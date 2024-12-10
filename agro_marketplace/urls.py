from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('agro_marketplace.common.urls')),
    path('accoutnts/', include('agro_marketplace.accounts.urls')),
    path('messages/', include('agro_marketplace.agro_messages.urls')),
    path('buyers/', include('agro_marketplace.buyers.urls')),
    path('sellers/', include('agro_marketplace.sellers.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
