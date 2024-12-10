from django.urls import path

from agro_marketplace.buyers import views

urlpatterns = [
    path('create/', views.create_buyer, name='create-buyer'),
    path('<int:pk>/card_info/', views.card_info_buyer, name='card-info-buy'),
    path('<int:pk>/edit/', views.BuyerEditView.as_view(), name='edit-buyer'),
]
