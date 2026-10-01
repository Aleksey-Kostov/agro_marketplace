from django.conf import settings
from django.core.files.storage import (
    FileSystemStorage,
    Storage,
)


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
# LOCAL MESSAGE ATTACHMENT STORAGE
# =========================================================

class LocalMessageAttachmentStorage(FileSystemStorage):
    """
    Локално съхранение на общите message attachments.

    Поддържа:

        image
        video
        file

    Файловете се записват в:

        MEDIA_ROOT/message_attachments/
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault(
            "location",
            settings.MEDIA_ROOT / "message_attachments",
        )

        kwargs.setdefault(
            "base_url",
            settings.MEDIA_URL
            + "message_attachments/",
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

    Използва VideoMediaCloudinaryStorage.
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
# CLOUDINARY MESSAGE ATTACHMENT STORAGE
# =========================================================

class CloudinaryMessageAttachmentStorage(Storage):
    """
    Cloudinary storage за MessageAttachment.

    Един Django FileField не знае дали attachment-ът е:

        image
        video
        file

    Затова attachment_type и message_id се подават
    чрез името при save():

        cloudinary/<attachment_type>/<message_id>/<filename>

    След това cloudinary_attachments service избира:

        image -> Cloudinary image
        video -> Cloudinary video
        file  -> Cloudinary raw

    В database MessageAttachment.file.name се пази
    Cloudinary reference, а не локален /media/ path.
    """

    PREFIX = "cloudinary"

    # -----------------------------------------------------
    # PARSE CLOUDINARY REFERENCE
    # -----------------------------------------------------

    def _parse_name(self, name):
        """
        Parse:

            cloudinary:<resource_type>:<public_id>:<version>

        Example:

            cloudinary:video:chat/messages/123/abc123:123456
        """

        parts = str(name or "").split(":", 3)

        if len(parts) != 4:
            raise ValueError(
                "Invalid Cloudinary attachment reference."
            )

        prefix = parts[0]
        resource_type = parts[1]
        public_id = parts[2]

        if prefix != self.PREFIX:
            raise ValueError(
                "Invalid Cloudinary attachment prefix."
            )

        if not resource_type:
            raise ValueError(
                "Cloudinary resource type is missing."
            )

        if not public_id:
            raise ValueError(
                "Cloudinary public ID is missing."
            )

        return resource_type, public_id

    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    def save(
        self,
        name,
        content,
        max_length=None,
    ):
        """
        Upload attachment directly to Cloudinary.

        Expected input name:

            cloudinary/<attachment_type>/<message_id>/<filename>
        """

        from .services.cloudinary_attachments import (
            upload_message_attachment,
        )

        parts = str(name or "").split("/", 3)

        if len(parts) < 3:
            raise ValueError(
                "Cloudinary attachment name must be "
                "cloudinary/<attachment_type>/<message_id>/..."
            )

        prefix = parts[0]
        attachment_type = parts[1]
        message_id = parts[2]

        if prefix != self.PREFIX:
            raise ValueError(
                "Invalid Cloudinary attachment prefix."
            )

        if attachment_type not in {
            "image",
            "video",
            "file",
        }:
            raise ValueError(
                "Unsupported attachment type."
            )

        if not message_id:
            raise ValueError(
                "Message ID is required."
            )

        # -------------------------------------------------
        # UPLOAD
        # -------------------------------------------------

        result = upload_message_attachment(
            file=content,
            attachment_type=attachment_type,
            message_id=message_id,
        )

        resource_type = result.get(
            "resource_type"
        )

        public_id = result.get(
            "public_id"
        )

        version = result.get(
            "version",
            "",
        )

        if not resource_type:
            raise ValueError(
                "Cloudinary upload did not return "
                "a resource type."
            )

        if not public_id:
            raise ValueError(
                "Cloudinary upload did not return "
                "a public ID."
            )

        # -------------------------------------------------
        # DATABASE REFERENCE
        # -------------------------------------------------
        #
        # Example:
        #
        # cloudinary:video:chat/messages/123/abc:def
        #
        # The reference is intentionally independent from
        # the original client filename.

        reference = (
            f"{self.PREFIX}:"
            f"{resource_type}:"
            f"{public_id}:"
            f"{version}"
        )

        if (
            max_length
            and len(reference) > max_length
        ):
            raise ValueError(
                "Cloudinary attachment reference "
                "is too long."
            )

        return reference

    # -----------------------------------------------------
    # URL
    # -----------------------------------------------------

    def url(self, name):
        """
        Return secure Cloudinary delivery URL.
        """

        from .services.cloudinary_attachments import (
            get_attachment_url,
        )

        resource_type, public_id = (
            self._parse_name(name)
        )

        return get_attachment_url(
            public_id=public_id,
            resource_type=resource_type,
            secure=True,
        )

    # -----------------------------------------------------
    # DELETE
    # -----------------------------------------------------

    def delete(self, name):
        """
        Delete attachment from Cloudinary.
        """

        from .services.cloudinary_attachments import (
            delete_message_attachment,
        )

        resource_type, public_id = (
            self._parse_name(name)
        )

        delete_message_attachment(
            public_id=public_id,
            resource_type=resource_type,
        )

    # -----------------------------------------------------
    # EXISTS
    # -----------------------------------------------------

    def exists(self, name):
        """
        Django calls exists() before save().

        We do not perform a Cloudinary API request here.

        Returning False allows Django to save the generated
        Cloudinary reference without trying to create local
        filename variants.
        """

        return False

    # -----------------------------------------------------
    # PATH
    # -----------------------------------------------------

    def path(self, name):
        """
        Cloudinary files do not have a local filesystem path.
        """

        raise NotImplementedError(
            "Cloudinary attachments do not "
            "have a local filesystem path."
        )


# =========================================================
# SELECTABLE STORAGE
# =========================================================

class SelectableMessageStorage(Storage):
    """
    Storage wrapper, който избира реалния backend
    според настройката в settings.py.
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
    # FILE OPERATIONS
    # -----------------------------------------------------

    def open(
        self,
        name,
        mode="rb",
    ):
        return self._storage.open(
            name,
            mode=mode,
        )

    def save(
        self,
        name,
        content,
        max_length=None,
    ):
        return self._storage.save(
            name,
            content,
            max_length=max_length,
        )

    def delete(self, name):
        return self._storage.delete(
            name
        )

    def exists(self, name):
        return self._storage.exists(
            name
        )

    def size(self, name):
        return self._storage.size(
            name
        )

    def url(self, name):
        return self._storage.url(
            name
        )

    # -----------------------------------------------------
    # OPTIONAL STORAGE METHODS
    # -----------------------------------------------------

    def path(self, name):
        return self._storage.path(
            name
        )

    def get_accessed_time(self, name):
        return self._storage.get_accessed_time(
            name
        )

    def get_created_time(self, name):
        return self._storage.get_created_time(
            name
        )

    def get_modified_time(self, name):
        return self._storage.get_modified_time(
            name
        )

    # -----------------------------------------------------
    # FILENAME HANDLING
    # -----------------------------------------------------

    def get_valid_name(self, name):
        return self._storage.get_valid_name(
            name
        )

    def get_available_name(
        self,
        name,
        max_length=None,
    ):
        return self._storage.get_available_name(
            name,
            max_length=max_length,
        )

    def generate_filename(self, filename):
        return self._storage.generate_filename(
            filename
        )

    # -----------------------------------------------------
    # DELEGATE UNKNOWN ATTRIBUTES
    # -----------------------------------------------------

    def __getattr__(
        self,
        name,
    ):
        return getattr(
            self._storage,
            name,
        )


