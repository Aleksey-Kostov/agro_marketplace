from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from agro_marketplace.accounts.models import Profile

UserModel = get_user_model()


class ProfileTests(TestCase):
    def setUp(self):
        self.user = UserModel.objects.create_user(
            username='test_user',
            email='testuser@gmail.com',
            password='password123'
        )

        self.other_user = UserModel.objects.create_user(
            username='other_user',
            email='otheruser@gmail.com',
            password='password123'
        )

        self.profile = self.user.profile
        self.profile2 = self.other_user.profile

    def test_user_registration_creates_profile(self):
        """Test profile creation during user registration."""
        self.assertIsNotNone(self.profile)
        self.assertEqual(self.profile.full_name, self.user.username)
        self.assertEqual(self.profile.email, self.user.email)

    def test_create_profile_on_user_creation(self):
        """Test that the profile is created when the user is created."""
        # Check that the profile was created
        self.assertIsNotNone(self.profile)
        self.assertEqual(self.profile.user, self.user)
        self.assertEqual(self.profile.full_name, 'test_user')  # This is set by the signal
        self.assertEqual(self.profile.username_in_marketplace, 'test_user-Agro')  # Set by the signal
        self.assertEqual(self.profile.email, 'testuser@gmail.com')

    def test_edit_profile_view(self):
        """Test updating profile and changing the password."""
        # Log in with the test user
        self.client.login(username='test_user', password='password123')

        response = self.client.post(
            reverse('profile-edit', args=[self.user.pk]),
            data={
                'full_name': 'Updated Name',
                'description': 'Updated Description',
                'email': 'testuser@gmail.com',
                'new_password': 'newpassword123',
                'confirm_password': 'newpassword123',
            }
        )

        self.assertEqual(response.status_code, 302)

        self.profile.refresh_from_db()
        self.user.refresh_from_db()

        self.assertEqual(self.profile.full_name, 'Updated Name')
        self.assertEqual(self.profile.description, 'Updated Description')
        self.assertEqual(self.user.email, 'testuser@gmail.com')

        self.assertTrue(self.user.check_password('newpassword123'))

    def test_profile_deletion(self):
        """Test that deleting a profile also deletes the associated user."""
        self.client.login(username='test_user', password='password123')
        response = self.client.post(reverse('profile-delete', args=[self.profile.pk]))
        self.assertEqual(response.status_code, 302)  # Redirect after deletion
        with self.assertRaises(Profile.DoesNotExist):
            Profile.objects.get(pk=self.profile.pk)
        with self.assertRaises(UserModel.DoesNotExist):
            UserModel.objects.get(pk=self.user.pk)

    def test_unauthorized_profile_deletion(self):
        """Test that users cannot delete other users' profiles."""

        self.client.login(username='other_user', password='password123')
        response = self.client.post(reverse('profile-delete', args=[self.profile.pk]))
        self.assertEqual(response.status_code, 403)

    def test_active_listings_view(self):
        """Test retrieving active listings."""
        self.client.login(username='test_user', password='password123')
        response = self.client.get(reverse('active-listings', args=[self.profile.pk]))
        self.assertEqual(response.status_code, 200)

    def test_inactive_listings_view(self):
        """Test retrieving inactive listings."""
        self.client.login(username='test_user', password='password123')
        response = self.client.get(reverse('inactive-listings', args=[self.profile.pk]))
        self.assertEqual(response.status_code, 200)
