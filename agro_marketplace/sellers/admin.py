from django.contrib import admin

from .models import SellerItems
from django.utils.text import slugify


@admin.register(SellerItems)
class SellerItemsAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'profile',
        'title',
        'category',
        'location',
        'quantity',
        'price_type',
        'currency',
        'created_at',
        'expiration_date'
    )
    list_filter = (
        'category',
        'price_type',
        'currency',
        'created_at',
        'expiration_date'
    )
    search_fields = ('title', 'location', 'description', 'profile__full_name')
    ordering = ('-created_at',)

    # Fields for inline editing
    fieldsets = (
        (None, {
            'fields': ('profile', 'title', 'slug', 'category', 'location', 'description')
        }),
        ('Photos', {
            'fields': ('photo_1', 'photo_2', 'photo_3', 'photo_4')
        }),
        ('Contact Information', {
            'fields': ('phone',)
        }),
        ('Quantity and Pricing', {
            'fields': (
                'quantity',
                'price_type',
                'price_per_unit',
                'price_all_quantity',
                'currency',
                'unit_of_measure'
            )
        }),
        ('Dates', {
            'fields': ('created_at', 'expiration_date')
        }),
    )
    readonly_fields = ('slug', 'created_at', 'expiration_date')

    # Custom save logic to handle auto-generated fields
    def save_model(self, request, obj, form, change):
        if not obj.slug:
            obj.slug = slugify(f"seller-{obj.pk}-{obj.title}")
        super().save_model(request, obj, form, change)
