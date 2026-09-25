document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    const unreadMessageCount = document.getElementById('unread-message-count');

    if (!chatWindow) {
        return;
    }

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
        if (!unreadMessageCount || !scrollBottomBtn) {
            return;
        }

        if (
            unreadMessageCount.parentElement !==
            scrollBottomBtn
        ) {
            scrollBottomBtn.appendChild(
                unreadMessageCount
            );
        }
    }

    function updateBottomButtonLabel() {
        if (!scrollBottomBtn) {
            return;
        }

        if (unreadCount > 0) {
            scrollBottomBtn.setAttribute(
                'aria-label',
                `Go to latest message. ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
            );

            return;
        }

        scrollBottomBtn.setAttribute(
            'aria-label',
            'Go to latest message'
        );
    }

    function updateUnreadBadge() {
        ensureUnreadBadgePosition();

        if (!unreadMessageCount) {
            updateBottomButtonLabel();
            return;
        }

        if (unreadCount > 0) {
            unreadMessageCount.textContent =
                unreadCount > 99
                    ? '99+'
                    : String(unreadCount);

            unreadMessageCount.classList.remove(
                'd-none'
            );

        } else {
            unreadMessageCount.textContent = '0';

            unreadMessageCount.classList.add(
                'd-none'
            );
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

    /*
     * IMPORTANT:
     *
     * This is the ONLY place that increments unread.
     *
     * chat_controller.js must NOT call this function
     * directly.
     *
     * It only dispatches agro:message-rendered.
     */
    function addUnreadMessage() {
        unreadCount += 1;

        updateUnreadBadge();
        updateScrollButtons();

        if (scrollBottomBtn) {
            scrollBottomBtn.classList.remove(
                'd-none',
                'scroll-buttons-hidden'
            );
        }

        clearScrollButtonHideTimer();
    }

    /* =========================================================
       SCROLL STATE
       ========================================================= */

    function getMaxScrollTop() {
        return Math.max(
            0,
            chatWindow.scrollHeight -
            chatWindow.clientHeight
        );
    }

    function isAtTop() {
        return (
            chatWindow.scrollTop <=
            SCROLL_EPSILON
        );
    }

    function isAtBottom() {
        return (
            chatWindow.scrollTop +
            chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight -
            BOTTOM_THRESHOLD
        );
    }

    /* =========================================================
       SCROLL BUTTONS
       ========================================================= */

    function updateScrollButtons() {
        ensureUnreadBadgePosition();

        const atTop = isAtTop();
        const atBottom = isAtBottom();

        if (scrollTopBtn) {
            const topNeeded = !atTop;

            scrollTopBtn.classList.toggle(
                'd-none',
                !topNeeded
            );

            if (!topNeeded) {
                scrollTopBtn.classList.remove(
                    'scroll-buttons-hidden'
                );
            }
        }

        if (scrollBottomBtn) {
            const bottomNeeded =
                !atBottom ||
                unreadCount > 0;

            scrollBottomBtn.classList.toggle(
                'd-none',
                !bottomNeeded
            );

            if (unreadCount > 0) {
                scrollBottomBtn.classList.remove(
                    'd-none',
                    'scroll-buttons-hidden'
                );
            }

            if (!bottomNeeded) {
                scrollBottomBtn.classList.remove(
                    'scroll-buttons-hidden'
                );
            }
        }

        updateUnreadBadge();
    }

    /* =========================================================
       AUTO-HIDE
       ========================================================= */

    function clearScrollButtonHideTimer() {
        if (scrollButtonHideTimer) {
            clearTimeout(
                scrollButtonHideTimer
            );

            scrollButtonHideTimer = null;
        }
    }

    function showScrollButtons() {
        clearScrollButtonHideTimer();

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

        updateScrollButtons();
    }

    function scheduleScrollButtonHide() {
        clearScrollButtonHideTimer();

        scrollButtonHideTimer = setTimeout(
            function () {
                scrollButtonHideTimer = null;

                if (
                    scrollTopBtn &&
                    !scrollTopBtn.classList.contains(
                        'd-none'
                    )
                ) {
                    scrollTopBtn.classList.add(
                        'scroll-buttons-hidden'
                    );
                }

                /*
                 * Never hide the bottom button while
                 * unread messages exist.
                 */
                if (
                    scrollBottomBtn &&
                    unreadCount <= 0 &&
                    !scrollBottomBtn.classList.contains(
                        'd-none'
                    )
                ) {
                    scrollBottomBtn.classList.add(
                        'scroll-buttons-hidden'
                    );
                }
            },
            SCROLL_BUTTON_HIDE_DELAY
        );
    }

    /* =========================================================
       SCROLL ACTIONS
       ========================================================= */

    function scrollToTop() {
        showScrollButtons();

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        scheduleScrollButtonHide();
    }

    function scrollToBottom(smooth = true) {
        showScrollButtons();

        chatWindow.scrollTo({
            top: getMaxScrollTop(),
            behavior: smooth
                ? 'smooth'
                : 'auto'
        });

        if (!smooth) {
            clearUnreadMessages();

            window.dispatchEvent(
                new CustomEvent(
                    'agro:chat-bottom-reached'
                )
            );
        }

        scheduleScrollButtonHide();
    }

    /* =========================================================
       MESSAGE RENDERED
       ========================================================= */

    function handleMessageRendered(event) {
        const detail =
            event.detail || {};

        /*
         * The controller tells us whether the user was
         * at the bottom BEFORE the message was rendered.
         */
        if (!detail.shouldScroll) {
            /*
             * The user was reading older messages.
             *
             * One rendered message = one unread.
             *
             * No other file should increment this counter.
             */
            if (!isAtBottom()) {
                addUnreadMessage();
            }

            updateScrollButtons();
            return;
        }

        /*
         * User was already at the bottom.
         *
         * New message should follow the conversation.
         */
        requestAnimationFrame(
            function () {
                showScrollButtons();

                chatWindow.scrollTo({
                    top: getMaxScrollTop(),
                    behavior: 'smooth'
                });

                clearUnreadMessages();

                updateScrollButtons();

                scheduleScrollButtonHide();
            }
        );
    }

    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    chatWindow.addEventListener(
        'scroll',
        function () {
            showScrollButtons();

            const atBottom =
                isAtBottom();

            updateScrollButtons();

            if (atBottom) {
                clearUnreadMessages();

                window.dispatchEvent(
                    new CustomEvent(
                        'agro:chat-bottom-reached'
                    )
                );
            }

            scheduleScrollButtonHide();
        },
        {
            passive: true
        }
    );

    chatWindow.addEventListener(
        'mouseenter',
        function () {
            showScrollButtons();
            scheduleScrollButtonHide();
        },
        {
            passive: true
        }
    );

    chatWindow.addEventListener(
        'mousemove',
        function () {
            if (mouseActivityTimer) {
                return;
            }

            mouseActivityTimer =
                setTimeout(
                    function () {
                        mouseActivityTimer = null;

                        showScrollButtons();
                        scheduleScrollButtonHide();
                    },
                    50
                );
        },
        {
            passive: true
        }
    );

    window.addEventListener(
        'resize',
        updateScrollButtons
    );

    if ('ResizeObserver' in window) {
        const resizeObserver =
            new ResizeObserver(
                function () {
                    updateScrollButtons();
                }
            );

        resizeObserver.observe(
            chatWindow
        );

        if (chatMessages) {
            resizeObserver.observe(
                chatMessages
            );
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

                scrollToBottom(true);

                /*
                 * Smooth scrolling does not immediately
                 * update scrollTop, so wait for the
                 * animation to reach the bottom.
                 */
                setTimeout(
                    function () {
                        if (isAtBottom()) {
                            clearUnreadMessages();

                            window.dispatchEvent(
                                new CustomEvent(
                                    'agro:chat-bottom-reached'
                                )
                            );
                        }

                        updateScrollButtons();
                    },
                    450
                );
            }
        );
    }

    /*
     * This is the single source of truth for unread
     * increments.
     */
    window.addEventListener(
        'agro:message-rendered',
        handleMessageRendered
    );

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
        requestAnimationFrame(
            function () {
                chatWindow.scrollTop =
                    getMaxScrollTop();

                clearUnreadMessages();

                updateScrollButtons();

                showScrollButtons();

                scheduleScrollButtonHide();

                window.dispatchEvent(
                    new CustomEvent(
                        'agro:chat-bottom-reached'
                    )
                );
            }
        );
    }

    ensureUnreadBadgePosition();
    updateUnreadBadge();
    initializeChatPosition();

    window.addEventListener(
        'load',
        function () {
            ensureUnreadBadgePosition();
            initializeChatPosition();
        },
        {
            once: true
        }
    );

    window.addEventListener(
        'beforeunload',
        function () {
            clearScrollButtonHideTimer();

            if (mouseActivityTimer) {
                clearTimeout(
                    mouseActivityTimer
                );

                mouseActivityTimer = null;
            }
        }
    );
});
