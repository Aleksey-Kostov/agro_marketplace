from django.core.paginator import Paginator
from django.db.models import Q, Exists, OuterRef
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


# ============================================================
# SEND MESSAGE
# ============================================================

@login_required
def send_message(request, pk=None):
    recipient = get_object_or_404(AppUser, pk=pk) if pk else None
    product = None

    if pk:
        product = (
            SellerItems.objects.filter(
                profile__user=pk
            ).first()
            or BuyerItems.objects.filter(
                profile__user=pk
            ).first()
        )

    if request.method == 'POST':

        form = MessageForm(request.POST)

        if form.is_valid():

            message = form.save(commit=False)

            message.sender = request.user
            message.recipient = recipient

            # Body contains ONLY the actual message
            message.body = markdown.markdown(
                message.body
            )

            message.save()

            # Status for recipient
            MessageStatus.objects.create(
                message=message,
                profile=recipient
            )

            # Status for sender
            if message.recipient != message.sender:

                status = MessageStatus.objects.create(
                    message=message,
                    profile=request.user
                )

                status.mark_as_read()

            return redirect(
                'read-message',
                pk=message.pk
            )

    else:
        form = MessageForm()

    context = {
        'form': form,
        'recipient': recipient,
        'product': product,
    }

    return render(
        request,
        'messages/message-send.html',
        context
    )


# ============================================================
# READ MESSAGE / CONVERSATION
# ============================================================

@login_required
def read_message(request, pk):

    message = get_object_or_404(
        Message.objects.select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message'
        ),
        pk=pk
    )

    current_user = request.user

    # User must be sender or recipient
    if current_user not in [
        message.sender,
        message.recipient
    ]:
        return HttpResponse(
            "You are not authorized to view this message.",
            status=403
        )

    # --------------------------------------------------------
    # Find root message
    # --------------------------------------------------------

    root_message = message

    while root_message.parent_message_id:

        root_message = root_message.parent_message

    # --------------------------------------------------------
    # Build complete conversation
    # --------------------------------------------------------

    conversation_messages = [
        root_message
    ]

    current_level = [
        root_message
    ]

    while current_level:

        next_level = list(
            Message.objects.filter(
                parent_message__in=current_level
            )
            .select_related(
                'sender__profile',
                'recipient__profile'
            )
            .order_by('timestamp')
        )

        if not next_level:
            break

        conversation_messages.extend(
            next_level
        )

        current_level = next_level

    # --------------------------------------------------------
    # Mark conversation as read
    # --------------------------------------------------------

    statuses = MessageStatus.objects.filter(
        message__in=conversation_messages,
        profile=current_user,
        is_deleted=False
    )

    for status in statuses:
        status.mark_as_read()

    context = {
        'message': message,
        'root_message': root_message,
        'conversation_messages': conversation_messages,
    }

    return render(
        request,
        'messages/message-read.html',
        context
    )


# ============================================================
# REPLY MESSAGE
# ============================================================

@login_required
def reply_message(request, pk):

    parent_message = get_object_or_404(
        Message.objects.select_related(
            'sender__profile',
            'recipient__profile',
            'parent_message'
        ),
        Q(pk=pk) & (
            Q(sender=request.user) |
            Q(recipient=request.user)
        )
    )

    sender = request.user

    # --------------------------------------------------------
    # Determine recipient
    # --------------------------------------------------------

    if parent_message.recipient == request.user:

        recipient = parent_message.sender

    else:

        recipient = parent_message.recipient

    # --------------------------------------------------------
    # Find root message
    # --------------------------------------------------------

    root_message = parent_message

    while root_message.parent_message_id:

        root_message = root_message.parent_message

    # --------------------------------------------------------
    # Keep original conversation title
    # --------------------------------------------------------

    reply_title = root_message.title or "Message"

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    if request.method == 'POST':

        form = MessageForm(request.POST)

        if form.is_valid():

            reply = form.save(commit=False)

            reply.sender = sender
            reply.recipient = recipient

            # Same title for the conversation
            reply.title = reply_title

            # Connect reply to parent message
            reply.parent_message = parent_message

            # Body contains ONLY the actual reply
            reply.body = markdown.markdown(
                reply.body
            )

            reply.save()

            # Status for recipient
            MessageStatus.objects.create(
                message=reply,
                profile=reply.recipient
            )

            # Status for sender
            if reply.recipient != reply.sender:

                status = MessageStatus.objects.create(
                    message=reply,
                    profile=request.user
                )

                status.mark_as_read()

            return redirect(
                'read-message',
                pk=reply.pk
            )

    else:

        form = MessageForm()

    context = {
        'parent_message': parent_message,
        'root_message': root_message,
        'form': form,
        'sender': sender,
        'recipient': recipient,
    }

    return render(
        request,
        'messages/reply_message.html',
        context
    )


