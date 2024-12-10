from django.urls import path, include

from agro_marketplace.accounts import views
from agro_marketplace.accounts.views import EditProfileView

urlpatterns = [
    path('register/', views.AppUserRegisterView.as_view(), name='register'),
    path('registration/', views.ProfileRegistrationView.as_view(), name='profile-registration'),
    path('login/', views.AppUserLoginView.as_view(), name='login'),
    path('logout/', views.custom_logout, name='logout'),
    path('<int:pk>/', include([
        path('edit/', EditProfileView.as_view(), name='profile-edit'),
        path('details/', views.profile_details, name='profile-details'),
        path('delete-profile/', views.ProfileDeleteView.as_view(), name='profile-delete'),
        path('active/', views.activ_listings, name='active-listings'),
        path('inactive/', views.inactive_listings, name='inactive-listings'),
    ])),
    path('<slug:slug>/', include([
        path('activate/', views.activate_item, name='activate-item'),
        path('delete-item/', views.delete_item, name='delete-item'),
    ]))
]
