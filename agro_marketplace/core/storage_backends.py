from storages.backends.azure_storage import AzureStorage
import os


class StaticAzureStorage(AzureStorage):
    account_name = os.environ['AZURE_ACCOUNT_NAME']
    account_key = os.environ['AZURE_ACCOUNT_KEY']
    azure_container = os.environ['AZURE_CONTAINER']
    expiration_secs = None


class MediaAzureStorage(AzureStorage):
    account_name = os.environ['AZURE_ACCOUNT_NAME']
    account_key = os.environ['AZURE_ACCOUNT_KEY']
    azure_container = os.environ['AZURE_MEDIA_CONTAINER']
    expiration_secs = None
    file_overwrite = False  # prevents overwriting media with same name
