from django import template
from django.db.models import Q, Max

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
    ids = [root.id]
    current = [root]
    while current:
        children = list(Message.objects.filter(parent_message__in=current).only('id'))
        if not children:
            break
        ids.extend([c.id for c in children])
        current = children
    return ids


def _deleted_message_ids(user):
    return set(
        MessageStatus.objects.filter(
            profile=user,
            is_deleted=True
        ).values_list('message_id', flat=True)
    )


def get_user_conversations(user, filter_type='all'):
    deleted_ids = _deleted_message_ids(user)

    base = Message.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).select_related(
        'sender', 'recipient', 'sender__profile', 'recipient__profile', 'parent_message'
    )

    if deleted_ids:
        base = base.exclude(id__in=deleted_ids)

    roots_dict = {}
    for msg in base:
        try:
            root = get_root(msg)
            roots_dict[root.id] = root
        except Exception:
            continue

    if not roots_dict:
        return []

    root_ids = list(roots_dict.keys())

    if filter_type == 'inbox':
        # conversation, в който user е получател на поне 1 видимо съобщение
        valid = []
        for rid in root_ids:
            qs = Message.objects.filter(
                Q(id=rid) | Q(parent_message_id=rid)
            ).filter(recipient=user)
            if deleted_ids:
                qs = qs.exclude(id__in=deleted_ids)
            if qs.exists():
                valid.append(rid)
        root_ids = valid

    elif filter_type == 'sent':
        valid = []
        for rid in root_ids:
            qs = Message.objects.filter(
                Q(id=rid) | Q(parent_message_id=rid)
            ).filter(sender=user)
            if deleted_ids:
                qs = qs.exclude(id__in=deleted_ids)
            if qs.exists():
                valid.append(rid)
        root_ids = valid

    elif filter_type == 'unread':
        unread_ids = set(
            MessageStatus.objects.filter(
                profile=user,
                is_read=False,
                is_deleted=False
            ).values_list('message_id', flat=True)
        )
        # съобщения без status, където user е recipient → считаме unread
        known_status_ids = set(
            MessageStatus.objects.filter(profile=user).values_list('message_id', flat=True)
        )
        no_status = Message.objects.filter(recipient=user).exclude(id__in=known_status_ids)
        if deleted_ids:
            no_status = no_status.exclude(id__in=deleted_ids)
        unread_ids |= set(no_status.values_list('id', flat=True))

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

    return list(
        Message.objects.filter(id__in=root_ids)
        .select_related('sender', 'recipient', 'sender__profile', 'recipient__profile')
        .annotate(last_activity=Max('replies__timestamp'))
        .order_by('-last_activity', '-timestamp')
    )


@register.simple_tag
def message_counts(user):
    try:
        deleted_ids = _deleted_message_ids(user)

        # Navbar unread = отделни непрочетени съобщения
        unread_count = MessageStatus.objects.filter(
            profile=user,
            is_read=False,
            is_deleted=False
        ).count()

        # + recipient съобщения без status
        known = MessageStatus.objects.filter(profile=user).values_list('message_id', flat=True)
        extra_unread = Message.objects.filter(recipient=user).exclude(id__in=known)
        if deleted_ids:
            extra_unread = extra_unread.exclude(id__in=deleted_ids)
        unread_count += extra_unread.count()

        inbox_count = len(get_user_conversations(user, 'inbox'))
        sent_count = len(get_user_conversations(user, 'sent'))
        all_count = len(get_user_conversations(user, 'all'))
    except Exception:
        unread_count = inbox_count = sent_count = all_count = 0

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
    try:
        return message.reactions.filter(reaction=reaction_type).count()
    except Exception:
        return 0


@register.simple_tag
def user_reacted(message, user, reaction_type):
    try:
        return message.reactions.filter(user=user, reaction=reaction_type).exists()
    except Exception:
        return False


@register.simple_tag
def reaction_users(message, reaction_type):
    try:
        qs = (
            message.reactions
            .filter(reaction=reaction_type)
            .select_related('user', 'user__profile')
        )
        return [r.user for r in qs]
    except Exception:
        return []
