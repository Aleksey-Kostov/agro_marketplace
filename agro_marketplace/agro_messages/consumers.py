import json

from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        print("WS CONNECT: start")

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        print(f"WS CONNECT: conversation_id={self.conversation_id}")

        self.room_group_name = f"conversation_{self.conversation_id}"
        print(f"WS CONNECT: group={self.room_group_name}")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        print("WS CONNECT: group_add OK")

        await self.accept()
        print("WS CONNECT: accept OK")

    async def disconnect(self, close_code):
        print(f"WS DISCONNECT: {close_code}")

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

        print("WS DISCONNECT: group_discard OK")

    async def receive(self, text_data):
        print(f"WS RECEIVE: {text_data}")

        data = json.loads(text_data)
        message = data.get("message")

        if not message:
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message,
            },
        )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({
                "message": event["message"],
            })
        )
