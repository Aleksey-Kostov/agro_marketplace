from storages.backends.azure_storage import AzureStorage
from decouple import config


class StaticAzureStorage(AzureStorage):
    connection_string = config('AZURE_CONNECTION_STRING')
    azure_container = config('AZURE_CONTAINER', default='static-content')
    expiration_secs = None
    file_overwrite = True  # Overwrite files for static content
    location = ''  # You can set a specific location within the container if needed


class MediaAzureStorage(AzureStorage):
    connection_string = config('AZURE_CONNECTION_STRING')
    azure_container = config('AZURE_MEDIA_CONTAINER', default='media-content')
    expiration_secs = None
    file_overwrite = False  # Don't overwrite media files
    location = ''  # You can set a specific location within the container if needed
