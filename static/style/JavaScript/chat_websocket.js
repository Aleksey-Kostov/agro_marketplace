document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    if (!chatWindow) {
        return;
    }

    const WEBSOCKET_RECONNECT_DELAY = 3000;

    let messageWebSocket = null;
    let websocketReconnectTimer = null;
    let websocketManuallyClosed = false;


    /* =========================================================
       WEBSOCKET URL
       ========================================================= */

    function getWebSocketUrl() {
        const rootMessageId =
            chatWindow.dataset.rootMessageId;

        if (!rootMessageId) {
            console.warn(
                'WebSocket: data-root-message-id is missing.'
            );

            return null;
        }

        const protocol =
            window.location.protocol === 'https:'
                ? 'wss:'
                : 'ws:';

        return (
            `${protocol}//${window.location.host}` +
            `/ws/messages/${encodeURIComponent(rootMessageId)}/`
        );
    }


    /* =========================================================
       SEND
       ========================================================= */

    function sendWebSocketPayload(payload) {
        if (
            !messageWebSocket ||
            messageWebSocket.readyState !== WebSocket.OPEN
        ) {
            return false;
        }

        try {
            messageWebSocket.send(
                JSON.stringify(payload)
            );

            return true;

        } catch (error) {
            console.error(
                'Unable to send WebSocket payload:',
                error
            );

            return false;
        }
    }


    /* =========================================================
       INCOMING MESSAGE
       ========================================================= */

    function handleWebSocketMessage(event) {
        let data;

        try {
            data = JSON.parse(event.data);

        } catch (error) {
            console.error(
                'WebSocket invalid JSON:',
                error
            );

            return;
        }

        /*
         * Send every WebSocket message to the rest
         * of the chat application.
         *
         * conversation.js
         * chat_typing.js
         * and other modules can listen here.
         */
        window.dispatchEvent(
            new CustomEvent(
                'agro:websocket-message',
                {
                    detail: data
                }
            )
        );
    }


    /* =========================================================
       RECONNECT
       ========================================================= */

    function scheduleWebSocketReconnect() {
        if (
            websocketManuallyClosed ||
            websocketReconnectTimer
        ) {
            return;
        }

        websocketReconnectTimer =
            setTimeout(
                function () {
                    websocketReconnectTimer =
                        null;

                    connectWebSocket();
                },
                WEBSOCKET_RECONNECT_DELAY
            );
    }


    /* =========================================================
       CONNECT
       ========================================================= */

    function connectWebSocket() {
        const url =
            getWebSocketUrl();

        if (!url) {
            return;
        }

        /*
         * Do not create a second socket while one
         * is already OPEN or CONNECTING.
         */
        if (
            messageWebSocket &&
            (
                messageWebSocket.readyState ===
                    WebSocket.OPEN ||
                messageWebSocket.readyState ===
                    WebSocket.CONNECTING
            )
        ) {
            return;
        }

        websocketManuallyClosed = false;

        try {
            messageWebSocket =
                new WebSocket(url);

            /*
             * Public socket reference.
             *
             * chat_typing.js uses this.
             */
            window.agroMessageSocket =
                messageWebSocket;

        } catch (error) {
            console.error(
                'Unable to create WebSocket:',
                error
            );

            messageWebSocket = null;
            window.agroMessageSocket = null;

            scheduleWebSocketReconnect();

            return;
        }


        /* =====================================================
           OPEN
           ===================================================== */

        messageWebSocket.addEventListener(
            'open',
            function () {
                console.log(
                    'Message WebSocket connected.'
                );

                /*
                 * Make absolutely sure the current
                 * socket is exposed.
                 */
                window.agroMessageSocket =
                    messageWebSocket;

                /*
                 * Tell other modules that the socket
                 * is really OPEN.
                 */
                window.dispatchEvent(
                    new CustomEvent(
                        'agro:websocket-open'
                    )
                );
            }
        );


        /* =====================================================
           MESSAGE
           ===================================================== */

        messageWebSocket.addEventListener(
            'message',
            handleWebSocketMessage
        );


        /* =====================================================
           ERROR
           ===================================================== */

        messageWebSocket.addEventListener(
            'error',
            function (error) {
                console.error(
                    'Message WebSocket error:',
                    error
                );
            }
        );


        /* =====================================================
           CLOSE
           ===================================================== */

        messageWebSocket.addEventListener(
            'close',
            function (event) {
                console.warn(
                    'Message WebSocket closed:',
                    event.code,
                    event.reason
                );

                messageWebSocket =
                    null;

                window.agroMessageSocket =
                    null;

                scheduleWebSocketReconnect();
            }
        );
    }


    /* =========================================================
       CLOSE
       ========================================================= */

    function closeWebSocket() {
        websocketManuallyClosed = true;

        if (websocketReconnectTimer) {
            clearTimeout(
                websocketReconnectTimer
            );

            websocketReconnectTimer = null;
        }

        if (messageWebSocket) {
            try {
                messageWebSocket.close(
                    1000,
                    'Page unloading'
                );

            } catch (error) {
                console.error(
                    'Unable to close WebSocket:',
                    error
                );
            }

            messageWebSocket = null;
        }

        window.agroMessageSocket = null;
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.agroChatWebSocket = {
        send: sendWebSocketPayload,
        connect: connectWebSocket,
        close: closeWebSocket,
        isOpen: function () {
            return Boolean(
                messageWebSocket &&
                messageWebSocket.readyState ===
                    WebSocket.OPEN
            );
        },
        getSocket: function () {
            return messageWebSocket;
        }
    };


    /* =========================================================
       START
       ========================================================= */

    connectWebSocket();


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            closeWebSocket();
        }
    );
});
