from django import template
from django.db.models import Q, Max

from ..models import Message, MessageStatus

register = template.Library()


def get_root(message):
    root = message
    while root.parent_message_id:
        root = root.parent_message
    return root


def get_conversation_ids(root):
    """Връща списък с id-тата на всички съобщения в conversation-а."""
    ids = [root.id]
    current = [root]
    while current:
        children = list(Message.objects.filter(parent_message__in=current).only('id'))
        if not children:
            break
        ids.extend([c.id for c in children])
        current = children
    return ids


def get_user_conversations(user, filter_type='all'):
    """
    Връща queryset от root съобщения (Conversations).
    """
    user_message_ids = MessageStatus.objects.filter(
        profile=user,
        is_deleted=False
    ).values_list('message_id', flat=True)

    messages = Message.objects.filter(id__in=user_message_ids).select_related(
        'sender', 'recipient', 'sender__profile', 'recipient__profile'
    )

    roots = {}
    for msg in messages:
        root = get_root(msg)
        roots[root.id] = root

    root_qs = Message.objects.filter(id__in=roots.keys()).select_related(
        'sender', 'recipient', 'sender__profile', 'recipient__profile'
    )

    if filter_type == 'inbox':
        root_qs = root_qs.filter(
            Q(recipient=user) | Q(replies__recipient=user)
        ).distinct()

    elif filter_type == 'sent':
        root_qs = root_qs.filter(
            Q(sender=user) | Q(replies__sender=user)
        ).distinct()

    elif filter_type == 'unread':
        unread_ids = MessageStatus.objects.filter(
            profile=user,
            is_read=False,
            is_deleted=False
        ).values_list('message_id', flat=True)

        unread_roots = set()
        for mid in unread_ids:
            try:
                m = Message.objects.get(id=mid)
                unread_roots.add(get_root(m).id)
            except Message.DoesNotExist:
                continue
        root_qs = root_qs.filter(id__in=unread_roots)

    return root_qs.annotate(
        last_activity=Max('replies__timestamp')
    ).order_by('-last_activity', '-timestamp')


@register.simple_tag
def message_counts(user):

    unread_count = MessageStatus.objects.filter(
        profile=user,
        is_read=False,
        is_deleted=False
    ).count()

    inbox_count = get_user_conversations(user, 'inbox').count()
    sent_count = get_user_conversations(user, 'sent').count()
    all_count = get_user_conversations(user, 'all').count()

    return {
        'unread_count': unread_count,
        'inbox_count': inbox_count,
        'sent_count': sent_count,
        'all_count': all_count,
    }


@register.simple_tag
def conversation_read_status(root_message, user):
    ids = get_conversation_ids(root_message)
    has_unread = MessageStatus.objects.filter(
        message_id__in=ids,
        profile=user,
        is_read=False,
        is_deleted=False
    ).exists()
    return 'unread' if has_unread else 'read'
