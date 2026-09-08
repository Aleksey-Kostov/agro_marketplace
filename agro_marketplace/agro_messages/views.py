from django.core.paginator import Paginator
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages as django_messages
from django.contrib.auth import get_user_model
from django.http import HttpResponse
import markdown

from .forms import MessageForm
from .models import Message, MessageStatus, MessageReport, BlockedUser, MessageReaction
from .templatetags.message_tags_inbox import get_root, get_user_conversations
from ..accounts.models import AppUser
from ..buyers.models import BuyerItems
from ..sellers.models import SellerItems

from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Message, MessageReaction

User = get_user_model()


# ============================================================
# HELPERS
# ============================================================

def get_conversation_messages(root_message):
    """Всички съобщения в conversation-а (стари → нови)."""
    messages = [root_message]
    current_level = [root_message]

    while current_level:
        next_level = list(
            Message.objects.filter(parent_message__in=current_level)
            .select_related('sender__profile', 'recipient__profile')
            .order_by('timestamp')
        )
        if not next_level:
            break
        messages.extend(next_level)
        current_level = next_level

    return messages


def is_message_visible_for_user(message, user):
    """
    Видимо ако:
    - user е sender или recipient
    - и няма status със is_deleted=True
    (ако status липсва → считаме го за видимо)
    """
    if user not in [message.sender, message.recipient]:
        return False

    status = MessageStatus.objects.filter(message=message, profile=user).first()
    if status is None:
        return True
    return not status.is_deleted


def get_conversation_messages_for_user(root_message, user):
    """Само съобщения, видими за user."""
    all_msgs = []

    if is_message_visible_for_user(root_message, user):
        all_msgs.append(root_message)

    current_level = [root_message]
    while current_level:
        next_level = list(
            Message.objects.filter(parent_message__in=current_level)
            .select_related('sender__profile', 'recipient__profile')
            .order_by('timestamp')
        )
        if not next_level:
            break

        for msg in next_level:
            if is_message_visible_for_user(msg, user):
                all_msgs.append(msg)

        current_level = next_level

    return all_msgs


def get_admin_user():
    return (
            User.objects.filter(is_superuser=True).first()
            or User.objects.filter(is_staff=True).first()
    )


def send_system_message(recipient, title, body):
    admin = get_admin_user()
    if not admin or admin == recipient:
        return

    message = Message.objects.create(
        sender=admin,
        recipient=recipient,
        title=title,
        body=markdown.markdown(body),
        is_system=True,
    )
    MessageStatus.objects.create(message=message, profile=recipient)
    st = MessageStatus.objects.create(message=message, profile=admin)
    st.mark_as_read()


# ============================================================
# SEND MESSAGE
# ============================================================

@login_required
def send_message(request, pk=None):
    recipient = get_object_or_404(AppUser, pk=pk) if pk else None
    product = None

    if pk:
        product = (
                SellerItems.objects.filter(profile__user=pk).first()
                or BuyerItems.objects.filter(profile__user=pk).first()
        )

    is_blocked = False
    is_blocked_by_other = False

    if recipient:
        is_blocked = BlockedUser.objects.filter(
            blocker=request.user, blocked=recipient
        ).exists()
        is_blocked_by_other = BlockedUser.objects.filter(
            blocker=recipient, blocked=request.user
        ).exists()

    if request.method == 'POST':
        form = MessageForm(request.POST, request.FILES)
        if form.is_valid():
            if recipient:
                if is_blocked_by_other:
                    django_messages.error(
                        request,
                        "You cannot send messages to this user because you have been blocked."
                    )
                    return redirect('message-inbox')

                if is_blocked:
                    django_messages.error(
                        request,
                        "You cannot send messages to a blocked user. Please unblock them first."
                    )
                    return redirect('message-inbox')

            message = form.save(commit=False)
            message.sender = request.user
            message.recipient = recipient

            if product and getattr(product, 'title', None):
                message.title = product.title
            else:
                message.title = "Direct conversation"

            if message.body:
                message.body = markdown.markdown(message.body)

            message.save()

            MessageStatus.objects.create(message=message, profile=recipient)

            if message.recipient != message.sender:
                st = MessageStatus.objects.create(
                    message=message, profile=request.user
                )
                st.mark_as_read()

            return redirect('read-message', pk=message.pk)
    else:
        form = MessageForm()

    return render(request, 'messages/message-send.html', {
        'form': form,
        'recipient': recipient,
        'product': product,
        'is_blocked': is_blocked,
        'is_blocked_by_other': is_blocked_by_other,
    })


