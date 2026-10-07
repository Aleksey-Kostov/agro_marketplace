from pathlib import Path
from django.conf import settings

from django.core.paginator import Paginator
from django.shortcuts import (
    render,
    redirect,
    get_object_or_404,
)
from django.contrib.auth.decorators import login_required
from django.contrib import messages as django_messages
from django.contrib.auth import get_user_model
from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from django.db import transaction
from django.utils.http import url_has_allowed_host_and_scheme
from django.core.exceptions import ValidationError
from django.template.loader import render_to_string

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

import hashlib
import markdown

from .forms import MessageForm
from .models import (
    Message,
    MessageAttachment,
    MessageStatus,
    MessageReport,
    BlockedUser,
    MessageReaction,
)
from .services.attachment_validation import (
    validate_message_attachments as validate_attachments,
)
from .templatetags.message_tags_inbox import (
    get_user_conversations,
    _conversation_filter,
)
from ..accounts.models import AppUser
from ..buyers.models import BuyerItems
from ..sellers.models import SellerItems

User = get_user_model()


# ============================================================
# AJAX HELPER
# ============================================================

def is_ajax_request(request):
    return (
            request.headers.get('X-Requested-With')
            == 'XMLHttpRequest'
    )


# ============================================================
# WEBSOCKET GROUP
# ============================================================

def build_message_group_name(
        sender_id,
        recipient_id,
        product_type,
        product_id,
):
    """
    IMPORTANT:
    Тази функция трябва да е абсолютно същата и в consumers.py.

    Conversation identity:

        user 1
        user 2
        product_type
        product_id
    """

    user_ids = sorted(
        [
            int(sender_id),
            int(recipient_id),
        ]
    )

    raw = (
        f"{user_ids[0]}:{user_ids[1]}:"
        f"{product_type or ''}:{product_id or ''}"
    )

    digest = hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()[:32]

    return f"chat_{digest}"


# ============================================================
# WEBSOCKET ATTACHMENTS SERIALIZATION
# ============================================================

def serialize_message_attachments(message):
    """
    Server-authoritative representation of all new-style
    message attachments.

    One message currently allows only one attachment, but the
    response is intentionally a list so the frontend architecture
    can support multiple attachments later without changing the
    API shape.
    """

    attachments = []

    for attachment in message.attachments.all():

        url = None

        try:

            if attachment.file:
                url = attachment.file.url

        except Exception:

            url = None

        attachments.append(
            {
                'id': attachment.pk,
                'type': attachment.attachment_type,
                'url': url,
                'original_name': (
                        attachment.original_name
                        or ''
                ),
                'mime_type': (
                        attachment.mime_type
                        or ''
                ),
                'size': int(
                    attachment.size
                    or 0
                ),
            }
        )

    return attachments


# ============================================================
# WEBSOCKET SERIALIZATION
# ============================================================

def serialize_message_for_websocket(message):
    # --------------------------------------------------------
    # Legacy image/video URLs
    # --------------------------------------------------------
    #
    # These remain temporarily for backward compatibility with
    # old messages stored in Message.image / Message.video.
    #
    # New uploads use MessageAttachment.

    image_url = None
    video_url = None

    try:

        if message.image:
            image_url = message.image.url

    except Exception:

        image_url = None

    try:

        if message.video:
            video_url = message.video.url

    except Exception:

        video_url = None

    # --------------------------------------------------------
    # New attachment architecture
    # --------------------------------------------------------

    attachments = serialize_message_attachments(
        message
    )

    # --------------------------------------------------------
    # Reply
    # --------------------------------------------------------

    parent_message = getattr(
        message,
        'parent_message',
        None,
    )

    reply_data = None

    if parent_message:
        reply_data = {
            'id': parent_message.pk,
            'body': parent_message.body or '',
            'sender_id': parent_message.sender_id,
        }

    return {
        'id': message.pk,
        'sender_id': message.sender_id,
        'recipient_id': message.recipient_id,
        'body': message.body or '',
        'title': message.title or '',
        'product_type': message.product_type,
        'product_id': message.product_id,
        'timestamp': message.timestamp.isoformat(),
        'is_system': bool(message.is_system),
        'is_removed': bool(message.is_removed),

        # Legacy compatibility.
        'image_url': image_url,
        'video_url': video_url,

        # New canonical attachment API.
        'attachments': attachments,

        'reply': reply_data,
    }


# ============================================================
# GENERIC WEBSOCKET BROADCAST
# ============================================================

def broadcast_message_event(
        message,
        event_type,
        extra_data=None,
):
    """
    Изпраща realtime event до двамата участници
    в конкретната conversation.

    Никога не чупи HTTP request-а, ако WebSocket layer
    временно не работи.
    """

    if not message:
        return

    try:

        channel_layer = get_channel_layer()

        if channel_layer is None:
            return

        group_name = build_message_group_name(
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            product_type=message.product_type,
            product_id=message.product_id,
        )

        data = {
            'type': event_type,
            'message_id': message.pk,
        }

        if extra_data:
            data.update(extra_data)

        async_to_sync(
            channel_layer.group_send
        )(
            group_name,
            {
                'type': 'chat_message',
                'data': data,
            },
        )

    except Exception:
        return


# ============================================================
# MESSAGE CREATED
# ============================================================

def broadcast_message_created(message):
    """
    Broadcast за ново съобщение.
    """

    if not message:
        return

    try:

        channel_layer = get_channel_layer()

        if channel_layer is None:
            return

        group_name = build_message_group_name(
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            product_type=message.product_type,
            product_id=message.product_id,
        )

        async_to_sync(
            channel_layer.group_send
        )(
            group_name,
            {
                'type': 'chat_message',
                'data': {
                    'type': 'message_created',
                    'message': (
                        serialize_message_for_websocket(
                            message
                        )
                    ),
                },
            },
        )

    except Exception:
        return


