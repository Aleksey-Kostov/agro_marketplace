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
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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
    get_root,
    get_user_conversations,
)
from ..accounts.models import AppUser
from ..buyers.models import BuyerItems
from ..sellers.models import SellerItems

User = get_user_model()


# ============================================================
# HELPERS
# ============================================================

def get_conversation_messages(root_message):
    """
    Всички съобщения в conversation-а:
    стари -> нови.
    """

    messages = [root_message]
    current_level = [root_message]

    while current_level:

        next_level = list(
            Message.objects.filter(
                parent_message__in=current_level
            )
            .select_related(
                'sender__profile',
                'recipient__profile',
            )
            .order_by('timestamp')
        )

        if not next_level:
            break

        messages.extend(next_level)
        current_level = next_level

    return messages


def is_message_visible_for_user(message, user):
    """
    Съобщението е видимо ако:
    - user е sender или recipient
    - user няма is_deleted=True status

    Ако status липсва -> считаме го за видимо.
    """

    if user not in [
        message.sender,
        message.recipient,
    ]:
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


def get_conversation_messages_for_user(root_message, user):
    """
    Само съобщенията, които текущият user може да вижда.
    """

    visible_messages = []

    if is_message_visible_for_user(
        root_message,
        user,
    ):
        visible_messages.append(root_message)

    current_level = [root_message]

    while current_level:

        next_level = list(
            Message.objects.filter(
                parent_message__in=current_level
            )
            .select_related(
                'sender__profile',
                'recipient__profile',
            )
            .order_by('timestamp')
        )

        if not next_level:
            break

        for msg in next_level:

            if is_message_visible_for_user(
                msg,
                user,
            ):
                visible_messages.append(msg)

        current_level = next_level

    return visible_messages


def add_message_delivery_status(messages, current_user):
    """
    Добавя delivery/read информация към съобщенията.

    Само собствените съобщения получават delivery status:

    - няма recipient status -> sent
    - има recipient status -> delivered
    - recipient status.is_read=True -> read
    """

    if not messages:
        return messages

    message_ids = [
        msg.pk
        for msg in messages
    ]

    statuses = (
        MessageStatus.objects
        .filter(
            message_id__in=message_ids
        )
        .select_related('profile')
    )

    status_map = {}

    for status in statuses:
        status_map[
            (
                status.message_id,
                status.profile_id,
            )
        ] = status

    for msg in messages:

        msg.delivery_status = None

        if msg.sender_id != current_user.pk:
            continue

        recipient_status = status_map.get(
            (
                msg.pk,
                msg.recipient_id,
            )
        )

        if recipient_status is None:

            msg.delivery_status = 'sent'

        elif recipient_status.is_read:

            msg.delivery_status = 'read'

        else:

            msg.delivery_status = 'delivered'

    return messages


def get_admin_user():
    """
    Връща първия superuser или staff user.
    """

    return (
        User.objects.filter(
            is_superuser=True
        ).first()
        or
        User.objects.filter(
            is_staff=True
        ).first()
    )


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
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return next_url

    return fallback


