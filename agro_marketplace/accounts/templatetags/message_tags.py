from django import template

from agro_marketplace.agro_messages.models import MessageStatus

register = template.Library()


@register.simple_tag
def unread_message_count(user):
    """
    Връща броя на непрочетените съобщения за текущия потребител.

    Броим само:
    - съобщения, получени от user
    - is_read=False
    - is_deleted=False
    - не system message
    - не изтрити съобщения
    """

    if not user or not user.is_authenticated:
        return 0

    unread_count = (
        MessageStatus.objects
        .filter(
            profile=user,
            is_read=False,
            is_deleted=False,
            message__recipient=user,
            message__is_removed=False,
        )
        .exclude(
            message__is_system=True,
        )
        .count()
    )

    return unread_count
