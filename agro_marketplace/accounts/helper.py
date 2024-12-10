from itertools import chain
from django.core.exceptions import ObjectDoesNotExist
from django.utils.timezone import now

from agro_marketplace.buyers.models import BuyerItems
from agro_marketplace.sellers.models import SellerItems

current_time = now()


def get_item_by_slug(slug, expiration_check=None):
    """
    Fetch an item from BuyerItems or SellerItems using `slug`.

    Args:
        slug (str): The slug field of the item.
        expiration_check (str): Whether to filter based on expiration status.
                                Accepts 'active' or 'inactive'.

    Returns:
        object: The matched item from BuyerItems or SellerItems.
    """
    try:
        filters = {'slug': slug}
        if expiration_check == 'active':
            filters['expiration_date__gte'] = current_time
        elif expiration_check == 'inactive':
            filters['expiration_date__lt'] = current_time

        return (
            BuyerItems.objects.filter(**filters).first() or
            SellerItems.objects.filter(**filters).first()
        )
    except ObjectDoesNotExist:
        return None


def get_combined_items(profile, expiration_check):
    """
    Get combined items from BuyerItems and SellerItems for a profile.

    Args:
        profile: The Profile instance.
        expiration_check: Expiration filter ('active' or 'inactive').

    Returns:
        list: Combined and sorted items.
    """
    if expiration_check == 'active':
        sellers = profile.seller_products.filter(expiration_date__gte=current_time).order_by('-created_at')
        buyers = profile.buyer_products.filter(expiration_date__gte=current_time).order_by('-created_at')
    else:
        sellers = profile.seller_products.filter(expiration_date__lt=current_time).order_by('-created_at')
        buyers = profile.buyer_products.filter(expiration_date__lt=current_time).order_by('-created_at')

    combined_items = list(chain(sellers, buyers))
    for item in combined_items:
        item.item_type = 'Seller' if isinstance(item, SellerItems) else 'Buyer'
    return sorted(combined_items, key=lambda x: x.created_at, reverse=True)
