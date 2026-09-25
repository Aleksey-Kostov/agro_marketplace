document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    const replyForm =
        document.getElementById('reply-form');

    const messageBodyField =
        replyForm
            ? replyForm.querySelector(
                'textarea[name="body"], input[name="body"]'
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
       SOCKET
       ========================================================= */

    function getSocket() {
        return window.agroMessageSocket || null;
    }

    function isSocketOpen() {
        const socket = getSocket();

        return Boolean(
            socket &&
            socket.readyState === WebSocket.OPEN
        );
    }


    /* =========================================================
       SEND TYPING EVENT
       ========================================================= */

    function sendTypingEvent(type) {
        const socket = getSocket();

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return false;
        }

        try {
            socket.send(
                JSON.stringify({
                    type: type
                })
            );

            return true;
        } catch (error) {
            console.error(
                'Unable to send typing event:',
                error
            );

            return false;
        }
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
                        username: username || 'User'
                    }
                }
            )
        );
    }


    /* =========================================================
       START TYPING
       ========================================================= */

    function startTyping() {
        const wasTyping = isTyping;

        isTyping = true;

        /*
         * Socket may still be CONNECTING.
         * agro:websocket-open will retry.
         */
        if (!isSocketOpen()) {
            return;
        }

        /*
         * Send typing_start only once
         * per typing session.
         */
        if (!wasTyping) {
            sendTypingEvent('typing_start');
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

        sendTypingEvent('typing_stop');
    }


    /* =========================================================
       TIMER
       ========================================================= */

    function clearTypingTimer() {
        if (!typingTimer) {
            return;
        }

        clearTimeout(typingTimer);
        typingTimer = null;
    }

    function resetTypingTimer() {
        clearTypingTimer();

        typingTimer = setTimeout(
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
            messageBodyField.value.trim();

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
         * Channels sends:
         *
         * {
         *     type: "chat_message",
         *     data: {
         *         type: "typing_start",
         *         ...
         *     }
         * }
         *
         * So we need the nested data object.
         */
        if (
            data.type === 'chat_message' &&
            data.data
        ) {
            return data.data;
        }

        /*
         * Also support direct payloads.
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

        const id = Number(raw);

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
            incomingUserId === currentUserId
        ) {
            return;
        }

        typingUserId =
            incomingUserId;

        dispatchTypingState(
            true,
            data.username ||
                data.user?.username ||
                'User'
        );
    }


    /* =========================================================
       INCOMING TYPING STOP
       ========================================================= */

    function handleIncomingTypingStop(data) {
        const incomingUserId =
            getIncomingUserId(data);

        if (
            typingUserId &&
            incomingUserId &&
            typingUserId !== incomingUserId
        ) {
            return;
        }

        typingUserId = null;

        dispatchTypingState(false);
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
                getTypingPayload(rawData);

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
                handleIncomingTypingStart(data);
                return;
            }


            /* ---------------------------------------------
               TYPING STOP
               --------------------------------------------- */

            if (
                data.type ===
                'typing_stop'
            ) {
                handleIncomingTypingStop(data);
            }
        }
    );


    /* =========================================================
       SOCKET OPEN / RECONNECT
       ========================================================= */

    window.addEventListener(
        'agro:websocket-open',
        function () {
            if (
                isTyping &&
                messageBodyField &&
                messageBodyField.value.trim()
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
