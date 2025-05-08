import os
from storages.backends.azure_storage import AzureStorage


class StaticAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    container_name = os.getenv('AZURE_CONTAINER')  # Corrected here
    expiration_secs = None


class MediaAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    container_name = os.getenv('AZURE_MEDIA_CONTAINER')  # Corrected here
    expiration_secs = None
