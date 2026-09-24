document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /* =========================================================
       ELEMENTS
    ========================================================== */

    const chatWindow =
        document.getElementById('chat-window');

    const chatMessages =
        document.getElementById('chat-messages');

    const replyForm =
        document.getElementById('reply-form');

    const messageBodyField =
        replyForm
            ? replyForm.querySelector(
                'textarea[name="body"], input[name="body"]'
            )
            : null;


    /* =========================================================
       CONSTANTS
    ========================================================== */

    const TYPING_STOP_DELAY = 1200;
    const BOTTOM_THRESHOLD = 80;


    /* =========================================================
       STATE
    ========================================================== */

    let typingTimer = null;
    let isTyping = false;
    let typingIndicator = null;

    /*
     * Remember whether the user was at the bottom
     * BEFORE a new message is inserted.
     */
    let wasNearBottom = true;


    /* =========================================================
       CURRENT USER
    ========================================================== */

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
       SOCKET
    ========================================================== */

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
                JSON.stringify({
                    type: type
                })
            );
        } catch (error) {
            console.error(
                'Unable to send typing event:',
                error
            );
        }
    }


    /* =========================================================
       TYPING INDICATOR
    ========================================================== */

    function createTypingIndicator() {
        if (typingIndicator) {
            return typingIndicator;
        }

        typingIndicator =
            document.createElement('div');

        typingIndicator.id =
            'chat-typing-indicator';

        typingIndicator.className =
            'chat-typing-indicator d-none';

        typingIndicator.setAttribute(
            'aria-live',
            'polite'
        );

        typingIndicator.innerHTML = `
            <span class="chat-typing-name"></span>
            <span class="chat-typing-text">пише</span>
            <span class="chat-typing-dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
            </span>
        `;

        if (chatMessages) {
            chatMessages.appendChild(
                typingIndicator
            );
        } else if (chatWindow) {
            chatWindow.appendChild(
                typingIndicator
            );
        }

        return typingIndicator;
    }


    function showTypingIndicator(username) {
        const indicator =
            createTypingIndicator();

        if (!indicator) {
            return;
        }

        const nameElement =
            indicator.querySelector(
                '.chat-typing-name'
            );

        if (nameElement) {
            nameElement.textContent =
                username || 'Потребителят';
        }

        indicator.classList.remove(
            'd-none'
        );

        if (isNearBottom()) {
            scrollToBottom(false);
        }
    }


    function hideTypingIndicator() {
        if (!typingIndicator) {
            return;
        }

        typingIndicator.classList.add(
            'd-none'
        );
    }


    /* =========================================================
       OUTGOING TYPING
    ========================================================== */

    function startTyping() {
        if (isTyping) {
            return;
        }

        isTyping = true;

        sendTypingEvent(
            'typing_start'
        );
    }


    function stopTyping() {
        if (!isTyping) {
            return;
        }

        isTyping = false;

        sendTypingEvent(
            'typing_stop'
        );
    }


    function resetTypingTimer() {
        if (typingTimer) {
            clearTimeout(
                typingTimer
            );
        }

        typingTimer =
            setTimeout(
                function () {
                    stopTyping();
                    typingTimer = null;
                },
                TYPING_STOP_DELAY
            );
    }


    function handleComposerInput() {
        if (!messageBodyField) {
            return;
        }

        const value =
            messageBodyField.value.trim();

        if (!value) {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }

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
                stopTyping();

                if (typingTimer) {
                    clearTimeout(
                        typingTimer
                    );

                    typingTimer = null;
                }
            }
        );
    }


    /* =========================================================
       MESSAGE SENT
    ========================================================== */

    window.addEventListener(
        'agro:message-sent',
        function () {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }
        }
    );


    /* =========================================================
       WEBSOCKET EVENTS
    ========================================================== */

    window.addEventListener(
        'agro:websocket-message',
        function (event) {
            const data =
                event.detail;

            if (!data) {
                return;
            }

            if (
                data.type ===
                'typing_start'
            ) {
                const currentUserId =
                    getCurrentUserId();

                /*
                 * Ignore our own typing event.
                 */
                if (
                    data.user_id &&
                    currentUserId &&
                    Number(data.user_id) ===
                        Number(currentUserId)
                ) {
                    return;
                }

                showTypingIndicator(
                    data.username ||
                    data.user_name ||
                    data.name ||
                    'Потребителят'
                );

                return;
            }


            if (
                data.type ===
                'typing_stop'
            ) {
                hideTypingIndicator();

                return;
            }
        }
    );


    /* =========================================================
       AUTO SCROLL
    ========================================================== */

    function isNearBottom() {
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
    }


    /*
     * Track the position BEFORE a new message arrives.
     */
    if (chatWindow) {
        chatWindow.addEventListener(
            'scroll',
            function () {
                wasNearBottom =
                    isNearBottom();
            }
        );

        /*
         * Initial state.
         */
        wasNearBottom =
            isNearBottom();
    }


    /* =========================================================
       NEW MESSAGE AUTO SCROLL
    ========================================================== */

    if (chatMessages) {
        const observer =
            new MutationObserver(
                function (mutations) {

                    let newMessageAdded =
                        false;

                    for (
                        const mutation of mutations
                    ) {
                        if (
                            mutation.type !==
                            'childList'
                        ) {
                            continue;
                        }

                        for (
                            const node of mutation.addedNodes
                        ) {
                            if (
                                node.nodeType !==
                                Node.ELEMENT_NODE
                            ) {
                                continue;
                            }

                            if (
                                node.matches &&
                                node.matches(
                                    '.conversation-message'
                                )
                            ) {
                                newMessageAdded = true;
                                break;
                            }

                            if (
                                node.querySelector &&
                                node.querySelector(
                                    '.conversation-message'
                                )
                            ) {
                                newMessageAdded = true;
                                break;
                            }
                        }

                        if (newMessageAdded) {
                            break;
                        }
                    }

                    if (!newMessageAdded) {
                        return;
                    }

                    /*
                     * IMPORTANT:
                     * Use the position from BEFORE
                     * the message was inserted.
                     */
                    const shouldScroll =
                        wasNearBottom;

                    /*
                     * Prepare for the next message.
                     */
                    wasNearBottom = false;

                    if (!shouldScroll) {
                        return;
                    }

                    requestAnimationFrame(
                        function () {
                            requestAnimationFrame(
                                function () {
                                    scrollToBottom(true);

                                    /*
                                     * We are at the bottom again.
                                     */
                                    wasNearBottom =
                                        isNearBottom();
                                }
                            );
                        }
                    );
                }
            );

        observer.observe(
            chatMessages,
            {
                childList: true,
                subtree: false
            }
        );
    }


    /* =========================================================
       CLEANUP
    ========================================================== */

    window.addEventListener(
        'beforeunload',
        function () {
            stopTyping();

            if (typingTimer) {
                clearTimeout(
                    typingTimer
                );

                typingTimer = null;
            }
        }
    );
});