# ============================================================
# MESSAGE STATUS
# ============================================================

def broadcast_message_status(
        message,
        status,
):
    """
    status:
        delivered
        read
        sent
    """

    if not message:
        return

    broadcast_message_event(
        message,
        'message_status_updated',
        {
            'status': status,
            'delivery_status': status,
        },
    )


# ============================================================
# MESSAGE REACTION
# ============================================================

def broadcast_message_reaction(
        message,
        reaction=None,
        active=None,
):
    """
    Изпраща reaction_updated към двата браузъра.

    Frontend-ът след това взема server-authoritative
    message fragment.
    """

    extra = {}

    if reaction is not None:
        extra['reaction'] = reaction

    if active is not None:
        extra['active'] = bool(active)

    broadcast_message_event(
        message,
        'reaction_updated',
        extra,
    )


# ============================================================
# MESSAGE DELETED
# ============================================================

def broadcast_message_deleted(message):
    """
    Съобщава на двата браузъра, че съобщението е изтрито.
    """

    broadcast_message_event(
        message,
        'message_deleted',
        {
            'is_removed': True,
        },
    )


# ============================================================
# MESSAGE UPDATED
# ============================================================

def broadcast_message_updated(message):
    """
    Използва се при edit.
    """

    broadcast_message_event(
        message,
        'message_updated',
    )


# ============================================================
# CONVERSATION HELPERS
# ============================================================

def _same_conversation(message_a, message_b):
    if not message_a or not message_b:
        return False

    participants_a = {
        message_a.sender_id,
        message_a.recipient_id,
    }

    participants_b = {
        message_b.sender_id,
        message_b.recipient_id,
    }

    if participants_a != participants_b:
        return False

    return (
            message_a.product_type
            == message_b.product_type
            and
            message_a.product_id
            == message_b.product_id
    )


# ============================================================
# GET CONVERSATION MESSAGES
# ============================================================

def get_conversation_messages(root_message):
    if not root_message:
        return []

    messages = (
        Message.objects
        .filter(
            _conversation_filter(root_message)
        )
        .select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message',
            'parent_message__sender__profile',
            'parent_message__recipient__profile',
        )
        .prefetch_related(
            'statuses',
            'reactions',
            'attachments',
        )
        .order_by(
            'timestamp',
            'pk',
        )
    )

    return list(messages)


# ============================================================
# MESSAGE VISIBILITY
# ============================================================

def is_message_visible_for_user(
        message,
        user,
):
    if not user or not user.is_authenticated:
        return False

    if (
            message.sender_id != user.pk
            and
            message.recipient_id != user.pk
    ):
        return False

    status = (
        MessageStatus.objects
        .filter(
            message=message,
            profile=user,
        )
        .first()
    )

    if status is None:
        return True

    return not status.is_deleted


# ============================================================
# GET CONVERSATION MESSAGES FOR USER
# ============================================================

def get_conversation_messages_for_user(
        root_message,
        user,
):
    if not root_message:
        return []

    if not user or not user.is_authenticated:
        return []

    messages = (
        Message.objects
        .filter(
            _conversation_filter(root_message)
        )
        .select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message',
            'parent_message__sender__profile',
            'parent_message__recipient__profile',
        )
        .prefetch_related(
            'statuses',
            'reactions',
            'attachments',
        )
        .order_by(
            'timestamp',
            'pk',
        )
    )

    message_ids = list(
        messages.values_list(
            'pk',
            flat=True,
        )
    )

    if not message_ids:
        return []

    deleted_ids = set(
        MessageStatus.objects
        .filter(
            profile=user,
            message_id__in=message_ids,
            is_deleted=True,
        )
        .values_list(
            'message_id',
            flat=True,
        )
    )

    return [
        message
        for message in messages
        if message.pk not in deleted_ids
    ]


# ============================================================
# DELIVERY / READ STATUS
# ============================================================

def add_message_delivery_status(
        messages,
        current_user,
):
    if not messages:
        return messages

    if not current_user or not current_user.is_authenticated:
        return messages

    message_ids = [
        message.pk
        for message in messages
    ]

    statuses = (
        MessageStatus.objects
        .filter(
            message_id__in=message_ids,
        )
        .select_related(
            'profile',
        )
    )

    status_map = {}

    for status in statuses:
        status_map[
            (
                status.message_id,
                status.profile_id,
            )
        ] = status

    for message in messages:

        message.delivery_status = None

        if message.is_removed:
            continue

        if message.sender_id != current_user.pk:
            continue

        recipient_status = status_map.get(
            (
                message.pk,
                message.recipient_id,
            )
        )

        if recipient_status is None:

            message.delivery_status = 'sent'

        elif recipient_status.is_read:

            message.delivery_status = 'read'

        else:

            message.delivery_status = 'delivered'

    return messages


# ============================================================
# ADMIN
# ============================================================

def get_admin_user():
    return (
            User.objects
            .filter(
                is_superuser=True,
            )
            .first()
            or
            User.objects
            .filter(
                is_staff=True,
            )
            .first()
    )


# ============================================================
# SAFE REDIRECT
# ============================================================

def safe_next_url(
        request,
        fallback='message-inbox',
):
    next_url = (
            request.POST.get('next')
            or
            request.GET.get('next')
            or
            request.META.get('HTTP_REFERER')
    )

    if next_url and url_has_allowed_host_and_scheme(
            next_url,
            allowed_hosts={
                request.get_host(),
            },
            require_https=request.is_secure(),
    ):
        return next_url

    return fallback


# ============================================================
# REACTION HELPERS
# ============================================================

