from django.db import models
from agro_marketplace.accounts.models import Profile
from agro_marketplace.choises import Currency, UnitOfMeasure, PriceTypeChoices, Category
from agro_marketplace.validators import FileSizeValidator
from datetime import timedelta
from django.utils.text import slugify
from datetime import datetime


class SellerItems(models.Model):
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='seller_products'
    )

    title = models.CharField(
        max_length=255
    )

    slug = models.SlugField(
        max_length=300,
        unique=True,
        blank=True
    )

    category = models.CharField(
        max_length=20,
        choices=Category.choices
    )
    location = models.CharField(
        max_length=255
    )
    description = models.TextField()
    photo_1 = models.ImageField(
        upload_to="seller_items/",
        validators=[FileSizeValidator(5)],
        blank=True,
        null=True,
    )
    photo_2 = models.ImageField(
        upload_to="seller_items/",
        validators=[FileSizeValidator(5)],
        blank=True,
        null=True,
    )
    photo_3 = models.ImageField(
        upload_to="seller_items/",
        validators=[FileSizeValidator(5)],
        blank=True,
        null=True,
    )
    photo_4 = models.ImageField(
        upload_to="seller_items/",
        validators=[FileSizeValidator(5)],
        blank=True,
        null=True,
    )
    phone = models.CharField(
        max_length=15,
        null=True,
        blank=True
    )
    quantity = models.PositiveIntegerField()
    price_type = models.CharField(
        max_length=20,
        choices=PriceTypeChoices.choices,
        default=PriceTypeChoices.NEGOTIATION,
    )
    price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    price_all_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.LEVA,
    )

    unit_of_measure = models.CharField(
        max_length=3,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.KG,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    expiration_date = models.DateTimeField(
        null=True, blank=True, editable=False
    )

    def save(self, *args, **kwargs):
        if not self.pk:
            if not self.expiration_date:
                self.expiration_date = datetime.now() + timedelta(days=30)

            if not self.slug:
                differentiator = "seller"
                self.slug = slugify(f"{differentiator}-{self.pk}-{self.title}")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
