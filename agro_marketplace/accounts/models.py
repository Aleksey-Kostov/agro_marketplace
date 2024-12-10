from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.db import models

from agro_marketplace.accounts.choices import CountryCode
from agro_marketplace.accounts.managers import AppUserManager


class AppUser(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(
        max_length=100,
        unique=True
    )
    email = models.EmailField(
        unique=True
    )

    is_active = models.BooleanField(
        default=True
    )
    is_staff = models.BooleanField(
        default=False
    )

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    objects = AppUserManager()

    def __str__(self):
        return self.username


UserModel = get_user_model()


class Profile(models.Model):

    user = models.OneToOneField(
        to=UserModel,
        on_delete=models.CASCADE,
        primary_key=True,
    )
    profile_photo = models.ImageField(
        upload_to='profile_photo/',
        blank=True,
        null=True
    )

    full_name = models.CharField(
        max_length=100,
        null=True,
        blank=True)

    username_in_marketplace = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True)

    email = models.EmailField(
        default='default@example.com'
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        null=True
    )

    country_code = models.CharField(
        max_length=5,
        choices=CountryCode.choices,
        blank=True,
        null=True
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
        null=True
    )

    town = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.full_name
