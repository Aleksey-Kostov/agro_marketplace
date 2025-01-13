from django.contrib import admin
from .models import Message, MessageStatus
from django.db.models import Case, When, Value, IntegerField, F


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'sender', 'recipient', 'title', 'timestamp', 'parent_message')
    list_filter = ('timestamp', 'sender', 'recipient')
    search_fields = ('sender__username', 'recipient__username', 'title', 'body')
    ordering = ('-timestamp',)

    fieldsets = (
        (None, {
            'fields': ('sender', 'recipient', 'title', 'body')
        }),
        ('Additional Info', {
            'fields': ('timestamp', 'parent_message')
        }),
    )


@admin.register(MessageStatus)
class MessageStatusAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'profile', 'is_read', 'is_deleted', 'read_at')
    list_filter = ('is_read', 'is_deleted', 'read_at')
    search_fields = ('message__title', 'profile__username')

    def get_ordering(self, request):
        return [
            Case(
                When(read_at__isnull=True, then=Value(1)),
                When(read_at__isnull=False, then=Value(0)),
                output_field=IntegerField()
            ),
            F('read_at').desc(nulls_last=True)
        ]

    fieldsets = (
        (None, {
            'fields': ('message', 'profile')
        }),
        ('Status Info', {
            'fields': ('is_read', 'is_deleted', 'read_at')
        }),
    )
