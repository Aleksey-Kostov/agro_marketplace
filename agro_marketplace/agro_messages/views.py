from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils.timezone import now
import markdown

from .forms import MessageForm
from .models import Message, MessageStatus
from ..accounts.models import AppUser
from ..buyers.models import BuyerItems
from ..sellers.models import SellerItems


@login_required
def send_message(request, pk=None):
    recipient = get_object_or_404(AppUser, pk=pk) if pk else None
    product = None

    if pk:
        product = SellerItems.objects.filter(profile__user=pk).first() or BuyerItems.objects.filter(
            profile__user=pk).first()

    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid():
            message = form.save(commit=False)
            message.sender = request.user
            message.recipient = recipient
            message.body = (
                f"🛒 **Product Inquiry:** {product}\n"
                f"📅 **Date:** {now():%d-%m-%Y %H:%M}\n"
                f"📨 **From:** {message.sender.profile.username_in_marketplace}\n"
                f"📩 **To:** {message.recipient.profile.username_in_marketplace}\n"
                f"─────────────────────────\n"
                f"💬 **Message Content:**\n"
                f"{message.body}\n"
                f"─────────────────────────"
            )
            html_content = markdown.markdown(message.body)
            message.body = html_content

            message.save()

            MessageStatus.objects.create(message=message, profile=recipient)
            if message.recipient != message.sender:
                status = MessageStatus.objects.create(message=message, profile=request.user)
                status.mark_as_read()
            return redirect('message-inbox')
    else:
        form = MessageForm()

    return render(request, 'messages/message-send.html', {'form': form, 'recipient': recipient, 'product': product})


@login_required
def read_message(request, pk):
    message = get_object_or_404(Message, pk=pk)
    current_user = request.user

    if current_user not in [message.sender, message.recipient]:
        return HttpResponse("You are not authorized to view this message.", status=403)

    read_status = MessageStatus.objects.filter(message=message, profile=current_user)
    if read_status:
        read_status[0].mark_as_read()

    return render(request, 'messages/message-read.html', {'message': message})


@login_required
def reply_message(request, pk):
    parent_message = get_object_or_404(
        Message,
        Q(pk=pk) & (Q(sender=request.user) | Q(recipient=request.user))
    )
    sender = request.user
    recipient = (
        parent_message.sender if parent_message.recipient == request.user else parent_message.recipient
    )
    current_time = now()
    parent_message.title = f"Re: {parent_message.title}" if not parent_message.title.startswith("Re:") \
        else parent_message.title

    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid():
            reply = form.save(commit=False)
            reply.sender = sender
            reply.recipient = recipient

            reply.title = f"Re: {parent_message.title}" if not parent_message.title.startswith("Re:") \
                else parent_message.title
            reply.parent_message = parent_message
            reply.body = (
                f"🔄 **Replied to** {recipient.profile.username_in_marketplace}\n"
                f"📅**Date:** {current_time:%d-%m-%Y %H:%M}\n "
                f"─────────────────────────\n"
                f"💬 **Message Content:**\n"
                f"{reply.body}\n"
                f"─────────────────────────\n\n"
                f"{parent_message.body}\n"
            )
            html_content = markdown.markdown(reply.body)
            reply.body = html_content
            reply.save()
            MessageStatus.objects.create(message=reply, profile=reply.recipient)
            if reply.recipient != reply.sender:
                status = MessageStatus.objects.create(message=reply, profile=request.user)
                status.mark_as_read()

            return redirect('message-inbox')
    else:
        form = MessageForm()

    context = {
        'parent_message': parent_message,
        'form': form,
        'sender': sender,
        'recipient': recipient,
        'current_time': current_time,
    }

    return render(request, 'messages/reply_message.html', context)


@login_required
def delete_message(request, pk):
    message = get_object_or_404(Message, pk=pk)
    user_profile = request.user

    try:
        status = message.statuses.get(profile=user_profile)
    except MessageStatus.DoesNotExist:
        return HttpResponse("You are not allowed to delete this message.", status=403)

    if request.method == 'POST':
        status.is_deleted = True
        status.save()

        if not message.statuses.filter(is_deleted=False).exists():
            message.delete()

        return redirect('message-inbox')

    return render(request, 'messages/message-delete.html', {'message': message})


@login_required
def message_inbox(request):
    filter_type = request.GET.get('filter', 'inbox')
    user = request.user

    base_query = Message.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).select_related('sender', 'recipient').prefetch_related(
        'statuses'
    )

    if filter_type == 'unread':
        messages = base_query.filter(
            recipient=user,
            statuses__profile=user,
            statuses__is_read=False,
            statuses__is_deleted=False
        ).distinct().order_by('-timestamp')

    elif filter_type == 'sent':
        messages = base_query.filter(
            sender=user,
            statuses__profile=user,
            statuses__is_deleted=False
        ).distinct().order_by('-timestamp')

    elif filter_type == 'all':
        messages = base_query.filter(
            statuses__profile=user,
            statuses__is_deleted=False
        ).distinct().order_by('-timestamp')

    else:
        messages = base_query.filter(
            recipient=user,
            statuses__profile=user,
            statuses__is_deleted=False
        ).distinct().order_by('-timestamp')

    paginator = Paginator(messages, 5)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'messages': page_obj,
        'filter_type': filter_type
    }

    return render(request, 'messages/message-inbox.html', context)
