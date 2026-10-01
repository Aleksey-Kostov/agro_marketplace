from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


# ============================================================
# LIMITS
# ============================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
MAX_FILE_SIZE = 25 * 1024 * 1024


# ============================================================
# ALLOWED TYPES
# ============================================================

IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
}

VIDEO_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
}

VIDEO_EXTENSIONS = {
    ".mp4",
    ".webm",
    ".mov",
}

# Generic files use an explicit allowlist.
# Executable and browser-active formats are intentionally excluded.
FILE_TYPES_BY_EXTENSION = {
    ".pdf": {
        "application/pdf",
    },
    ".txt": {
        "text/plain",
    },
    ".csv": {
        "text/csv",
        "application/csv",
        "text/plain",
    },
    ".doc": {
        "application/msword",
    },
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    ".xls": {
        "application/vnd.ms-excel",
    },
    ".xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    ".ppt": {
        "application/vnd.ms-powerpoint",
    },
    ".pptx": {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    ".zip": {
        "application/zip",
        "application/x-zip-compressed",
    },
}

FILE_EXTENSIONS = set(FILE_TYPES_BY_EXTENSION)


# ============================================================
# MAGIC BYTES
# ============================================================

def _read_header(
    file: BinaryIO,
    size: int = 16,
) -> bytes:
    current_position = file.tell()

    try:
        file.seek(0)
        return file.read(size)
    finally:
        file.seek(current_position)


def _has_zip_signature(
    header: bytes,
) -> bool:
    return header.startswith(
        (
            b"PK\x03\x04",
            b"PK\x05\x06",
            b"PK\x07\x08",
        )
    )


def _validate_file_signature(
    *,
    file: BinaryIO,
    extension: str,
) -> None:
    """
    Validate signatures for formats where a reliable
    magic signature exists.

    Plain text and CSV intentionally do not require
    a magic signature because they are text formats.
    """

    header = _read_header(
        file,
        16,
    )

    if extension == ".pdf":
        if not header.startswith(b"%PDF-"):
            raise ValidationError(
                "Invalid file content."
            )
        return

    if extension in {
        ".doc",
        ".xls",
        ".ppt",
    }:
        if not header.startswith(
            b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        ):
            raise ValidationError(
                "Invalid file content."
            )
        return

    if extension in {
        ".docx",
        ".xlsx",
        ".pptx",
        ".zip",
    }:
        if not _has_zip_signature(header):
            raise ValidationError(
                "Invalid file content."
            )


# ============================================================
# BASIC HELPERS
# ============================================================

def _get_content_type(
    file: BinaryIO,
) -> str:
    return (
        getattr(
            file,
            "content_type",
            "",
        )
        or ""
    ).lower().strip()


def _get_extension(
    file: BinaryIO,
) -> str:
    return (
        Path(
            getattr(file, "name", "")
            or ""
        )
        .suffix
        .lower()
    )


def _get_size(
    file: BinaryIO,
) -> int:
    size = getattr(
        file,
        "size",
        None,
    )

    if size is not None:
        return int(size)

    current_position = file.tell()

    try:
        file.seek(0, 2)
        return file.tell()
    finally:
        file.seek(current_position)


def _ensure_filename(
    file: BinaryIO,
) -> None:
    name = getattr(
        file,
        "name",
        None,
    )

    if not name:
        raise ValidationError(
            "Attachment filename is required."
        )

    if len(Path(name).name) > 255:
        raise ValidationError(
            "Attachment filename is too long."
        )


# ============================================================
# IMAGE
# ============================================================

def _validate_image(
    file: BinaryIO,
) -> None:
    size = _get_size(file)

    if size > MAX_IMAGE_SIZE:
        raise ValidationError(
            "Image is too large. Maximum size is 10 MB."
        )

    content_type = _get_content_type(file)

    if content_type not in IMAGE_TYPES:
        raise ValidationError(
            "Invalid image file."
        )

    extension = _get_extension(file)

    if extension not in IMAGE_EXTENSIONS:
        raise ValidationError(
            "Invalid image file extension."
        )

    try:
        file.seek(0)

        with Image.open(file) as image:
            image.verify()

        file.seek(0)

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        file.seek(0)

        raise ValidationError(
            "Invalid image file."
        ) from exc


# ============================================================
# VIDEO
# ============================================================

def _validate_video(
    file: BinaryIO,
) -> None:
    size = _get_size(file)

    if size > MAX_VIDEO_SIZE:
        raise ValidationError(
            "Video is too large. Maximum size is 100 MB."
        )

    content_type = _get_content_type(file)

    if content_type not in VIDEO_TYPES:
        raise ValidationError(
            "Invalid video file."
        )

    extension = _get_extension(file)

    if extension not in VIDEO_EXTENSIONS:
        raise ValidationError(
            "Invalid video file extension."
        )

    header = _read_header(
        file,
        32,
    )

    is_mp4_or_mov = (
        len(header) >= 12
        and header[4:8] == b"ftyp"
    )

    is_webm = header.startswith(
        b"\x1a\x45\xdf\xa3"
    )

    if not (
        is_mp4_or_mov
        or is_webm
    ):
        raise ValidationError(
            "Invalid video file."
        )

    if (
        extension == ".webm"
        and not is_webm
    ):
        raise ValidationError(
            "Invalid video file."
        )

    if (
        extension in {
            ".mp4",
            ".mov",
        }
        and not is_mp4_or_mov
    ):
        raise ValidationError(
            "Invalid video file."
        )


# ============================================================
# GENERIC FILE
# ============================================================

def _validate_generic_file(
    file: BinaryIO,
) -> None:
    size = _get_size(file)

    if size > MAX_FILE_SIZE:
        raise ValidationError(
            "File is too large. Maximum size is 25 MB."
        )

    extension = _get_extension(file)

    if extension not in FILE_EXTENSIONS:
        raise ValidationError(
            "This file type is not allowed."
        )

    content_type = _get_content_type(file)

    allowed_types = FILE_TYPES_BY_EXTENSION[
        extension
    ]

    if content_type not in allowed_types:
        raise ValidationError(
            "Invalid file type."
        )

    _validate_file_signature(
        file=file,
        extension=extension,
    )


# ============================================================
# PUBLIC API
# ============================================================

def validate_attachment(
    *,
    file: BinaryIO,
    attachment_type: str,
) -> None:
    """
    Validate exactly one attachment before upload.

    Supported types:
        image
        video
        file
    """

    if not file:
        raise ValidationError(
            "Attachment is required."
        )

    _ensure_filename(file)

    if attachment_type == "image":
        _validate_image(file)
        return

    if attachment_type == "video":
        _validate_video(file)
        return

    if attachment_type == "file":
        _validate_generic_file(file)
        return

    raise ValidationError(
        "Unsupported attachment type."
    )


def validate_message_attachments(
    *,
    image_file=None,
    video_file=None,
    generic_file=None,
) -> tuple[str, BinaryIO] | None:
    """
    Validate the complete attachment set for one message.

    Only one attachment is allowed per message.

    Returns:
        (attachment_type, file)
        or None when no attachment was supplied.
    """

    supplied = [
        (
            "image",
            image_file,
        ),
        (
            "video",
            video_file,
        ),
        (
            "file",
            generic_file,
        ),
    ]

    attachments = [
        item
        for item in supplied
        if item[1] is not None
    ]

    if len(attachments) > 1:
        raise ValidationError(
            "Please attach only one file per message."
        )

    if not attachments:
        return None

    attachment_type, file = attachments[0]

    validate_attachment(
        file=file,
        attachment_type=attachment_type,
    )

    return (
        attachment_type,
        file,
    )
