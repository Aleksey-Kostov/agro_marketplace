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
from django.db.models import Q

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
    Връща ВСИЧКИ съобщения между двамата участници.

    ВАЖНО:
    parent_message НЕ определя структурата на разговора.

    parent_message се използва САМО за Reply reference.

    Нормалните съобщения имат:
        parent_message = None

    Само съобщения, изпратени след натискане на Reply,
    имат:
        parent_message = избраното съобщение
    """

    if not root_message:
        return []

    sender_id = root_message.sender_id
    recipient_id = root_message.recipient_id

    messages = (
        Message.objects
        .filter(
            Q(
                sender_id=sender_id,
                recipient_id=recipient_id,
            )
            |
            Q(
                sender_id=recipient_id,
                recipient_id=sender_id,
            )
        )
        .exclude(
            is_removed=True
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


def is_message_visible_for_user(message, user):
    """
    Съобщението е видимо ако:

    - user е sender или recipient
    - user няма is_deleted=True status

    Ако status липсва -> считаме го за видимо.
    """

    if message.sender_id != user.pk and message.recipient_id != user.pk:
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
    Връща всички видими съобщения от разговора между
    root_message.sender и root_message.recipient.

    КРИТИЧНО:

    НЕ използваме:

        parent_message__in=current_level

    защото parent_message е само Reply reference.

    Разговорът се определя единствено от участниците.
    """

    if not root_message:
        return []

    messages = (
        Message.objects
        .filter(
            Q(
                sender_id=root_message.sender_id,
                recipient_id=root_message.recipient_id,
            )
            |
            Q(
                sender_id=root_message.recipient_id,
                recipient_id=root_message.sender_id,
            )
        )
        .exclude(
            is_removed=True
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

    visible_messages = []

    user_statuses = {
        status.message_id: status
        for status in (
            MessageStatus.objects
            .filter(
                profile=user,
                message_id__in=[
                    msg.pk for msg in messages
                ],
            )
        )
    }

    for msg in messages:

        if msg.sender_id != user.pk and msg.recipient_id != user.pk:
            continue

        status = user_statuses.get(msg.pk)

        if status and status.is_deleted:
            continue

        visible_messages.append(msg)

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
        .select_related(
            'profile'
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
            User.objects
            .filter(
                is_superuser=True
            )
            .first()
            or
            User.objects
            .filter(
                is_staff=True
            )
            .first()
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
        .filter(
            reaction=reaction
        )
        .select_related(
            'user__profile'
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

        content_type = (
                getattr(
                    image_file,
                    'content_type',
                    ''
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
                    ''
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
        parent_message=None,
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

    # =========================================================
    # RECIPIENT
    # =========================================================

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

    # GET при първоначално отваряне
    product_id = request.GET.get('product_id')
    product_type = request.GET.get('product_type')

    # POST - ако формата изпраща hidden полетата
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

        # =====================================================
        # BLOCK CHECKS
        # =====================================================

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

        # =====================================================
        # FORM
        # =====================================================

        form = MessageForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            # =================================================
            # ATTACHMENT VALIDATION
            # =================================================

            try:

                validate_message_attachments(
                    request
                )

            except ValidationError as exc:

                django_messages.error(
                    request,
                    str(exc),
                )

                return redirect(
                    'message-inbox'
                )

            # =================================================
            # CREATE MESSAGE
            # =================================================

            message = form.save(
                commit=False
            )

            message.sender = request.user
            message.recipient = recipient

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

            # Нормално съобщение няма parent.
            message.parent_message = None

            # parent_message се задава само при изричен Reply.
            if reply_to_id.isdigit():

                parent_message = (
                    Message.objects
                    .filter(
                        pk=int(reply_to_id),
                        is_removed=False,
                    )
                    .first()
                )

                if parent_message:

                    valid_parent = (
                        (
                            parent_message.sender_id
                            == request.user.pk
                            and
                            parent_message.recipient_id
                            == recipient.pk
                        )
                        or
                        (
                            parent_message.sender_id
                            == recipient.pk
                            and
                            parent_message.recipient_id
                            == request.user.pk
                        )
                    )

                    if valid_parent:

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
            # RESPONSE
            # =================================================

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
            'product_id': product_id,
            'product_type': product_type,
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
    #
    # НЕ използваме get_root() за изграждане на разговора.
    #
    # Всеки message в разговора е равноправно съобщение.
    # parent_message е само Reply reference.
    # ========================================================

    conversation_messages = (
        get_conversation_messages_for_user(
            message,
            current_user,
        )
    )

    if not conversation_messages:
        conversation_messages = [
            message
        ]

    # ========================================================
    # ROOT MESSAGE
    # ========================================================
    #
    # Root тук е само първото съобщение хронологично.
    # Това НЕ означава parent_message.
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

            # =================================================
            # ATTACHMENT VALIDATION
            # =================================================

            try:

                validate_message_attachments(
                    request
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
                    'message-inbox'
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
            # FIND REPLY TARGET
            # =================================================

            reply_to_id = (
                    request.POST.get('reply_to')
                    or ''
            ).strip()

            reply_to = None

            if reply_to_id.isdigit():

                try:

                    reply_to = (
                        Message.objects
                        .select_related(
                            'sender',
                            'recipient',
                        )
                        .get(
                            pk=int(reply_to_id),
                            is_removed=False,
                        )
                    )

                except (
                        Message.DoesNotExist,
                        ValueError,
                        TypeError,
                ):

                    reply_to = None

            # =================================================
            # SECURITY CHECK FOR REPLY TARGET
            # =================================================
            #
            # Reply target трябва да е точно от този разговор.
            #
            # НЕ използваме get_root().
            # =================================================

            if reply_to is not None:

                valid_participants = {
                    current_user.pk,
                    recipient.pk,
                }

                reply_participants = {
                    reply_to.sender_id,
                    reply_to.recipient_id,
                }

                if reply_participants != valid_participants:
                    reply_to = None

            # =================================================
            # CREATE MESSAGE
            # =================================================

            reply = form.save(
                commit=False
            )

            reply.sender = current_user
            reply.recipient = recipient

            reply.title = (
                    message.title
                    or "Direct conversation"
            )

            # =================================================
            # CRITICAL REPLY RULE
            # =================================================
            #
            # Само ако request.POST съдържа валиден reply_to,
            # съобщението става Reply.
            #
            # При нормално изпращане:
            #
            #     parent_message = None
            #
            # НЯМА fallback към последното съобщение.
            # =================================================

            if reply_to is not None:

                reply.parent_message = reply_to

            else:

                reply.parent_message = None

            # =================================================
            # MARKDOWN
            # =================================================

            if reply.body:
                reply.body = markdown.markdown(
                    reply.body
                )

            # =================================================
            # SAVE
            # =================================================

            with transaction.atomic():

                reply.save()

                # ---------------------------------------------
                # RECIPIENT STATUS
                # ---------------------------------------------

                MessageStatus.objects.create(
                    message=reply,
                    profile=recipient,
                )

                # ---------------------------------------------
                # SENDER STATUS
                # ---------------------------------------------

                if recipient != current_user:
                    sender_status = (
                        MessageStatus.objects.create(
                            message=reply,
                            profile=current_user,
                        )
                    )

                    sender_status.mark_as_read()

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
        update_fields=[
            'is_removed'
        ]
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
    # IMPORTANT
    # ========================================================
    #
    # Не използваме get_root() + parent tree.
    #
    # Целият разговор се намира по двамата участници.
    # ========================================================

    conversation = get_conversation_messages_for_user(
        message,
        user,
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
            'root_message': conversation[0]
            if conversation
            else message,
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
            ''
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

    # =====================================================
    # PERMISSION
    # =====================================================

    if message.sender != request.user:
        return JsonResponse(
            {
                'ok': False,
                'error': 'You can only edit your own messages.',
            },
            status=403,
        )

    # =====================================================
    # SYSTEM MESSAGE
    # =====================================================

    if message.is_system:
        return JsonResponse(
            {
                'ok': False,
                'error': 'System messages cannot be edited.',
            },
            status=403,
        )

    # =====================================================
    # DELETED MESSAGE
    # =====================================================

    if message.is_removed:
        return JsonResponse(
            {
                'ok': False,
                'error': 'Deleted messages cannot be edited.',
            },
            status=400,
        )

    # =====================================================
    # METHOD
    # =====================================================

    if request.method != 'POST':
        return JsonResponse(
            {
                'ok': False,
                'error': 'POST required.',
            },
            status=405,
        )

    # =====================================================
    # BODY
    # =====================================================

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

    # =====================================================
    # MARKDOWN
    # =====================================================

    message.body = markdown.markdown(
        new_body
    )

    message.save(
        update_fields=[
            'body'
        ]
    )

    return JsonResponse(
        {
            'ok': True,
            'message_id': message.pk,
            'body': message.body,
        }
    )
