from __future__ import annotations

import uuid
from pathlib import Path
from typing import BinaryIO

import cloudinary.uploader


class CloudinaryAttachmentError(Exception):
    """Base exception for Cloudinary attachment errors."""


class CloudinaryAttachmentUploadError(
    CloudinaryAttachmentError
):
    """Raised when an attachment cannot be uploaded."""


class CloudinaryAttachmentDeleteError(
    CloudinaryAttachmentError
):
    """Raised when a Cloudinary attachment cannot be deleted."""


# Cloudinary resource types.
RESOURCE_TYPE_IMAGE = "image"
RESOURCE_TYPE_VIDEO = "video"
RESOURCE_TYPE_RAW = "raw"


# MessageAttachment types.
ATTACHMENT_IMAGE = "image"
ATTACHMENT_VIDEO = "video"
ATTACHMENT_FILE = "file"


ATTACHMENT_RESOURCE_TYPES = {
    ATTACHMENT_IMAGE: RESOURCE_TYPE_IMAGE,
    ATTACHMENT_VIDEO: RESOURCE_TYPE_VIDEO,
    ATTACHMENT_FILE: RESOURCE_TYPE_RAW,
}


# Files up to this size use the regular upload endpoint.
# Larger files use Cloudinary's chunked upload endpoint.
CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024


def _get_resource_type(
    attachment_type: str,
) -> str:
    try:
        return ATTACHMENT_RESOURCE_TYPES[
            attachment_type
        ]
    except KeyError as exc:
        raise CloudinaryAttachmentError(
            f"Unsupported attachment type: "
            f"{attachment_type!r}"
        ) from exc


def _build_public_id(
    *,
    message_id: int | str,
) -> str:
    """
    Generate a safe Cloudinary public ID.

    The original filename is intentionally not used.
    """
    unique_id = uuid.uuid4().hex

    return (
        f"chat/messages/"
        f"{message_id}/"
        f"{unique_id}"
    )


def _get_file_size(
    file: BinaryIO,
) -> int:
    """
    Return the uploaded file size without
    permanently changing the current file position.
    """
    current_position = file.tell()

    try:
        file.seek(0, 2)
        return file.tell()
    finally:
        file.seek(current_position)


def upload_message_attachment(
    *,
    file: BinaryIO,
    attachment_type: str,
    message_id: int | str,
) -> dict:
    """
    Upload one message attachment to Cloudinary.

    Returns the Cloudinary upload result.

    The caller is responsible for validating:
        - MIME type
        - extension
        - file contents
        - maximum allowed size

    This service only handles the Cloudinary upload itself.
    """

    resource_type = _get_resource_type(
        attachment_type
    )

    public_id = _build_public_id(
        message_id=message_id
    )

    file_size = _get_file_size(file)

    upload_options = {
        "resource_type": resource_type,
        "public_id": public_id,
        "overwrite": False,
        "unique_filename": False,
        "use_filename": False,
        "invalidate": True,
    }

    try:
        if file_size >= CHUNKED_UPLOAD_THRESHOLD:
            result = cloudinary.uploader.upload_large(
                file,
                **upload_options,
            )
        else:
            result = cloudinary.uploader.upload(
                file,
                **upload_options,
            )

    except Exception as exc:
        raise CloudinaryAttachmentUploadError(
            "Cloudinary upload failed."
        ) from exc

    if not result:
        raise CloudinaryAttachmentUploadError(
            "Cloudinary returned an empty upload result."
        )

    if not result.get("public_id"):
        raise CloudinaryAttachmentUploadError(
            "Cloudinary upload did not return "
            "a public_id."
        )

    if not result.get("resource_type"):
        raise CloudinaryAttachmentUploadError(
            "Cloudinary upload did not return "
            "a resource_type."
        )

    return result


def delete_message_attachment(
    *,
    public_id: str,
    resource_type: str,
) -> None:
    """
    Delete an attachment from Cloudinary.

    This is intentionally separate from the upload
    operation so it can later be used for cleanup
    when a database operation fails or a message is deleted.
    """

    if not public_id:
        return

    if resource_type not in {
        RESOURCE_TYPE_IMAGE,
        RESOURCE_TYPE_VIDEO,
        RESOURCE_TYPE_RAW,
    }:
        raise CloudinaryAttachmentDeleteError(
            f"Unsupported Cloudinary resource type: "
            f"{resource_type!r}"
        )

    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            invalidate=True,
        )
    except Exception as exc:
        raise CloudinaryAttachmentDeleteError(
            "Cloudinary deletion failed."
        ) from exc

    result_status = result.get("result")

    if result_status not in {
        "ok",
        "not found",
    }:
        raise CloudinaryAttachmentDeleteError(
            "Cloudinary did not confirm "
            "the attachment deletion."
        )


def get_attachment_url(
    *,
    public_id: str,
    resource_type: str,
    secure: bool = True,
) -> str:
    """
    Build a Cloudinary delivery URL for an attachment.

    This does not perform a network request.
    """

    if not public_id:
        raise CloudinaryAttachmentError(
            "public_id is required."
        )

    if resource_type not in {
        RESOURCE_TYPE_IMAGE,
        RESOURCE_TYPE_VIDEO,
        RESOURCE_TYPE_RAW,
    }:
        raise CloudinaryAttachmentError(
            f"Unsupported Cloudinary resource type: "
            f"{resource_type!r}"
        )

    from cloudinary import CloudinaryResource

    resource = CloudinaryResource(
        public_id,
        resource_type=resource_type,
        type="upload",
    )

    if secure:
        return resource.build_url(
            secure=True,
        )

    return resource.build_url(
        secure=False,
    )
