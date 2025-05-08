# agro_marketplace/core/storage_backends.py

from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError
from django.core.files.storage import Storage
from django.core.files.base import ContentFile, File
from django.conf import settings
from io import BytesIO


class StaticAzureStorage(Storage):
    def __init__(self):
        self.account_name = settings.AZURE_ACCOUNT_NAME
        self.account_key = settings.AZURE_ACCOUNT_KEY
        self.azure_container = settings.AZURE_CONTAINER
        self.location = 'static'

        self.blob_service_client = BlobServiceClient(
            account_url=f"https://{self.account_name}.blob.core.windows.net",
            credential=self.account_key
        )
        self.container_client = self.blob_service_client.get_container_client(self.azure_container)

    def _get_blob_client(self, name):
        blob_path = f"{self.location}/{name}".lstrip("/")
        return self.container_client.get_blob_client(blob_path)

    def _open(self, name, mode='rb'):
        blob_client = self._get_blob_client(name)
        stream = blob_client.download_blob()
        return File(BytesIO(stream.readall()), name)

    def _save(self, name, content):
        blob_client = self._get_blob_client(name)
        blob_client.upload_blob(content.read(), overwrite=True)
        return name

    def exists(self, name):
        blob_client = self._get_blob_client(name)
        try:
            blob_client.get_blob_properties()
            return True
        except ResourceNotFoundError:
            return False

    def url(self, name):
        blob_path = f"{self.location}/{name}".lstrip("/")
        return f"https://{self.account_name}.blob.core.windows.net/{self.azure_container}/{blob_path}"

    def listdir(self, path):
        prefix = f"{self.location}/{path}".rstrip('/') + '/'
        blobs = self.container_client.list_blobs(name_starts_with=prefix)
        files = [blob.name[len(prefix):] for blob in blobs if blob.name != prefix]
        return [], files

    def size(self, name):
        blob_client = self._get_blob_client(name)
        props = blob_client.get_blob_properties()
        return props.size
