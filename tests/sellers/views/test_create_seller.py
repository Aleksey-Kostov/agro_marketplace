from datetime import timedelta

from django.test import TestCase, Client
from django.utils.timezone import now
from django.contrib.auth import get_user_model
from agro_marketplace.sellers.models import SellerItems

UserModel = get_user_model()


class SellerViewsTestCase(TestCase):

    def setUp(self):
        self.client = Client()

        self.user = UserModel.objects.create_user(
            username='testuser',
            password='testpassword',
            email='testuser@gmail.com'
        )
        self.client.login(username='testuser', password='testpassword')

        self.profile = self.user.profile

        self.seller_item = SellerItems.objects.create(
            profile=self.profile,
            title="Test Item",
            category="vegetables",
            location="Test Location",
            description="ASCII table - Table of ASCII codes, characters and symbols",
            quantity=10,
            price_type="negotiation",
            created_at=now() - timedelta(),
        )

    def test_create_seller_item_with_expiration_date(self):
        """Test that the expiration date is calculated correctly upon creation."""
        expected_expiration_date = self.seller_item.created_at + timedelta(days=30)

        actual_expiration_date = self.seller_item.expiration_date.replace(microsecond=0)
        expected_expiration_date = expected_expiration_date.replace(microsecond=0)

        self.assertEqual(actual_expiration_date, expected_expiration_date)

    def test_update_seller_item_with_expiration_date(self):
        """Test that expiration date is preserved during update."""
        self.seller_item.title = "Updated Test Item"
        self.seller_item.save()

        expected_expiration_date = self.seller_item.created_at + timedelta(days=30)

        actual_expiration_date = self.seller_item.expiration_date.replace(microsecond=0)
        expected_expiration_date = expected_expiration_date.replace(microsecond=0)

        self.assertEqual(actual_expiration_date, expected_expiration_date)