def get_reaction_reactors(
        message,
        reaction,
):
    reactors = []

    reactions = (
        message.reactions
        .filter(
            reaction=reaction,
        )
        .select_related(
            'user__profile',
        )
    )

    for reaction_obj in reactions:

        user = reaction_obj.user

        photo = ''
        username = user.username

        profile = getattr(
            user,
            'profile',
            None,
        )

        if profile:

            try:

                if profile.profile_photo:
                    photo = profile.profile_photo.url

            except Exception:

                photo = ''

            username = (
                    profile.username_in_marketplace
                    or user.username
            )

        reactors.append(
            {
                'id': user.pk,
                'photo': (
                        photo
                        or
                        '/static/images/profile_picture.webp'
                ),
                'username': username,
            }
        )

    return reactors


def is_valid_reaction(reaction):
    return reaction in (
        MessageReaction.LIKE,
        MessageReaction.HEART,
    )


# ============================================================
# MESSAGE CONTENT VALIDATION
# ============================================================

def message_has_content(request):
    body = (
            request.POST.get('body')
            or ''
    ).strip()

    image_file = request.FILES.get('image')
    video_file = request.FILES.get('video')
    audio_file = request.FILES.get('audio')
    generic_file = request.FILES.get('file')

    return bool(
        body
        or image_file
        or video_file
        or audio_file
        or generic_file
    )


def validate_message_attachments(request):
    """
    Central server-side validation for chat attachments.

    The actual validation rules live in:
        services/attachment_validation.py
    """

    return validate_attachments(
        image_file=request.FILES.get('image'),
        video_file=request.FILES.get('video'),
        audio_file=request.FILES.get('audio'),
        generic_file=request.FILES.get('file'),
    )



# ============================================================
# CREATE MESSAGE ATTACHMENT
# ============================================================

def create_message_attachment(
        *,
        message,
        file,
        attachment_type,
):
    """
    Creates one MessageAttachment and stores the uploaded file.

    Local storage:
        original filename is passed normally.

    Cloudinary storage:
        a special storage name is passed so the storage knows:

            attachment_type
            message_id

        Example:

            cloudinary/video/123/movie.mp4

        The Cloudinary storage then uploads the file using
        the existing cloudinary_attachments service.
    """

    if not file:
        return None

    original_name = Path(
        file.name or "attachment"
    ).name

    attachment = MessageAttachment(
        message=message,
        original_name=original_name,
        mime_type=(
                getattr(
                    file,
                    "content_type",
                    "",
                )
                or ""
        ).lower().strip(),
        size=int(
            getattr(
                file,
                "size",
                0,
            )
            or 0
        ),
        attachment_type=attachment_type,
    )

    # --------------------------------------------------------
    # SELECT STORAGE MODE
    # --------------------------------------------------------

    storage_name = getattr(
        settings,
        "MESSAGE_ATTACHMENT_STORAGE",
        "local",
    )

    storage_name = (
        str(storage_name)
        .strip()
        .lower()
    )

    # --------------------------------------------------------
    # BUILD STORAGE NAME
    # --------------------------------------------------------

    if storage_name == "cloudinary":

        storage_filename = (
            f"cloudinary/"
            f"{attachment_type}/"
            f"{message.pk}/"
            f"{original_name}"
        )

    else:

        storage_filename = original_name

    try:

        attachment.file.save(
            storage_filename,
            file,
            save=False,
        )

        # ----------------------------------------------------
        # CLOUDINARY METADATA
        # ----------------------------------------------------
        #
        # CloudinaryMessageAttachmentStorage returns:
        #
        # cloudinary:<resource_type>:<public_id>:<version>
        #
        # Store the useful parts explicitly in the model too.

        if storage_name == "cloudinary":

            stored_name = str(
                attachment.file.name
                or ""
            )

            parts = stored_name.split(
                ":",
                3,
            )

            if len(parts) != 4:
                raise ValueError(
                    "Invalid Cloudinary attachment "
                    "reference returned by storage."
                )

            (
                prefix,
                resource_type,
                public_id,
                _version,
            ) = parts

            if prefix != "cloudinary":
                raise ValueError(
                    "Invalid Cloudinary attachment "
                    "reference prefix."
                )

            attachment.cloudinary_public_id = (
                public_id
            )

            attachment.cloudinary_resource_type = (
                resource_type
            )

        attachment.save()

    except Exception:

        try:

            if attachment.file:
                attachment.file.delete(
                    save=False
                )
        except Exception:
            pass
        raise
    return attachment


# ============================================================
# CREATE MESSAGE ATTACHMENT FROM REQUEST
# ============================================================

def create_attachment_from_request(
        *,
        request,
        message,
):
    """
    Finds the single validated attachment in the request
    and creates the corresponding MessageAttachment.
    """

    image_file = request.FILES.get('image')
    video_file = request.FILES.get('video')
    audio_file = request.FILES.get('audio')
    generic_file = request.FILES.get('file')

    supplied = [
        ('image', image_file),
        ('video', video_file),
        ('audio', audio_file),
        ('file', generic_file),
    ]

    attachments = [
        item
        for item in supplied
        if item[1] is not None
    ]

    if not attachments:
        return None

    if len(attachments) != 1:
        raise ValidationError(
            "Please attach only one file per message."
        )

    attachment_type, file = attachments[0]

    return create_message_attachment(
        message=message,
        file=file,
        attachment_type=attachment_type,
    )


# ============================================================
# DELETE STORED ATTACHMENT FILE
# ============================================================

def delete_stored_attachment_file(
        attachment,
):
    """
    Deletes the physical file represented by one
    MessageAttachment.

    The DB object itself may already be rolled back, therefore
    this helper works directly with the attachment instance.
    """

    if not attachment:
        return

    try:

        if attachment.file:
            attachment.file.delete(
                save=False
            )

    except Exception:
        pass


# ============================================================
# DELETE STORED ATTACHMENTS
# ============================================================

def delete_message_attachments(message):
    """
    Deletes physical attachment files for a globally deleted
    message.

    This function must NOT be called for per-user conversation
    deletion via MessageStatus.is_deleted.
    """

    attachments = list(
        message.attachments.all()
    )

    for attachment in attachments:
        delete_stored_attachment_file(
            attachment
        )


