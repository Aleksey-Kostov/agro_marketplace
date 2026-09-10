import pytz
from django.db import models
from django.conf import settings
from datetime import datetime
from cloudinary.models import CloudinaryField

User = settings.AUTH_USER_MODEL


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    title = models.CharField(max_length=255, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    image = CloudinaryField('image', folder='message_images', blank=True, null=True)
    video = CloudinaryField(
        'video',
        resource_type='video',
        folder='message_videos',
        blank=True,
        null=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    parent_message = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies'
    )
    is_system = models.BooleanField(default=False)
    is_removed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.sender} -> {self.recipient}: {(self.title or 'No Title')[:30]}"

    @property
    def video_url(self):
        if not self.video:
            return ''
        name = str(self.video)
        if name.startswith('http'):
            return name

        from django.conf import settings
        url = getattr(settings, 'CLOUDINARY_URL', '') or ''
        cloud_name = ''
        if '@' in url:
            cloud_name = url.split('@')[-1].strip()

        if not cloud_name:
            # локален fallback
            try:
                return self.video.url
            except Exception:
                return ''

        return f'https://res.cloudinary.com/{cloud_name}/video/upload/{name}'


class MessageStatus(models.Model):
    class Meta:
        verbose_name = "Messages Status"
        verbose_name_plural = "Messages Status"

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='statuses')
    profile = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_statuses')
    is_read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            tz = pytz.timezone("Europe/Sofia")
            self.read_at = datetime.now(tz)
            self.save()


class MessageReport(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reports'
    )
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class BlockedUser(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_users'
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')


class MessageReaction(models.Model):
    LIKE = 'like'
    HEART = 'heart'
    REACTION_CHOICES = (
        (LIKE, 'Like'),
        (HEART, 'Heart'),
    )

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reactions')
    reaction = models.CharField(max_length=10, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user', 'reaction')
