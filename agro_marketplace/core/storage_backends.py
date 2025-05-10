from storages.backends.azure_storage import AzureStorage
import os


class StaticAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_CONTAINER', 'staticfiles')
    expiration_secs = None
    file_overwrite = True  # Static files can be safely overwritten
    location = 'static'
    default_acl = 'public-read'


class MediaAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_MEDIA_CONTAINER', 'media')
    expiration_secs = None
    file_overwrite = False  # Media files should not be overwritten
    location = 'media'
    default_acl = None  # private by default