# ============================================================
# SYSTEM MESSAGE
# ============================================================

def send_system_message(
        recipient,
        title,
        body,
):
    if not recipient:
        return

    admin = get_admin_user()

    if not admin:
        return

    if admin == recipient:
        return

    message = Message.objects.create(
        sender=admin,
        recipient=recipient,
        title=title,
        body=markdown.markdown(body),
        is_system=True,
        parent_message=None,
        product_type=None,
        product_id=None,
    )

    MessageStatus.objects.create(
        message=message,
        profile=recipient,
        is_read=False,
    )

    MessageStatus.objects.create(
        message=message,
        profile=admin,
        is_read=True,
    )

    broadcast_message_created(
        message
    )


# ============================================================
# SEND MESSAGE
# ============================================================

@login_required
def send_message(
        request,
        pk=None,
):
    recipient = (
        get_object_or_404(
            AppUser,
            pk=pk,
        )
        if pk
        else None
    )

    product_id = request.GET.get(
        'product_id'
    )

    product_type = request.GET.get(
        'product_type'
    )

    if request.method == 'POST':
        product_id = (
                request.POST.get('product_id')
                or
                product_id
        )

        product_type = (
                request.POST.get('product_type')
                or
                product_type
        )

    product = None

    # ========================================================
    # PRODUCT
    # ========================================================

    if recipient and product_id:

        if product_type == 'seller':

            product = (
                SellerItems.objects
                .filter(
                    pk=product_id,
                    profile__user=recipient,
                )
                .first()
            )

        elif product_type == 'buyer':

            product = (
                BuyerItems.objects
                .filter(
                    pk=product_id,
                    profile__user=recipient,
                )
                .first()
            )

    # ========================================================
    # BLOCK STATUS
    # ========================================================

    is_blocked = False
    is_blocked_by_other = False

    if recipient:
        is_blocked = (
            BlockedUser.objects
            .filter(
                blocker=request.user,
                blocked=recipient,
            )
            .exists()
        )

        is_blocked_by_other = (
            BlockedUser.objects
            .filter(
                blocker=recipient,
                blocked=request.user,
            )
            .exists()
        )

    # ========================================================
    # POST
    # ========================================================

    if request.method == 'POST':

        if not recipient:

            if is_ajax_request(request):
                return JsonResponse(
                    {
                        'ok': False,
                        'error': 'Recipient is required.',
                    },
                    status=400,
                )

            django_messages.error(
                request,
                "Recipient is required.",
            )

            return redirect(
                'message-inbox',
            )

        if is_blocked_by_other:

            if is_ajax_request(request):
                return JsonResponse(
                    {
                        'ok': False,
                        'error': (
                            'You cannot send messages to this user '
                            'because you have been blocked.'
                        ),
                    },
                    status=403,
                )

            django_messages.error(
                request,
                "You cannot send messages to this user because you have been blocked.",
            )

            return redirect(
                'message-inbox',
            )

        if is_blocked:

            if is_ajax_request(request):
                return JsonResponse(
                    {
                        'ok': False,
                        'error': (
                            'You cannot send messages to a blocked user. '
                            'Please unblock them first.'
                        ),
                    },
                    status=403,
                )

            django_messages.error(
                request,
                "You cannot send messages to a blocked user. Please unblock them first.",
            )

            return redirect(
                'message-inbox',
            )

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            if not message_has_content(request):

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': 'Message cannot be empty.',
                        },
                        status=400,
                    )

                django_messages.error(
                    request,
                    "Message cannot be empty.",
                )

                return redirect(
                    'message-inbox',
                )

            try:

                attachment_result = (
                    validate_message_attachments(
                        request
                    )
                )

            except ValidationError as exc:

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': str(exc),
                        },
                        status=400,
                    )

                django_messages.error(
                    request,
                    str(exc),
                )

                return redirect(
                    'message-inbox',
                )

            message = form.save(
                commit=False
            )

            # =================================================
            # NEW ATTACHMENT ARCHITECTURE
            # =================================================
            #
            # New image/video uploads are stored only in
            # MessageAttachment.
            #
            # The legacy Message.image / Message.video fields
            # remain available for old messages.
            #
            # This prevents storing the same new upload twice.

            if attachment_result:

                attachment_type, _ = (
                    attachment_result
                )

                if attachment_type == 'image':

                    message.image = None

                elif attachment_type == 'video':

                    message.video = None

            message.sender = request.user
            message.recipient = recipient

            # =================================================
            # PRODUCT
            # =================================================

            if product:

                message.product_type = product_type
                message.product_id = product.pk

            else:

                message.product_type = None
                message.product_id = None

            # =================================================
            # TITLE
            # =================================================

            if product and getattr(
                    product,
                    'title',
                    None,
            ):

                message.title = product.title

            else:

                message.title = "Direct conversation"

            # =================================================
            # REPLY
            # =================================================

            reply_to_id = (
                    request.POST.get('reply_to')
                    or ''
            ).strip()

            message.parent_message = None

            if reply_to_id.isdigit():

                parent_message = (
                    Message.objects
                    .select_related(
                        'sender',
                        'recipient',
                    )
                    .filter(
                        pk=int(reply_to_id),
                    )
                    .first()
                )

                if parent_message:

                    temp_message = Message(
                        sender=request.user,
                        recipient=recipient,
                        product_type=message.product_type,
                        product_id=message.product_id,
                    )

                    if _same_conversation(
                            temp_message,
                            parent_message,
                    ):
                        message.parent_message = (
                            parent_message
                        )

            # =================================================
            # MARKDOWN
            # =================================================

            if message.body:
                message.body = markdown.markdown(
                    message.body
                )

            # =================================================
            # SAVE MESSAGE + ATTACHMENT
            # =================================================

            created_attachment = None

            try:

                with transaction.atomic():

                    message.save()

                    created_attachment = (
                        create_attachment_from_request(
                            request=request,
                            message=message,
                        )
                    )

                    MessageStatus.objects.create(
                        message=message,
                        profile=recipient,
                        is_read=False,
                    )

                    MessageStatus.objects.create(
                        message=message,
                        profile=request.user,
                        is_read=True,
                    )

            except Exception:

                # Important:
                #
                # transaction rollback removes the DB row,
                # therefore message.attachments cannot be used
                # here. We must delete the physical file from
                # the attachment instance we already created.

                delete_stored_attachment_file(
                    created_attachment
                )

                raise

            # =================================================
            # REFRESH MESSAGE + ATTACHMENTS
            # =================================================

            message = (
                Message.objects
                .select_related(
                    'sender__profile',
                    'recipient__profile',
                    'parent_message',
                    'parent_message__sender__profile',
                    'parent_message__recipient__profile',
                )
                .prefetch_related(
                    'statuses',
                    'reactions',
                    'attachments',
                )
                .get(
                    pk=message.pk
                )
            )

            # =================================================
            # WEBSOCKET
            # =================================================

            broadcast_message_created(
                message
            )

            broadcast_message_status(
                message,
                'delivered',
            )

            # =================================================
            # AJAX
            # =================================================

            if is_ajax_request(request):
                add_message_delivery_status(
                    [message],
                    request.user,
                )

                html = render_to_string(
                    'messages/_message.html',
                    {
                        'item': message,
                    },
                    request=request,
                )

                return JsonResponse(
                    {
                        'ok': True,
                        'message_id': message.pk,
                        'html': html,
                    }
                )

            return redirect(
                'read-message',
                pk=message.pk,
            )

        # =====================================================
        # FORM ERRORS
        # =====================================================

        if is_ajax_request(request):

            errors = {}

            for (
                    field_name,
                    field_errors,
            ) in form.errors.items():
                errors[field_name] = [
                    str(error)
                    for error in field_errors
                ]

            return JsonResponse(
                {
                    'ok': False,
                    'error': (
                        'Please correct the form errors.'
                    ),
                    'errors': errors,
                },
                status=400,
            )

        django_messages.error(
            request,
            "Please correct the form errors.",
        )

        return redirect(
            'message-inbox',
        )

    # =========================================================
    # GET
    # =========================================================

    form = MessageForm()

    return render(
        request,
        'messages/message-send.html',
        {
            'form': form,
            'recipient': recipient,
            'product': product,
            'product_id': (
                product.pk
                if product
                else None
            ),
            'product_type': (
                product_type
                if product
                else None
            ),
            'is_blocked': is_blocked,
            'is_blocked_by_other': is_blocked_by_other,
        },
    )


