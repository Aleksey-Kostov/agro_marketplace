import os
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient


class StaticAzureStorage:
    account_name = os.getenv("AZURE_ACCOUNT_NAME")
    account_key = os.getenv("AZURE_ACCOUNT_KEY")
    azure_container = os.getenv("AZURE_CONTAINER")
    expiration_secs = None
    location = 'static'  # Ensures files are saved under 'static/' in the container

    def __init__(self):
        self.blob_service_client = BlobServiceClient(
            account_url=f"https://{self.account_name}.blob.core.windows.net",
            credential=self.account_key
        )
        self.container_client = self.blob_service_client.get_container_client(self.azure_container)

    def upload_blob(self, file_name, file_path):
        # Uploads a file to Azure Blob Storage
        blob_client = self.container_client.get_blob_client(f"{self.location}/{file_name}")
        with open(file_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)
        print(f"File {file_name} uploaded successfully.")

    def download_blob(self, file_name, download_path):
        # Downloads a file from Azure Blob Storage
        blob_client = self.container_client.get_blob_client(f"{self.location}/{file_name}")
        with open(download_path, "wb") as download_file:
            download_file.write(blob_client.download_blob().readall())
        print(f"File {file_name} downloaded successfully.")

    def list_blobs(self):
        # Lists all blobs in the container
        blobs = self.container_client.list_blobs(name_starts_with=self.location)
        for blob in blobs:
            print(blob.name)
