from django.test import TestCase
from django.contrib.auth import get_user_model
from agro_marketplace.accounts.models import Profile

UserModel = get_user_model()


class ProfileSignalTest(TestCase):
    def setUp(self):
        # Create an AppUser
        self.user = UserModel.objects.create_user(
            username='test_user',
            email='test@abv.bg',
            password='password123'
        )

    def test_profile_created_on_user_creation(self):
        profile = Profile.objects.get(user=self.user)
        self.assertEqual(profile.full_name, self.user.username)
        self.assertEqual(profile.email, self.user.email)
        self.assertEqual(profile.username_in_marketplace, f"{self.user.username}-Agro")

    def test_profile_updated_on_user_update(self):
        self.user.username = 'new_username'
        self.user.save()

        profile = Profile.objects.get(user=self.user)
        self.assertEqual(profile.user.username, 'new_username')


