import hashlib

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db import transaction

from .models import Message, MessageStatus


class MessageConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):

        self.user = self.scope["user"]

        self.root_message_id = (
            self.scope["url_route"]["kwargs"].get("message_id")
        )

        if not self.user.is_authenticated:
            await self.close(code=4401)
            return

        conversation = await self.get_conversation()

        if conversation is None:
            await self.close(code=4403)
            return

        self.sender_id = conversation["sender_id"]
        self.recipient_id = conversation["recipient_id"]
        self.product_type = conversation["product_type"]
        self.product_id = conversation["product_id"]

        self.group_name = self.build_group_name(
            self.sender_id,
            self.recipient_id,
            self.product_type,
            self.product_id,
        )

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send_json({
            "type": "connection_established",
            "message": "WebSocket connection established.",
        })


    async def disconnect(self, close_code):

        if hasattr(self, "group_name"):

            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )


    async def receive_json(self, content, **kwargs):

        message_type = content.get("type")

        if message_type == "ping":

            await self.send_json({
                "type": "pong",
            })

            return

        if message_type == "send_message":

            await self.handle_send_message(content)

            return

        await self.send_json({
            "type": "error",
            "code": "unsupported_message_type",
            "message": "Unsupported WebSocket message type.",
        })


    async def handle_send_message(self, content):

        body = content.get("body")

        if not isinstance(body, str):

            await self.send_json({
                "type": "error",
                "code": "invalid_body",
                "message": "Message body must be a string.",
            })

            return

        body = body.strip()

        if not body:

            await self.send_json({
                "type": "error",
                "code": "empty_body",
                "message": "Message body cannot be empty.",
            })

            return

        if len(body) > 10000:

            await self.send_json({
                "type": "error",
                "code": "body_too_long",
                "message": "Message body is too long.",
            })

            return

        result = await self.create_message(body)

        if result is None:

            await self.send_json({
                "type": "error",
                "code": "message_creation_failed",
                "message": "Unable to create message.",
            })

            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "data": result,
            },
        )


    @database_sync_to_async
    def create_message(self, body):

        try:

            with transaction.atomic():

                recipient_id = (
                    self.recipient_id
                    if self.user.pk == self.sender_id
                    else self.sender_id
                )

                message = Message.objects.create(
                    sender_id=self.user.pk,
                    recipient_id=recipient_id,
                    body=body,
                    product_type=self.product_type,
                    product_id=self.product_id,
                    title="Direct conversation",
                )

                MessageStatus.objects.create(
                    message=message,
                    profile_id=recipient_id,
                    is_read=False,
                )

                MessageStatus.objects.create(
                    message=message,
                    profile_id=self.user.pk,
                    is_read=True,
                )

                return self.serialize_message(
                    message
                )

        except Exception as error:

            print(
                "WebSocket message creation error:",
                error,
            )

            return None


    @database_sync_to_async
    def get_conversation(self):

        try:

            root_message = (
                Message.objects
                .select_related(
                    "sender",
                    "sender__profile",
                    "recipient",
                    "recipient__profile",
                )
                .get(
                    pk=self.root_message_id
                )
            )

        except Message.DoesNotExist:

            return None

        if self.user.pk not in {
            root_message.sender_id,
            root_message.recipient_id,
        }:

            return None

        return {
            "sender_id": root_message.sender_id,
            "recipient_id": root_message.recipient_id,
            "product_type": root_message.product_type,
            "product_id": root_message.product_id,
        }


    @staticmethod
    def serialize_message(message):

        sender = message.sender

        profile = getattr(
            sender,
            "profile",
            None,
        )

        username = (
            getattr(
                profile,
                "username_in_marketplace",
                None,
            )
            or sender.username
        )

        profile_photo = ""

        if profile and profile.profile_photo:

            try:
                profile_photo = profile.profile_photo.url

            except Exception:
                profile_photo = ""

        parent = None

        if message.parent_message_id:

            parent_message = (
                Message.objects
                .select_related(
                    "sender",
                    "sender__profile",
                )
                .filter(
                    pk=message.parent_message_id
                )
                .first()
            )

            if parent_message:

                parent_profile = getattr(
                    parent_message.sender,
                    "profile",
                    None,
                )

                parent_username = (
                    getattr(
                        parent_profile,
                        "username_in_marketplace",
                        None,
                    )
                    or parent_message.sender.username
                )

                parent_image_url = ""

                if parent_message.image:

                    try:
                        parent_image_url = (
                            parent_message.image.url
                        )

                    except Exception:
                        parent_image_url = ""

                parent_video_url = ""

                if parent_message.video:

                    try:
                        parent_video_url = (
                            parent_message.video.url
                        )

                    except Exception:
                        parent_video_url = ""

                parent = {
                    "id": parent_message.pk,
                    "sender_id": parent_message.sender_id,
                    "username": parent_username,
                    "body": parent_message.body or "",
                    "image_url": parent_image_url,
                    "video_url": parent_video_url,
                    "is_removed": parent_message.is_removed,
                }

        image_url = ""

        if message.image:

            try:
                image_url = message.image.url

            except Exception:
                image_url = ""

        video_url = ""

        if message.video:

            try:
                video_url = message.video.url

            except Exception:
                video_url = ""

        return {
            "type": "message_created",

            "message": {
                "id": message.pk,

                "sender_id": message.sender_id,
                "recipient_id": message.recipient_id,

                "sender_username": username,
                "sender_profile_photo": profile_photo,

                "body": message.body or "",
                "title": message.title or "",

                "image_url": image_url,
                "video_url": video_url,

                "product_type": message.product_type,
                "product_id": message.product_id,

                "timestamp": message.timestamp.isoformat(),

                "is_system": message.is_system,
                "is_removed": message.is_removed,

                "parent_message": parent,

                "delivery_status": "sent",
            },
        }


    async def chat_message(self, event):

        await self.send_json(
            event["data"]
        )


    @staticmethod
    def build_group_name(
        sender_id,
        recipient_id,
        product_type,
        product_id,
    ):

        user_ids = sorted([
            sender_id,
            recipient_id,
        ])

        raw = (
            f"{user_ids[0]}:"
            f"{user_ids[1]}:"
            f"{product_type or ''}:"
            f"{product_id or ''}"
        )

        digest = hashlib.sha256(
            raw.encode("utf-8")
        ).hexdigest()[:32]

        return f"chat_{digest}"
