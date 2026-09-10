import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        print("WS CONNECT: start")

        self.conversation_id = (
            self.scope["url_route"]["kwargs"]["conversation_id"]
        )

        print(
            f"WS CONNECT: conversation_id={self.conversation_id}"
        )

        self.room_group_name = (
            f"conversation_{self.conversation_id}"
        )

        print(
            f"WS CONNECT: group={self.room_group_name}"
        )

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        print("WS CONNECT: group_add OK")

        await self.accept()

        print("WS CONNECT: accept OK")

    async def disconnect(self, close_code):
        print(
            f"WS DISCONNECT: {close_code}"
        )

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

        print(
            "WS CONNECT: group_discard OK"
        )

    @database_sync_to_async
    def get_username(self):
        user = self.scope["user"]

        profile = getattr(user, "profile", None)

        return (
                getattr(profile, "username_in_marketplace", None)
                or user.username
        )

    async def receive(self, text_data):
        print(
            f"WS RECEIVE: {text_data}"
        )

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            print("WS RECEIVE: invalid JSON")
            return

        if data.get("type") != "typing":
            print(
                f"WS RECEIVE: unknown type={data.get('type')}"
            )
            return

        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            print("WS TYPING: unauthenticated user")
            return

        username = await self.get_username()

        is_typing = bool(
            data.get("is_typing")
        )

        print(
            f"WS TYPING: username={username}, "
            f"is_typing={is_typing}"
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_status",
                "is_typing": is_typing,
                "username": username,
                "sender_channel_name": self.channel_name,
            },
        )

    async def typing_status(self, event):
        if (
                event.get("sender_channel_name")
                == self.channel_name
        ):
            return

        print(
            "WS TYPING EVENT: sending to browser"
        )

        await self.send(
            text_data=json.dumps({
                "type": "typing",
                "is_typing": event["is_typing"],
                "username": event["username"],
            })
        )

    async def chat_message(self, event):
        print(
            "WS EVENT: new message received from Redis"
        )

        await self.send(
            text_data=json.dumps({
                "type": "new_message",
                "message": event["message"],
            })
        )

        print(
            "WS EVENT: message sent to browser"
        )

    async def reaction_update(self, event):
        print("WS EVENT: reaction update received from Redis")

        await self.send(
            text_data=json.dumps({
                "type": "reaction_update",
                "message_id": event["message_id"],
                "reaction": event["reaction"],
                "active": event["active"],
                "reactors": event["reactors"],
            })
        )

        print("WS EVENT: reaction update sent to browser")
