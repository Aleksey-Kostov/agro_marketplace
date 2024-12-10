from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from agro_marketplace.sellers.models import SellerItems
from django.contrib.messages import get_messages

UserModel = get_user_model()


class SellerViewsTestCase(TestCase):

    def setUp(self):
        self.client = self.client

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
        )

    def test_create_seller(self):
        """Test creating a new seller item through the create_seller view."""
        data = {
            'title': 'Updated Seller Item',
            'category': 'fruits',
            'location': 'Updated Location',
            'description': 'ASCII table - Table of ASCII codes, characters and symbols',
            'quantity': 10,
            'price_type': 'negotiation',
            'unit_of_measure': 'kg',
            'currency': 'USD',
        }
        response = self.client.post(reverse('create_seller'), data)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(SellerItems.objects.count(), 2)

        created_item = SellerItems.objects.last()
        self.assertEqual(created_item.profile, self.user.profile)
        self.assertEqual(created_item.title, 'Updated Seller Item')

    def test_create_seller_form_invalid(self):
        """Test invalid seller creation form."""
        data = {
            'title': '',
            'category': 'fruits',
            'location': 'Test Location',
            'description': 'ASCII table - Table of ASCII codes, characters and symbols',
            'quantity': 5,
            'price_type': 'negotiation',
        }
        response = self.client.post(reverse('create_seller'), data)

        self.assertEqual(response.status_code, 200)

    def test_edit_seller(self):
        """Test editing an existing seller item."""
        data = {
            'title': 'Updated Seller Item',
            'category': 'fruits',
            'location': 'Updated Location',
            'description': 'ASCII table - Table of ASCII codes, characters and symbols',
            'quantity': 10,
            'price_type': 'negotiation',
            'unit_of_measure': 'kg',
            'currency': 'USD',
        }

        response = self.client.post(
            reverse('edit-seller', kwargs={'pk': self.seller_item.pk}), data
        )

        if response.status_code == 200:
            print(response.context['form'].errors)

        self.assertEqual(response.status_code, 302)

        self.seller_item.refresh_from_db()

        self.assertEqual(self.seller_item.title, 'Updated Seller Item')
        self.assertEqual(self.seller_item.category, 'fruits')
        self.assertEqual(self.seller_item.location, 'Updated Location')
        self.assertEqual(self.seller_item.description,
                         'ASCII table - Table of ASCII codes, characters and symbols')
        self.assertEqual(self.seller_item.quantity, 10)

        # Check success message
        messages = list(get_messages(response.wsgi_request))
        self.assertIn('Seller item updated successfully!', [str(message) for message in messages])

    def test_card_info_sellers(self):
        """Test viewing seller item details."""
        response = self.client.get(reverse('card_info_sell', kwargs={'pk': self.seller_item.pk}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Test Item')
