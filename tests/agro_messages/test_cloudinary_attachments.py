from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from agro_marketplace.agro_messages.models import (
    Message,
    MessageAttachment,
)
from agro_marketplace.agro_messages.services.cloudinary_attachments import (
    ATTACHMENT_FILE,
    ATTACHMENT_IMAGE,
    ATTACHMENT_VIDEO,
    CHUNKED_UPLOAD_THRESHOLD,
    RESOURCE_TYPE_IMAGE,
    RESOURCE_TYPE_RAW,
    RESOURCE_TYPE_VIDEO,
    CloudinaryAttachmentError,
    CloudinaryAttachmentUploadError,
    _build_public_id,
    _get_resource_type,
    upload_message_attachment,
)
from agro_marketplace.agro_messages.services.message_attachments import (
    upload_message_attachment_file,
)


class CloudinaryAttachmentServiceTests(
    TestCase
):
    def test_image_uses_image_resource_type(self):
        result = _get_resource_type(
            ATTACHMENT_IMAGE
        )

        self.assertEqual(
            result,
            RESOURCE_TYPE_IMAGE,
        )

    def test_video_uses_video_resource_type(self):
        result = _get_resource_type(
            ATTACHMENT_VIDEO
        )

        self.assertEqual(
            result,
            RESOURCE_TYPE_VIDEO,
        )

    def test_file_uses_raw_resource_type(self):
        result = _get_resource_type(
            ATTACHMENT_FILE
        )

        self.assertEqual(
            result,
            RESOURCE_TYPE_RAW,
        )

    def test_unknown_attachment_type_raises_error(self):
        with self.assertRaises(
            CloudinaryAttachmentError
        ):
            _get_resource_type("unknown")

    def test_public_id_contains_message_id(self):
        public_id = _build_public_id(
            message_id=123
        )

        self.assertTrue(
            public_id.startswith(
                "chat/messages/123/"
            )
        )

    def test_public_id_is_unique(self):
        first = _build_public_id(
            message_id=123
        )

        second = _build_public_id(
            message_id=123
        )

        self.assertNotEqual(
            first,
            second,
        )

    @patch(
        "agro_marketplace.agro_messages.services."
        "cloudinary_attachments."
        "cloudinary.uploader.upload"
    )
    def test_small_file_uses_regular_upload(
        self,
        mock_upload,
    ):
        mock_upload.return_value = {
            "public_id": "chat/messages/1/test",
            "resource_type": "image",
        }

        uploaded_file = BytesIO(
            b"small test file"
        )

        result = upload_message_attachment(
            file=uploaded_file,
            attachment_type=ATTACHMENT_IMAGE,
            message_id=1,
        )

        mock_upload.assert_called_once()

        self.assertEqual(
            result["public_id"],
            "chat/messages/1/test",
        )

    @patch(
        "agro_marketplace.agro_messages.services."
        "cloudinary_attachments."
        "cloudinary.uploader.upload_large"
    )
    def test_large_file_uses_chunked_upload(
        self,
        mock_upload_large,
    ):
        mock_upload_large.return_value = {
            "public_id": "chat/messages/1/test",
            "resource_type": "video",
        }

        uploaded_file = BytesIO(
            b"x" * (
                CHUNKED_UPLOAD_THRESHOLD + 1
            )
        )

        result = upload_message_attachment(
            file=uploaded_file,
            attachment_type=ATTACHMENT_VIDEO,
            message_id=1,
        )

        mock_upload_large.assert_called_once()

        self.assertEqual(
            result["resource_type"],
            "video",
        )

    @patch(
        "agro_marketplace.agro_messages.services."
        "cloudinary_attachments."
        "cloudinary.uploader.upload"
    )
    def test_upload_error_is_wrapped(
        self,
        mock_upload,
    ):
        mock_upload.side_effect = RuntimeError(
            "Cloudinary unavailable"
        )

        uploaded_file = BytesIO(
            b"test"
        )

        with self.assertRaises(
            CloudinaryAttachmentUploadError
        ):
            upload_message_attachment(
                file=uploaded_file,
                attachment_type=ATTACHMENT_IMAGE,
                message_id=1,
            )

    @patch(
        "agro_marketplace.agro_messages.services."
        "message_attachments.upload_message_attachment"
    )
    def test_message_attachment_file_metadata(
        self,
        mock_upload,
    ):
        User = get_user_model()

        sender = User.objects.create_user(
            username="attachment_sender",
            email="attachment_sender@test.com",
        )

        recipient = User.objects.create_user(
            username="attachment_recipient",
            email="attachment_recipient@test.com",
        )

        message = Message.objects.create(
            sender=sender,
            recipient=recipient,
            body="Test message",
        )

        mock_upload.return_value = {
            "public_id": (
                f"chat/messages/{message.pk}/test"
            ),
            "resource_type": "image",
            "secure_url": (
                "https://res.cloudinary.com/test/"
                "image/upload/"
                f"chat/messages/{message.pk}/test"
            ),
        }

        uploaded_file = BytesIO(
            b"test image"
        )

        uploaded_file.name = "photo.jpg"
        uploaded_file.content_type = "image/jpeg"
        uploaded_file.size = 10

        result = upload_message_attachment_file(
            file=uploaded_file,
            attachment_type=ATTACHMENT_IMAGE,
            message_id=message.pk,
        )

        self.assertIsInstance(
            result,
            MessageAttachment,
        )

        self.assertEqual(
            result.original_name,
            "photo.jpg",
        )

        self.assertEqual(
            result.mime_type,
            "image/jpeg",
        )

        self.assertEqual(
            result.size,
            10,
        )

        self.assertEqual(
            result.attachment_type,
            ATTACHMENT_IMAGE,
        )

        self.assertEqual(
            result.cloudinary_public_id,
            f"chat/messages/{message.pk}/test",
        )

        self.assertEqual(
            result.cloudinary_resource_type,
            "image",
        )

        self.assertEqual(
            result.message_id,
            message.pk,
        )

        mock_upload.assert_called_once_with(
            file=uploaded_file,
            attachment_type=ATTACHMENT_IMAGE,
            message_id=message.pk,
        )
