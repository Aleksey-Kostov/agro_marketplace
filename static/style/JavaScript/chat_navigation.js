document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    const unreadMessageCount = document.getElementById('unread-message-count');

    if (!chatWindow) return;

    const SCROLL_EPSILON = 2;
    const BOTTOM_THRESHOLD = 50;
    const SCROLL_BUTTON_HIDE_DELAY = 2000;

    let scrollButtonHideTimer = null;
    let unreadCount = 0;
    let mouseActivityTimer = null;

    /* =========================================================
       UNREAD BADGE
    ========================================================= */

    function ensureUnreadBadgePosition() {
        if (!unreadMessageCount || !scrollBottomBtn) return;
        if (unreadMessageCount.parentElement !== scrollBottomBtn) {
            scrollBottomBtn.appendChild(unreadMessageCount);
        }
    }

    function updateBottomButtonLabel() {
        if (!scrollBottomBtn) return;
        if (unreadCount > 0) {
            scrollBottomBtn.setAttribute(
                'aria-label',
                `Go to latest message. ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
            );
        } else {
            scrollBottomBtn.setAttribute('aria-label', 'Go to latest message');
        }
    }

    function updateUnreadBadge() {
        ensureUnreadBadgePosition();
        if (!unreadMessageCount) {
            updateBottomButtonLabel();
            return;
        }
        if (unreadCount > 0) {
            unreadMessageCount.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            unreadMessageCount.classList.remove('d-none');
        } else {
            unreadMessageCount.textContent = '0';
            unreadMessageCount.classList.add('d-none');
        }
        updateBottomButtonLabel();
    }

    function clearUnreadMessages() {
        if (unreadCount === 0) {
            updateUnreadBadge();
            updateScrollButtons();
            return;
        }
        unreadCount = 0;
        updateUnreadBadge();
        updateScrollButtons();
    }

    function addUnreadMessage() {
        unreadCount += 1;
        updateUnreadBadge();
        updateScrollButtons();
        // Unread always forces bottom button visible
        if (scrollBottomBtn) {
            scrollBottomBtn.classList.remove('d-none', 'scroll-buttons-hidden');
        }
        clearScrollButtonHideTimer();
    }

    /* =========================================================
       SCROLL STATE
    ========================================================= */

    function getMaxScrollTop() {
        return Math.max(0, chatWindow.scrollHeight - chatWindow.clientHeight);
    }

    function isAtTop() {
        return chatWindow.scrollTop <= SCROLL_EPSILON;
    }

    function isAtBottom() {
        return (chatWindow.scrollTop + chatWindow.clientHeight) >=
               (chatWindow.scrollHeight - BOTTOM_THRESHOLD);
    }

    /* =========================================================
       SCROLL BUTTONS
    ========================================================= */

    function updateScrollButtons() {
        ensureUnreadBadgePosition();

        const atTop = isAtTop();
        const atBottom = isAtBottom();

        // Top button
        if (scrollTopBtn) {
            const topNeeded = !atTop;
            scrollTopBtn.classList.toggle('d-none', !topNeeded);
            if (!topNeeded) {
                scrollTopBtn.classList.remove('scroll-buttons-hidden');
            }
        }

        // Bottom button – needed when not at bottom OR there are unread
        if (scrollBottomBtn) {
            const bottomNeeded = !atBottom || unreadCount > 0;
            scrollBottomBtn.classList.toggle('d-none', !bottomNeeded);

            if (unreadCount > 0) {
                scrollBottomBtn.classList.remove('d-none', 'scroll-buttons-hidden');
            }
            if (!bottomNeeded) {
                scrollBottomBtn.classList.remove('scroll-buttons-hidden');
            }
        }

        updateUnreadBadge();
    }

    /* =========================================================
       AUTO-HIDE
    ========================================================= */

    function clearScrollButtonHideTimer() {
        if (scrollButtonHideTimer) {
            clearTimeout(scrollButtonHideTimer);
            scrollButtonHideTimer = null;
        }
    }

    function showScrollButtons() {
        clearScrollButtonHideTimer();
        if (scrollTopBtn) scrollTopBtn.classList.remove('scroll-buttons-hidden');
        if (scrollBottomBtn) scrollBottomBtn.classList.remove('scroll-buttons-hidden');
        updateScrollButtons();
    }

    function scheduleScrollButtonHide() {
        clearScrollButtonHideTimer();
        scrollButtonHideTimer = setTimeout(() => {
            scrollButtonHideTimer = null;

            // Top button – hide only if currently visible
            if (scrollTopBtn && !scrollTopBtn.classList.contains('d-none')) {
                scrollTopBtn.classList.add('scroll-buttons-hidden');
            }

            // Bottom button – never hide while there are unread
            if (scrollBottomBtn &&
                unreadCount <= 0 &&
                !scrollBottomBtn.classList.contains('d-none')) {
                scrollBottomBtn.classList.add('scroll-buttons-hidden');
            }
        }, SCROLL_BUTTON_HIDE_DELAY);
    }

    /* =========================================================
       SCROLL ACTIONS
    ========================================================= */

    function scrollToTop() {
        showScrollButtons();
        chatWindow.scrollTo({ top: 0, behavior: 'smooth' });
        scheduleScrollButtonHide();
    }

    function scrollToBottom(smooth = true) {
        showScrollButtons();
        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });

        if (!smooth) {
            clearUnreadMessages();
            window.dispatchEvent(new CustomEvent('agro:chat-bottom-reached'));
        }
        scheduleScrollButtonHide();
    }

    /* =========================================================
       MESSAGE RENDERED
    ========================================================= */

    function handleMessageRendered(event) {
        const detail = event.detail || {};

        if (!detail.shouldScroll) {
            // Message arrived while user is scrolled up → unread
            if (!isAtBottom()) {
                addUnreadMessage();
            }
            updateScrollButtons();
            return;
        }

        // User was at bottom → auto-scroll
        requestAnimationFrame(() => {
            showScrollButtons();
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });
            clearUnreadMessages();
            updateScrollButtons();
            scheduleScrollButtonHide();
        });
    }

    /* =========================================================
       EVENT LISTENERS
    ========================================================= */

    chatWindow.addEventListener('scroll', function () {
        showScrollButtons();
        const atBottom = isAtBottom();
        updateScrollButtons();

        if (atBottom) {
            clearUnreadMessages();
            window.dispatchEvent(new CustomEvent('agro:chat-bottom-reached'));
        }
        scheduleScrollButtonHide();
    }, { passive: true });

    chatWindow.addEventListener('mouseenter', function () {
        showScrollButtons();
        scheduleScrollButtonHide();
    }, { passive: true });

    chatWindow.addEventListener('mousemove', function () {
        if (mouseActivityTimer) return;
        mouseActivityTimer = setTimeout(() => {
            mouseActivityTimer = null;
            showScrollButtons();
            scheduleScrollButtonHide();
        }, 50);
    }, { passive: true });

    window.addEventListener('resize', updateScrollButtons);

    if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(updateScrollButtons);
        resizeObserver.observe(chatWindow);
        if (chatMessages) resizeObserver.observe(chatMessages);
    }

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', function (e) {
            e.preventDefault();
            scrollToTop();
        });
    }

    if (scrollBottomBtn) {
        scrollBottomBtn.addEventListener('click', function (e) {
            e.preventDefault();
            scrollToBottom(true);
            // After smooth scroll finishes, clear unread
            setTimeout(() => {
                if (isAtBottom()) clearUnreadMessages();
            }, 400);
        });
    }

    window.addEventListener('agro:message-rendered', handleMessageRendered);

    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.agroChatNavigation = {
        isAtBottom,
        addUnreadMessage,
        clearUnreadMessages,
        scrollToBottom,
        scrollToTop,
        updateScrollButtons,
        showScrollButtons
    };

    /* =========================================================
       INITIALIZATION
    ========================================================= */

    function initializeChatPosition() {
        requestAnimationFrame(() => {
            chatWindow.scrollTop = getMaxScrollTop();
            clearUnreadMessages();
            updateScrollButtons();
            showScrollButtons();
            scheduleScrollButtonHide();
            window.dispatchEvent(new CustomEvent('agro:chat-bottom-reached'));
        });
    }

    ensureUnreadBadgePosition();
    updateUnreadBadge();
    initializeChatPosition();

    window.addEventListener('load', function () {
        ensureUnreadBadgePosition();
        initializeChatPosition();
    }, { once: true });

    window.addEventListener('beforeunload', function () {
        clearScrollButtonHideTimer();
        if (mouseActivityTimer) clearTimeout(mouseActivityTimer);
    });
});
