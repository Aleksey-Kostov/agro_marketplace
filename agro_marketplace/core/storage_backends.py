import os
from storages.backends.azure_storage import AzureStorage


class StaticAzureStorage(AzureStorage):
    account_name = os.getenv("AZURE_ACCOUNT_NAME")
    account_key = os.getenv("AZURE_ACCOUNT_KEY")
    azure_container = os.getenv("AZURE_CONTAINER")
    expiration_secs = None
    location = 'static'  # Ensures files are saved under 'static/' in the container
