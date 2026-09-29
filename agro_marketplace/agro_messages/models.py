import pytz
from datetime import datetime
from django.conf import settings
from django.db import models

from .storages import (
    MessageImageStorage,
    MessageVideoStorage,
)

User = settings.AUTH_USER_MODEL


# =========================================================
# MESSAGE
# =========================================================

class Message(models.Model):
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_messages",
    )

    title = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    body = models.TextField(
        blank=True,
        null=True,
    )

    image = models.ImageField(
        "image",
        upload_to="",
        storage=MessageImageStorage(),
        blank=True,
        null=True,
    )

    video = models.FileField(
        "video",
        upload_to="",
        storage=MessageVideoStorage(),
        blank=True,
        null=True,
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
    )

    parent_message = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )

    is_system = models.BooleanField(
        default=False,
    )

    is_removed = models.BooleanField(
        default=False,
    )

    product_type = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_index=True,
    )

    product_id = models.PositiveIntegerField(
        blank=True,
        null=True,
        db_index=True,
    )

    def __str__(self):
        return (
            f"{self.sender} -> "
            f"{self.recipient}: "
            f"{(self.title or 'No Title')[:30]}"
        )

    @property
    def video_url(self):
        if not self.video:
            return ""

        try:
            return self.video.url
        except Exception:
            return ""


# =========================================================
# MESSAGE ATTACHMENT
# =========================================================

class MessageAttachment(models.Model):
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"

    ATTACHMENT_TYPE_CHOICES = (
        (IMAGE, "Image"),
        (VIDEO, "Video"),
        (FILE, "File"),
    )

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="attachments",
    )

    file = models.FileField(
        upload_to="message_attachments/",
    )

    original_name = models.CharField(
        max_length=255,
    )

    mime_type = models.CharField(
        max_length=100,
    )

    size = models.PositiveBigIntegerField()

    attachment_type = models.CharField(
        max_length=10,
        choices=ATTACHMENT_TYPE_CHOICES,
    )

    cloudinary_public_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    cloudinary_resource_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.original_name


# =========================================================
# MESSAGE STATUS
# =========================================================

class MessageStatus(models.Model):
    class Meta:
        verbose_name = "Messages Status"
        verbose_name_plural = "Messages Status"

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="statuses",
    )

    profile = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="message_statuses",
    )

    is_read = models.BooleanField(
        default=False,
    )

    is_deleted = models.BooleanField(
        default=False,
    )

    read_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True

            tz = pytz.timezone(
                "Europe/Sofia"
            )

            self.read_at = datetime.now(tz)

            self.save()


# =========================================================
# MESSAGE REPORT
# =========================================================

class MessageReport(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reports",
    )

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_reports",
    )

    reason = models.TextField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    is_resolved = models.BooleanField(
        default=False,
    )

    class Meta:
        ordering = ["-created_at"]


# =========================================================
# BLOCKED USER
# =========================================================

class BlockedUser(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_users",
    )

    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_by",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        unique_together = (
            "blocker",
            "blocked",
        )


# =========================================================
# MESSAGE REACTION
# =========================================================

class MessageReaction(models.Model):
    LIKE = "like"
    HEART = "heart"

    REACTION_CHOICES = (
        (LIKE, "Like"),
        (HEART, "Heart"),
    )

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_reactions",
    )

    reaction = models.CharField(
        max_length=10,
        choices=REACTION_CHOICES,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        unique_together = (
            "message",
            "user",
            "reaction",
        )
