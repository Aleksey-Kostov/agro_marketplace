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

    const typingIndicator =
        document.getElementById('chat-typing-indicator');

    const SCROLL_EPSILON = 2;
    const BOTTOM_THRESHOLD = 20;
    const SCROLL_BUTTON_HIDE_DELAY = 2000;
    const TYPING_HIDE_DELAY = 250;

    let scrollButtonHideTimer = null;
    let typingHideTimer = null;

    let unreadCount = 0;


    /* =========================================================
       FORCE UNREAD BADGE TO DOWN BUTTON
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
       UNREAD
       ========================================================= */

    function updateUnreadBadge() {
        ensureUnreadBadgePosition();

        if (!unreadMessageCount) {
            return;
        }

        if (unreadCount <= 0) {
            unreadMessageCount.textContent = '0';

            unreadMessageCount.classList.add(
                'd-none'
            );
        } else {
            unreadMessageCount.textContent =
                unreadCount > 99
                    ? '99+'
                    : String(unreadCount);

            unreadMessageCount.classList.remove(
                'd-none'
            );
        }

        updateBottomButtonLabel();
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


    function clearUnreadMessages() {
        unreadCount = 0;

        updateUnreadBadge();

        /*
         * Immediately re-evaluate bottom button.
         */
        updateScrollButtons();
    }


    function addUnreadMessage() {
        unreadCount += 1;

        updateUnreadBadge();
        updateScrollButtons();

        /*
         * Unread messages must keep the bottom
         * navigation button visible.
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
         * Restart the auto-hide timer.
         */
        showScrollButtons();
        scheduleScrollButtonHide();
    }


    /* =========================================================
       BUTTON VISIBILITY
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


        /* ---------------------------------------------
           TOP BUTTON
           --------------------------------------------- */

        if (scrollTopBtn) {
            /*
             * d-none represents whether the button
             * is actually needed based on position.
             *
             * scroll-buttons-hidden represents only
             * the temporary auto-hide state.
             */
            scrollTopBtn.classList.toggle(
                'd-none',
                atTop
            );
        }


        /* ---------------------------------------------
           BOTTOM BUTTON
           --------------------------------------------- */

        if (scrollBottomBtn) {
            const shouldShowBottom =
                !atBottom ||
                unreadCount > 0;

            scrollBottomBtn.classList.toggle(
                'd-none',
                !shouldShowBottom
            );

            /*
             * IMPORTANT:
             *
             * If unread messages exist, the bottom
             * button must ALWAYS remain visible.
             */
            if (unreadCount > 0) {
                scrollBottomBtn.classList.remove(
                    'd-none'
                );

                scrollBottomBtn.classList.remove(
                    'scroll-buttons-hidden'
                );
            }
        }

        updateUnreadBadge();

        updateTypingIndicatorPosition();
    }


    /* =========================================================
       AUTO-HIDE
       ========================================================= */

    function showScrollButtons() {
        if (scrollTopBtn) {
            /*
             * Only remove the temporary auto-hide.
             * d-none is handled by updateScrollButtons().
             */
            scrollTopBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        if (scrollBottomBtn) {
            /*
             * Unread state has priority.
             */
            scrollBottomBtn.classList.remove(
                'scroll-buttons-hidden'
            );
        }

        updateScrollButtons();
    }


    function clearScrollButtonHideTimer() {
        if (!scrollButtonHideTimer) {
            return;
        }

        clearTimeout(
            scrollButtonHideTimer
        );

        scrollButtonHideTimer = null;
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
                     * Hide it after inactivity if it
                     * is currently needed.
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
                     * Unread messages have priority.
                     *
                     * If unreadCount > 0, the button
                     * stays visible.
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
                 * Initial state should not have
                 * auto-hidden buttons.
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
       TYPING INDICATOR
       ========================================================= */

    function updateTypingIndicatorPosition() {
        if (!typingIndicator) {
            return;
        }

        /*
         * Typing indicator is always an overlay.
         *
         * It must NEVER participate in document flow
         * and must NEVER change chat scrollHeight.
         */
        if (
            typingIndicator.classList.contains(
                'typing-visible'
            )
        ) {
            typingIndicator.classList.add(
                'typing-floating'
            );
        } else {
            typingIndicator.classList.remove(
                'typing-floating'
            );
        }
    }


    function showTypingIndicator(
        username
    ) {
        if (!typingIndicator) {
            return;
        }

        if (typingHideTimer) {
            clearTimeout(
                typingHideTimer
            );

            typingHideTimer = null;
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
            'd-none',
            'typing-hiding'
        );

        typingIndicator.classList.add(
            'typing-visible'
        );

        typingIndicator.classList.add(
            'typing-floating'
        );
    }


    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        if (typingHideTimer) {
            clearTimeout(
                typingHideTimer
            );

            typingHideTimer = null;
        }

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
                     * A new typing_start may have
                     * arrived during fade-out.
                     */
                    if (
                        typingIndicator.classList.contains(
                            'typing-visible'
                        )
                    ) {
                        return;
                    }

                    typingIndicator.classList.remove(
                        'typing-hiding',
                        'typing-floating'
                    );

                    typingIndicator.classList.add(
                        'd-none'
                    );
                },
                TYPING_HIDE_DELAY
            );
    }


    function handleTypingState(
        event
    ) {
        const detail =
            event.detail || {};

        if (
            detail.typing === true
        ) {
            showTypingIndicator(
                detail.username || 'User'
            );

            return;
        }

        hideTypingIndicator();
    }


    /* =========================================================
       MESSAGE RENDERED
       ========================================================= */

    function handleMessageRendered(
        event
    ) {
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
                 * Every real scroll activity shows
                 * the navigation buttons again.
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
                 * Restart inactivity timer.
                 */
                scheduleScrollButtonHide();
            },
            {
                passive: true
            }
        );

        /*
         * Mouse activity inside the chat also
         * brings the navigation buttons back.
         */
        chatWindow.addEventListener(
            'mousemove',
            function () {
                showScrollButtons();
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

        window.addEventListener(
            'resize',
            function () {
                updateScrollButtons();
            }
        );

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
       EVENTS
       ========================================================= */

    window.addEventListener(
        'agro:message-rendered',
        handleMessageRendered
    );

    window.addEventListener(
        'agro:typing-state',
        handleTypingState
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
        showScrollButtons,
        showTypingIndicator,
        hideTypingIndicator
    };


    /* =========================================================
       INIT
       ========================================================= */

    ensureUnreadBadgePosition();

    initializeChatPosition();

    updateUnreadBadge();

    updateScrollButtons();


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
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            clearScrollButtonHideTimer();

            if (typingHideTimer) {
                clearTimeout(
                    typingHideTimer
                );

                typingHideTimer = null;
            }
        }
    );
});
