from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import AppUser, Profile


@admin.register(AppUser)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active')

    # Fieldsets for user details in the admin
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'), {'fields': ('email',)}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login',)}),
    )

    # Fields for the add user form
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
    )

    search_fields = ('username', 'email')
    ordering = ('username',)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'username_in_marketplace', 'email', 'phone', 'town', 'country_code')
    list_filter = ('country_code', 'town', 'created_at')
    readonly_fields = ('created_at',)

    # Fields for profile details in the admin
    fieldsets = (
        (None, {'fields': ('user', 'profile_photo')}),
        ('Personal Info', {'fields': ('full_name', 'username_in_marketplace', 'email', 'description')}),
        ('Contact Info', {'fields': ('country_code', 'phone', 'town')}),
        ('Important Dates', {'fields': ('created_at',)}),
    )

    search_fields = ('full_name', 'username_in_marketplace', 'email', 'phone', 'town')
    ordering = ('created_at',)
