from django.urls import path, include

from agro_marketplace.agro_messages import views

urlpatterns = [
    path('inbox/', views.message_inbox, name='message-inbox'),
    path('block/<int:pk>/', views.block_user, name='block-user'),
    path('<int:pk>/', include([
        path('send/', views.send_message, name='send-message'),
        path('read/', views.read_message, name='read-message'),
        path('delete/', views.delete_message, name='delete-message'),
        path('report/', views.report_message, name='report-message'),
    ]))
]
