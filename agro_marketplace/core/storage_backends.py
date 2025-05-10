from storages.backends.azure_storage import AzureStorage
import os


class StaticAzureStorage(AzureStorage):
    account_name = os.environ.get('AZURE_ACCOUNT_NAME')
    account_key = os.environ.get('AZURE_ACCOUNT_KEY')
    azure_container = os.environ.get('AZURE_CONTAINER', 'staticfiles')
    expiration_secs = None
    file_overwrite = True  # static files can be safely overwritten


class MediaAzureStorage(AzureStorage):
    account_name = os.environ.get('AZURE_ACCOUNT_NAME')
    account_key = os.environ.get('AZURE_ACCOUNT_KEY')
    azure_container = os.environ.get('AZURE_MEDIA_CONTAINER', 'media')
    expiration_secs = None
    file_overwrite = False  # media files usually should not be overwritten