# ============================================================
# MESSAGE HTML FRAGMENT
# ============================================================

@login_required
def message_fragment(
        request,
        pk,
):
    message = get_object_or_404(
        Message.objects
        .select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message__sender__profile',
            'parent_message__recipient__profile',
        )
        .prefetch_related(
            'statuses',
            'reactions',
            'attachments',
        ),
        pk=pk,
    )

    current_user = request.user

    # ========================================================
    # AUTHORIZATION
    # ========================================================

    if (
            message.sender_id != current_user.pk
            and
            message.recipient_id != current_user.pk
    ):
        return HttpResponse(
            "Not authorized",
            status=403,
        )

    # ========================================================
    # VISIBILITY
    # ========================================================

    if not is_message_visible_for_user(
            message,
            current_user,
    ):
        return HttpResponse(
            "Not found",
            status=404,
        )

    # ========================================================
    # DELIVERY
    # ========================================================

    add_message_delivery_status(
        [message],
        current_user,
    )

    # ========================================================
    # HTML
    # ========================================================

    html = render_to_string(
        'messages/_message.html',
        {
            'item': message,
        },
        request=request,
    )

    return JsonResponse(
        {
            'ok': True,
            'message_id': message.pk,
            'html': html,
        }
    )


# ============================================================
# READ MESSAGE + REPLY
# ============================================================

