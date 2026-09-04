from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages as django_messages
from django.contrib.auth import get_user_model

import markdown

from .forms import MessageForm
from .models import Message, MessageStatus, MessageReport, BlockedUser
from .templatetags.message_tags_inbox import get_root, get_user_conversations
from ..accounts.models import AppUser
from ..buyers.models import BuyerItems
from ..sellers.models import SellerItems

User = get_user_model()


def get_conversation_messages(root_message):
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


def get_admin_user():
    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        admin = User.objects.filter(is_staff=True).first()
    return admin


def send_system_message(recipient, title, body):
    admin = get_admin_user()
    if not admin or admin == recipient:
        return

    message = Message.objects.create(
        sender=admin,
        recipient=recipient,
        title=title,
        body=markdown.markdown(body)
    )
    MessageStatus.objects.create(message=message, profile=recipient)
    status = MessageStatus.objects.create(message=message, profile=admin)
    status.mark_as_read()


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

    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid():
            if recipient:
                if BlockedUser.objects.filter(blocker=recipient, blocked=request.user).exists():
                    django_messages.error(
                        request,
                        "You cannot send messages to this user because you have been blocked."
                    )
                    return redirect('message-inbox')

                if BlockedUser.objects.filter(blocker=request.user, blocked=recipient).exists():
                    django_messages.error(
                        request,
                        "You cannot send messages to a blocked user. Please unblock them first."
                    )
                    return redirect('message-inbox')

            message = form.save(commit=False)
            message.sender = request.user
            message.recipient = recipient
            message.body = markdown.markdown(message.body)
            message.save()

            MessageStatus.objects.create(message=message, profile=recipient)

            if message.recipient != message.sender:
                status = MessageStatus.objects.create(message=message, profile=request.user)
                status.mark_as_read()

            return redirect('read-message', pk=message.pk)
    else:
        form = MessageForm()

    context = {
        'form': form,
        'recipient': recipient,
        'product': product,
    }
    return render(request, 'messages/message-send.html', context)


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
        return HttpResponse("You are not authorized to view this message.", status=403)

    root_message = get_root(message)
    conversation_messages = get_conversation_messages(root_message)

    # Най-новите горе
    conversation_messages = list(reversed(conversation_messages))

    # Маркираме като прочетени
    statuses = MessageStatus.objects.filter(
        message__in=conversation_messages,
        profile=current_user,
        is_deleted=False
    )
    for status in statuses:
        status.mark_as_read()

    other_user = root_message.recipient if root_message.sender == current_user else root_message.sender
    is_blocked = BlockedUser.objects.filter(blocker=current_user, blocked=other_user).exists()
    is_blocked_by_other = BlockedUser.objects.filter(blocker=other_user, blocked=current_user).exists()

    # ---------- REPLY ----------
    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid():
            if root_message.sender == current_user:
                recipient = root_message.recipient
            else:
                recipient = root_message.sender

            if BlockedUser.objects.filter(blocker=recipient, blocked=current_user).exists():
                django_messages.error(
                    request,
                    "You cannot send messages to this user because you have been blocked."
                )
                return redirect('read-message', pk=pk)

            if BlockedUser.objects.filter(blocker=current_user, blocked=recipient).exists():
                django_messages.error(
                    request,
                    "You cannot send messages to a blocked user. Please unblock them first."
                )
                return redirect('read-message', pk=pk)

            chronological = get_conversation_messages(root_message)
            last_msg = chronological[-1]

            reply = form.save(commit=False)
            reply.sender = current_user
            reply.recipient = recipient
            reply.title = root_message.title or "Message"
            reply.parent_message = last_msg
            reply.body = markdown.markdown(reply.body)
            reply.save()

            MessageStatus.objects.create(message=reply, profile=recipient)

            if reply.recipient != reply.sender:
                status = MessageStatus.objects.create(message=reply, profile=current_user)
                status.mark_as_read()

            return redirect('read-message', pk=reply.pk)
    else:
        form = MessageForm()

    paginator = Paginator(conversation_messages, 5)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    chronological = get_conversation_messages(root_message)
    last_message = chronological[-1] if chronological else None

    context = {
        'message': message,
        'root_message': root_message,
        'conversation_messages': page_obj,
        'last_message': last_message,
        'form': form,
        'page_obj': page_obj,
        'other_user': other_user,
        'is_blocked': is_blocked,
        'is_blocked_by_other': is_blocked_by_other,
    }
    return render(request, 'messages/message-read.html', context)


# ============================================================
# DELETE MESSAGE
# ============================================================

@login_required
def delete_message(request, pk):
    message = get_object_or_404(Message, pk=pk)
    user = request.user

    if user not in [message.sender, message.recipient]:
        return HttpResponse("Not allowed", status=403)

    root = get_root(message)
    conversation = get_conversation_messages(root)

    if request.method == 'POST':
        MessageStatus.objects.filter(
            message__in=conversation,
            profile=user
        ).update(is_deleted=True)

        for msg in conversation:
            if not msg.statuses.filter(is_deleted=False).exists():
                msg.delete()

        return redirect('message-inbox')

    return render(request, 'messages/message-delete.html', {
        'message': message,
        'root_message': root,
        'messages_count': len(conversation),
    })


# ============================================================
# BLOCK / UNBLOCK
# ============================================================

@login_required
def block_user(request, pk):
    user_to_block = get_object_or_404(AppUser, pk=pk)

    if user_to_block == request.user:
        return HttpResponse("Cannot block yourself.", status=400)

    BlockedUser.objects.get_or_create(
        blocker=request.user,
        blocked=user_to_block
    )

    django_messages.success(request, f"You have successfully blocked {user_to_block.username}.")
    return redirect('message-inbox')


@login_required
def unblock_user(request, pk):
    user_to_unblock = get_object_or_404(AppUser, pk=pk)

    BlockedUser.objects.filter(
        blocker=request.user,
        blocked=user_to_unblock
    ).delete()

    django_messages.success(request, f"You have successfully unblocked {user_to_unblock.username}.")
    return redirect('message-inbox')


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(request):
    filter_type = request.GET.get('filter', 'inbox')
    user = request.user

    roots = get_user_conversations(user, filter_type)

    conversation_list = []
    for root in roots:
        all_msgs = get_conversation_messages(root)
        last_msg = all_msgs[-1]
        conversation_list.append({
            'root': root,
            'last_message': last_msg,
            'messages_count': len(all_msgs),
        })

    paginator = Paginator(conversation_list, 5)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'conversations': page_obj,
        'filter_type': filter_type,
    }
    return render(request, 'messages/message-inbox.html', context)


# ============================================================
# REPORT MESSAGE
# ============================================================

@login_required
def report_message(request, pk):
    message = get_object_or_404(Message, pk=pk)

    if request.user not in [message.sender, message.recipient]:
        return HttpResponse("You are not authorized to report this message.", status=403)

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
                title="Your report has been received",
                body=(
                    "Thank you for reporting the message.\n\n"
                    "Our team will review the content for appropriateness "
                    "and take the necessary actions if needed.\n\n"
                    "This is an automated message. Please do not reply."
                )
            )
            django_messages.success(request, "Your report has been submitted successfully.")
        else:
            django_messages.info(request, "You have already reported this message.")

        return redirect('message-inbox')

    return redirect('read-message', pk=message.pk)
