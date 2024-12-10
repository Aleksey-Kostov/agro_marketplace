from django.contrib import admin

from .models import BuyerItems
from ..sellers.admin import SellerItemsAdmin


@admin.register(BuyerItems)
class BuyerItemsAdmin(SellerItemsAdmin):
    pass
