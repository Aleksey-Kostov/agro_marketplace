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

        if (!socket) {
            return false;
        }

        if (socket.readyState !== WebSocket.OPEN) {
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
       TYPING STATE EVENT
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
        /*
         * Remember whether this is a NEW typing session.
         *
         * We must NOT send typing_start on every keypress.
         */
        const wasTyping = isTyping;

        isTyping = true;

        /*
         * Socket may still be CONNECTING.
         *
         * Keep isTyping=true so that agro:websocket-open
         * can send typing_start once the socket is ready.
         */
        if (!isSocketOpen()) {
            return;
        }

        /*
         * Only send typing_start when entering the
         * typing state.
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

        /*
         * If the socket is open, tell the other user.
         */
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
       HANDLE INCOMING TYPING START
       ========================================================= */

    function handleIncomingTypingStart(data) {
        const currentUserId =
            getCurrentUserId();

        const incomingUserId =
            getIncomingUserId(data);

        /*
         * Never show our own typing event.
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
       HANDLE INCOMING TYPING STOP
       ========================================================= */

    function handleIncomingTypingStop(data) {
        const incomingUserId =
            getIncomingUserId(data);

        /*
         * Ignore a stop event from another user.
         */
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
       INCOMING WEBSOCKET EVENTS
       ========================================================= */

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data =
                event.detail;

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
            /*
             * The user may have started typing while the
             * WebSocket was CONNECTING.
             *
             * Now that it is definitely OPEN, send the
             * typing_start event.
             */
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

            if (isTyping && isSocketOpen()) {
                sendTypingEvent(
                    'typing_stop'
                );
            }

            isTyping = false;
            typingUserId = null;
        }
    );
});
