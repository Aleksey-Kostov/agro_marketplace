document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const replyForm = document.getElementById('reply-form');
    const messageBodyField = replyForm
        ? replyForm.querySelector('textarea[name="body"], input[name="body"]')
        : null;
    const typingIndicator = document.getElementById('chat-typing-indicator');

    const TYPING_STOP_DELAY = 1200;
    const INDICATOR_HIDE_DELAY = 250;
    const BOTTOM_THRESHOLD = 20;

    let typingTimer = null;
    let indicatorHideTimer = null;
    let isTyping = false;
    let typingUserId = null;

    function getCurrentUserId() {
        if (!chatWindow) return null;

        const value = Number(chatWindow.dataset.currentUserId);

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }

    function getSocket() {
        return window.agroMessageSocket || null;
    }

    function sendTypingEvent(type) {
        const socket = getSocket();

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            socket.send(JSON.stringify({ type }));
        } catch (error) {
            console.error('Unable to send typing event:', error);
        }
    }

    function isChatAtBottom() {
        if (!chatWindow) {
            return true;
        }

        return Math.abs(
            chatWindow.scrollHeight -
            chatWindow.scrollTop -
            chatWindow.clientHeight
        ) <= BOTTOM_THRESHOLD;
    }

    function showTypingIndicator(username, userId) {
        if (!typingIndicator) {
            return;
        }

        /*
         * Important:
         * If the indicator is already visible, this is another
         * typing_start event from the same typing session.
         *
         * We update the state/name, but DO NOT scroll again.
         */
        const alreadyVisible =
            typingIndicator.classList.contains('typing-visible');

        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        const nameElement =
            typingIndicator.querySelector('.chat-typing-name');

        if (nameElement) {
            nameElement.textContent = username || 'User';
        }

        typingUserId = userId ? Number(userId) : null;

        typingIndicator.classList.remove('d-none');
        typingIndicator.classList.remove('typing-hiding');
        typingIndicator.classList.add('typing-visible');

        if (alreadyVisible) {
            return;
        }

        /*
         * Only the first typing_start can trigger the automatic scroll.
         *
         * If the user is already reading the bottom of the conversation,
         * bring the newly visible typing indicator into view.
         *
         * If the user is reading older messages, do not interrupt them.
         */
        if (!isChatAtBottom() || !chatWindow) {
            return;
        }

        requestAnimationFrame(function () {
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    function hideTypingIndicator(immediate = false) {
        if (!typingIndicator) {
            return;
        }

        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        if (immediate) {
            typingIndicator.classList.remove(
                'typing-visible',
                'typing-hiding'
            );

            typingIndicator.classList.add('d-none');

            typingUserId = null;

            return;
        }

        /*
         * Start the CSS fade-out.
         */
        typingIndicator.classList.remove('typing-visible');
        typingIndicator.classList.add('typing-hiding');

        /*
         * Remove display:none only after the fade-out has finished.
         */
        indicatorHideTimer = setTimeout(function () {
            typingIndicator.classList.remove('typing-hiding');
            typingIndicator.classList.add('d-none');

            typingUserId = null;
            indicatorHideTimer = null;
        }, INDICATOR_HIDE_DELAY);
    }

    function startTyping() {
        if (isTyping) {
            return;
        }

        isTyping = true;

        sendTypingEvent('typing_start');
    }

    function stopTyping() {
        if (!isTyping) {
            return;
        }

        isTyping = false;

        sendTypingEvent('typing_stop');
    }

    function clearTypingTimer() {
        if (!typingTimer) {
            return;
        }

        clearTimeout(typingTimer);
        typingTimer = null;
    }

    function resetTypingTimer() {
        clearTypingTimer();

        typingTimer = setTimeout(function () {
            stopTyping();
            typingTimer = null;
        }, TYPING_STOP_DELAY);
    }

    function handleComposerInput() {
        if (!messageBodyField) {
            return;
        }

        /*
         * Empty composer = definitely not typing.
         */
        if (!messageBodyField.value.trim()) {
            clearTypingTimer();
            stopTyping();
            return;
        }

        startTyping();
        resetTypingTimer();
    }

    /*
     * Composer typing detection.
     */
    if (messageBodyField) {
        messageBodyField.addEventListener(
            'input',
            handleComposerInput
        );

        messageBodyField.addEventListener('blur', function () {
            clearTypingTimer();
            stopTyping();
        });
    }

    /*
     * Our own message was successfully sent.
     *
     * Stop local typing state immediately and hide any remote
     * typing indicator without animation/scrolling.
     *
     * conversation.js owns the actual message scroll.
     */
    window.addEventListener('agro:message-sent', function () {
        clearTypingTimer();
        stopTyping();
        hideTypingIndicator(true);
    });

    /*
     * WebSocket events forwarded by conversation.js.
     */
    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data = event.detail;

            if (!data) {
                return;
            }

            /*
             * Someone started typing.
             */
            if (data.type === 'typing_start') {
                const currentUserId = getCurrentUserId();
                const incomingUserId = data.user_id
                    ? Number(data.user_id)
                    : null;

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

                showTypingIndicator(
                    data.username || 'User',
                    incomingUserId
                );

                return;
            }

            /*
             * Someone stopped typing.
             */
            if (data.type === 'typing_stop') {
                const incomingUserId = data.user_id
                    ? Number(data.user_id)
                    : null;

                /*
                 * If we know who is currently typing and the stop event
                 * belongs to another user, ignore it.
                 */
                if (
                    typingUserId &&
                    incomingUserId &&
                    typingUserId !== incomingUserId
                ) {
                    return;
                }

                hideTypingIndicator();

                return;
            }
        }
    );

    /*
     * conversation.js dispatches this after a message has been rendered.
     *
     * conversation.js decides whether scrolling is appropriate.
     * This file only performs the requested scroll.
     */
    window.addEventListener(
        'agro:message-rendered',
        function (event) {
            const detail = event.detail || {};

            if (!detail.shouldScroll || !chatWindow) {
                return;
            }

            requestAnimationFrame(function () {
                chatWindow.scrollTo({
                    top: chatWindow.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    );

    /*
     * Clean up before leaving the page.
     */
    window.addEventListener('beforeunload', function () {
        clearTypingTimer();

        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        stopTyping();
    });
});
