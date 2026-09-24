import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .models import Message, MessageStatus

import hashlib


class MessageConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope.get("user")

        if (
            not self.user
            or isinstance(self.user, AnonymousUser)
            or not self.user.is_authenticated
        ):
            await self.close(code=4001)
            return

        self.root_message_id = (
            self.scope["url_route"]["kwargs"].get("pk")
        )

        conversation = await self.get_conversation(
            self.root_message_id
        )

        if not conversation:
            await self.close(code=4004)
            return

        self.conversation_sender_id = (
            conversation["sender_id"]
        )

        self.conversation_recipient_id = (
            conversation["recipient_id"]
        )

        self.conversation_product_type = (
            conversation["product_type"]
        )

        self.conversation_product_id = (
            conversation["product_id"]
        )

        # IMPORTANT:
        # Трябва да е 100% същият алгоритъм като
        # build_message_group_name() в views.py.
        self.group_name = self.build_group_name(
            sender_id=conversation["sender_id"],
            recipient_id=conversation["recipient_id"],
            product_type=conversation["product_type"],
            product_id=conversation["product_id"],
        )

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def receive(
        self,
        text_data=None,
        bytes_data=None,
    ):
        if not text_data:
            return

        try:
            content = json.loads(text_data)
        except (TypeError, ValueError):
            return

        message_type = content.get("type")

        # -----------------------------------------------------
        # PING
        # -----------------------------------------------------

        if message_type == "ping":
            await self.send(
                text_data=json.dumps({
                    "type": "pong",
                })
            )
            return

        # -----------------------------------------------------
        # SEND MESSAGE
        # -----------------------------------------------------

        if message_type == "send_message":
            await self.handle_send_message(content)
            return

        # -----------------------------------------------------
        # MARK READ
        # -----------------------------------------------------

        if message_type == "mark_read":
            await self.handle_mark_read(content)
            return

    # =========================================================
    # SEND MESSAGE
    # =========================================================

    async def handle_send_message(self, content):
        body = (
            content.get("body")
            or ""
        ).strip()

        if not body:
            return

        result = await self.create_message(body)

        if not result:
            return

        # -----------------------------------------------------
        # MESSAGE CREATED
        # -----------------------------------------------------

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "data": {
                    "type": "message_created",
                    "message": result,
                },
            },
        )

        # -----------------------------------------------------
        # DELIVERED
        # -----------------------------------------------------

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "data": {
                    "type": "message_status_updated",
                    "message_id": result["id"],
                    "delivery_status": "delivered",
                    "status": "delivered",
                },
            },
        )

    # =========================================================
    # MARK READ
    # =========================================================

    async def handle_mark_read(self, content):
        try:
            message_id = int(
                content.get("message_id")
            )
        except (TypeError, ValueError):
            return

        result = await self.mark_message_read(
            message_id
        )

        if not result:
            return

        # Няма нужда да пращаме event, ако съобщението
        # вече е било read.
        if not result["changed"]:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "data": {
                    "type": "message_status_updated",
                    "message_id": result["message_id"],
                    "delivery_status": "read",
                    "status": "read",
                    "reader_id": result["reader_id"],
                },
            },
        )

    # =========================================================
    # GROUP MESSAGE
    # =========================================================

    async def chat_message(self, event):
        data = event.get("data") or {}

        await self.send(
            text_data=json.dumps(data)
        )

    # =========================================================
    # DATABASE
    # =========================================================

    @database_sync_to_async
    def get_conversation(
        self,
        root_message_id,
    ):
        try:
            message = (
                Message.objects
                .select_related(
                    "sender",
                    "recipient",
                )
                .get(
                    pk=root_message_id
                )
            )
        except Message.DoesNotExist:
            return None

        # Само участниците в conversation-а могат
        # да отворят WebSocket-а.
        if self.user.pk not in {
            message.sender_id,
            message.recipient_id,
        }:
            return None

        product_type = getattr(
            message,
            "product_type",
            None,
        )

        product_id = getattr(
            message,
            "product_id",
            None,
        )

        return {
            "sender_id": message.sender_id,
            "recipient_id": message.recipient_id,
            "product_type": product_type,
            "product_id": product_id,
        }

    @database_sync_to_async
    def create_message(
        self,
        body,
    ):
        try:
            root_message = (
                Message.objects
                .get(
                    pk=self.root_message_id
                )
            )
        except Message.DoesNotExist:
            return None

        # Проверка дали user е участник.
        if self.user.pk not in {
            root_message.sender_id,
            root_message.recipient_id,
        }:
            return None

        if self.user.pk == root_message.sender_id:
            recipient_id = (
                root_message.recipient_id
            )
        else:
            recipient_id = (
                root_message.sender_id
            )

        message = Message.objects.create(
            sender_id=self.user.pk,
            recipient_id=recipient_id,
            body=body,
            parent_message=root_message,
            product_type=root_message.product_type,
            product_id=root_message.product_id,
            title=root_message.title,
        )

        # -----------------------------------------------------
        # SENDER = READ
        # -----------------------------------------------------

        MessageStatus.objects.update_or_create(
            message=message,
            profile_id=self.user.pk,
            defaults={
                "is_read": True,
            },
        )

        # -----------------------------------------------------
        # RECIPIENT = DELIVERED, BUT UNREAD
        # -----------------------------------------------------

        MessageStatus.objects.update_or_create(
            message=message,
            profile_id=recipient_id,
            defaults={
                "is_read": False,
            },
        )

        return {
            "id": message.pk,
            "sender_id": message.sender_id,
            "recipient_id": message.recipient_id,
            "body": message.body,
            "delivery_status": "delivered",
        }

    @database_sync_to_async
    def mark_message_read(
        self,
        message_id,
    ):
        try:
            message = (
                Message.objects
                .get(
                    pk=message_id
                )
            )
        except Message.DoesNotExist:
            return None

        # Само recipient може да маркира message-а
        # като read.
        if message.recipient_id != self.user.pk:
            return None

        # Допълнителна защита:
        # message-ът трябва да е в текущата conversation.
        current_group = self.build_group_name(
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            product_type=message.product_type,
            product_id=message.product_id,
        )

        if current_group != self.group_name:
            return None

        status, created = (
            MessageStatus.objects.get_or_create(
                message=message,
                profile_id=self.user.pk,
                defaults={
                    "is_read": True,
                },
            )
        )

        changed = False

        if not status.is_read:
            status.is_read = True

            status.save(
                update_fields=[
                    "is_read",
                ]
            )

            changed = True

        elif created:
            changed = True

        return {
            "message_id": message.pk,
            "changed": changed,
            "status": "read",
            "delivery_status": "read",
            "reader_id": self.user.pk,
        }

    # =========================================================
    # GROUP NAME
    # =========================================================

    @staticmethod
    def build_group_name(
        sender_id,
        recipient_id,
        product_type=None,
        product_id=None,
    ):
        """
        ВНИМАНИЕ:

        Този алгоритъм трябва да е абсолютно същият
        като build_message_group_name() в views.py.

        views.py прави:

            user1:user2:product_type:product_id

        след което:

            sha256(...).hexdigest()[:32]

        и:

            chat_<digest>
        """

        user_ids = sorted(
            [
                int(sender_id),
                int(recipient_id),
            ]
        )

        raw = (
            f"{user_ids[0]}:{user_ids[1]}:"
            f"{product_type or ''}:"
            f"{product_id or ''}"
        )

        digest = hashlib.sha256(
            raw.encode("utf-8")
        ).hexdigest()[:32]

        return f"chat_{digest}"
