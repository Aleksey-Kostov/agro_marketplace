from storages.backends.azure_storage import AzureStorage


class StaticAzureStorage(AzureStorage):
    container_name = 'staticfiles'
    location = 'static'
    file_overwrite = True


class MediaAzureStorage(AzureStorage):
    container_name = 'media'
    location = 'media'
    file_overwrite = False
