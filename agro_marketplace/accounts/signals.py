from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AppUser, Profile


@receiver(post_save, sender=AppUser)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(
            user=instance,
            full_name=instance.username,
            email=instance.email,
            username_in_marketplace=instance.username + '-Agro'
        )


@receiver(post_save, sender=AppUser)
def save_profile(sender, instance, **kwargs):
    instance.profile.save()
