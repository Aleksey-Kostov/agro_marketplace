from django import template
from django.db.models import Q

from ..models import Message, MessageStatus

register = template.Library()


def _conversation_filter(message):
    """
    Всички съобщения между двамата участници.
    parent_message НЕ участва в определянето на conversation-а.
    """
    return (
            Q(
                sender_id=message.sender_id,
                recipient_id=message.recipient_id,
            )
            |
            Q(
                sender_id=message.recipient_id,
                recipient_id=message.sender_id,
            )
    )


def get_root(message):
    """
    Запазено за backwards compatibility.

    Вече няма истински 'root' на conversation.
    Връщаме най-старото съобщение между двамата участници.
    """
    if not message:
        return None

    return (
        Message.objects
        .filter(_conversation_filter(message))
        .exclude(is_removed=True)
        .order_by('timestamp', 'pk')
        .first()
    )


def get_conversation_ids(root):
    """
    Връща ID-тата на ВСИЧКИ съобщения между двамата участници.

    Не използва parent_message.
    """
    if not root:
        return []

    return list(
        Message.objects
        .filter(_conversation_filter(root))
        .exclude(is_removed=True)
        .values_list('id', flat=True)
    )


def _deleted_message_ids(user):
    if not user or not user.is_authenticated:
        return set()

    return set(
        MessageStatus.objects
        .filter(
            profile=user,
            is_deleted=True,
        )
        .values_list('message_id', flat=True)
    )


def _visible_messages_for_user(user):
    """
    Всички съобщения, които могат да се виждат от user.
    """
    if not user or not user.is_authenticated:
        return Message.objects.none()

    deleted_ids = _deleted_message_ids(user)

    qs = (
        Message.objects
        .filter(
            Q(sender=user) | Q(recipient=user)
        )
        .exclude(is_removed=True)
        .select_related(
            'sender',
            'recipient',
            'sender__profile',
            'recipient__profile',
            'parent_message',
            'parent_message__sender',
            'parent_message__recipient',
        )
    )

    if deleted_ids:
        qs = qs.exclude(id__in=deleted_ids)

    return qs


def _conversation_key(message):
    """
    Conversation се идентифицира само от двамата участници.

    Така:
        A -> B
        B -> A

    са една и съща conversation.
    """
    return tuple(sorted((message.sender_id, message.recipient_id)))


def _has_unread_for_user(message_ids, user):
    if not message_ids:
        return False

    return MessageStatus.objects.filter(
        message_id__in=message_ids,
        profile=user,
        is_read=False,
        is_deleted=False,
    ).exists()


def get_user_conversations(user, filter_type='all'):
    """
    Връща по един representative message за всяка conversation.

    ВАЖНО:
    parent_message НЕ се използва за групиране.

    Representative message = последното видимо съобщение
    в conversation-а.
    """
    if not user or not user.is_authenticated:
        return []

    messages = list(
        _visible_messages_for_user(user)
        .order_by('timestamp', 'pk')
    )

    if not messages:
        return []

    # ---------------------------------------------------------
    # Групиране по двамата участници
    # ---------------------------------------------------------
    conversations = {}

    for message in messages:
        key = _conversation_key(message)

        if key not in conversations:
            conversations[key] = []

        conversations[key].append(message)

    result = []

    # ---------------------------------------------------------
    # Филтри
    # ---------------------------------------------------------
    for key, conversation_messages in conversations.items():

        # chronological
        conversation_messages.sort(
            key=lambda m: (
                m.timestamp,
                m.pk,
            )
        )

        message_ids = [m.id for m in conversation_messages]

        # -----------------------------------------------------
        # INBOX
        # Има поне едно входящо съобщение към user.
        # -----------------------------------------------------
        if filter_type == 'inbox':
            if not any(
                    m.recipient_id == user.id
                    for m in conversation_messages
            ):
                continue

        # -----------------------------------------------------
        # SENT
        # Има поне едно изпратено от user съобщение.
        # -----------------------------------------------------
        elif filter_type == 'sent':
            if not any(
                    m.sender_id == user.id
                    for m in conversation_messages
            ):
                continue

        # -----------------------------------------------------
        # UNREAD
        # Има unread съобщение към user.
        # -----------------------------------------------------
        elif filter_type == 'unread':
            unread_ids = set(
                MessageStatus.objects.filter(
                    profile=user,
                    message_id__in=message_ids,
                    is_read=False,
                    is_deleted=False,
                ).values_list('message_id', flat=True)
            )

            # Съобщения към user без MessageStatus също са unread.
            status_ids = set(
                MessageStatus.objects.filter(
                    profile=user,
                    message_id__in=message_ids,
                ).values_list('message_id', flat=True)
            )

            no_status_ids = {
                m.id
                for m in conversation_messages
                if (
                        m.recipient_id == user.id
                        and m.id not in status_ids
                )
            }

            unread_ids |= no_status_ids

            if not unread_ids:
                continue

        # -----------------------------------------------------
        # Последното съобщение представлява conversation-а.
        # -----------------------------------------------------
        representative = conversation_messages[-1]

        result.append(representative)

    # ---------------------------------------------------------
    # Най-активните conversations първи.
    # ---------------------------------------------------------
    result.sort(
        key=lambda m: (
            m.timestamp,
            m.pk,
        ),
        reverse=True,
    )

    return result