# ============================================================
# READ MESSAGE + REPLY
# ============================================================

@login_required
def read_message(request, pk):
    message = get_object_or_404(
        Message.objects.select_related(
            'sender__profile', 'recipient__profile', 'parent_message'
        ),
        pk=pk
    )
    current_user = request.user

    if current_user not in [message.sender, message.recipient]:
        return HttpResponse("Not authorized", status=403)

    root_message = get_root(message)

    conversation_messages = get_conversation_messages_for_user(
        root_message, current_user
    )
    conversation_messages = list(reversed(conversation_messages))

    for status in MessageStatus.objects.filter(
            message__in=conversation_messages,
            profile=current_user,
            is_deleted=False
    ):
        status.mark_as_read()

    other_user = (
        root_message.recipient
        if root_message.sender == current_user
        else root_message.sender
    )
    is_blocked = BlockedUser.objects.filter(
        blocker=current_user, blocked=other_user
    ).exists()
    is_blocked_by_other = BlockedUser.objects.filter(
        blocker=other_user, blocked=current_user
    ).exists()
    is_system = bool(getattr(root_message, 'is_system', False))

    if request.method == 'POST' and not is_system:
        form = MessageForm(request.POST, request.FILES)
        if form.is_valid():
            recipient = (
                root_message.recipient
                if root_message.sender == current_user
                else root_message.sender
            )

            if BlockedUser.objects.filter(
                    blocker=recipient, blocked=current_user
            ).exists():
                django_messages.error(
                    request,
                    "You cannot send messages to this user because you have been blocked."
                )
                return redirect('read-message', pk=pk)

            if BlockedUser.objects.filter(
                    blocker=current_user, blocked=recipient
            ).exists():
                django_messages.error(
                    request,
                    "You cannot send messages to a blocked user. Please unblock them first."
                )
                return redirect('read-message', pk=pk)

            chronological = get_conversation_messages_for_user(
                root_message, current_user
            )
            last_msg = chronological[-1] if chronological else root_message

            reply = form.save(commit=False)
            reply.sender = current_user
            reply.recipient = recipient
            reply.title = root_message.title or "Direct conversation"
            reply.parent_message = last_msg

            if reply.body:
                reply.body = markdown.markdown(reply.body)

            reply.save()

            MessageStatus.objects.create(message=reply, profile=recipient)

            if reply.recipient != reply.sender:
                st = MessageStatus.objects.create(
                    message=reply, profile=current_user
                )
                st.mark_as_read()

            return redirect('read-message', pk=reply.pk)
    else:
        form = MessageForm()

    paginator = Paginator(conversation_messages, 5)
    page_obj = paginator.get_page(request.GET.get('page'))

    chronological = get_conversation_messages_for_user(
        root_message, current_user
    )
    last_message = chronological[-1] if chronological else root_message

    return render(request, 'messages/message-read.html', {
        'message': message,
        'root_message': root_message,
        'conversation_messages': page_obj,
        'last_message': last_message,
        'form': form,
        'page_obj': page_obj,
        'other_user': other_user,
        'is_blocked': is_blocked,
        'is_blocked_by_other': is_blocked_by_other,
        'is_system': is_system,
    })


# ============================================================
# DELETE ONE MESSAGE
# ============================================================

@login_required
def delete_one_message(request, pk):
    msg = get_object_or_404(Message, pk=pk)

    if msg.sender != request.user:
        return HttpResponse("Not allowed", status=403)

    msg.is_removed = True
    msg.save(update_fields=['is_removed'])

    referer = request.META.get('HTTP_REFERER')
    return redirect(referer or 'message-inbox')


# ============================================================
# DELETE CONVERSATION
# ============================================================

from django.urls import reverse


