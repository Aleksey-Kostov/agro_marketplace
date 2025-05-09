import os
from storages.backends.azure_storage import AzureStorage
from django.core.exceptions import ImproperlyConfigured


def get_env_var(name):
    value = os.getenv(name)
    if not value:
        raise ImproperlyConfigured(f"Missing environment variable: {name}")
    return value


class StaticAzureStorage(AzureStorage):
    account_name = get_env_var('AZURE_ACCOUNT_NAME')
    account_key = get_env_var('AZURE_ACCOUNT_KEY')
    azure_container = get_env_var('AZURE_CONTAINER')
    expiration_secs = None


class MediaAzureStorage(AzureStorage):
    account_name = get_env_var('AZURE_ACCOUNT_NAME')
    account_key = get_env_var('AZURE_ACCOUNT_KEY')
    azure_container = get_env_var('AZURE_MEDIA_CONTAINER')
    expiration_secs = None