# ============================================================
# DELETE MESSAGE
# ============================================================

@login_required
def delete_message(request, pk):

    message = get_object_or_404(
        Message,
        pk=pk
    )

    user_profile = request.user

    try:

        status = message.statuses.get(
            profile=user_profile
        )

    except MessageStatus.DoesNotExist:

        return HttpResponse(
            "You are not allowed to delete this message.",
            status=403
        )

    if request.method == 'POST':

        status.is_deleted = True
        status.save()

        # Physically delete only when nobody has the message
        if not message.statuses.filter(
            is_deleted=False
        ).exists():

            message.delete()

        return redirect(
            'message-inbox'
        )

    return render(
        request,
        'messages/message-delete.html',
        {
            'message': message
        }
    )


# ============================================================
# MESSAGE INBOX
# ============================================================

@login_required
def message_inbox(request):

    filter_type = request.GET.get(
        'filter',
        'inbox'
    )

    user = request.user

    # --------------------------------------------------------
    # Status belonging to current user
    # --------------------------------------------------------

    user_status = MessageStatus.objects.filter(
        message=OuterRef('pk'),
        profile=user,
        is_deleted=False
    )

    # --------------------------------------------------------
    # Base query
    # --------------------------------------------------------

    base_query = (
        Message.objects
        .filter(
            Q(sender=user) |
            Q(recipient=user)
        )
        .select_related(
            'sender',
            'sender__profile',
            'recipient',
            'recipient__profile'
        )
        .annotate(
            has_user_status=Exists(
                user_status
            )
        )
        .filter(
            has_user_status=True
        )
    )

    # --------------------------------------------------------
    # UNREAD
    # --------------------------------------------------------

    if filter_type == 'unread':

        unread_status = MessageStatus.objects.filter(
            message=OuterRef('pk'),
            profile=user,
            is_read=False,
            is_deleted=False
        )

        messages = (
            base_query
            .filter(
                recipient=user
            )
            .annotate(
                is_unread=Exists(
                    unread_status
                )
            )
            .filter(
                is_unread=True
            )
            .order_by('-timestamp')
        )

    # --------------------------------------------------------
    # SENT
    # --------------------------------------------------------

    elif filter_type == 'sent':

        messages = (
            base_query
            .filter(
                sender=user
            )
            .order_by('-timestamp')
        )

    # --------------------------------------------------------
    # ALL
    # --------------------------------------------------------

    elif filter_type == 'all':

        messages = (
            base_query
            .order_by('-timestamp')
        )

    # --------------------------------------------------------
    # INBOX
    # --------------------------------------------------------

    else:

        messages = (
            base_query
            .filter(
                recipient=user
            )
            .order_by('-timestamp')
        )

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    paginator = Paginator(
        messages,
        5
    )

    page_number = request.GET.get(
        'page'
    )

    page_obj = paginator.get_page(
        page_number
    )

    context = {
        'messages': page_obj,
        'filter_type': filter_type,
    }

    return render(
        request,
        'messages/message-inbox.html',
        context
    )