@login_required
def delete_message(request, pk):
    message = get_object_or_404(Message, pk=pk)
    user = request.user

    if user not in [message.sender, message.recipient]:
        return HttpResponse("Not allowed", status=403)

    root = get_root(message)
    conversation = get_conversation_messages(root)

    filter_type = request.GET.get('filter') or request.POST.get('filter') or 'inbox'

    if request.method == 'POST':
        MessageStatus.objects.filter(
            message__in=conversation,
            profile=user
        ).update(is_deleted=True)

        for msg in conversation:
            if not msg.statuses.filter(is_deleted=False).exists():
                msg.delete()

        return redirect(f"{reverse('message-inbox')}?filter={filter_type}")

    return render(request, 'messages/message-delete.html', {
        'message': message,
        'root_message': root,
        'messages_count': len(conversation),
        'filter_type': filter_type,
    })

# ============================================================
# REACT
# ============================================================


@login_required
def react_message(request, pk, reaction):
    msg = get_object_or_404(Message, pk=pk)

    if request.user not in [msg.sender, msg.recipient]:
        return JsonResponse({'ok': False, 'error': 'Not allowed'}, status=403)

    if reaction not in (MessageReaction.LIKE, MessageReaction.HEART):
        return JsonResponse({'ok': False, 'error': 'Invalid'}, status=400)

    existing = MessageReaction.objects.filter(
        message=msg,
        user=request.user,
        reaction=reaction
    ).first()

    if existing:
        existing.delete()
        active = False
    else:
        MessageReaction.objects.create(
            message=msg,
            user=request.user,
            reaction=reaction
        )
        active = True

    return JsonResponse({
        'ok': True,
        'reaction': reaction,
        'active': active,
        'message_id': pk,
    })


# ============================================================
# REPORT
# ============================================================

@login_required
def report_message(request, pk):
    message = get_object_or_404(Message, pk=pk)

    if request.user not in [message.sender, message.recipient]:
        return HttpResponse("Not authorized", status=403)

    if request.method == 'POST':
        reason = request.POST.get('reason', '').strip()
        report, created = MessageReport.objects.get_or_create(
            message=message,
            reported_by=request.user,
            defaults={'reason': reason}
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
                )
            )
            django_messages.success(
                request, "Your report has been submitted successfully."
            )
        else:
            django_messages.info(
                request, "You have already reported this message."
            )

        return redirect('message-inbox')

    return redirect('read-message', pk=message.pk)


# ============================================================
# BLOCK / UNBLOCK
# ============================================================

@login_required
def block_user(request, pk):
    user_to_block = get_object_or_404(User, pk=pk)

    if user_to_block == request.user:
        django_messages.error(request, "You cannot block yourself.")
        next_url = request.GET.get('next') or request.META.get('HTTP_REFERER')
        return redirect(next_url or 'message-inbox')

    obj, created = BlockedUser.objects.get_or_create(
        blocker=request.user,
        blocked=user_to_block
    )

    if created:
        django_messages.success(
            request, f"You have successfully blocked {user_to_block.username}."
        )
    else:
        django_messages.info(request, "This user is already blocked.")

    next_url = request.GET.get('next') or request.META.get('HTTP_REFERER')
    return redirect(next_url or 'message-inbox')


@login_required
def unblock_user(request, pk):
    user_to_unblock = get_object_or_404(User, pk=pk)

    deleted, _ = BlockedUser.objects.filter(
        blocker=request.user,
        blocked=user_to_unblock
    ).delete()

    if deleted:
        django_messages.success(
            request,
            f"You have successfully unblocked {user_to_unblock.username}."
        )
    else:
        django_messages.info(request, "This user was not blocked.")

    next_url = request.GET.get('next') or request.META.get('HTTP_REFERER')
    if next_url:
        return redirect(next_url)

    return redirect('message-inbox')


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(request):
    filter_type = request.GET.get('filter', 'inbox')
    user = request.user

    try:
        roots = get_user_conversations(user, filter_type)
    except Exception:
        roots = []

    conversation_list = []
    for root in roots:
        try:
            all_msgs = get_conversation_messages_for_user(root, user)
            if not all_msgs:
                # fallback: ако for_user е празно, но user е участник
                raw = get_conversation_messages(root)
                all_msgs = [m for m in raw if user in [m.sender, m.recipient]]
            if not all_msgs:
                continue

            last_msg = all_msgs[-1]
            conversation_list.append({
                'root': root,
                'last_message': last_msg,
                'messages_count': len(all_msgs),
            })
        except Exception:
            continue

    paginator = Paginator(conversation_list, 5)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'messages/message-inbox.html', {
        'conversations': page_obj,
        'filter_type': filter_type,
    })
