from django.urls import path, include

from agro_marketplace.agro_messages import views

urlpatterns = [
    path('inbox/', views.message_inbox, name='message-inbox'),
    path('<int:pk>/', include([
        path('send/', views.send_message, name='send-message'),
        path('read/', views.read_message, name='read-message'),
        path('reply/', views.reply_message, name='reply-message'),
        path('delete/', views.delete_message, name='delete-message')
    ]))
]
