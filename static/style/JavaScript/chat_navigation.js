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

    let scrollButtonHideTimer = null;
    let unreadCount = 0;
    let typingHideTimer = null;


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

        /*
         * The unread badge MUST be a child of the
         * down button.
         */
        if (
            unreadMessageCount.parentElement !==
            scrollBottomBtn
        ) {
            scrollBottomBtn.appendChild(
                unreadMessageCount
            );
        }

        /*
         * Defensive protection:
         * never allow the badge to exist inside
         * the top button.
         */
        if (
            scrollTopBtn &&
            scrollTopBtn.contains(
                unreadMessageCount
            )
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
        if (unreadCount === 0) {
            updateUnreadBadge();
            return;
        }

        unreadCount = 0;

        updateUnreadBadge();
    }

    function addUnreadMessage() {
        unreadCount += 1;

        updateUnreadBadge();
        updateScrollButtons();
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
            scrollTopBtn.classList.toggle(
                'd-none',
                atTop
            );

            /*
             * Extra protection:
             * the top button can NEVER contain
             * the unread badge.
             */
            if (
                unreadMessageCount &&
                scrollTopBtn.contains(
                    unreadMessageCount
                )
            ) {
                scrollBottomBtn.appendChild(
                    unreadMessageCount
                );
            }
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
        }

        updateUnreadBadge();

        updateTypingIndicatorPosition(
            atBottom
        );
    }


    /* =========================================================
       HOVER VISIBILITY
       ========================================================= */

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
            clearTimeout(
                scrollButtonHideTimer
            );
        }

        scrollButtonHideTimer =
            setTimeout(function () {
                scrollButtonHideTimer = null;

                /*
                 * Never hide the DOWN button while
                 * unread messages exist.
                 */
                if (
                    scrollBottomBtn &&
                    unreadCount <= 0
                ) {
                    scrollBottomBtn.classList.add(
                        'scroll-buttons-hidden'
                    );
                }

                /*
                 * TOP button may hide after inactivity.
                 */
                if (
                    scrollTopBtn &&
                    isAtTop()
                ) {
                    scrollTopBtn.classList.add(
                        'scroll-buttons-hidden'
                    );
                }
            }, SCROLL_BUTTON_HIDE_DELAY);
    }


    /* =========================================================
       SCROLL ACTIONS
       ========================================================= */

    function scrollToTop() {
        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    function scrollToBottom(smooth = true) {
        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: smooth
                ? 'smooth'
                : 'auto'
        });

        /*
         * For an instant scroll we know that the user
         * reached the bottom.
         */
        if (!smooth) {
            clearUnreadMessages();

            window.dispatchEvent(
                new CustomEvent(
                    'agro:chat-bottom-reached'
                )
            );
        }
    }


    /* =========================================================
       INITIAL POSITION
       ========================================================= */

    function initializeChatPosition() {
        if (!chatWindow) {
            return;
        }

        requestAnimationFrame(function () {
            chatWindow.scrollTop =
                chatWindow.scrollHeight;

            /*
             * Initial page load is considered read.
             */
            clearUnreadMessages();

            updateScrollButtons();

            window.dispatchEvent(
                new CustomEvent(
                    'agro:chat-bottom-reached'
                )
            );
        });
    }


    /* =========================================================
       TYPING INDICATOR
       ========================================================= */

    function updateTypingIndicatorPosition(
        atBottom = isAtBottom()
    ) {
        if (!typingIndicator) {
            return;
        }

        const isVisible =
            typingIndicator.classList.contains(
                'typing-visible'
            );

        if (!isVisible) {
            typingIndicator.classList.remove(
                'typing-floating'
            );

            return;
        }

        /*
         * At bottom:
         * typing indicator stays in normal document flow.
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
             * If it was floating while the user was
             * reading older messages, restore the bottom.
             */
            if (
                wasFloating &&
                chatWindow
            ) {
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
         * User is reading older messages.
         *
         * Do NOT change scroll position.
         * Make typing indicator float above the chat.
         */
        typingIndicator.classList.add(
            'typing-floating'
        );
    }


    function showTypingIndicator(username) {
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

        /*
         * IMPORTANT:
         *
         * d-none must be removed BEFORE typing-visible
         * so CSS can actually render the indicator.
         */
        typingIndicator.classList.remove(
            'd-none',
            'typing-hiding'
        );

        typingIndicator.classList.add(
            'typing-visible'
        );

        updateTypingIndicatorPosition();
    }


    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        if (typingHideTimer) {
            clearTimeout(
                typingHideTimer
            );
        }

        typingIndicator.classList.remove(
            'typing-visible',
            'typing-floating'
        );

        typingIndicator.classList.add(
            'typing-hiding'
        );

        typingHideTimer =
            setTimeout(function () {
                typingHideTimer = null;

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


    function handleTypingState(event) {
        const detail =
            event.detail || {};

        if (detail.typing === true) {
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

        requestAnimationFrame(function () {
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });

            updateScrollButtons();
        });
    }


    /* =========================================================
       CHAT SCROLL
       ========================================================= */

    if (chatWindow) {
        chatWindow.addEventListener(
            'scroll',
            function () {
                const atBottom =
                    isAtBottom();

                updateScrollButtons();

                /*
                 * Only actual bottom clears unread.
                 */
                if (atBottom) {
                    clearUnreadMessages();

                    window.dispatchEvent(
                        new CustomEvent(
                            'agro:chat-bottom-reached'
                        )
                    );
                }

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
        updateScrollButtons
    };


    /* =========================================================
       INIT
       ========================================================= */

    /*
     * FIRST:
     * guarantee badge placement.
     */
    ensureUnreadBadgePosition();

    /*
     * THEN:
     * initialize the chat.
     */
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
            if (scrollButtonHideTimer) {
                clearTimeout(
                    scrollButtonHideTimer
                );

                scrollButtonHideTimer = null;
            }

            if (typingHideTimer) {
                clearTimeout(
                    typingHideTimer
                );

                typingHideTimer = null;
            }
        }
    );
});
