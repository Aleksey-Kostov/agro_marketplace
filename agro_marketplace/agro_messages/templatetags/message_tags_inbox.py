from django import template
from django.db.models import Max

from ..models import Message, MessageStatus

register = template.Library()


def get_root(message):
    root = message
    visited = set()
    while root.parent_message_id and root.id not in visited:
        visited.add(root.id)
        try:
            root = root.parent_message
        except Message.DoesNotExist:
            break
    return root


def get_conversation_ids(root):
    """Връща всички id-та в conversation-а."""
    ids = [root.id]
    current = [root]
    while current:
        children = list(
            Message.objects.filter(parent_message__in=current).only('id')
        )
        if not children:
            break
        ids.extend([c.id for c in children])
        current = children
    return ids


def get_user_conversations(user, filter_type='all'):
    # Всички съобщения, в които user участва
    messages = Message.objects.filter(
        models.Q(sender=user) | models.Q(recipient=user)
    ).select_related(
        'sender', 'recipient', 'sender__profile', 'recipient__profile', 'parent_message'
    )

    # Махаме soft-deleted за този user (ако има status)
    deleted_ids = set(
        MessageStatus.objects.filter(
            profile=user, is_deleted=True
        ).values_list('message_id', flat=True)
    )

    roots_dict = {}
    for msg in messages:
        if msg.id in deleted_ids:
            continue
        try:
            root = get_root(msg)
            # ако root е изтрит за user — пропускаме целия conversation само ако ВСИЧКИ са изтрити
            roots_dict[root.id] = root
        except Exception:
            continue

    if not roots_dict:
        return []

    root_ids = list(roots_dict.keys())

    # филтри inbox/sent/unread...
    if filter_type == 'inbox':
        valid = []
        for rid in root_ids:
            root = roots_dict[rid]
            if root.recipient_id == user.id or Message.objects.filter(
                    parent_message_id=rid, recipient=user
            ).exclude(id__in=deleted_ids).exists():
                valid.append(rid)
            elif root.recipient_id == user.id:
                valid.append(rid)
        root_ids = list(set(valid)) or root_ids

    elif filter_type == 'sent':
        valid = []
        for rid in root_ids:
            root = roots_dict[rid]
            if root.sender_id == user.id or Message.objects.filter(
                    parent_message_id=rid, sender=user
            ).exclude(id__in=deleted_ids).exists():
                valid.append(rid)
        root_ids = list(set(valid)) or root_ids

    elif filter_type == 'unread':
        unread_ids = set(
            MessageStatus.objects.filter(
                profile=user, is_read=False, is_deleted=False
            ).values_list('message_id', flat=True)
        )
        # също съобщения без status, където user е recipient
        no_status_unread = Message.objects.filter(
            recipient=user
        ).exclude(
            id__in=MessageStatus.objects.filter(profile=user).values_list('message_id', flat=True)
        ).values_list('id', flat=True)
        unread_ids |= set(no_status_unread)

        valid = set()
        for mid in unread_ids:
            try:
                m = Message.objects.get(pk=mid)
                valid.add(get_root(m).id)
            except Message.DoesNotExist:
                continue
        root_ids = [rid for rid in root_ids if rid in valid]

    if not root_ids:
        return []

    roots = list(
        Message.objects.filter(id__in=root_ids)
        .select_related('sender', 'recipient', 'sender__profile', 'recipient__profile')
        .annotate(last_activity=Max('replies__timestamp'))
        .order_by('-last_activity', '-timestamp')
    )
    return roots


@register.simple_tag
def message_counts(user):
    try:
        unread_count = MessageStatus.objects.filter(
            profile=user,
            is_read=False,
            is_deleted=False
        ).count()

        inbox_count = len(get_user_conversations(user, 'inbox'))
        sent_count = len(get_user_conversations(user, 'sent'))
        all_count = len(get_user_conversations(user, 'all'))
    except Exception:
        unread_count = 0
        inbox_count = 0
        sent_count = 0
        all_count = 0

    return {
        'unread_count': unread_count,
        'inbox_count': inbox_count,
        'sent_count': sent_count,
        'all_count': all_count,
    }


@register.simple_tag
def conversation_read_status(root_message, user):
    try:
        ids = get_conversation_ids(root_message)
        has_unread = MessageStatus.objects.filter(
            message_id__in=ids,
            profile=user,
            is_read=False,
            is_deleted=False
        ).exists()
        return 'unread' if has_unread else 'read'
    except Exception:
        return 'read'


@register.simple_tag
def reaction_count(message, reaction_type):
    return message.reactions.filter(reaction=reaction_type).count()


@register.simple_tag
def user_reacted(message, user, reaction_type):
    return message.reactions.filter(user=user, reaction=reaction_type).exists()
