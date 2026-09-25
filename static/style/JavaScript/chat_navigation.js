document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow =
        document.getElementById('chat-window');

    const chatMessages =
        document.getElementById('chat-messages');

    const scrollTopBtn =
        document.getElementById('scroll-top-btn');

    const scrollBottomBtn =
        document.getElementById('scroll-bottom-btn');

    const unreadMessageCount =
        document.getElementById('unread-message-count');

    const SCROLL_EPSILON = 2;
    const BOTTOM_THRESHOLD = 20;
    const SCROLL_BUTTON_HIDE_DELAY = 2000;

    let scrollButtonHideTimer = null;
    let unreadCount = 0;


    /* =========================================================
       UNREAD BADGE
       ========================================================= */

    function ensureUnreadBadgePosition() {
        if (
            !unreadMessageCount ||
            !scrollBottomBtn
        ) {
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
        } else {
            scrollBottomBtn.setAttribute(
                'aria-label',
                'Go to latest message'
            );
        }
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


    function addUnreadMessage() {
        unreadCount += 1;

        updateUnreadBadge();
        updateScrollButtons();

        /*
         * An unread message ALWAYS keeps the
         * bottom navigation button visible.
         */
        if (scrollBottomBtn) {
            scrollBottomBtn.classList.remove(
                'd-none'
            );

            scrollBottomBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        /*
         * Do not allow the idle timer to hide
         * the unread button.
         */
        clearScrollButtonHideTimer();
    }


    /* =========================================================
       SCROLL STATE
       ========================================================= */

    function getMaxScrollTop() {
        if (!chatWindow) {
            return 0;
        }

        return Math.max(
            0,
            chatWindow.scrollHeight -
                chatWindow.clientHeight
        );
    }


    function isAtTop() {
        if (!chatWindow) {
            return true;
        }

        return (
            chatWindow.scrollTop <=
            SCROLL_EPSILON
        );
    }


    function isAtBottom() {
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


    /* =========================================================
       SCROLL BUTTON STATE
       ========================================================= */

    function updateScrollButtons() {
        if (!chatWindow) {
            return;
        }

        ensureUnreadBadgePosition();

        const atTop =
            isAtTop();

        const atBottom =
            isAtBottom();


        /*
         * -----------------------------------------------------
         * TOP BUTTON
         * -----------------------------------------------------
         */

        if (scrollTopBtn) {
            const topNeeded =
                !atTop;

            scrollTopBtn.classList.toggle(
                'd-none',
                !topNeeded
            );

            /*
             * If the button is no longer needed,
             * remove the temporary auto-hide state.
             */
            if (!topNeeded) {
                scrollTopBtn.classList.remove(
                    'scroll-buttons-hidden'
                );
            }
        }


        /*
         * -----------------------------------------------------
         * BOTTOM BUTTON
         * -----------------------------------------------------
         *
         * Needed when:
         *
         * 1. We are not at the bottom
         * OR
         * 2. There are unread messages.
         */

        if (scrollBottomBtn) {
            const bottomNeeded =
                !atBottom ||
                unreadCount > 0;

            scrollBottomBtn.classList.toggle(
                'd-none',
                !bottomNeeded
            );

            /*
             * Unread messages always have priority.
             */
            if (unreadCount > 0) {
                scrollBottomBtn.classList.remove(
                    'd-none'
                );

                scrollBottomBtn.classList.remove(
                    'scroll-buttons-hidden'
                );
            }

            /*
             * If the button is no longer needed,
             * remove the temporary auto-hide state.
             */
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
        if (!scrollButtonHideTimer) {
            return;
        }

        clearTimeout(
            scrollButtonHideTimer
        );

        scrollButtonHideTimer = null;
    }


    function showScrollButtons() {
        clearScrollButtonHideTimer();

        /*
         * Remove ONLY the temporary idle state.
         *
         * d-none remains controlled by
         * updateScrollButtons().
         */

        if (scrollTopBtn) {
            scrollTopBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        if (scrollBottomBtn) {
            /*
             * Unread messages always stay visible.
             */
            scrollBottomBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        updateScrollButtons();
    }


    function scheduleScrollButtonHide() {
        clearScrollButtonHideTimer();

        scrollButtonHideTimer =
            setTimeout(
                function () {
                    scrollButtonHideTimer = null;

                    /*
                     * TOP BUTTON
                     *
                     * Hide only if it is actually needed.
                     */
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
                     * BOTTOM BUTTON
                     *
                     * Never auto-hide while unread
                     * messages exist.
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
        if (!chatWindow) {
            return;
        }

        showScrollButtons();

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        scheduleScrollButtonHide();
    }


    function scrollToBottom(
        smooth = true
    ) {
        if (!chatWindow) {
            return;
        }

        showScrollButtons();

        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
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

        if (
            !detail.shouldScroll ||
            !chatWindow
        ) {
            updateScrollButtons();

            return;
        }

        requestAnimationFrame(
            function () {
                showScrollButtons();

                chatWindow.scrollTo({
                    top:
                        chatWindow.scrollHeight,
                    behavior: 'smooth'
                });

                updateScrollButtons();

                scheduleScrollButtonHide();
            }
        );
    }


    /* =========================================================
       CHAT SCROLL
       ========================================================= */

    if (chatWindow) {
        chatWindow.addEventListener(
            'scroll',
            function () {
                /*
                 * Any real scrolling activity
                 * immediately reveals the buttons.
                 */
                showScrollButtons();

                const atBottom =
                    isAtBottom();

                updateScrollButtons();

                /*
                 * Reaching the bottom clears unread.
                 */
                if (atBottom) {
                    clearUnreadMessages();

                    window.dispatchEvent(
                        new CustomEvent(
                            'agro:chat-bottom-reached'
                        )
                    );
                }

                /*
                 * Restart idle timer.
                 */
                scheduleScrollButtonHide();
            },
            {
                passive: true
            }
        );


        /*
         * Mouse entering the chat counts
         * as navigation activity.
         */
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


        /*
         * Mouse movement resets the idle timer.
         *
         * Throttled to avoid excessive DOM work.
         */
        let mouseActivityTimer = null;

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


        /*
         * Window resize.
         */
        window.addEventListener(
            'resize',
            function () {
                updateScrollButtons();
            }
        );


        /*
         * Detect changes in the chat content.
         */
        if (
            'ResizeObserver' in window
        ) {
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
    }


    /* =========================================================
       BUTTON EVENTS
       ========================================================= */

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
            }
        );
    }


    /* =========================================================
       GLOBAL EVENTS
       ========================================================= */

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


    /* =========================================================
       INITIAL POSITION
       ========================================================= */

    function initializeChatPosition() {
        if (!chatWindow) {
            return;
        }

        requestAnimationFrame(
            function () {
                chatWindow.scrollTop =
                    getMaxScrollTop();

                clearUnreadMessages();

                updateScrollButtons();

                /*
                 * Show navigation briefly,
                 * then allow the idle timer to hide it.
                 */
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


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearScrollButtonHideTimer();
        }
    );
});
