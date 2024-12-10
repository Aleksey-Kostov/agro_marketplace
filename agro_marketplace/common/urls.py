from django.urls import path

from agro_marketplace.common import views

urlpatterns = [
    path('', views.home_page, name='home'),
    path('dashboard/', views.dashboard, name='dash'),
    path('info/', views.info_contacts, name='info-contacts'),
    path('search/', views.search, name='search'),
    path('api/data/', views.providing_data, name='api-data'),
]
