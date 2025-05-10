from storages.backends.azure_storage import AzureStorage
import os


class StaticAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_CONTAINER', 'staticfiles')  # Default container name is 'staticfiles'
    expiration_secs = None
    file_overwrite = True  # Static files can be safely overwritten


class MediaAzureStorage(AzureStorage):
    account_name = os.getenv('AZURE_ACCOUNT_NAME')
    account_key = os.getenv('AZURE_ACCOUNT_KEY')
    azure_container = os.getenv('AZURE_MEDIA_CONTAINER', 'media')  # Default container name is 'media'
    expiration_secs = None
    file_overwrite = False  # Media files usually should not be overwritten
