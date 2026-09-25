document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    const conversationWrap =
        document.querySelector('.conversation-scroll-wrap');

    const replyForm =
        document.getElementById('reply-form');

    const messageBodyField = replyForm
        ? (
            replyForm.querySelector('[name="body"]') ||
            replyForm.querySelector('textarea')
        )
        : null;

    const typingIndicator =
        document.getElementById(
            'chat-typing-indicator'
        );

    const TYPING_STOP_DELAY = 1200;
    const TYPING_HIDE_DELAY = 250;
    const BOTTOM_THRESHOLD = 50;

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

        const value = Number(
            chatWindow.dataset.currentUserId
        );

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
       SCROLL STATE
    ========================================================= */

    function isChatAtBottom() {
        if (!chatWindow) {
            return true;
        }

        return (
            chatWindow.scrollTop +
            chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight -
            BOTTOM_THRESHOLD
        );
    }

    function updateTypingPosition() {
        if (!conversationWrap) {
            return;
        }

        if (isChatAtBottom()) {
            conversationWrap.classList.remove(
                'typing-scrolled-up'
            );
        } else {
            conversationWrap.classList.add(
                'typing-scrolled-up'
            );
        }
    }


    /* =========================================================
       LOCAL TYPING
    ========================================================= */

    function clearTypingTimer() {
        if (typingTimer) {
            clearTimeout(typingTimer);
            typingTimer = null;
        }
    }

    function startTyping() {
        const wasTyping = isTyping;

        isTyping = true;

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

        if (isSocketOpen()) {
            sendTypingEvent(
                'typing_stop'
            );
        }
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

    function handleComposerInput() {
        if (!messageBodyField) {
            return;
        }

        const value =
            String(
                messageBodyField.value || ''
            ).trim();

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
       INDICATOR VISIBILITY
    ========================================================= */

    function clearTypingHideTimer() {
        if (typingHideTimer) {
            clearTimeout(
                typingHideTimer
            );

            typingHideTimer = null;
        }
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

        updateTypingPosition();

        typingIndicator.classList.remove(
            'd-none',
            'typing-hiding'
        );

        typingIndicator.classList.add(
            'typing-visible'
        );
    }

    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        clearTypingHideTimer();

        typingIndicator.classList.remove(
            'typing-visible'
        );

        typingIndicator.classList.add(
            'typing-hiding'
        );

        typingHideTimer = setTimeout(
            function () {
                typingHideTimer = null;

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

                typingIndicator.classList.add(
                    'd-none'
                );
            },
            TYPING_HIDE_DELAY
        );
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
                        username:
                            username || 'User'
                    }
                }
            )
        );
    }


    /* =========================================================
       PAYLOAD NORMALIZATION
    ========================================================= */

    function getTypingPayload(data) {
        if (!data) {
            return null;
        }

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
            (
                data.user &&
                data.user.id
            ) ??
            null;

        const id = Number(raw);

        return Number.isFinite(id) && id > 0
            ? id
            : null;
    }


    /* =========================================================
       REMOTE TYPING START
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

        const username =
            data.username ||
            (
                data.user &&
                data.user.username
            ) ||
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
       REMOTE TYPING STOP
    ========================================================= */

    function handleIncomingTypingStop(data) {
        const incomingUserId =
            getIncomingUserId(data);

        /*
         * Ignore a stop event belonging to another
         * remote user.
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
       WEBSOCKET MESSAGE LISTENER
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
                data.type ===
                'typing_start'
            ) {
                handleIncomingTypingStart(
                    data
                );

                return;
            }

            if (
                data.type ===
                'typing_stop'
            ) {
                handleIncomingTypingStop(
                    data
                );
            }
        }
    );


    /* =========================================================
       SCROLL LISTENER
    ========================================================= */

    if (chatWindow) {
        chatWindow.addEventListener(
            'scroll',
            function () {
                if (!typingUserId) {
                    return;
                }

                updateTypingPosition();
            },
            {
                passive: true
            }
        );
    }


    /* =========================================================
       WEBSOCKET RECONNECT
    ========================================================= */

    window.addEventListener(
        'agro:websocket-open',
        function () {
            /*
             * If the user was typing while the socket
             * reconnected, restore typing state.
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

            updateTypingPosition();
        }
    );


    /* =========================================================
       WINDOW CLEANUP
    ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearTypingTimer();
            clearTypingHideTimer();

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