@login_required
def read_message(
        request,
        pk,
):
    message = get_object_or_404(
        Message.objects
        .select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message',
        )
        .prefetch_related(
            'attachments',
        ),
        pk=pk,
    )

    current_user = request.user

    # ========================================================
    # AUTHORIZATION
    # ========================================================

    if (
            message.sender_id != current_user.pk
            and
            message.recipient_id != current_user.pk
    ):
        return HttpResponse(
            "Not authorized",
            status=403,
        )

    # ========================================================
    # CONVERSATION
    # ========================================================

    conversation_messages = (
        get_conversation_messages_for_user(
            message,
            current_user,
        )
    )

    if not conversation_messages:
        return redirect(
            'message-inbox'
        )

    root_message = conversation_messages[0]

    # ========================================================
    # MARK READ
    # ========================================================

    unread_statuses = list(
        MessageStatus.objects
        .filter(
            message__in=conversation_messages,
            profile=current_user,
            is_deleted=False,
            is_read=False,
            message__is_removed=False,
        )
        .select_related(
            'message',
        )
    )

    read_message_objects = []

    with transaction.atomic():

        for status in unread_statuses:
            status.mark_as_read()

            read_message_objects.append(
                status.message
            )

    # ========================================================
    # REALTIME READ EVENTS
    # ========================================================

    already_sent = set()

    for read_msg in read_message_objects:

        if read_msg.pk in already_sent:
            continue

        already_sent.add(
            read_msg.pk
        )

        broadcast_message_status(
            read_msg,
            'read',
        )

    # ========================================================
    # OTHER USER
    # ========================================================

    if message.sender_id == current_user.pk:

        other_user = message.recipient

    else:

        other_user = message.sender

    # ========================================================
    # BLOCK STATUS
    # ========================================================

    is_blocked = False
    is_blocked_by_other = False

    if other_user:
        is_blocked = (
            BlockedUser.objects
            .filter(
                blocker=current_user,
                blocked=other_user,
            )
            .exists()
        )

        is_blocked_by_other = (
            BlockedUser.objects
            .filter(
                blocker=other_user,
                blocked=current_user,
            )
            .exists()
        )

    # ========================================================
    # SYSTEM
    # ========================================================

    is_system = bool(
        getattr(
            message,
            'is_system',
            False,
        )
    )

    # ========================================================
    # POST REPLY
    # ========================================================

    if request.method == 'POST' and not is_system:

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            if not message_has_content(request):

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': (
                                'Message cannot be empty.'
                            ),
                        },
                        status=400,
                    )

                django_messages.error(
                    request,
                    "Message cannot be empty.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            try:

                attachment_result = (
                    validate_message_attachments(
                        request
                    )
                )

            except ValidationError as exc:

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': str(exc),
                        },
                        status=400,
                    )

                django_messages.error(
                    request,
                    str(exc),
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            # =================================================
            # RECIPIENT
            # =================================================

            recipient = (
                message.recipient
                if message.sender_id
                   == current_user.pk
                else message.sender
            )

            if not recipient:

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': (
                                'Recipient not found.'
                            ),
                        },
                        status=400,
                    )

                django_messages.error(
                    request,
                    "Recipient not found.",
                )

                return redirect(
                    'message-inbox'
                )

            # =================================================
            # BLOCK CHECK
            # =================================================

            if (
                    BlockedUser.objects
                            .filter(
                        blocker=recipient,
                        blocked=current_user,
                    )
                            .exists()
            ):

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': (
                                'You cannot send messages to this user '
                                'because you have been blocked.'
                            ),
                        },
                        status=403,
                    )

                django_messages.error(
                    request,
                    "You cannot send messages to this user because you have been blocked.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            if (
                    BlockedUser.objects
                            .filter(
                        blocker=current_user,
                        blocked=recipient,
                    )
                            .exists()
            ):

                if is_ajax_request(request):
                    return JsonResponse(
                        {
                            'ok': False,
                            'error': (
                                'You cannot send messages to a blocked user. '
                                'Please unblock them first.'
                            ),
                        },
                        status=403,
                    )

                django_messages.error(
                    request,
                    "You cannot send messages to a blocked user. Please unblock them first.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            # =================================================
            # REPLY TARGET
            # =================================================

            reply_to_id = (
                    request.POST.get('reply_to')
                    or ''
            ).strip()

            reply_to = None

            if reply_to_id.isdigit():
                reply_to = (
                    Message.objects
                    .select_related(
                        'sender',
                        'recipient',
                    )
                    .filter(
                        pk=int(reply_to_id),
                    )
                    .first()
                )

            if reply_to is not None:

                if not _same_conversation(
                        message,
                        reply_to,
                ):
                    reply_to = None

            # =================================================
            # CREATE REPLY
            # =================================================

            reply = form.save(
                commit=False
            )

            # New image/video uploads are stored only in
            # MessageAttachment.

            if attachment_result:

                attachment_type, _ = (
                    attachment_result
                )

                if attachment_type == 'image':

                    reply.image = None

                elif attachment_type == 'video':

                    reply.video = None

            reply.sender = current_user
            reply.recipient = recipient

            reply.product_type = (
                message.product_type
            )

            reply.product_id = (
                message.product_id
            )

            reply.title = (
                    message.title
                    or
                    "Direct conversation"
            )

            reply.parent_message = reply_to

            if reply.body:
                reply.body = markdown.markdown(
                    reply.body
                )

            # =================================================
            # SAVE REPLY + ATTACHMENT
            # =================================================

            created_attachment = None

            try:

                with transaction.atomic():

                    reply.save()

                    created_attachment = (
                        create_attachment_from_request(
                            request=request,
                            message=reply,
                        )
                    )

                    MessageStatus.objects.create(
                        message=reply,
                        profile=recipient,
                        is_read=False,
                    )

                    MessageStatus.objects.create(
                        message=reply,
                        profile=current_user,
                        is_read=True,
                    )

            except Exception:

                delete_stored_attachment_file(
                    created_attachment
                )

                raise

            # =================================================
            # REFRESH ATTACHMENTS
            # =================================================

            reply = (
                Message.objects
                .select_related(
                    'sender__profile',
                    'recipient__profile',
                    'parent_message',
                    'parent_message__sender__profile',
                    'parent_message__recipient__profile',
                )
                .prefetch_related(
                    'statuses',
                    'reactions',
                    'attachments',
                )
                .get(
                    pk=reply.pk
                )
            )

            # =================================================
            # WEBSOCKET
            # =================================================

            broadcast_message_created(
                reply
            )

            broadcast_message_status(
                reply,
                'delivered',
            )

            # =================================================
            # AJAX
            # =================================================

            if is_ajax_request(request):
                add_message_delivery_status(
                    [reply],
                    current_user,
                )

                html = render_to_string(
                    'messages/_message.html',
                    {
                        'item': reply,
                    },
                    request=request,
                )

                return JsonResponse(
                    {
                        'ok': True,
                        'message_id': reply.pk,
                        'html': html,
                    }
                )

            return redirect(
                'read-message',
                pk=reply.pk,
            )

        # =====================================================
        # FORM ERRORS
        # =====================================================

        if is_ajax_request(request):

            errors = {}

            for (
                    field_name,
                    field_errors,
            ) in form.errors.items():
                errors[field_name] = [
                    str(error)
                    for error in field_errors
                ]

            return JsonResponse(
                {
                    'ok': False,
                    'error': (
                        'Please correct the form errors.'
                    ),
                    'errors': errors,
                },
                status=400,
            )

        django_messages.error(
            request,
            "Please correct the form errors.",
        )

        return redirect(
            'read-message',
            pk=pk,
        )

    else:

        form = MessageForm()

    # ========================================================
    # DELIVERY / READ
    # ========================================================

    conversation_messages = (
        add_message_delivery_status(
            conversation_messages,
            current_user,
        )
    )

    last_message = (
        conversation_messages[-1]
        if conversation_messages
        else message
    )

    # ========================================================
    # PRODUCT (от обява, ако разговорът е по listing)
    # ========================================================

    product = None
    product_is_active = False

    if root_message.product_id and root_message.product_type:
        if root_message.product_type == 'seller':
            product = (
                SellerItems.objects
                .filter(pk=root_message.product_id)
                .first()
            )
        elif root_message.product_type == 'buyer':
            product = (
                BuyerItems.objects
                .filter(pk=root_message.product_id)
                .first()
            )

        if product is not None:
            exp = getattr(product, 'expiration_date', None)
            if exp is not None:
                from django.utils import timezone
                now = timezone.now()
                if timezone.is_naive(exp):
                    exp = timezone.make_aware(exp, timezone.get_current_timezone())
                product_is_active = exp > now
            else:
                product_is_active = True


    # ========================================================
    # RENDER
    # ========================================================

    return render(
        request,
        'messages/message-read.html',
        {
            'message': message,
            'root_message': root_message,
            'conversation_messages': (
                conversation_messages
            ),
            'product': product,
            'product_is_active': product_is_active,
            'last_message': last_message,
            'form': form,
            'other_user': other_user,
            'is_blocked': is_blocked,
            'is_blocked_by_other': (
                is_blocked_by_other
            ),
            'is_system': is_system,
        },
    )


# ============================================================
# DELETE ONE MESSAGE
# ============================================================

@login_required
def delete_one_message(
        request,
        pk,
):
    msg = get_object_or_404(
        Message.objects
        .select_related(
            'sender',
            'recipient',
        )
        .prefetch_related(
            'attachments',
        ),
        pk=pk,
    )

    if msg.sender_id != request.user.pk:

        if is_ajax_request(request):
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Not allowed',
                },
                status=403,
            )

        return HttpResponse(
            "Not allowed",
            status=403,
        )

    if request.method != 'POST':

        if is_ajax_request(request):
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'POST required',
                },
                status=405,
            )

        return HttpResponse(
            "POST required",
            status=405,
        )

    was_removed = bool(
        msg.is_removed
    )

    if not was_removed:
        delete_message_attachments(
            msg
        )

        msg.is_removed = True

        msg.save(
            update_fields=[
                'is_removed',
            ]
        )

    MessageStatus.objects.filter(
        message=msg,
        profile_id=msg.recipient_id,
    ).update(
        is_read=True,
    )

    if not was_removed:
        broadcast_message_deleted(
            msg
        )

    if is_ajax_request(request):
        return JsonResponse(
            {
                'ok': True,
                'message_id': msg.pk,
                'deleted': True,
            }
        )

    return redirect(
        safe_next_url(request)
    )


