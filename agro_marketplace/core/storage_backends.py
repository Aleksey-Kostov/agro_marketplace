from storages.backends.azure_storage import AzureStorage
import os


class StaticAzureStorage(AzureStorage):
    connection_string = os.getenv('AZURE_CONNECTION_STRING')
    azure_container = os.getenv('AZURE_CONTAINER', 'static-content')
    expiration_secs = None
    file_overwrite = True
    location = ''


class MediaAzureStorage(AzureStorage):
    connection_string = os.getenv('AZURE_CONNECTION_STRING')
    azure_container = os.getenv('AZURE_MEDIA_CONTAINER', 'media-content')
    expiration_secs = None
    file_overwrite = False
    location = ''
