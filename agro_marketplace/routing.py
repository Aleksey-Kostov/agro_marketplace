from agro_marketplace.agro_messages.routing import (
    websocket_urlpatterns as message_websocket_urlpatterns,
)


websocket_urlpatterns = [
    *message_websocket_urlpatterns,
]
