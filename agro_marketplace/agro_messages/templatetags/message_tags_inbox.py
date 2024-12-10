from django import template
from django.db.models import Q

from ..models import Message, MessageStatus

register = template.Library()


@register.simple_tag
def message_counts(user):
    """
    Returns counts of messages for the given user, including unread, inbox, sent, and all messages.
    """
    unread_count = MessageStatus.objects.filter(
        profile=user,
        is_read=False,
        is_deleted=False
    ).count()

    inbox_count = Message.objects.filter(
        recipient=user,
        statuses__profile=user,
        statuses__is_deleted=False
    ).distinct().count()

    sent_count = Message.objects.filter(
        sender=user,
        statuses__profile=user,
        statuses__is_deleted=False
    ).distinct().count()

    all_count = Message.objects.filter(
        Q(sender=user) | Q(recipient=user),
        statuses__profile=user,
        statuses__is_deleted=False
    ).distinct().count()

    return {
        'unread_count': unread_count,
        'inbox_count': inbox_count,
        'sent_count': sent_count,
        'all_count': all_count,
    }


@register.simple_tag
def message_read_status(message, user):
    """
    Returns the read status ('read' or 'unread') of a specific message for the given user.
    """
    status = MessageStatus.objects.filter(message=message, profile=user, is_deleted=False).first()
    return 'read' if status and status.is_read else 'unread'
