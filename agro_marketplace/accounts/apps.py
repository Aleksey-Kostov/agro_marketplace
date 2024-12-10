from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'agro_marketplace.accounts'

    def ready(self):
        import agro_marketplace.accounts.signals