# ============================================================
# DELETE CONVERSATION FOR CURRENT USER
# ============================================================

@login_required
def delete_message(
        request,
        pk,
):
    message = get_object_or_404(
        Message,
        pk=pk,
    )

    user = request.user

    if (
            message.sender_id != user.pk
            and
            message.recipient_id != user.pk
    ):
        return HttpResponse(
            "Not allowed",
            status=403,
        )

    filter_type = (
            request.POST.get('filter')
            or
            request.GET.get('filter')
            or
            'inbox'
    )

    if filter_type not in (
            'inbox',
            'sent',
            'unread',
            'all',
    ):
        filter_type = 'inbox'

    conversation = list(
        Message.objects
        .filter(
            _conversation_filter(message)
        )
        .order_by(
            'timestamp',
            'pk',
        )
    )

    if request.method == 'GET':
        return render(
            request,
            'messages/message-delete.html',
            {
                'message': message,
                'root_message': (
                    conversation[0]
                    if conversation
                    else message
                ),
                'messages_count': len(
                    conversation
                ),
                'filter_type': filter_type,
            },
        )

    if request.method != 'POST':
        return HttpResponse(
            "Method not allowed",
            status=405,
        )

    message_ids = [
        msg.pk
        for msg in conversation
    ]

    if message_ids:
        with transaction.atomic():
            MessageStatus.objects.filter(
                message_id__in=message_ids,
                profile=user,
            ).update(
                is_deleted=True,
                is_read=True,
            )

    if is_ajax_request(request):
        return JsonResponse(
            {
                'ok': True,
                'deleted': True,
            }
        )

    return redirect(
        f"{reverse('message-inbox')}"
        f"?filter={filter_type}"
    )


# ============================================================
# REACT MESSAGE
# ============================================================

