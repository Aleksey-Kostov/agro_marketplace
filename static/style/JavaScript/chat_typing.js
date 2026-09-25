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

        const value =
            Number(
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
        return (
            window.agroMessageSocket ||
            null
        );
    }

    function sendTypingEvent(type) {
        const socket =
            getSocket();

        if (
            !socket ||
            socket.readyState !==
                WebSocket.OPEN
        ) {
            return;
        }

        try {
            socket.send(
                JSON.stringify({
                    type
                })
            );
        } catch (error) {
            console.error(
                'Unable to send typing event:',
                error
            );
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
                        typing,
                        username
                    }
                }
            )
        );
    }


    /* =========================================================
       START / STOP LOCAL TYPING
       ========================================================= */

    function startTyping() {
        if (isTyping) {
            return;
        }

        isTyping = true;

        sendTypingEvent(
            'typing_start'
        );
    }

    function stopTyping() {
        if (!isTyping) {
            return;
        }

        isTyping = false;

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
            setTimeout(function () {
                typingTimer = null;

                stopTyping();
            }, TYPING_STOP_DELAY);
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
       WEBSOCKET EVENTS
       ========================================================= */

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data =
                event.detail;

            if (!data) {
                return;
            }


            /* -------------------------------------------------
               TYPING START
               ------------------------------------------------- */

            if (
                data.type ===
                'typing_start'
            ) {
                const currentUserId =
                    getCurrentUserId();

                const incomingUserId =
                    getIncomingUserId(
                        data
                    );

                /*
                 * Never show our own typing event.
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

                dispatchTypingState(
                    true,
                    data.username ||
                        data.user?.username ||
                        'User'
                );

                return;
            }


            /* -------------------------------------------------
               TYPING STOP
               ------------------------------------------------- */

            if (
                data.type ===
                'typing_stop'
            ) {
                const incomingUserId =
                    getIncomingUserId(
                        data
                    );

                /*
                 * If we know who is currently typing,
                 * ignore a stop event from another user.
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
        }
    );


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearTypingTimer();

            stopTyping();

            typingUserId = null;
        }
    );
});
