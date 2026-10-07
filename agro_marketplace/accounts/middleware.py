from django.utils import timezone


class UpdateLastSeenMiddleware:
    """
    Обновява last_seen най-много веднъж на ~60 сек,
    за да не пише в DB на всеки request.
    """

    THROTTLE_SECONDS = 60

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)

        if user is not None and user.is_authenticated:
            profile = getattr(user, 'profile', None)
            if profile is not None:
                now = timezone.now()
                last = profile.last_seen
                if last is None or (now - last).total_seconds() >= self.THROTTLE_SECONDS:
                    type(profile).objects.filter(pk=profile.pk).update(last_seen=now)
                    profile.last_seen = now

        return self.get_response(request)