@login_required
def react_message(
        request,
        pk,
        reaction,
):
    if request.method != 'POST':
        return JsonResponse(
            {
                'ok': False,
                'error': 'POST required',
            },
            status=405,
        )

    msg = get_object_or_404(
        Message.objects
        .select_related(
            'sender',
            'recipient',
        )
        .prefetch_related(
            'attachments',
        ),
        pk=pk,
    )

    if (
            msg.sender_id != request.user.pk
            and
            msg.recipient_id != request.user.pk
    ):
        return JsonResponse(
            {
                'ok': False,
                'error': 'Not allowed',
            },
            status=403,
        )

    if msg.is_removed:
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'Message has been deleted.'
                ),
            },
            status=400,
        )

    if getattr(
            msg,
            'is_system',
            False,
    ):
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'System messages cannot be reacted to.'
                ),
            },
            status=400,
        )

    if not is_valid_reaction(
            reaction
    ):
        return JsonResponse(
            {
                'ok': False,
                'error': 'Invalid reaction.',
            },
            status=400,
        )

    with transaction.atomic():

        existing = (
            MessageReaction.objects
            .filter(
                message=msg,
                user=request.user,
                reaction=reaction,
            )
            .first()
        )

        if existing:

            existing.delete()

            active = False

        else:

            MessageReaction.objects.create(
                message=msg,
                user=request.user,
                reaction=reaction,
            )

            active = True

    reactors = get_reaction_reactors(
        msg,
        reaction,
    )

    broadcast_message_reaction(
        msg,
        reaction=reaction,
        active=active,
    )

    add_message_delivery_status(
        [msg],
        request.user,
    )

    html = render_to_string(
        'messages/_message.html',
        {
            'item': msg,
        },
        request=request,
    )

    return JsonResponse(
        {
            'ok': True,
            'reaction': reaction,
            'active': active,
            'message_id': msg.pk,
            'reactors': reactors,
            'html': html,
        }
    )


# ============================================================
# REPORT
# ============================================================

@login_required
def report_message(
        request,
        pk,
):
    message = get_object_or_404(
        Message,
        pk=pk,
    )

    if (
            message.sender_id != request.user.pk
            and
            message.recipient_id != request.user.pk
    ):
        return HttpResponse(
            "Not authorized",
            status=403,
        )

    if request.method != 'POST':
        return redirect(
            'read-message',
            pk=message.pk,
        )

    reason = (
        request.POST.get(
            'reason',
            '',
        )
        .strip()
    )

    report, created = (
        MessageReport.objects
        .get_or_create(
            message=message,
            reported_by=request.user,
            defaults={
                'reason': reason,
            },
        )
    )

    if created:

        send_system_message(
            recipient=request.user,
            title="Report received",
            body=(
                "Thank you for your report.<br><br>"
                "Our team will review the content for appropriateness "
                "and take action if needed.<br><br>"
                "<em>This is an automated message. Replies are disabled.</em>"
            ),
        )

        django_messages.success(
            request,
            "Your report has been submitted successfully.",
        )

    else:

        django_messages.info(
            request,
            "You have already reported this message.",
        )

    return redirect(
        'message-inbox'
    )


# ============================================================
# BLOCK USER
# ============================================================

@login_required
def block_user(
        request,
        pk,
):
    if request.method != 'POST':
        return HttpResponse(
            "POST required",
            status=405,
        )

    user_to_block = get_object_or_404(
        User,
        pk=pk,
    )

    if user_to_block == request.user:
        django_messages.error(
            request,
            "You cannot block yourself.",
        )

        return redirect(
            safe_next_url(request)
        )

    obj, created = (
        BlockedUser.objects
        .get_or_create(
            blocker=request.user,
            blocked=user_to_block,
        )
    )

    if created:

        django_messages.success(
            request,
            (
                f"You have successfully blocked "
                f"{user_to_block.username}."
            ),
        )

    else:

        django_messages.info(
            request,
            "This user is already blocked.",
        )

    return redirect(
        safe_next_url(request)
    )


# ============================================================
# UNBLOCK USER
# ============================================================

@login_required
def unblock_user(
        request,
        pk,
):
    if request.method != 'POST':
        return HttpResponse(
            "POST required",
            status=405,
        )

    user_to_unblock = get_object_or_404(
        User,
        pk=pk,
    )

    deleted, _ = (
        BlockedUser.objects
        .filter(
            blocker=request.user,
            blocked=user_to_unblock,
        )
        .delete()
    )

    if deleted:

        django_messages.success(
            request,
            (
                f"You have successfully unblocked "
                f"{user_to_unblock.username}."
            ),
        )

    else:

        django_messages.info(
            request,
            "This user was not blocked.",
        )

    return redirect(
        safe_next_url(request)
    )


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(
        request,
):
    filter_type = request.GET.get(
        'filter',
        'inbox',
    )

    if filter_type not in (
            'inbox',
            'sent',
            'unread',
            'all',
    ):
        filter_type = 'inbox'

    conversations = get_user_conversations(
        request.user,
        filter_type,
    )

    paginator = Paginator(
        conversations,
        5,
    )

    page_obj = paginator.get_page(
        request.GET.get('page')
    )

    return render(
        request,
        'messages/message-inbox.html',
        {
            'conversations': page_obj,
            'filter_type': filter_type,
        },
    )


# ============================================================
# EDIT ONE MESSAGE
# ============================================================

@login_required
def edit_message(
        request,
        pk,
):
    message = get_object_or_404(
        Message.objects
        .select_related(
            'sender',
            'recipient',
        )
        .prefetch_related(
            'attachments',
        ),
        pk=pk,
    )

    if message.sender != request.user:
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'You can only edit your own messages.'
                ),
            },
            status=403,
        )

    if message.is_system:
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'System messages cannot be edited.'
                ),
            },
            status=403,
        )

    if message.is_removed:
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'Deleted messages cannot be edited.'
                ),
            },
            status=400,
        )

    if request.method != 'POST':
        return JsonResponse(
            {
                'ok': False,
                'error': 'POST required.',
            },
            status=405,
        )

    new_body = (
            request.POST.get('body')
            or ''
    ).strip()

    if not new_body:
        return JsonResponse(
            {
                'ok': False,
                'error': (
                    'Message cannot be empty.'
                ),
            },
            status=400,
        )

    message.body = markdown.markdown(
        new_body,
    )

    message.save(
        update_fields=[
            'body',
        ]
    )

    broadcast_message_updated(
        message
    )

    add_message_delivery_status(
        [message],
        request.user,
    )

    html = render_to_string(
        'messages/_message.html',
        {
            'item': message,
        },
        request=request,
    )

    return JsonResponse(
        {
            'ok': True,
            'message_id': message.pk,
            'body': message.body,
            'html': html,
        }
    )
