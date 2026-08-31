import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the configured superuser if it does not already exist"

    def handle(self, *args, **options):
        User = get_user_model()

        username = os.environ["DJANGO_SUPERUSER_USERNAME"]
        email = os.environ["DJANGO_SUPERUSER_EMAIL"]
        password = os.environ["DJANGO_SUPERUSER_PASSWORD"]

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                "SUPERUSER: username already exists - not created"
            )
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(
                "SUPERUSER: email already exists - not created"
            )
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )

        self.stdout.write(
            self.style.SUCCESS("SUPERUSER: created successfully")
        )
      
