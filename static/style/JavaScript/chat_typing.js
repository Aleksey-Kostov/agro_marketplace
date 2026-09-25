document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    const replyForm =
        document.getElementById('reply-form');

    const messageBodyField =
        replyForm
            ? (
                replyForm.querySelector('[name="body"]') ||
                replyForm.querySelector('textarea')
            )
            : null;

    const typingIndicator =
        document.getElementById('chat-typing-indicator');

    const TYPING_STOP_DELAY = 1200;
    const TYPING_HIDE_DELAY = 250;

    let typingTimer = null;
    let typingHideTimer = null;

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
            Number(chatWindow.dataset.currentUserId);

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }


    /* =========================================================
       WEBSOCKET
       ========================================================= */

    function getWebSocketManager() {
        return window.agroChatWebSocket || null;
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
       LOCAL TYPING STATE
       ========================================================= */

    function startTyping() {
        const wasTyping =
            isTyping;

        isTyping = true;

        /*
         * If WebSocket is not connected yet,
         * agro:websocket-open will send typing_start
         * when the connection becomes available.
         */
        if (!isSocketOpen()) {
            return;
        }

        if (!wasTyping) {
            sendTypingEvent(
                'typing_start'
            );
        }
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
       TYPING TIMER
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
         * Empty composer means typing has stopped.
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
       TYPING UI
       ========================================================= */

    function clearTypingHideTimer() {
        if (!typingHideTimer) {
            return;
        }

        clearTimeout(
            typingHideTimer
        );

        typingHideTimer = null;
    }


    function showTypingIndicator(username) {
        if (!typingIndicator) {
            return;
        }

        clearTypingHideTimer();

        const nameElement =
            typingIndicator.querySelector(
                '.chat-typing-name'
            );

        if (nameElement) {
            nameElement.textContent =
                username || 'User';
        }

        /*
         * d-none prevents the indicator from
         * being displayed.
         */
        typingIndicator.classList.remove(
            'd-none'
        );

        typingIndicator.classList.remove(
            'typing-hiding'
        );

        /*
         * typing-floating is purely visual.
         * The CSS positions the indicator as
         * an overlay inside #chat-window.
         */
        typingIndicator.classList.add(
            'typing-floating'
        );

        /*
         * Force the visible state.
         */
        typingIndicator.classList.add(
            'typing-visible'
        );
    }


    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        clearTypingHideTimer();

        /*
         * Already hidden.
         */
        if (
            typingIndicator.classList.contains(
                'd-none'
            ) &&
            !typingIndicator.classList.contains(
                'typing-visible'
            )
        ) {
            return;
        }

        /*
         * Start CSS fade-out.
         */
        typingIndicator.classList.remove(
            'typing-visible'
        );

        typingIndicator.classList.add(
            'typing-hiding'
        );

        typingHideTimer =
            setTimeout(
                function () {
                    typingHideTimer = null;

                    /*
                     * Someone started typing again
                     * while the fade-out was running.
                     */
                    if (
                        typingIndicator.classList.contains(
                            'typing-visible'
                        )
                    ) {
                        return;
                    }

                    typingIndicator.classList.remove(
                        'typing-hiding'
                    );

                    typingIndicator.classList.remove(
                        'typing-floating'
                    );

                    typingIndicator.classList.add(
                        'd-none'
                    );
                },
                TYPING_HIDE_DELAY
            );
    }


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
       INCOMING WEBSOCKET PAYLOAD
       ========================================================= */

    function getTypingPayload(data) {
        if (!data) {
            return null;
        }

        /*
         * Supports both:
         *
         * {
         *     type: "typing_start",
         *     ...
         * }
         *
         * and:
         *
         * {
         *     type: "chat_message",
         *     data: {
         *         type: "typing_start",
         *         ...
         *     }
         * }
         */
        if (
            data.type === 'chat_message' &&
            data.data
        ) {
            return data.data;
        }

        return data;
    }


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

        return Number.isFinite(id) && id > 0
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
         * Never display our own typing event.
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

        const username =
            data.username ||
            data.user?.username ||
            'User';

        showTypingIndicator(
            username
        );

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
         * If we know who is currently typing,
         * ignore a stop event belonging to another user.
         */
        if (
            typingUserId &&
            incomingUserId &&
            typingUserId !== incomingUserId
        ) {
            return;
        }

        typingUserId = null;

        hideTypingIndicator();

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

            if (
                data.type === 'typing_start'
            ) {
                handleIncomingTypingStart(
                    data
                );

                return;
            }

            if (
                data.type === 'typing_stop'
            ) {
                handleIncomingTypingStop(
                    data
                );

                return;
            }
        }
    );


    /* =========================================================
       WEBSOCKET RECONNECTED
       ========================================================= */

    window.addEventListener(
        'agro:websocket-open',
        function () {
            /*
             * If the user was already typing while
             * the WebSocket reconnected, restore
             * the typing state.
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
       BEFORE UNLOAD
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearTypingTimer();

            clearTypingHideTimer();

            /*
             * Best effort: notify the other participant
             * before the page disappears.
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


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.agroChatTyping = {
        show: showTypingIndicator,
        hide: hideTypingIndicator,
        isTyping: function () {
            return isTyping;
        }
    };
});
