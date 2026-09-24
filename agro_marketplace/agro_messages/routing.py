from django.urls import re_path

from .consumers import MessageConsumer


websocket_urlpatterns = [
    re_path(
        r"ws/messages/(?P<pk>\d+)/$",
        MessageConsumer.as_asgi(),
    ),
]
