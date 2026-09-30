from __future__ import annotations

from typing import BinaryIO

from django.db import transaction
from django.core.files.uploadedfile import UploadedFile

from agro_marketplace.agro_messages.models import (
    MessageAttachment,
)
from agro_marketplace.agro_messages.services.cloudinary_attachments import (
    ATTACHMENT_FILE,
    ATTACHMENT_IMAGE,
    ATTACHMENT_VIDEO,
    CloudinaryAttachmentDeleteError,
    delete_message_attachment,
    upload_message_attachment,
)


def upload_message_attachment_file(
    *,
    file: UploadedFile | BinaryIO,
    attachment_type: str,
    message_id: int | str,
) -> MessageAttachment:
    """
    Upload one message attachment to Cloudinary
    and create its database record.

    If the database record cannot be created after
    a successful Cloudinary upload, the uploaded
    Cloudinary asset is deleted to prevent orphan files.

    File validation must happen before calling this service.
    """

    result = upload_message_attachment(
        file=file,
        attachment_type=attachment_type,
        message_id=message_id,
    )

    public_id = result["public_id"]
    resource_type = result["resource_type"]

    try:
        with transaction.atomic():
            attachment = MessageAttachment.objects.create(
                message_id=message_id,
                original_name=getattr(
                    file,
                    "name",
                    "",
                ),
                mime_type=getattr(
                    file,
                    "content_type",
                    "",
                ),
                size=getattr(
                    file,
                    "size",
                    0,
                ),
                attachment_type=attachment_type,
                cloudinary_public_id=public_id,
                cloudinary_resource_type=resource_type,
            )

    except Exception:
        try:
            delete_message_attachment(
                public_id=public_id,
                resource_type=resource_type,
            )
        except CloudinaryAttachmentDeleteError:
            pass

        raise

    return attachment
