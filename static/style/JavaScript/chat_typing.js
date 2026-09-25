document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const replyForm = document.getElementById('reply-form');

    const messageBodyField = replyForm
        ? replyForm.querySelector(
            'textarea[name="body"], input[name="body"]'
        )
        : null;

    const typingIndicator =
        document.getElementById(
            'chat-typing-indicator'
        );

    const TYPING_STOP_DELAY = 1200;
    const INDICATOR_HIDE_DELAY = 250;

    let typingTimer = null;
    let indicatorHideTimer = null;
    let isTyping = false;
    let typingUserId = null;

    function getCurrentUserId() {
        if (!chatWindow) return null;

        const value = Number(
            chatWindow.dataset.currentUserId
        );

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }

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
                JSON.stringify({ type })
            );
        } catch (error) {
            console.error(
                'Unable to send typing event:',
                error
            );
        }
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
                        typing,
                        username
                    }
                }
            )
        );
    }

    function showTypingIndicator(
        username,
        userId
    ) {
        if (!typingIndicator) return;

        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        typingUserId = userId
            ? Number(userId)
            : null;

        dispatchTypingState(
            true,
            username || 'User'
        );
    }

    function hideTypingIndicator(
        immediate = false
    ) {
        if (!typingIndicator) return;

        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        typingUserId = null;

        if (immediate) {
            dispatchTypingState(false);

            return;
        }

        dispatchTypingState(false);

        indicatorHideTimer = setTimeout(
            function () {
                indicatorHideTimer = null;
            },
            INDICATOR_HIDE_DELAY
        );
    }

    function startTyping() {
        if (isTyping) return;

        isTyping = true;

        sendTypingEvent(
            'typing_start'
        );
    }

    function stopTyping() {
        if (!isTyping) return;

        isTyping = false;

        sendTypingEvent(
            'typing_stop'
        );
    }

    function clearTypingTimer() {
        if (!typingTimer) return;

        clearTimeout(typingTimer);
        typingTimer = null;
    }

    function resetTypingTimer() {
        clearTypingTimer();

        typingTimer = setTimeout(
            function () {
                stopTyping();
                typingTimer = null;
            },
            TYPING_STOP_DELAY
        );
    }

    function handleComposerInput() {
        if (!messageBodyField) return;

        if (!messageBodyField.value.trim()) {
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

    window.addEventListener(
        'agro:message-sent',
        function () {
            clearTypingTimer();
            stopTyping();
            hideTypingIndicator(true);
        }
    );

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data = event.detail;

            if (!data) return;

            if (
                data.type === 'typing_start'
            ) {
                const currentUserId =
                    getCurrentUserId();

                const incomingUserId =
                    data.user_id
                        ? Number(data.user_id)
                        : null;

                if (
                    incomingUserId &&
                    currentUserId &&
                    incomingUserId ===
                        currentUserId
                ) {
                    return;
                }

                showTypingIndicator(
                    data.username || 'User',
                    incomingUserId
                );

                return;
            }

            if (
                data.type === 'typing_stop'
            ) {
                const incomingUserId =
                    data.user_id
                        ? Number(data.user_id)
                        : null;

                if (
                    typingUserId &&
                    incomingUserId &&
                    typingUserId !==
                        incomingUserId
                ) {
                    return;
                }

                hideTypingIndicator();

                return;
            }
        }
    );

    window.addEventListener(
        'beforeunload',
        function () {
            clearTypingTimer();

            if (indicatorHideTimer) {
                clearTimeout(
                    indicatorHideTimer
                );

                indicatorHideTimer = null;
            }

            stopTyping();
        }
    );
});
