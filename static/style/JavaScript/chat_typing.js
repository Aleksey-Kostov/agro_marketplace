document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    const replyForm =
        document.getElementById('reply-form');

    const messageBodyField =
        replyForm
            ? (
                replyForm.querySelector(
                    '[name="body"]'
                ) ||
                replyForm.querySelector(
                    'textarea'
                )
            )
            : null;

    const TYPING_STOP_DELAY = 1200;

    let typingTimer = null;
    let isTyping = false;
    let typingUserId = null;


    /* =========================================================
       CURRENT USER
       ========================================================= */

    function getCurrentUserId() {
        if (!chatWindow) {
            return null;
        }

        const value = Number(
            chatWindow.dataset.currentUserId
        );

        return (
            Number.isFinite(value) &&
            value > 0
        )
            ? value
            : null;
    }


    /* =========================================================
       WEBSOCKET MANAGER
       ========================================================= */

    function getWebSocketManager() {
        return (
            window.agroChatWebSocket ||
            null
        );
    }


    function isSocketOpen() {
        const manager =
            getWebSocketManager();

        return Boolean(
            manager &&
            typeof manager.isOpen === 'function' &&
            manager.isOpen()
        );
    }


    /* =========================================================
       SEND TYPING EVENT
       ========================================================= */

    function sendTypingEvent(type) {
        const manager =
            getWebSocketManager();

        if (
            !manager ||
            typeof manager.send !== 'function'
        ) {
            return false;
        }

        return manager.send({
            type: type
        });
    }


    /* =========================================================
       TYPING UI EVENT
       ========================================================= */

    function dispatchTypingState(
        typing,
        username = ''
    ) {
        window.dispatchEvent(
            new CustomEvent(
                'agro:typing-state',
                {
                    detail: {
                        typing: Boolean(typing),
                        username:
                            username || 'User'
                    }
                }
            )
        );
    }


    /* =========================================================
       START TYPING
       ========================================================= */

    function startTyping() {
        const wasTyping =
            isTyping;

        isTyping = true;

        /*
         * The WebSocket manager owns the socket.
         *
         * If it is still CONNECTING, do not send anything now.
         * agro:websocket-open will send typing_start after
         * the connection becomes ready.
         */
        if (!isSocketOpen()) {
            return;
        }

        /*
         * Send typing_start only once
         * during the current typing session.
         */
        if (!wasTyping) {
            sendTypingEvent(
                'typing_start'
            );
        }
    }


    /* =========================================================
       STOP TYPING
       ========================================================= */

    function stopTyping() {
        if (!isTyping) {
            return;
        }

        isTyping = false;

        /*
         * If the socket is temporarily unavailable,
         * sendTypingEvent() simply returns false.
         *
         * The important part is that the local typing
         * state is reset.
         */
        sendTypingEvent(
            'typing_stop'
        );
    }


    /* =========================================================
       TIMER
       ========================================================= */

    function clearTypingTimer() {
        if (!typingTimer) {
            return;
        }

        clearTimeout(
            typingTimer
        );

        typingTimer = null;
    }


    function resetTypingTimer() {
        clearTypingTimer();

        typingTimer =
            setTimeout(
                function () {
                    typingTimer = null;

                    stopTyping();
                },
                TYPING_STOP_DELAY
            );
    }


    /* =========================================================
       COMPOSER
       ========================================================= */

    function handleComposerInput() {
        if (!messageBodyField) {
            return;
        }

        const value =
            String(
                messageBodyField.value || ''
            ).trim();

        /*
         * Empty composer means the user stopped typing.
         */
        if (!value) {
            clearTypingTimer();
            stopTyping();

            return;
        }

        startTyping();

        resetTypingTimer();
    }


    if (messageBodyField) {
        messageBodyField.addEventListener(
            'input',
            handleComposerInput
        );

        messageBodyField.addEventListener(
            'blur',
            function () {
                clearTypingTimer();

                stopTyping();
            }
        );
    }


    /* =========================================================
       MESSAGE SENT
       ========================================================= */

    window.addEventListener(
        'agro:message-sent',
        function () {
            clearTypingTimer();

            stopTyping();
        }
    );


    /* =========================================================
       NORMALIZE WEBSOCKET DATA
       ========================================================= */

    function getTypingPayload(data) {
        if (!data) {
            return null;
        }

        /*
         * Channels sends typing events as:
         *
         * {
         *     type: "chat_message",
         *     data: {
         *         type: "typing_start",
         *         user_id: 123,
         *         username: "John"
         *     }
         * }
         *
         * The WebSocket manager already parses JSON.
         * Therefore event.detail contains the object directly.
         */
        if (
            data.type === 'chat_message' &&
            data.data
        ) {
            return data.data;
        }

        /*
         * Also support direct payloads:
         *
         * {
         *     type: "typing_start",
         *     ...
         * }
         */
        return data;
    }


    /* =========================================================
       INCOMING USER ID
       ========================================================= */

    function getIncomingUserId(data) {
        if (!data) {
            return null;
        }

        const raw =
            data.user_id ??
            data.sender_id ??
            data.user?.id ??
            null;

        const id =
            Number(raw);

        return (
            Number.isFinite(id) &&
            id > 0
        )
            ? id
            : null;
    }


    /* =========================================================
       INCOMING TYPING START
       ========================================================= */

    function handleIncomingTypingStart(data) {
        const currentUserId =
            getCurrentUserId();

        const incomingUserId =
            getIncomingUserId(data);

        /*
         * Never show our own typing indicator.
         */
        if (
            incomingUserId &&
            currentUserId &&
            incomingUserId ===
                currentUserId
        ) {
            return;
        }

        typingUserId =
            incomingUserId;

        const username =
            data.username ||
            data.user?.username ||
            'User';

        dispatchTypingState(
            true,
            username
        );
    }


    /* =========================================================
       INCOMING TYPING STOP
       ========================================================= */

    function handleIncomingTypingStop(data) {
        const incomingUserId =
            getIncomingUserId(data);

        /*
         * Ignore a stop event from another user
         * if we currently display somebody else.
         */
        if (
            typingUserId &&
            incomingUserId &&
            typingUserId !==
                incomingUserId
        ) {
            return;
        }

        typingUserId = null;

        dispatchTypingState(
            false
        );
    }


    /* =========================================================
       WEBSOCKET MESSAGE
       ========================================================= */

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const rawData =
                event.detail;

            if (!rawData) {
                return;
            }

            const data =
                getTypingPayload(
                    rawData
                );

            if (!data) {
                return;
            }


            /* ---------------------------------------------
               TYPING START
               --------------------------------------------- */

            if (
                data.type ===
                'typing_start'
            ) {
                handleIncomingTypingStart(
                    data
                );

                return;
            }


            /* ---------------------------------------------
               TYPING STOP
               --------------------------------------------- */

            if (
                data.type ===
                'typing_stop'
            ) {
                handleIncomingTypingStop(
                    data
                );

                return;
            }
        }
    );


    /* =========================================================
       WEBSOCKET OPEN / RECONNECT
       ========================================================= */

    window.addEventListener(
        'agro:websocket-open',
        function () {
            /*
             * If the user was already typing while the socket
             * reconnected, tell the server again.
             */
            if (
                isTyping &&
                messageBodyField &&
                String(
                    messageBodyField.value || ''
                ).trim()
            ) {
                sendTypingEvent(
                    'typing_start'
                );
            }
        }
    );


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearTypingTimer();

            /*
             * Do NOT close the WebSocket here.
             *
             * chat_websocket.js owns WebSocket lifecycle.
             */
            if (
                isTyping &&
                isSocketOpen()
            ) {
                sendTypingEvent(
                    'typing_stop'
                );
            }

            isTyping = false;
            typingUserId = null;
        }
    );
});