# =========================================================
# MESSAGE IMAGE STORAGE
# =========================================================

class MessageImageStorage(
    SelectableMessageStorage
):
    """
    Storage за изображенията на съобщенията.

    Управлява се от:

        MESSAGE_IMAGE_STORAGE
    """

    storage_setting = (
        "MESSAGE_IMAGE_STORAGE"
    )

    storage_map = {
        "local": LocalMessageImageStorage,
        "cloudinary": CloudinaryMessageImageStorage,
    }


# =========================================================
# MESSAGE VIDEO STORAGE
# =========================================================

class MessageVideoStorage(
    SelectableMessageStorage
):
    """
    Storage за видеата на съобщенията.

    Управлява се от:

        MESSAGE_VIDEO_STORAGE
    """

    storage_setting = (
        "MESSAGE_VIDEO_STORAGE"
    )

    storage_map = {
        "local": LocalMessageVideoStorage,
        "cloudinary": CloudinaryMessageVideoStorage,
    }


# =========================================================
# MESSAGE ATTACHMENT STORAGE
# =========================================================

class MessageAttachmentStorage(
    SelectableMessageStorage
):
    """
    Storage за всички общи message attachments.

    Поддържа:

        image
        video
        file

    Управлява се от:

        MESSAGE_ATTACHMENT_STORAGE
    """

    storage_setting = (
        "MESSAGE_ATTACHMENT_STORAGE"
    )

    storage_map = {
        "local": LocalMessageAttachmentStorage,
        "cloudinary": CloudinaryMessageAttachmentStorage,
    }
