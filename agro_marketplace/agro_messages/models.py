import pytz
from django.db import models
from django.conf import settings
from datetime import datetime

User = settings.AUTH_USER_MODEL


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    title = models.CharField(max_length=255, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    parent_message = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')

    def __str__(self):
        return f"{self.sender} -> {self.recipient}: {self.title[:30]}"


class MessageStatus(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='statuses')
    profile = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_statuses')
    is_read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            timezone = pytz.timezone("Europe/Sofia")
            current_time = datetime.now(timezone)
            self.read_at = current_time
            self.save()
