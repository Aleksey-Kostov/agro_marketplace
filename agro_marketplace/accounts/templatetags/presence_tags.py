from django import template
from django.utils import timezone

register = template.Library()

ONLINE_WINDOW_SECONDS = 5 * 60  # 5 мин = online (като Telegram)


@register.filter
def last_seen_label(profile):
    """
    Връща: 'online' | 'last seen just now' | 'last seen 5 minutes ago' | ...
    """
    if profile is None:
        return ''

    last = getattr(profile, 'last_seen', None)
    if last is None:
        return ''

    now = timezone.now()
    if timezone.is_naive(last):
        last = timezone.make_aware(last, timezone.get_current_timezone())

    delta = now - last
    seconds = int(delta.total_seconds())

    if seconds < 0:
        seconds = 0

    if seconds <= ONLINE_WINDOW_SECONDS:
        return 'online'

    minutes = seconds // 60
    hours = seconds // 3600
    days = seconds // 86400

    if minutes < 1:
        return 'last seen just now'
    if minutes == 1:
        return 'last seen 1 minute ago'
    if minutes < 60:
        return f'last seen {minutes} minutes ago'
    if hours == 1:
        return 'last seen 1 hour ago'
    if hours < 24:
        return f'last seen {hours} hours ago'
    if days == 1:
        return 'last seen yesterday'
    if days < 7:
        return f'last seen {days} days ago'

    return 'last seen ' + last.strftime('%d.%m.%Y')


@register.filter
def is_online(profile):
    if profile is None:
        return False
    last = getattr(profile, 'last_seen', None)
    if last is None:
        return False
    now = timezone.now()
    if timezone.is_naive(last):
        last = timezone.make_aware(last, timezone.get_current_timezone())
    return (now - last).total_seconds() <= ONLINE_WINDOW_SECONDS
