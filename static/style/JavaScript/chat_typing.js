document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const replyForm = document.getElementById('reply-form');
    const messageBodyField = replyForm
        ? (replyForm.querySelector('[name="body"]') || replyForm.querySelector('textarea'))
        : null;
    const typingIndicator = document.getElementById('chat-typing-indicator');

    const TYPING_STOP_DELAY = 1200;
    const TYPING_HIDE_DELAY = 250;

    let typingTimer = null;
    let typingHideTimer = null;
    let isTyping = false;
    let typingUserId = null;

    function getCurrentUserId() {
        if (!chatWindow) return null;
        const value = Number(chatWindow.dataset.currentUserId);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    function getWebSocketManager() {
        return window.agroChatWebSocket || null;
    }

    function isSocketOpen() {
        const manager = getWebSocketManager();
        return Boolean(manager && typeof manager.isOpen === 'function' && manager.isOpen());
    }

    function sendTypingEvent(type) {
        const manager = getWebSocketManager();
        if (!manager || typeof manager.send !== 'function') return false;
        return manager.send({ type: type });
    }

    function startTyping() {
        const wasTyping = isTyping;
        isTyping = true;
        if (!isSocketOpen()) return; // will be restored on agro:websocket-open
        if (!wasTyping) sendTypingEvent('typing_start');
    }

    function stopTyping() {
        if (!isTyping) return;
        isTyping = false;
        sendTypingEvent('typing_stop');
    }

    function clearTypingTimer() {
        if (typingTimer) {
            clearTimeout(typingTimer);
            typingTimer = null;
        }
    }

    function resetTypingTimer() {
        clearTypingTimer();
        typingTimer = setTimeout(() => {
            typingTimer = null;
            stopTyping();
        }, TYPING_STOP_DELAY);
    }

    function handleComposerInput() {
        if (!messageBodyField) return;
        const value = String(messageBodyField.value || '').trim();
        if (!value) {
            clearTypingTimer();
            stopTyping();
            return;
        }
        startTyping();
        resetTypingTimer();
    }

    if (messageBodyField) {
        messageBodyField.addEventListener('input', handleComposerInput);
        messageBodyField.addEventListener('blur', function () {
            clearTypingTimer();
            stopTyping();
        });
    }

    window.addEventListener('agro:message-sent', function () {
        clearTypingTimer();
        stopTyping();
    });

    function clearTypingHideTimer() {
        if (typingHideTimer) {
            clearTimeout(typingHideTimer);
            typingHideTimer = null;
        }
    }

    function showTypingIndicator(username) {
        if (!typingIndicator) return;
        clearTypingHideTimer();
        const nameElement = typingIndicator.querySelector('.chat-typing-name');
        if (nameElement) nameElement.textContent = username || 'User';
        typingIndicator.classList.remove('d-none', 'typing-hiding');
        typingIndicator.classList.add('typing-floating', 'typing-visible');
    }

    function hideTypingIndicator() {
        if (!typingIndicator) return;
        clearTypingHideTimer();
        if (typingIndicator.classList.contains('d-none') &&
            !typingIndicator.classList.contains('typing-visible')) {
            return;
        }
        typingIndicator.classList.remove('typing-visible');
        typingIndicator.classList.add('typing-hiding');
        typingHideTimer = setTimeout(() => {
            typingHideTimer = null;
            if (typingIndicator.classList.contains('typing-visible')) return;
            typingIndicator.classList.remove('typing-hiding', 'typing-floating');
            typingIndicator.classList.add('d-none');
        }, TYPING_HIDE_DELAY);
    }

    function dispatchTypingState(typing, username = '') {
        window.dispatchEvent(new CustomEvent('agro:typing-state', {
            detail: {
                typing: Boolean(typing),
                username: username || 'User'
            }
        }));
    }

    function getTypingPayload(data) {
        if (!data) return null;
        // Support both flat and nested payloads
        if (data.type === 'chat_message' && data.data) return data.data;
        return data;
    }

    function getIncomingUserId(data) {
        if (!data) return null;
        const raw = data.user_id ?? data.sender_id ?? data.user?.id ?? null;
        const id = Number(raw);
        return Number.isFinite(id) && id > 0 ? id : null;
    }

    function handleIncomingTypingStart(data) {
        const currentUserId = getCurrentUserId();
        const incomingUserId = getIncomingUserId(data);
        // Never show our own typing
        if (incomingUserId && currentUserId && incomingUserId === currentUserId) return;
        typingUserId = incomingUserId;
        const username = data.username || data.user?.username || 'User';
        showTypingIndicator(username);
        dispatchTypingState(true, username);
    }

    function handleIncomingTypingStop(data) {
        const incomingUserId = getIncomingUserId(data);
        // Ignore stop from another user if we already track someone
        if (typingUserId && incomingUserId && typingUserId !== incomingUserId) return;
        typingUserId = null;
        hideTypingIndicator();
        dispatchTypingState(false);
    }

    window.addEventListener('agro:websocket-message', function (event) {
        const rawData = event.detail;
        if (!rawData) return;
        const data = getTypingPayload(rawData);
        if (!data) return;
        if (data.type === 'typing_start') {
            handleIncomingTypingStart(data);
            return;
        }
        if (data.type === 'typing_stop') {
            handleIncomingTypingStop(data);
        }
    });

    // Restore typing state after reconnect
    window.addEventListener('agro:websocket-open', function () {
        if (isTyping && messageBodyField && String(messageBodyField.value || '').trim()) {
            sendTypingEvent('typing_start');
        }
    });

    window.addEventListener('beforeunload', function () {
        clearTypingTimer();
        clearTypingHideTimer();
        if (isTyping && isSocketOpen()) {
            sendTypingEvent('typing_stop');
        }
        isTyping = false;
        typingUserId = null;
    });

    // Public API
    window.agroChatTyping = {
        show: showTypingIndicator,
        hide: hideTypingIndicator,
        isTyping: function () {
            return isTyping;
        }
    };
});
