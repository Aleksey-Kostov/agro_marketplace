document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');

    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    const unreadMessageCount = document.getElementById('unread-message-count');

    const typingIndicator = document.getElementById('chat-typing-indicator');

    const SCROLL_EPSILON = 2;
    const BOTTOM_THRESHOLD = 20;
    const SCROLL_BUTTON_HIDE_DELAY = 2000;

    let scrollButtonHideTimer = null;
    let unreadCount = 0;

    function getMaxScrollTop() {
        if (!chatWindow) return 0;

        return Math.max(
            0,
            chatWindow.scrollHeight - chatWindow.clientHeight
        );
    }

    function isAtBottom() {
        if (!chatWindow) return true;

        return (
            chatWindow.scrollTop + chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight - BOTTOM_THRESHOLD
        );
    }

    function updateUnreadBadge() {
        if (!unreadMessageCount) return;

        if (unreadCount <= 0) {
            unreadMessageCount.textContent = '0';
            unreadMessageCount.classList.add('d-none');
        } else {
            unreadMessageCount.textContent =
                unreadCount > 99 ? '99+' : String(unreadCount);

            unreadMessageCount.classList.remove('d-none');
        }

        updateBottomButtonLabel();
    }

    function updateBottomButtonLabel() {
        if (!scrollBottomBtn) return;

        if (unreadCount > 0) {
            scrollBottomBtn.setAttribute(
                'aria-label',
                `Go to latest message. ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
            );
        } else {
            scrollBottomBtn.setAttribute(
                'aria-label',
                'Go to latest message'
            );
        }
    }

    function clearUnreadMessages() {
        if (unreadCount === 0) return;

        unreadCount = 0;
        updateUnreadBadge();
    }

    function addUnreadMessage() {
        unreadCount += 1;
        updateUnreadBadge();
        updateScrollButtons();
    }

    function updateScrollButtons() {
        if (!chatWindow) return;

        const currentScrollTop = chatWindow.scrollTop;
        const maxScrollTop = getMaxScrollTop();

        const atTop =
            currentScrollTop <= SCROLL_EPSILON;

        const atBottom =
            currentScrollTop >=
            maxScrollTop - SCROLL_EPSILON;

        if (scrollTopBtn) {
            scrollTopBtn.classList.toggle(
                'd-none',
                atTop
            );
        }

        if (scrollBottomBtn) {
            scrollBottomBtn.classList.toggle(
                'd-none',
                atBottom
            );
        }

        if (atBottom) {
            clearUnreadMessages();
        }

        updateTypingIndicatorPosition(atBottom);
    }

    function showScrollButtons() {
        if (scrollTopBtn) {
            scrollTopBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        if (scrollBottomBtn) {
            scrollBottomBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }
    }

    function scheduleScrollButtonHide() {
        if (scrollButtonHideTimer) {
            clearTimeout(scrollButtonHideTimer);
        }

        scrollButtonHideTimer = setTimeout(function () {
            if (scrollTopBtn) {
                scrollTopBtn.classList.add(
                    'scroll-buttons-hidden'
                );
            }

            if (scrollBottomBtn) {
                scrollBottomBtn.classList.add(
                    'scroll-buttons-hidden'
                );
            }
        }, SCROLL_BUTTON_HIDE_DELAY);
    }

    function scrollToTop() {
        if (!chatWindow) return;

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    function scrollToBottom(smooth = true) {
        if (!chatWindow) return;

        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });

        /*
         * The actual reset also happens from the scroll event
         * when we reach the bottom.
         */
        if (!smooth) {
            clearUnreadMessages();
        }
    }

    function initializeChatPosition() {
        if (!chatWindow) return;

        requestAnimationFrame(function () {
            chatWindow.scrollTop = chatWindow.scrollHeight;
            updateScrollButtons();
        });
    }

    function updateTypingIndicatorPosition(atBottom = isAtBottom()) {
        if (!typingIndicator) return;

        const isTypingVisible =
            typingIndicator.classList.contains(
                'typing-visible'
            );

        if (!isTypingVisible) {
            typingIndicator.classList.remove(
                'typing-floating'
            );

            return;
        }

        /*
         * At bottom:
         * show full "Username is typing..."
         */
        if (atBottom) {
            const wasFloating =
                typingIndicator.classList.contains(
                    'typing-floating'
                );

            typingIndicator.classList.remove(
                'typing-floating'
            );

            /*
             * Removing the floating position puts the
             * indicator back into normal document flow.
             *
             * If we were already at bottom, keep the chat
             * visually pinned to the bottom.
             */
            if (wasFloating && chatWindow) {
                requestAnimationFrame(function () {
                    if (isAtBottom()) {
                        chatWindow.scrollTop =
                            chatWindow.scrollHeight;
                    }
                });
            }

            return;
        }

        /*
         * Not at bottom:
         * turn it into a small floating typing bubble.
         */
        typingIndicator.classList.add(
            'typing-floating'
        );
    }

    function handleTypingState(event) {
        const detail = event.detail || {};

        if (!typingIndicator) return;

        if (detail.typing) {
            const nameElement =
                typingIndicator.querySelector(
                    '.chat-typing-name'
                );

            if (nameElement) {
                nameElement.textContent =
                    detail.username || 'User';
            }

            typingIndicator.classList.remove(
                'd-none',
                'typing-hiding'
            );

            typingIndicator.classList.add(
                'typing-visible'
            );

            updateTypingIndicatorPosition();

            return;
        }

        typingIndicator.classList.remove(
            'typing-visible',
            'typing-floating'
        );

        typingIndicator.classList.add(
            'typing-hiding'
        );

        setTimeout(function () {
            if (
                !typingIndicator.classList.contains(
                    'typing-visible'
                )
            ) {
                typingIndicator.classList.remove(
                    'typing-hiding'
                );

                typingIndicator.classList.add(
                    'd-none'
                );
            }
        }, 250);
    }

    function handleMessageRendered(event) {
        const detail = event.detail || {};

        if (!detail.shouldScroll || !chatWindow) {
            updateScrollButtons();
            return;
        }

        requestAnimationFrame(function () {
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });

            updateScrollButtons();
        });
    }

    if (chatWindow) {
        chatWindow.addEventListener(
            'scroll',
            function () {
                const wasAtBottom = isAtBottom();

                updateScrollButtons();
                showScrollButtons();
                scheduleScrollButtonHide();

                /*
                 * When the user reaches the bottom,
                 * the unread counter is cleared.
                 */
                if (wasAtBottom) {
                    clearUnreadMessages();

                    window.dispatchEvent(
                        new CustomEvent(
                            'agro:chat-bottom-reached'
                        )
                    );
                }
            },
            { passive: true }
        );

        window.addEventListener(
            'resize',
            updateScrollButtons
        );

        if ('ResizeObserver' in window) {
            const resizeObserver =
                new ResizeObserver(function () {
                    updateScrollButtons();
                });

            resizeObserver.observe(chatWindow);

            if (chatMessages) {
                resizeObserver.observe(chatMessages);
            }
        }
    }

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();
                scrollToTop();
            }
        );
    }

    if (scrollBottomBtn) {
        scrollBottomBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();

                clearUnreadMessages();
                scrollToBottom(true);
            }
        );
    }

    window.addEventListener(
        'agro:message-rendered',
        handleMessageRendered
    );

    window.addEventListener(
        'agro:typing-state',
        handleTypingState
    );

    /*
     * Public API used by conversation.js
     */
    window.agroChatNavigation = {
        isAtBottom,
        addUnreadMessage,
        clearUnreadMessages,
        scrollToBottom,
        updateScrollButtons
    };

    initializeChatPosition();
    updateUnreadBadge();
    updateScrollButtons();

    window.addEventListener(
        'load',
        initializeChatPosition,
        { once: true }
    );
});
