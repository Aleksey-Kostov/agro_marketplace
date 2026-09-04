from django import template
from django.db.models import Q, Max, Prefetch

from ..models import Message, MessageStatus

register = template.Library()


def get_root(message):
    root = message
    visited = set()
    while root.parent_message_id and root.id not in visited:
        visited.add(root.id)
        root = root.parent_message
    return root


def get_conversation_ids(root):
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

    user_message_ids = list(
        MessageStatus.objects.filter(
            profile=user,
            is_deleted=False
        ).values_list('message_id', flat=True)
    )

    if not user_message_ids:
        return []

    messages = (
        Message.objects
        .filter(id__in=user_message_ids)
        .select_related('sender', 'recipient', 'sender__profile', 'recipient__profile', 'parent_message')
    )

    roots_dict = {}
    for msg in messages:
        try:
            root = get_root(msg)
            roots_dict[root.id] = root
        except Exception:
            continue

    if not roots_dict:
        return []

    root_ids = list(roots_dict.keys())

    if filter_type == 'inbox':
        valid_ids = set()
        for rid in root_ids:
            root = roots_dict[rid]
            if root.recipient_id == user.id:
                valid_ids.add(rid)
                continue
            if Message.objects.filter(parent_message_id=rid, recipient=user).exists():
                valid_ids.add(rid)
        root_ids = list(valid_ids)

    elif filter_type == 'sent':
        valid_ids = set()
        for rid in root_ids:
            root = roots_dict[rid]
            if root.sender_id == user.id:
                valid_ids.add(rid)
                continue
            if Message.objects.filter(parent_message_id=rid, sender=user).exists():
                valid_ids.add(rid)
        root_ids = list(valid_ids)

    elif filter_type == 'unread':
        unread_msg_ids = set(
            MessageStatus.objects.filter(
                profile=user,
                is_read=False,
                is_deleted=False
            ).values_list('message_id', flat=True)
        )
        valid_ids = set()
        for mid in unread_msg_ids:
            try:
                m = Message.objects.get(id=mid)
                valid_ids.add(get_root(m).id)
            except Message.DoesNotExist:
                continue
        root_ids = [rid for rid in root_ids if rid in valid_ids]

    if not root_ids:
        return []

    roots = (
        Message.objects
        .filter(id__in=root_ids)
        .select_related('sender', 'recipient', 'sender__profile', 'recipient__profile')
        .annotate(last_activity=Max('replies__timestamp'))
        .order_by('-last_activity', '-timestamp')
    )

    return list(roots)


@register.simple_tag
def message_counts(user):
    unread_count = MessageStatus.objects.filter(
        profile=user,
        is_read=False,
        is_deleted=False
    ).count()

    inbox_count = len(get_user_conversations(user, 'inbox'))
    sent_count = len(get_user_conversations(user, 'sent'))
    all_count = len(get_user_conversations(user, 'all'))

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
