document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const WEBSOCKET_RECONNECT_DELAY = 3000;

    let messageWebSocket = null;
    let websocketReconnectTimer = null;
    let websocketManuallyClosed = false;

    function getWebSocketUrl() {
        const rootMessageId = chatWindow.dataset.rootMessageId;
        if (!rootMessageId) {
            console.warn('WebSocket: data-root-message-id is missing.');
            return null;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws/messages/${encodeURIComponent(rootMessageId)}/`;
    }

    function sendWebSocketPayload(payload) {
        if (!messageWebSocket || messageWebSocket.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            messageWebSocket.send(JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error('Unable to send WebSocket payload:', error);
            return false;
        }
    }

    function handleWebSocketMessage(event) {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.error('WebSocket invalid JSON:', error);
            return;
        }
        // Broadcast to conversation.js, chat_typing.js and others
        window.dispatchEvent(new CustomEvent('agro:websocket-message', {
            detail: data
        }));
    }

    function scheduleWebSocketReconnect() {
        if (websocketManuallyClosed || websocketReconnectTimer) return;
        websocketReconnectTimer = setTimeout(() => {
            websocketReconnectTimer = null;
            connectWebSocket();
        }, WEBSOCKET_RECONNECT_DELAY);
    }

    function connectWebSocket() {
        const url = getWebSocketUrl();
        if (!url) return;

        if (messageWebSocket &&
            (messageWebSocket.readyState === WebSocket.OPEN ||
             messageWebSocket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        websocketManuallyClosed = false;

        try {
            messageWebSocket = new WebSocket(url);
            window.agroMessageSocket = messageWebSocket;
        } catch (error) {
            console.error('Unable to create WebSocket:', error);
            messageWebSocket = null;
            window.agroMessageSocket = null;
            scheduleWebSocketReconnect();
            return;
        }

        messageWebSocket.addEventListener('open', function () {
            console.log('Message WebSocket connected.');
            window.agroMessageSocket = messageWebSocket;
            window.dispatchEvent(new CustomEvent('agro:websocket-open'));
        });

        messageWebSocket.addEventListener('message', handleWebSocketMessage);

        messageWebSocket.addEventListener('error', function (error) {
            console.error('Message WebSocket error:', error);
        });

        messageWebSocket.addEventListener('close', function (event) {
            console.warn('Message WebSocket closed:', event.code, event.reason);
            messageWebSocket = null;
            window.agroMessageSocket = null;
            scheduleWebSocketReconnect();
        });
    }

    function closeWebSocket() {
        websocketManuallyClosed = true;
        if (websocketReconnectTimer) {
            clearTimeout(websocketReconnectTimer);
            websocketReconnectTimer = null;
        }
        if (messageWebSocket) {
            try {
                messageWebSocket.close(1000, 'Page unloading');
            } catch (error) {
                console.error('Unable to close WebSocket:', error);
            }
            messageWebSocket = null;
        }
        window.agroMessageSocket = null;
    }

    // Public manager API (used by chat_typing.js and others)
    window.agroChatWebSocket = {
        send: sendWebSocketPayload,
        connect: connectWebSocket,
        close: closeWebSocket,
        isOpen: function () {
            return Boolean(
                messageWebSocket &&
                messageWebSocket.readyState === WebSocket.OPEN
            );
        },
        getSocket: function () {
            return messageWebSocket;
        }
    };

    connectWebSocket();

    window.addEventListener('beforeunload', function () {
        closeWebSocket();
    });
});
