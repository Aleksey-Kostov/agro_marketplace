from storages.backends.azure_storage import AzureStorage
import os


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
    file_overwrite = False  # prevents overwriting media with same name
