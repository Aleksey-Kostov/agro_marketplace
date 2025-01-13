from django.contrib import admin

from .models import BuyerItems
from ..sellers.admin import SellerItemsAdmin
from django.utils.text import slugify


@admin.register(BuyerItems)
class BuyerItemsAdmin(SellerItemsAdmin):
    def save_model(self, request, obj, form, change):
        if not obj.slug:
            obj.slug = slugify(f"Buyer-{obj.pk}-{obj.title}")
        super().save_model(request, obj, form, change)
