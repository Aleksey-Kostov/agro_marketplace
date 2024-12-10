from django.db.models import Count
from collections import defaultdict
from django.http import JsonResponse
import calendar

from django.utils import timezone

from django.core.paginator import Paginator
from django.shortcuts import render, redirect

from agro_marketplace.buyers.models import BuyerItems
from agro_marketplace.sellers.models import SellerItems


def home_page(request):
    if request.user.is_authenticated:
        return redirect('dash')
    return render(request, 'common/home-page2.html')


def dashboard(request):
    current_time = timezone.now()

    sellers = SellerItems.objects.filter(expiration_date__gte=current_time).order_by('-created_at')

    buyers = BuyerItems.objects.filter(expiration_date__gte=current_time).order_by('-created_at')

    paginator_sellers = Paginator(sellers, 5)
    page_number_sellers = request.GET.get('page_sellers')
    page_obj_sellers = paginator_sellers.get_page(page_number_sellers)

    paginator_buyers = Paginator(buyers, 5)
    page_number_buyers = request.GET.get('page_buyers')
    page_obj_buyers = paginator_buyers.get_page(page_number_buyers)

    context = {
        'page_obj_sellers': page_obj_sellers,
        'page_obj_buyers': page_obj_buyers,
    }

    return render(request, 'common/dashboard.html', context)


def info_contacts(request):
    return render(request, 'common/info-contacts.html')


def search(request):
    query = request.GET.get('query', '')
    category = request.GET.get('category', '')

    if not query and not category:
        return redirect('dash')

    sellers = SellerItems.objects.all()
    buyers = BuyerItems.objects.all()

    if query:
        sellers = (sellers.filter(title__icontains=query) |
                   sellers.filter(description__icontains=query) |
                   sellers.filter(location__icontains=query) |
                   sellers.filter(profile__username_in_marketplace__icontains=query))

        buyers = (buyers.filter(title__icontains=query) |
                  buyers.filter(description__icontains=query) |
                  buyers.filter(location__icontains=query) |
                  buyers.filter(profile__username_in_marketplace__icontains=query))

    if category:
        sellers = sellers.filter(category=category)
        buyers = buyers.filter(category=category)

    no_results = False
    if not sellers.exists() and not buyers.exists():
        no_results = True

    seller_paginator = Paginator(sellers, 5)
    buyer_paginator = Paginator(buyers, 5)
    page_sellers = request.GET.get('page_sellers')
    page_buyers = request.GET.get('page_buyers')

    page_obj_sellers = seller_paginator.get_page(page_sellers)
    page_obj_buyers = buyer_paginator.get_page(page_buyers)

    return render(request, 'common/dashboard.html', {
        'page_obj_sellers': page_obj_sellers,
        'page_obj_buyers': page_obj_buyers,
        'query': query,
        'category': category,
        'no_results': no_results,
    })


def providing_data(request):
    # Define categories for products
    categories = [
        'fruits', 'vegetables', 'grain', 'herbs-spices',
        'grapes', 'bee-products', 'other',
        'dairy-products', 'mushrooms'
    ]

    total_products_labels = [category.replace('-', ' ').title() for category in categories]

    total_products_data = defaultdict(int)

    for category in categories:
        total_products_data[category] += SellerItems.objects.filter(category=category).count()
        total_products_data[category] += BuyerItems.objects.filter(category=category).count()

    total_products_counts = [total_products_data[category] for category in categories]

    months = list(calendar.month_name[1:])

    active_sellers_monthly = SellerItems.objects.values('created_at__month').annotate(count=Count('id'))
    active_buyers_monthly = BuyerItems.objects.values('created_at__month').annotate(count=Count('id'))

    active_sellers_monthly_data = [0] * 12
    active_buyers_monthly_data = [0] * 12

    for entry in active_sellers_monthly:
        month_index = entry['created_at__month'] - 1
        active_sellers_monthly_data[month_index] = entry['count']

    for entry in active_buyers_monthly:
        month_index = entry['created_at__month'] - 1
        active_buyers_monthly_data[month_index] = entry['count']

    data = {
        'months': months,
        'activeSellersData': active_sellers_monthly_data,
        'activeBuyersData': active_buyers_monthly_data,
        'totalProductsLabels': total_products_labels,
        'totalProductsData': total_products_counts,
    }

    return JsonResponse(data)