def get_reaction_reactors(message, reaction):
    """
    Връща reactor информацията за JS.
    """

    reactors = []

    reactions = (
        message.reactions
        .filter(reaction=reaction)
        .select_related('user__profile')
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

        reactors.append({
            'id': user.pk,
            'photo': (
                photo
                or '/static/images/profile_picture.webp'
            ),
            'username': username,
        })

    return reactors


def is_valid_reaction(reaction):
    return reaction in (
        MessageReaction.LIKE,
        MessageReaction.HEART,
    )


MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024


def validate_message_attachments(request):
    """
    Backend validation за message attachments.
    Позволява максимум един attachment.
    """

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

        if not image_file.content_type.startswith('image/'):
            raise ValidationError(
                "Invalid image file."
            )

    if video_file:

        if video_file.size > MAX_VIDEO_SIZE:
            raise ValidationError(
                "Video is too large. Maximum size is 100 MB."
            )

        if not video_file.content_type.startswith('video/'):
            raise ValidationError(
                "Invalid video file."
            )


def broadcast_message(message, root_message):
    """
    Изпраща новото съобщение към WebSocket клиентите
    на conversation-а.

    Файловете НЕ се изпращат през WebSocket.
    Изпращаме само техните URL адреси.
    """

    print(
        f"WS BROADCAST: message={message.pk}, root={root_message.pk}"
    )

    channel_layer = get_channel_layer()

    # ========================================================
    # IMAGE URL
    # ========================================================

    image_url = ''

    if message.image:

        try:
            image_url = message.image.url
        except Exception:
            image_url = ''

    # ========================================================
    # VIDEO URL
    # ========================================================

    video_url = ''

    if message.video:
        video_url = message.video_url

    # ========================================================
    # SENDER INFO
    # ========================================================

    sender_username = message.sender.username
    sender_avatar_url = ''

    profile = getattr(
        message.sender,
        'profile',
        None,
    )

    if profile:

        sender_username = (
            profile.username_in_marketplace
            or message.sender.username
        )

        try:

            if profile.profile_photo:
                sender_avatar_url = (
                    profile.profile_photo.url
                )

        except Exception:

            sender_avatar_url = ''

    if not sender_avatar_url:

        sender_avatar_url = (
            '/static/images/profile_picture.webp'
        )

    # ========================================================
    # PAYLOAD
    # ========================================================

    payload = {
        'id': message.pk,
        'sender_id': message.sender_id,
        'sender_username': sender_username,
        'sender_avatar_url': sender_avatar_url,
        'body': message.body or '',
        'timestamp': (
            message.timestamp.isoformat()
            if message.timestamp
            else None
        ),
        'image_url': image_url,
        'video_url': video_url,
        'is_system': message.is_system,
        'is_removed': message.is_removed,
    }

    # ========================================================
    # BROADCAST
    # ========================================================

    async_to_sync(
        channel_layer.group_send
    )(
        f'conversation_{root_message.pk}',
        {
            'type': 'chat_message',
            'message': payload,
        },
    )


# ============================================================
# SYSTEM MESSAGE
# ============================================================

def send_system_message(recipient, title, body):
    """
    Изпраща автоматично system message.
    """

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

    product = None

    if recipient:

        product = (
            SellerItems.objects
            .filter(profile__user=recipient)
            .first()
        )

        if not product:

            product = (
                BuyerItems.objects
                .filter(profile__user=recipient)
                .first()
            )

    is_blocked = False
    is_blocked_by_other = False

    if recipient:

        is_blocked = BlockedUser.objects.filter(
            blocker=request.user,
            blocked=recipient,
        ).exists()

        is_blocked_by_other = BlockedUser.objects.filter(
            blocker=recipient,
            blocked=request.user,
        ).exists()

    if request.method == 'POST':

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            try:

                validate_message_attachments(
                    request
                )

            except ValidationError as exc:

                django_messages.error(
                    request,
                    exc.message,
                )

                return redirect(
                    'message-inbox'
                )

            if not recipient:

                django_messages.error(
                    request,
                    "Recipient is required.",
                )

                return redirect(
                    'message-inbox'
                )

            if is_blocked_by_other:

                django_messages.error(
                    request,
                    "You cannot send messages to this user because you have been blocked.",
                )

                return redirect(
                    'message-inbox'
                )

            if is_blocked:

                django_messages.error(
                    request,
                    "You cannot send messages to a blocked user. Please unblock them first.",
                )

                return redirect(
                    'message-inbox'
                )

            message = form.save(
                commit=False
            )

            message.sender = request.user
            message.recipient = recipient

            if product and getattr(
                product,
                'title',
                None,
            ):

                message.title = product.title

            else:

                message.title = (
                    "Direct conversation"
                )

            if message.body:

                message.body = markdown.markdown(
                    message.body
                )

            message.save()

            # =================================================
            # RECIPIENT STATUS
            # =================================================

            MessageStatus.objects.create(
                message=message,
                profile=recipient,
            )

            # =================================================
            # SENDER STATUS
            # =================================================

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

            transaction.on_commit(
                lambda: broadcast_message(
                    message,
                    message,
                )
            )

            return redirect(
                'read-message',
                pk=message.pk,
            )

    else:

        form = MessageForm()

    return render(
        request,
        'messages/message-send.html',
        {
            'form': form,
            'recipient': recipient,
            'product': product,
            'is_blocked': is_blocked,
            'is_blocked_by_other': is_blocked_by_other,
        },
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

    if current_user not in [
        message.sender,
        message.recipient,
    ]:

        return HttpResponse(
            "Not authorized",
            status=403,
        )

    root_message = get_root(
        message
    )

    conversation_messages = (
        get_conversation_messages_for_user(
            root_message,
            current_user,
        )
    )

    # ========================================================
    # MARK AS READ
    # ========================================================

    for status in MessageStatus.objects.filter(
        message__in=conversation_messages,
        profile=current_user,
        is_deleted=False,
    ):

        status.mark_as_read()

    # ========================================================
    # OTHER USER
    # ========================================================

    if root_message.sender == current_user:

        other_user = root_message.recipient

    else:

        other_user = root_message.sender

    is_blocked = False
    is_blocked_by_other = False

    if other_user:

        is_blocked = BlockedUser.objects.filter(
            blocker=current_user,
            blocked=other_user,
        ).exists()

        is_blocked_by_other = BlockedUser.objects.filter(
            blocker=other_user,
            blocked=current_user,
        ).exists()

    is_system = bool(
        getattr(
            root_message,
            'is_system',
            False,
        )
    )

    # ========================================================
    # REPLY
    # ========================================================

    if request.method == 'POST' and not is_system:

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            try:

                validate_message_attachments(
                    request
                )

            except ValidationError as exc:

                django_messages.error(
                    request,
                    exc.message,
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            recipient = (
                root_message.recipient
                if root_message.sender == current_user
                else root_message.sender
            )

            if not recipient:

                django_messages.error(
                    request,
                    "Recipient not found.",
                )

                return redirect(
                    'message-inbox'
                )

            # =================================================
            # BLOCKED BY OTHER
            # =================================================

            if BlockedUser.objects.filter(
                blocker=recipient,
                blocked=current_user,
            ).exists():

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

            if BlockedUser.objects.filter(
                blocker=current_user,
                blocked=recipient,
            ).exists():

                django_messages.error(
                    request,
                    "You cannot send messages to a blocked user. Please unblock them first.",
                )

                return redirect(
                    'read-message',
                    pk=pk,
                )

            # =================================================
            # GET LATEST VISIBLE MESSAGE
            # =================================================

            chronological = (
                get_conversation_messages_for_user(
                    root_message,
                    current_user,
                )
            )

            last_msg = (
                chronological[-1]
                if chronological
                else root_message
            )

            reply = form.save(
                commit=False
            )

            reply.sender = current_user
            reply.recipient = recipient

            reply.title = (
                root_message.title
                or "Direct conversation"
            )

            reply.parent_message = last_msg

            if reply.body:

                reply.body = markdown.markdown(
                    reply.body
                )

            # =================================================
            # VIDEO
            # =================================================

            video_file = request.FILES.get(
                'video'
            )

            if video_file:

                try:

                    import cloudinary.uploader

                    result = cloudinary.uploader.upload(
                        video_file,
                        resource_type='video',
                        folder='message_videos',
                    )

                    public_id = result.get(
                        'public_id'
                    )

                    if not public_id:

                        raise ValueError(
                            "Cloudinary did not return a public_id."
                        )

                    reply.video = public_id

                except Exception as exc:

                    django_messages.error(
                        request,
                        f"Video upload failed: {exc}",
                    )

                    return redirect(
                        'read-message',
                        pk=pk,
                    )

            # =================================================
            # SAVE
            # =================================================

            with transaction.atomic():

                reply.save()

                # Recipient
                MessageStatus.objects.create(
                    message=reply,
                    profile=recipient,
                )

                # Sender
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

            transaction.on_commit(
                lambda: broadcast_message(
                    reply,
                    root_message,
                )
            )

            # =================================================
            # AJAX RESPONSE
            # =================================================

            if request.headers.get(
                'X-Requested-With'
            ) == 'XMLHttpRequest':

                return JsonResponse({
                    'ok': True,
                    'message_id': reply.pk,
                })

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
        else root_message
    )

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

    if msg.sender != request.user:

        return HttpResponse(
            "Not allowed",
            status=403,
        )

    if request.method != 'POST':

        return HttpResponse(
            "POST required",
            status=405,
        )

    msg.is_removed = True

    msg.save(
        update_fields=['is_removed']
    )

    return redirect(
        safe_next_url(request)
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

    if user not in [
        message.sender,
        message.recipient,
    ]:

        return HttpResponse(
            "Not allowed",
            status=403,
        )

    root = get_root(
        message
    )

    conversation = get_conversation_messages(
        root
    )

    if request.method == 'POST':

        filter_type = (
            request.POST.get('filter')
            or 'inbox'
        )

        with transaction.atomic():

            MessageStatus.objects.filter(
                message__in=conversation,
                profile=user,
            ).update(
                is_deleted=True,
            )

            for msg in conversation:

                if not msg.statuses.filter(
                    is_deleted=False
                ).exists():

                    msg.delete()

        return redirect(
            f"{reverse('message-inbox')}?filter={filter_type}"
        )

    filter_type = (
        request.GET.get('filter')
        or 'inbox'
    )

    return render(
        request,
        'messages/message-delete.html',
        {
            'message': message,
            'root_message': root,
            'messages_count': len(conversation),
            'filter_type': filter_type,
        },
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

    if request.user not in [
        msg.sender,
        msg.recipient,
    ]:

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

    # Find conversation root.
    root_message = msg

    while root_message.parent_message_id:
        root_message = root_message.parent_message

    # Broadcast reaction update to everyone
    # currently connected to this conversation.
    channel_layer = get_channel_layer()

    async_to_sync(
        channel_layer.group_send
    )(
        f'conversation_{root_message.pk}',
        {
            'type': 'reaction_update',
            'message_id': msg.pk,
            'reaction': reaction,
            'active': active,
            'reactors': reactors,
        },
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

    if request.user not in [
        message.sender,
        message.recipient,
    ]:

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
            ''
        )
        .strip()
    )

    report, created = (
        MessageReport.objects.get_or_create(
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
            safe_next_url(request)
        )

    obj, created = (
        BlockedUser.objects.get_or_create(
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
        safe_next_url(request)
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
        BlockedUser.objects.filter(
            blocker=request.user,
            blocked=user_to_unblock,
        ).delete()
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
        safe_next_url(request)
    )


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(request):

    filter_type = (
        request.GET.get(
            'filter',
            'inbox',
        )
    )

    user = request.user

    try:

        roots = get_user_conversations(
            user,
            filter_type,
        )

    except Exception:

        roots = []

    conversation_list = []

    for root in roots:

        try:

            all_msgs = (
                get_conversation_messages_for_user(
                    root,
                    user,
                )
            )

            if not all_msgs:

                raw = get_conversation_messages(
                    root
                )

                all_msgs = [
                    msg
                    for msg in raw
                    if user in [
                        msg.sender,
                        msg.recipient,
                    ]
                ]

            if not all_msgs:
                continue

            last_msg = all_msgs[-1]

            conversation_list.append(
                {
                    'root': root,
                    'last_message': last_msg,
                    'messages_count': len(all_msgs),
                }
            )

        except Exception:

            continue

    paginator = Paginator(
        conversation_list,
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
