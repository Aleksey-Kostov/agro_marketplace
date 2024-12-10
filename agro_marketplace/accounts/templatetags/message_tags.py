from django import template

from agro_marketplace.agro_messages.models import MessageStatus

register = template.Library()


@register.simple_tag
def unread_message_count(user):
    """
    Returns the count of unread messages for the given user.
    """
    if user.is_authenticated:
        unread_count = MessageStatus.objects.filter(profile=user,
                                                    is_read=False,
                                                    is_deleted=False).count()
        return unread_count
