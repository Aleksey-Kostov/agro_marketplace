# agro_marketplace/core/storage_backends.py

from azure.storage.blob import BlobServiceClient
from django.core.files.storage import Storage
from django.conf import settings
import os


class StaticAzureStorage(Storage):
    account_name = settings.AZURE_ACCOUNT_NAME
    account_key = settings.AZURE_ACCOUNT_KEY
    azure_container = settings.AZURE_CONTAINER
    location = 'static'  # Static files path in the container

    def __init__(self):
        self.blob_service_client = BlobServiceClient(
            account_url=f"https://{self.account_name}.blob.core.windows.net",
            credential=self.account_key
        )
        self.container_client = self.blob_service_client.get_container_client(self.azure_container)

    def _open(self, name, mode='rb'):
        # Opens a blob for reading (static files)
        blob_client = self.container_client.get_blob_client(f"{self.location}/{name}")
        stream = blob_client.download_blob()
        return stream

    def _save(self, name, content):
        # Saves a blob to Azure Blob Storage
        blob_client = self.container_client.get_blob_client(f"{self.location}/{name}")
        blob_client.upload_blob(content, overwrite=True)
        return name

    def exists(self, name):
        # Check if the blob exists in the container
        blob_client = self.container_client.get_blob_client(f"{self.location}/{name}")
        try:
            blob_client.get_blob_properties()
            return True
        except:
            return False

    def url(self, name):
        # Returns the public URL for a blob
        return f"https://{self.account_name}.blob.core.windows.net/{self.azure_container}/{self.location}/{name}"

    def list_blobs(self):
        # Lists all blobs in the static container
        blobs = self.container_client.list_blobs(name_starts_with=self.location)
        return [blob.name for blob in blobs]
