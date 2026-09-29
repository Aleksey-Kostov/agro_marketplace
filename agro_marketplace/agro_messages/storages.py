from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage


# =========================================================
# LOCAL MESSAGE IMAGE STORAGE
# =========================================================

class LocalMessageImageStorage(FileSystemStorage):
    """
    Локално съхранение на изображенията на съобщенията.

    Файловете се записват в:

        MEDIA_ROOT/message_images/
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault(
            "location",
            settings.MEDIA_ROOT / "message_images",
        )

        kwargs.setdefault(
            "base_url",
            settings.MEDIA_URL + "message_images/",
        )

        super().__init__(*args, **kwargs)


# =========================================================
# LOCAL MESSAGE VIDEO STORAGE
# =========================================================

class LocalMessageVideoStorage(FileSystemStorage):
    """
    Локално съхранение на видеата на съобщенията.

    Файловете се записват в:

        MEDIA_ROOT/message_videos/
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault(
            "location",
            settings.MEDIA_ROOT / "message_videos",
        )

        kwargs.setdefault(
            "base_url",
            settings.MEDIA_URL + "message_videos/",
        )

        super().__init__(*args, **kwargs)


# =========================================================
# CLOUDINARY MESSAGE IMAGE STORAGE
# =========================================================

class CloudinaryMessageImageStorage:
    """
    Cloudinary storage за изображения от съобщенията.

    Използва MediaCloudinaryStorage.
    """

    def __new__(cls, *args, **kwargs):
        from cloudinary_storage.storage import (
            MediaCloudinaryStorage,
        )

        return MediaCloudinaryStorage(
            *args,
            **kwargs,
        )


# =========================================================
# CLOUDINARY MESSAGE VIDEO STORAGE
# =========================================================

class CloudinaryMessageVideoStorage:
    """
    Cloudinary storage за видеа от съобщенията.

    Използва VideoMediaCloudinaryStorage,
    предназначен специално за видео файлове.
    """

    def __new__(cls, *args, **kwargs):
        from cloudinary_storage.storage import (
            VideoMediaCloudinaryStorage,
        )

        return VideoMediaCloudinaryStorage(
            *args,
            **kwargs,
        )


# =========================================================
# SELECTABLE STORAGE
# =========================================================

class SelectableMessageStorage(Storage):
    """
    Storage wrapper, който избира реалния backend
    според настройката в settings.py.

    Така моделът не е обвързан директно с Local,
    Cloudinary или друг конкретен storage.
    """

    storage_setting = None
    storage_map = {}

    def __init__(self):
        if not self.storage_setting:
            raise ValueError(
                "storage_setting must be defined."
            )

        storage_name = getattr(
            settings,
            self.storage_setting,
            "local",
        )

        storage_name = (
            str(storage_name)
            .strip()
            .lower()
        )

        storage_class = self.storage_map.get(
            storage_name
        )

        if storage_class is None:
            allowed = ", ".join(
                self.storage_map.keys()
            )

            raise ValueError(
                f"Invalid storage '{storage_name}' "
                f"for {self.storage_setting}. "
                f"Allowed values: {allowed}"
            )

        self._storage = storage_class()

    # -----------------------------------------------------
    # File operations
    # -----------------------------------------------------

    def open(self, name, mode="rb"):
        return self._storage.open(
            name,
            mode=mode,
        )

    def save(self, name, content, max_length=None):
        return self._storage.save(
            name,
            content,
            max_length=max_length,
        )

    def delete(self, name):
        return self._storage.delete(name)

    def exists(self, name):
        return self._storage.exists(name)

    def size(self, name):
        return self._storage.size(name)

    def url(self, name):
        return self._storage.url(name)

    # -----------------------------------------------------
    # Optional storage methods
    # -----------------------------------------------------

    def path(self, name):
        return self._storage.path(name)

    def get_accessed_time(self, name):
        return self._storage.get_accessed_time(name)

    def get_created_time(self, name):
        return self._storage.get_created_time(name)

    def get_modified_time(self, name):
        return self._storage.get_modified_time(name)

    # -----------------------------------------------------
    # Filename handling
    # -----------------------------------------------------

    def get_valid_name(self, name):
        return self._storage.get_valid_name(name)

    def get_available_name(self, name, max_length=None):
        return self._storage.get_available_name(
            name,
            max_length=max_length,
        )

    def generate_filename(self, filename):
        return self._storage.generate_filename(
            filename
        )

    # -----------------------------------------------------
    # Delegate unknown attributes/methods
    # -----------------------------------------------------

    def __getattr__(self, name):
        return getattr(
            self._storage,
            name,
        )


# =========================================================
# MESSAGE IMAGE STORAGE
# =========================================================

class MessageImageStorage(SelectableMessageStorage):
    """
    Storage за изображенията на съобщенията.

    Управлява се от:

        MESSAGE_IMAGE_STORAGE
    """

    storage_setting = "MESSAGE_IMAGE_STORAGE"

    storage_map = {
        "local": LocalMessageImageStorage,
        "cloudinary": CloudinaryMessageImageStorage,
    }


# =========================================================
# MESSAGE VIDEO STORAGE
# =========================================================

class MessageVideoStorage(SelectableMessageStorage):
    """
    Storage за видеата на съобщенията.

    Управлява се от:

        MESSAGE_VIDEO_STORAGE
    """

    storage_setting = "MESSAGE_VIDEO_STORAGE"

    storage_map = {
        "local": LocalMessageVideoStorage,
        "cloudinary": CloudinaryMessageVideoStorage,
    }


# =========================================================
# CLOUDINARY MESSAGE ATTACHMENT STORAGE
# =========================================================

class CloudinaryMessageAttachmentStorage:
    """
    Cloudinary storage за общи message attachments.

    Използва MediaCloudinaryStorage като универсален
    Cloudinary storage backend.
    """

    def __new__(cls, *args, **kwargs):
        from cloudinary_storage.storage import (
            MediaCloudinaryStorage,
        )

        return MediaCloudinaryStorage(
            *args,
            **kwargs,
        )
