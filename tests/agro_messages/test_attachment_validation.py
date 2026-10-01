from io import BytesIO

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from PIL import Image

from agro_marketplace.agro_messages.services.attachment_validation import (
    MAX_FILE_SIZE,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    validate_attachment,
    validate_message_attachments,
)


class UploadedTestFile(BytesIO):
    def __init__(
        self,
        content,
        *,
        name,
        content_type,
    ):
        super().__init__(content)

        self.name = name
        self.content_type = content_type
        self.size = len(content)


def create_jpeg():
    buffer = BytesIO()

    image = Image.new(
        "RGB",
        (100, 100),
        "white",
    )

    image.save(
        buffer,
        format="JPEG",
    )

    return buffer.getvalue()


class AttachmentValidationTests(
    SimpleTestCase
):
    def test_valid_image(self):
        file = UploadedTestFile(
            create_jpeg(),
            name="photo.jpg",
            content_type="image/jpeg",
        )

        validate_attachment(
            file=file,
            attachment_type="image",
        )

    def test_invalid_image_content(self):
        file = UploadedTestFile(
            b"not-an-image",
            name="photo.jpg",
            content_type="image/jpeg",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="image",
            )

    def test_image_extension_must_be_allowed(self):
        file = UploadedTestFile(
            create_jpeg(),
            name="photo.exe",
            content_type="image/jpeg",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="image",
            )

    def test_image_size_limit(self):
        file = UploadedTestFile(
            b"x",
            name="photo.jpg",
            content_type="image/jpeg",
        )

        file.size = MAX_IMAGE_SIZE + 1

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="image",
            )

    def test_valid_mp4_signature(self):
        content = (
            b"\x00\x00\x00\x18"
            b"ftyp"
            b"isom"
            b"\x00\x00\x02\x00"
            b"isomiso2"
        )

        file = UploadedTestFile(
            content,
            name="video.mp4",
            content_type="video/mp4",
        )

        validate_attachment(
            file=file,
            attachment_type="video",
        )

    def test_invalid_video_signature(self):
        file = UploadedTestFile(
            b"not-a-video",
            name="video.mp4",
            content_type="video/mp4",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="video",
            )

    def test_video_extension_must_match_container(self):
        content = (
            b"\x1a\x45\xdf\xa3"
            b"\x00\x00\x00\x00"
        )

        file = UploadedTestFile(
            content,
            name="video.mp4",
            content_type="video/mp4",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="video",
            )

    def test_video_size_limit(self):
        file = UploadedTestFile(
            b"x",
            name="video.mp4",
            content_type="video/mp4",
        )

        file.size = MAX_VIDEO_SIZE + 1

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="video",
            )

    def test_valid_pdf(self):
        file = UploadedTestFile(
            b"%PDF-1.7\n",
            name="document.pdf",
            content_type="application/pdf",
        )

        validate_attachment(
            file=file,
            attachment_type="file",
        )

    def test_invalid_pdf_content(self):
        file = UploadedTestFile(
            b"not-a-pdf",
            name="document.pdf",
            content_type="application/pdf",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="file",
            )

    def test_generic_file_extension_must_be_allowed(self):
        file = UploadedTestFile(
            b"anything",
            name="malware.exe",
            content_type="application/octet-stream",
        )

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="file",
            )

    def test_generic_file_size_limit(self):
        file = UploadedTestFile(
            b"%PDF-1.7\n",
            name="document.pdf",
            content_type="application/pdf",
        )

        file.size = MAX_FILE_SIZE + 1

        with self.assertRaises(ValidationError):
            validate_attachment(
                file=file,
                attachment_type="file",
            )

    def test_only_one_attachment_is_allowed(self):
        image_file = UploadedTestFile(
            create_jpeg(),
            name="photo.jpg",
            content_type="image/jpeg",
        )

        video_file = UploadedTestFile(
            b"\x00\x00\x00\x18"
            b"ftyp"
            b"isom"
            b"\x00\x00\x02\x00"
            b"isomiso2",
            name="video.mp4",
            content_type="video/mp4",
        )

        with self.assertRaises(ValidationError):
            validate_message_attachments(
                image_file=image_file,
                video_file=video_file,
            )

    def test_no_attachment_returns_none(self):
        result = validate_message_attachments()

        self.assertIsNone(result)

    def test_attachment_type_is_returned(self):
        file = UploadedTestFile(
            b"%PDF-1.7\n",
            name="document.pdf",
            content_type="application/pdf",
        )

        result = validate_message_attachments(
            generic_file=file,
        )

        self.assertIsNotNone(result)

        attachment_type, returned_file = result

        self.assertEqual(
            attachment_type,
            "file",
        )

        self.assertIs(
            returned_file,
            file,
        )