@register.simple_tag
def message_counts(user):
    """
    Броячи за navbar/inbox.
    """
    if not user or not user.is_authenticated:
        return {
            'unread_count': 0,
            'inbox_count': 0,
            'sent_count': 0,
            'all_count': 0,
        }

    try:
        deleted_ids = _deleted_message_ids(user)

        # -----------------------------------------------------
        # UNREAD
        # -----------------------------------------------------
        unread_qs = MessageStatus.objects.filter(
            profile=user,
            is_read=False,
            is_deleted=False,
            message__recipient=user,
            message__is_removed=False,
        ).exclude(
            message__is_system=True
        )

        if deleted_ids:
            unread_qs = unread_qs.exclude(
                message_id__in=deleted_ids
            )

        unread_ids = set(
            unread_qs.values_list(
                'message_id',
                flat=True
            )
        )

        # -----------------------------------------------------
        # Съобщения към user без MessageStatus
        # -----------------------------------------------------
        known_status_ids = set(
            MessageStatus.objects
            .filter(profile=user)
            .values_list('message_id', flat=True)
        )

        no_status_qs = (
            Message.objects
            .filter(
                recipient=user,
                is_removed=False,
            )
            .exclude(is_system=True)
            .exclude(id__in=known_status_ids)
        )

        if deleted_ids:
            no_status_qs = no_status_qs.exclude(
                id__in=deleted_ids
            )

        unread_ids.update(
            no_status_qs.values_list('id', flat=True)
        )

        unread_count = len(unread_ids)

        # -----------------------------------------------------
        # Conversation counts
        # -----------------------------------------------------
        inbox_count = len(
            get_user_conversations(user, 'inbox')
        )

        sent_count = len(
            get_user_conversations(user, 'sent')
        )

        all_count = len(
            get_user_conversations(user, 'all')
        )

        return {
            'unread_count': unread_count,
            'inbox_count': inbox_count,
            'sent_count': sent_count,
            'all_count': all_count,
        }

    except Exception:
        return {
            'unread_count': 0,
            'inbox_count': 0,
            'sent_count': 0,
            'all_count': 0,
        }


@register.simple_tag
def conversation_read_status(root_message, user):
    """
    Проверява дали има unread съобщение в цялата conversation.

    Conversation се определя от participants, НЕ от parent_message.
    """
    try:
        if not root_message or not user or not user.is_authenticated:
            return 'read'

        ids = get_conversation_ids(root_message)

        if not ids:
            return 'read'

        has_unread = MessageStatus.objects.filter(
            message_id__in=ids,
            profile=user,
            is_read=False,
            is_deleted=False,
        ).exists()

        # Съобщения без status също се считат за unread.
        status_ids = set(
            MessageStatus.objects.filter(
                profile=user,
                message_id__in=ids,
            ).values_list('message_id', flat=True)
        )

        has_no_status_unread = Message.objects.filter(
            id__in=ids,
            recipient=user,
            is_removed=False,
        ).exclude(
            id__in=status_ids
        ).exists()

        return (
            'unread'
            if has_unread or has_no_status_unread
            else 'read'
        )

    except Exception:
        return 'read'


@register.simple_tag
def reaction_count(message, reaction_type):
    try:
        return message.reactions.filter(
            reaction=reaction_type
        ).count()
    except Exception:
        return 0


@register.simple_tag
def user_reacted(message, user, reaction_type):
    try:
        return message.reactions.filter(
            user=user,
            reaction=reaction_type,
        ).exists()
    except Exception:
        return False


@register.simple_tag
def reaction_users(message, reaction_type):
    try:
        qs = (
            message.reactions
            .filter(reaction=reaction_type)
            .select_related(
                'user',
                'user__profile',
            )
        )

        return [reaction.user for reaction in qs]

    except Exception:
        return []
