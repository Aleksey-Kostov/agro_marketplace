from django.core.paginator import Paginator
from django.shortcuts import render, redirect, get_object_or_404
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
    MessageStatus,
    MessageReport,
    BlockedUser,
    MessageReaction,
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
# CONSTANTS
# ============================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024


# ============================================================
# WEBSOCKET HELPERS
# ============================================================

def build_message_group_name(
        sender_id,
        recipient_id,
        product_type,
        product_id,
):
    """
    Builds the exact same WebSocket group name used by
    MessageConsumer.

    Conversation identity:

        participants
        +
        product_type
        +
        product_id

    Direction does not matter.
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


def serialize_message_for_websocket(message):
    """
    Converts a Message instance into JSON-safe data for
    WebSocket delivery.

    Attachments are included because HTTP uploads are already
    handled before this function is called.
    """

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
        'image_url': image_url,
        'video_url': video_url,
        'reply': reply_data,
    }


def broadcast_message_created(message):
    """
    Broadcasts a newly created message to all WebSocket clients
    connected to this exact conversation.

    This function is intentionally synchronous because it is called
    from normal Django views.
    """

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
                    'message': serialize_message_for_websocket(
                        message
                    ),
                },
            },
        )

    except Exception:
        """
        WebSocket delivery must never break normal HTTP message
        creation.

        The database message has already been saved successfully.
        If Redis/WebSocket delivery fails, the message remains stored.
        """
        return


# ============================================================
# CONVERSATION HELPERS
# ============================================================

def _same_conversation(message_a, message_b):
    """
    Проверява дали две съобщения принадлежат към една и съща
    conversation.

    Conversation identity:

        User A
        User B
        product_type
        product_id

    Посоката няма значение.

    A -> B
    B -> A

    са една и съща conversation.
    """

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
            message_a.product_type == message_b.product_type
            and
            message_a.product_id == message_b.product_id
    )


# ============================================================
# GET CONVERSATION MESSAGES
# ============================================================

def get_conversation_messages(root_message):
    """
    Връща всички messages от конкретната conversation.

    Conversation се определя от:

        participants
        +
        product_type
        +
        product_id

    parent_message НЕ определя conversation-а.

    is_removed=True остава в conversation-а.
    """

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

def is_message_visible_for_user(message, user):
    """
    Съобщението е видимо ако:

        - user е sender или recipient
        - user няма MessageStatus.is_deleted=True

    Message.is_removed НЕ скрива placeholder-а.
    """

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

def get_conversation_messages_for_user(root_message, user):
    """
    Връща всички messages от конкретната conversation,
    които текущият user може да вижда.

    is_removed=True messages остават.

    MessageStatus.is_deleted=True се скрива само
    за конкретния user.
    """

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

    visible_messages = [
        message
        for message in messages
        if message.pk not in deleted_ids
    ]

    return visible_messages


# ============================================================
# DELIVERY / READ STATUS
# ============================================================

def add_message_delivery_status(messages, current_user):
    """
    Добавя delivery/read информация към съобщенията.

        sent
        delivered
        read
    """

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
    """
    Връща първия superuser или staff user.
    """

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

def safe_next_url(request, fallback='message-inbox'):
    """
    Позволява redirect към next само ако URL-ът
    е към текущия host.
    """

    next_url = (
            request.POST.get('next')
            or request.GET.get('next')
            or request.META.get('HTTP_REFERER')
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

def get_reaction_reactors(message, reaction):
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
                        or '/static/images/profile_picture.webp'
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

    return bool(
        body
        or image_file
        or video_file
    )


def validate_message_attachments(request):
    image_file = request.FILES.get('image')
    video_file = request.FILES.get('video')

    if image_file and video_file:
        raise ValidationError(
            "Please attach either an image or a video, not both."
        )

    if image_file:

        if image_file.size > MAX_IMAGE_SIZE:
            raise ValidationError(
                "Image is too large. Maximum size is 10 MB."
            )

        content_type = (
                getattr(
                    image_file,
                    'content_type',
                    '',
                )
                or ''
        )

        if not content_type.startswith('image/'):
            raise ValidationError(
                "Invalid image file."
            )

    if video_file:

        if video_file.size > MAX_VIDEO_SIZE:
            raise ValidationError(
                "Video is too large. Maximum size is 100 MB."
            )

        content_type = (
                getattr(
                    video_file,
                    'content_type',
                    '',
                )
                or ''
        )

        if not content_type.startswith('video/'):
            raise ValidationError(
                "Invalid video file."
            )


# ============================================================
# SYSTEM MESSAGE
# ============================================================

def send_system_message(recipient, title, body):
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
    )

    admin_status = MessageStatus.objects.create(
        message=message,
        profile=admin,
    )

    admin_status.mark_as_read()

    # ========================================================
    # WEBSOCKET BROADCAST
    # ========================================================

    broadcast_message_created(
        message
    )


# ============================================================
# SEND MESSAGE
# ============================================================

@login_required
def send_message(request, pk=None):
    recipient = (
        get_object_or_404(
            AppUser,
            pk=pk,
        )
        if pk
        else None
    )

    # =========================================================
    # PRODUCT
    # =========================================================

    product_id = request.GET.get('product_id')
    product_type = request.GET.get('product_type')

    if request.method == 'POST':
        product_id = (
                request.POST.get('product_id')
                or product_id
        )

        product_type = (
                request.POST.get('product_type')
                or product_type
        )

    product = None

    # =========================================================
    # VALIDATE PRODUCT
    # =========================================================

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

    # =========================================================
    # BLOCK STATUS
    # =========================================================

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

    # =========================================================
    # POST
    # =========================================================

    if request.method == 'POST':

        if not recipient:
            django_messages.error(
                request,
                "Recipient is required.",
            )

            return redirect(
                'message-inbox',
            )

        if is_blocked_by_other:
            django_messages.error(
                request,
                "You cannot send messages to this user because you have been blocked.",
            )

            return redirect(
                'message-inbox',
            )

        if is_blocked:
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
                django_messages.error(
                    request,
                    "Message cannot be empty.",
                )

                return redirect(
                    'message-inbox',
                )

            try:

                validate_message_attachments(
                    request,
                )

            except ValidationError as exc:

                django_messages.error(
                    request,
                    str(exc),
                )

                return redirect(
                    'message-inbox',
                )

            message = form.save(
                commit=False,
            )

            message.sender = request.user
            message.recipient = recipient

            # =================================================
            # PRODUCT CONTEXT
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
                        message.parent_message = parent_message

            # =================================================
            # MARKDOWN
            # =================================================

            if message.body:
                message.body = markdown.markdown(
                    message.body,
                )

            # =================================================
            # SAVE
            # =================================================

            with transaction.atomic():

                message.save()

                MessageStatus.objects.create(
                    message=message,
                    profile=recipient,
                )

                if recipient != request.user:
                    sender_status = (
                        MessageStatus.objects.create(
                            message=message,
                            profile=request.user,
                        )
                    )

                    sender_status.mark_as_read()

            # =================================================
            # WEBSOCKET BROADCAST
            # =================================================

            broadcast_message_created(
                message
            )

            return redirect(
                'read-message',
                pk=message.pk,
            )

    else:

        form = MessageForm()

    # =========================================================
    # RENDER
    # =========================================================

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
def message_fragment(request, pk):
    message = get_object_or_404(
        Message.objects.select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message__sender__profile',
            'parent_message__recipient__profile',
        ).prefetch_related(
            'statuses',
            'reactions',
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
    # USER-SPECIFIC VISIBILITY
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
    # DELIVERY STATUS
    # ========================================================

    add_message_delivery_status(
        [message],
        current_user,
    )

    # ========================================================
    # RENDER EXACT MESSAGE HTML
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
def read_message(request, pk):
    message = get_object_or_404(
        Message.objects.select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message',
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
            'message-inbox',
        )

    # ========================================================
    # ROOT MESSAGE
    # ========================================================

    root_message = conversation_messages[0]

    # ========================================================
    # MARK AS READ
    # ========================================================

    unread_statuses = (
        MessageStatus.objects
        .filter(
            message__in=conversation_messages,
            profile=current_user,
            is_deleted=False,
            is_read=False,
            message__is_removed=False,
        )
    )

    for status in unread_statuses:
        status.mark_as_read()

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
    # SYSTEM MESSAGE
    # ========================================================

    is_system = bool(
        getattr(
            message,
            'is_system',
            False,
        )
    )

    # ========================================================
    # REPLY / SEND
    # ========================================================

    if request.method == 'POST' and not is_system:

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            if not message_has_content(request):
                django_messages.error(
                    request,
                    "Message cannot be empty.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            try:

                validate_message_attachments(
                    request,
                )

            except ValidationError as exc:

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
                if message.sender_id == current_user.pk
                else message.sender
            )

            if not recipient:
                django_messages.error(
                    request,
                    "Recipient not found.",
                )

                return redirect(
                    'message-inbox',
                )

            # =================================================
            # BLOCKED BY OTHER
            # =================================================

            if (
                    BlockedUser.objects
                            .filter(
                        blocker=recipient,
                        blocked=current_user,
                    )
                            .exists()
            ):
                django_messages.error(
                    request,
                    "You cannot send messages to this user because you have been blocked.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            # =================================================
            # CURRENT USER BLOCKED OTHER
            # =================================================

            if (
                    BlockedUser.objects
                            .filter(
                        blocker=current_user,
                        blocked=recipient,
                    )
                            .exists()
            ):
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

            # =================================================
            # SECURITY CHECK
            # =================================================

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
                commit=False,
            )

            reply.sender = current_user
            reply.recipient = recipient

            # =================================================
            # INHERIT PRODUCT CONTEXT
            # =================================================

            reply.product_type = message.product_type
            reply.product_id = message.product_id

            reply.title = (
                    message.title
                    or "Direct conversation"
            )

            reply.parent_message = reply_to

            # =================================================
            # MARKDOWN
            # =================================================

            if reply.body:
                reply.body = markdown.markdown(
                    reply.body,
                )

            # =================================================
            # SAVE
            # =================================================

            with transaction.atomic():

                reply.save()

                MessageStatus.objects.create(
                    message=reply,
                    profile=recipient,
                )

                if recipient != current_user:
                    sender_status = (
                        MessageStatus.objects.create(
                            message=reply,
                            profile=current_user,
                        )
                    )

                    sender_status.mark_as_read()

            # =================================================
            # WEBSOCKET BROADCAST
            # =================================================

            broadcast_message_created(
                reply
            )

            # =========================================================
            # AJAX RESPONSE
            # =========================================================

            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
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

    else:

        form = MessageForm()

    # ========================================================
    # DELIVERY / READ STATUS
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
    # RENDER
    # ========================================================

    return render(
        request,
        'messages/message-read.html',
        {
            'message': message,
            'root_message': root_message,
            'conversation_messages': conversation_messages,
            'last_message': last_message,
            'form': form,
            'other_user': other_user,
            'is_blocked': is_blocked,
            'is_blocked_by_other': is_blocked_by_other,
            'is_system': is_system,
        },
    )


# ============================================================
# DELETE ONE MESSAGE
# ============================================================

@login_required
def delete_one_message(request, pk):
    msg = get_object_or_404(
        Message,
        pk=pk,
    )

    if msg.sender_id != request.user.pk:
        return HttpResponse(
            "Not allowed",
            status=403,
        )

    if request.method != 'POST':
        return HttpResponse(
            "POST required",
            status=405,
        )

    # ========================================================
    # SOFT DELETE
    # ========================================================

    if not msg.is_removed:
        msg.is_removed = True

        msg.save(
            update_fields=[
                'is_removed',
            ]
        )

    # ========================================================
    # RECIPIENT STATUS
    # ========================================================

    MessageStatus.objects.filter(
        message=msg,
        profile_id=msg.recipient_id,
    ).update(
        is_read=True,
    )

    # ========================================================
    # WEBSOCKET BROADCAST
    # ========================================================

    broadcast_message_created(
        msg
    )

    return redirect(
        safe_next_url(request),
    )


# ============================================================
# DELETE CONVERSATION
# ============================================================

@login_required
def delete_message(request, pk):
    message = get_object_or_404(
        Message,
        pk=pk,
    )

    user = request.user

    # ========================================================
    # AUTHORIZATION
    # ========================================================

    if (
            message.sender_id != user.pk
            and
            message.recipient_id != user.pk
    ):
        return HttpResponse(
            "Not allowed",
            status=403,
        )

    # ========================================================
    # FILTER TYPE
    # ========================================================

    filter_type = (
            request.POST.get('filter')
            or request.GET.get('filter')
            or 'inbox'
    )

    if filter_type not in (
            'inbox',
            'sent',
            'unread',
            'all',
    ):
        filter_type = 'inbox'

    # ========================================================
    # CONVERSATION
    # ========================================================

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

    # ========================================================
    # GET
    # ========================================================

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

    # ========================================================
    # POST
    # ========================================================

    if request.method != 'POST':
        return HttpResponse(
            "Method not allowed",
            status=405,
        )

    # ========================================================
    # DELETE FOR CURRENT USER
    # ========================================================

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

    # ========================================================
    # REDIRECT
    # ========================================================

    return redirect(
        f"{reverse('message-inbox')}?filter={filter_type}"
    )


# ============================================================
# REACT MESSAGE
# ============================================================

@login_required
def react_message(request, pk, reaction):
    if request.method != 'POST':
        return JsonResponse(
            {
                'ok': False,
                'error': 'POST required',
            },
            status=405,
        )

    msg = get_object_or_404(
        Message,
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
                'error': 'Message has been deleted.',
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
                'error': 'System messages cannot be reacted to.',
            },
            status=400,
        )

    if not is_valid_reaction(reaction):
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

    return JsonResponse(
        {
            'ok': True,
            'reaction': reaction,
            'active': active,
            'message_id': msg.pk,
            'reactors': reactors,
        }
    )


# ============================================================
# REPORT
# ============================================================

@login_required
def report_message(request, pk):
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
        'message-inbox',
    )


# ============================================================
# BLOCK USER
# ============================================================

@login_required
def block_user(request, pk):
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
            safe_next_url(request),
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
            f"You have successfully blocked {user_to_block.username}.",
        )

    else:

        django_messages.info(
            request,
            "This user is already blocked.",
        )

    return redirect(
        safe_next_url(request),
    )


# ============================================================
# UNBLOCK USER
# ============================================================

@login_required
def unblock_user(request, pk):
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
            f"You have successfully unblocked {user_to_unblock.username}.",
        )

    else:

        django_messages.info(
            request,
            "This user was not blocked.",
        )

    return redirect(
        safe_next_url(request),
    )


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(request):
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
def edit_message(request, pk):
    message = get_object_or_404(
        Message.objects.select_related(
            'sender',
            'recipient',
        ),
        pk=pk,
    )

    # ========================================================
    # PERMISSION
    # ========================================================

    if message.sender != request.user:
        return JsonResponse(
            {
                'ok': False,
                'error': 'You can only edit your own messages.',
            },
            status=403,
        )

    # ========================================================
    # SYSTEM MESSAGE
    # ========================================================

    if message.is_system:
        return JsonResponse(
            {
                'ok': False,
                'error': 'System messages cannot be edited.',
            },
            status=403,
        )

    # ========================================================
    # DELETED MESSAGE
    # ========================================================

    if message.is_removed:
        return JsonResponse(
            {
                'ok': False,
                'error': 'Deleted messages cannot be edited.',
            },
            status=400,
        )

    # ========================================================
    # METHOD
    # ========================================================

    if request.method != 'POST':
        return JsonResponse(
            {
                'ok': False,
                'error': 'POST required.',
            },
            status=405,
        )

    # ========================================================
    # BODY
    # ========================================================

    new_body = (
            request.POST.get('body')
            or ''
    ).strip()

    if not new_body:
        return JsonResponse(
            {
                'ok': False,
                'error': 'Message cannot be empty.',
            },
            status=400,
        )

    # ========================================================
    # MARKDOWN
    # ========================================================

    message.body = markdown.markdown(
        new_body,
    )

    message.save(
        update_fields=[
            'body',
        ]
    )

    return JsonResponse(
        {
            'ok': True,
            'message_id': message.pk,
            'body': message.body,
        }
    )
