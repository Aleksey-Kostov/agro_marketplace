document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /* =========================================================
       ELEMENTS
    ========================================================== */

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

    /*
     * IMPORTANT:
     * The indicator already exists in message-read.html.
     * We must NOT create another one dynamically.
     */
    const typingIndicator =
        document.getElementById(
            'chat-typing-indicator'
        );


    /* =========================================================
       CONSTANTS
    ========================================================== */

    const TYPING_STOP_DELAY = 1200;
    const BOTTOM_THRESHOLD = 80;


    /* =========================================================
       STATE
    ========================================================== */

    let typingTimer = null;
    let isTyping = false;


    /* =========================================================
       CURRENT USER
    ========================================================== */

    function getCurrentUserId() {
        if (!chatWindow) {
            return null;
        }

        const value = Number(
            chatWindow.dataset.currentUserId
        );

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }


    /* =========================================================
       SOCKET
    ========================================================== */

    function getSocket() {
        return window.agroMessageSocket || null;
    }


    function sendTypingEvent(type) {
        const socket = getSocket();

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        try {
            socket.send(
                JSON.stringify({
                    type: type
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
       TYPING INDICATOR
    ========================================================== */

    function showTypingIndicator(username) {
        if (!typingIndicator) {
            return;
        }

        const nameElement =
            typingIndicator.querySelector(
                '.chat-typing-name'
            );

        if (nameElement) {
            nameElement.textContent =
                username || 'User';
        }

        typingIndicator.classList.remove(
            'd-none'
        );
    }


    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        typingIndicator.classList.add(
            'd-none'
        );
    }


    /* =========================================================
       OUTGOING TYPING
    ========================================================== */

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


    function resetTypingTimer() {
        if (typingTimer) {
            clearTimeout(
                typingTimer
            );
        }

        typingTimer =
            setTimeout(
                function () {
                    stopTyping();
                    typingTimer = null;
                },
                TYPING_STOP_DELAY
            );
    }


    function handleComposerInput() {
        if (!messageBodyField) {
            return;
        }

        const value =
            messageBodyField.value.trim();

        if (!value) {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }

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
                stopTyping();

                if (typingTimer) {
                    clearTimeout(
                        typingTimer
                    );

                    typingTimer = null;
                }
            }
        );
    }


    /* =========================================================
       MESSAGE SENT
    ========================================================== */

    window.addEventListener(
        'agro:message-sent',
        function () {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }

            hideTypingIndicator();
        }
    );


    /* =========================================================
       WEBSOCKET EVENTS
    ========================================================== */

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data =
                event.detail;

            if (!data) {
                return;
            }


            /* -----------------------------------------------
               USER STARTED TYPING
            ------------------------------------------------ */

            if (
                data.type ===
                'typing_start'
            ) {
                const currentUserId =
                    getCurrentUserId();

                /*
                 * Ignore our own typing event.
                 */
                if (
                    data.user_id &&
                    currentUserId &&
                    Number(data.user_id) ===
                        Number(currentUserId)
                ) {
                    return;
                }

                showTypingIndicator(
                    data.username ||
                    'User'
                );

                return;
            }


            /* -----------------------------------------------
               USER STOPPED TYPING
            ------------------------------------------------ */

            if (
                data.type ===
                'typing_stop'
            ) {
                hideTypingIndicator();

                return;
            }
        }
    );

    /* =========================================================
       MESSAGE SENT / RENDERED

       IMPORTANT:
       conversation.js is responsible for deciding
       whether the user was at the bottom.

       chat_typing.js ONLY performs the scroll requested
       by conversation.js.

       MutationObserver is intentionally NOT used.
    ========================================================== */

    window.addEventListener(
        'agro:message-rendered',
        function (event) {
            const detail =
                event.detail || {};

            if (
                !detail.shouldScroll ||
                !chatWindow
            ) {
                return;
            }

            /*
             * Wait until the newly inserted message
             * has completed its DOM/layout update.
             *
             * Only ONE scroll operation.
             */
            requestAnimationFrame(
                function () {
                    chatWindow.scrollTo({
                        top:
                            chatWindow.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            );
        }
    );


    /* =========================================================
       CLEANUP
    ========================================================== */

    window.addEventListener(
        'beforeunload',
        function () {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }
        }
    );
});
