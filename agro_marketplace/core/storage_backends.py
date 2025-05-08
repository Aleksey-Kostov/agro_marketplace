import os
from storages.backends.azure_storage import AzureStorage


class StaticAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_CONTAINER')
    expiration_secs = None


class MediaAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_MEDIA_CONTAINER')
    expiration_secs = None
