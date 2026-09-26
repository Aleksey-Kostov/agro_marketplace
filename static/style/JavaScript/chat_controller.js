document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');

    if (!chatWindow || !chatMessages) {
        return;
    }

    const pendingMessageFragments = new Set();
    const pendingMessageRefreshes = new Map();
    const readMessagesSent = new Set();

    function isChatAtBottom() {
        if (
            window.agroChatNavigation &&
            typeof window.agroChatNavigation.isAtBottom === 'function'
        ) {
            return window.agroChatNavigation.isAtBottom();
        }

        return (
            chatWindow.scrollTop + chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight - 50
        );
    }

    function getCurrentUserId() {
        const value = Number(
            chatWindow.dataset.currentUserId
        );

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }

    function getMessageElement(messageId) {
        return messageId
            ? document.getElementById(`msg-${messageId}`)
            : null;
    }

    function getMessageIdFromElement(element) {
        if (!element) {
            return null;
        }

        if (element.dataset.messageId) {
            const id = Number(
                element.dataset.messageId
            );

            if (id) {
                return id;
            }
        }

        const rawId = element.id || '';

        if (rawId.startsWith('msg-')) {
            const id = Number(
                rawId.substring(4)
            );

            if (id) {
                return id;
            }
        }

        const child = element.querySelector(
            '[data-message-id]'
        );

        if (child) {
            const id = Number(
                child.dataset.messageId
            );

            if (id) {
                return id;
            }
        }

        return null;
    }

    function sendWebSocketPayload(payload) {
        if (
            !window.agroChatWebSocket ||
            typeof window.agroChatWebSocket.send !== 'function'
        ) {
            return false;
        }

        return window.agroChatWebSocket.send(payload);
    }

    function isWebSocketOpen() {
        if (
            !window.agroChatWebSocket ||
            typeof window.agroChatWebSocket.isOpen !== 'function'
        ) {
            return false;
        }

        return window.agroChatWebSocket.isOpen();
    }

    function getMessageFragmentUrl(messageId) {
        const template =
            chatWindow.dataset.messageFragmentUrl;

        if (!template || !messageId) {
            return null;
        }

        try {
            const url = new URL(
                template,
                window.location.origin
            );

            url.pathname = url.pathname.replace(
                /\/0\/?$/,
                `/${encodeURIComponent(messageId)}/`
            );

            return url.toString();

        } catch (error) {
            console.error(
                'Unable to build message fragment URL:',
                error
            );

            return null;
        }
    }

    async function fetchMessageFragment(messageId) {
        const fragmentUrl =
            getMessageFragmentUrl(messageId);

        if (!fragmentUrl) {
            throw new Error(
                'Message fragment URL is missing.'
            );
        }

        const response = await fetch(
            fragmentUrl,
            {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            }
        );

        let data;

        try {
            data = await response.json();

        } catch (error) {
            throw new Error(
                `Invalid message fragment response (${response.status}).`
            );
        }

        if (
            !response.ok ||
            !data.ok ||
            !data.html
        ) {
            throw new Error(
                data.error ||
                `Unable to load message fragment (${response.status}).`
            );
        }

        return data;
    }

    function removeEmptyConversationMessage() {
        chatMessages
            .querySelectorAll('.alert.alert-info')
            .forEach(function (element) {
                element.remove();
            });
    }

    function dispatchMessageAcknowledged(
        message
    ) {
        if (!message) {
            return;
        }

        const messageId =
            Number(message.id);

        const senderId =
            Number(message.sender_id);

        const currentUserId =
            getCurrentUserId();

        if (
            !messageId ||
            !senderId ||
            !currentUserId ||
            senderId !== currentUserId
        ) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                'agro:message-acknowledged',
                {
                    detail: {
                        messageId,
                        senderId
                    }
                }
            )
        );
    }

    function appendRenderedMessage(
        html,
        messageId,
        shouldScroll
    ) {
        if (
            !html ||
            !messageId ||
            getMessageElement(messageId)
        ) {
            return false;
        }

        removeEmptyConversationMessage();

        /*
         * The conversation uses normal DOM order:
         *
         * oldest message
         * oldest message
         * newest message
         *
         * Therefore a new message always belongs
         * at the end of the message list.
         *
         * We intentionally do NOT use column-reverse.
         */
        chatMessages.insertAdjacentHTML(
            'beforeend',
            html
        );

        const inserted =
            getMessageElement(messageId);

        if (!inserted) {
            console.warn(
                'Rendered message HTML did not contain expected message:',
                messageId
            );

            return false;
        }

        /*
         * chat_navigation.js owns:
         *
         * - scroll position
         * - unread counter
         * - "at bottom" state
         * - scroll buttons
         *
         * This event only tells it that the message
         * has been rendered.
         */
        window.dispatchEvent(
            new CustomEvent(
                'agro:message-rendered',
                {
                    detail: {
                        messageId,
                        shouldScroll: Boolean(
                            shouldScroll
                        )
                    }
                }
            )
        );

        return true;
    }

    function markMessageAsRead(
        messageId,
        force = false
    ) {
        const id = Number(messageId);

        if (!id) {
            return false;
        }

        if (
            !force &&
            readMessagesSent.has(id)
        ) {
            return false;
        }

        if (!isWebSocketOpen()) {
            return false;
        }

        const sent =
            sendWebSocketPayload({
                type: 'mark_read',
                message_id: id
            });

        if (sent) {
            readMessagesSent.add(id);
        }

        return sent;
    }

    function markExistingReceivedMessagesAsRead() {
        if (!isChatAtBottom()) {
            return;
        }

        chatMessages
            .querySelectorAll(
                '.conversation-message.received-message'
            )
            .forEach(function (element) {
                const messageId =
                    getMessageIdFromElement(
                        element
                    );

                if (messageId) {
                    markMessageAsRead(
                        messageId
                    );
                }
            });
    }

    async function appendIncomingMessage(
        message
    ) {
        if (!message) {
            return;
        }

        const messageId =
            Number(message.id);

        if (!messageId) {
            return;
        }

        /*
         * If the message is already in the DOM,
         * it may have been inserted by the normal
         * HTTP response in conversation.js.
         *
         * Still acknowledge it here if it belongs
         * to the current user. This keeps the
         * realtime acknowledgement reliable.
         */
        if (getMessageElement(messageId)) {
            dispatchMessageAcknowledged(
                message
            );

            if (isChatAtBottom()) {
                markMessageAsRead(
                    messageId
                );
            }

            return;
        }

        if (
            pendingMessageFragments.has(
                messageId
            )
        ) {
            return;
        }

        const shouldScroll =
            isChatAtBottom();

        pendingMessageFragments.add(
            messageId
        );

        try {
            const data =
                await fetchMessageFragment(
                    messageId
                );

            if (getMessageElement(messageId)) {
                dispatchMessageAcknowledged(
                    message
                );

                if (isChatAtBottom()) {
                    markMessageAsRead(
                        messageId
                    );
                }

                return;
            }

            const rendered =
                appendRenderedMessage(
                    data.html,
                    messageId,
                    shouldScroll
                );

            if (!rendered) {
                return;
            }

            /*
             * IMPORTANT:
             *
             * The WebSocket message has now
             * actually been rendered.
             *
             * If this is our own message, notify
             * conversation.js so its Sending...
             * state can be cleared even when the
             * original HTTP request is still pending.
             */
            dispatchMessageAcknowledged(
                message
            );

            if (shouldScroll) {
                markMessageAsRead(
                    messageId
                );
            }

            /*
             * IMPORTANT:
             *
             * We DO NOT call addUnreadMessage()
             * here.
             *
             * chat_navigation.js receives the
             * agro:message-rendered event and is
             * the single owner of the unread counter.
             */

        } catch (error) {
            console.error(
                'Unable to append WebSocket message:',
                error
            );

        } finally {
            pendingMessageFragments.delete(
                messageId
            );
        }
    }

    async function refreshMessageFragment(
        messageId,
        options = {}
    ) {
        const id = Number(messageId);

        if (!id) {
            return false;
        }

        const previous =
            pendingMessageRefreshes.get(id) ||
            Promise.resolve();

        const next =
            previous
                .catch(() => {})
                .then(async function () {
                    const preserveScroll =
                        options.preserveScroll !== false;

                    const oldScrollTop =
                        chatWindow.scrollTop;

                    const data =
                        await fetchMessageFragment(
                            id
                        );

                    const currentMessage =
                        getMessageElement(id);

                    if (!currentMessage) {
                        return appendRenderedMessage(
                            data.html,
                            data.message_id || id,
                            false
                        );
                    }

                    const wrapper =
                        document.createElement(
                            'div'
                        );

                    wrapper.innerHTML =
                        data.html.trim();

                    const newMessage =
                        wrapper.firstElementChild;

                    if (!newMessage) {
                        throw new Error(
                            'Server returned empty message HTML.'
                        );
                    }

                    currentMessage.replaceWith(
                        newMessage
                    );

                    if (preserveScroll) {
                        chatWindow.scrollTop =
                            oldScrollTop;

                        chatWindow.dispatchEvent(
                            new Event('scroll')
                        );
                    }

                    return true;
                });

        let trackedPromise;

        trackedPromise =
            next.finally(function () {
                if (
                    pendingMessageRefreshes.get(id) ===
                    trackedPromise
                ) {
                    pendingMessageRefreshes.delete(
                        id
                    );
                }
            });

        pendingMessageRefreshes.set(
            id,
            trackedPromise
        );

        return trackedPromise;
    }

    function refreshStatusMessages(
        messageIds
    ) {
        if (!Array.isArray(messageIds)) {
            return;
        }

        const uniqueIds = [
            ...new Set(
                messageIds
                    .map(Number)
                    .filter(Boolean)
            )
        ];

        uniqueIds.forEach(
            function (messageId) {
                refreshMessageFragment(
                    messageId,
                    {
                        preserveScroll: true
                    }
                ).catch(
                    function (error) {
                        console.error(
                            'Unable to refresh message status:',
                            messageId,
                            error
                        );
                    }
                );
            }
        );
    }

    function handleWebSocketMessage(
        event
    ) {
        const data = event.detail;

        if (!data) {
            return;
        }

        if (
            data.type ===
            'connection_established'
        ) {
            markExistingReceivedMessagesAsRead();
            return;
        }

        if (
            data.type ===
            'message_created'
        ) {
            appendIncomingMessage(
                data.message
            ).catch(function (error) {
                console.error(
                    'WebSocket message rendering error:',
                    error
                );
            });

            return;
        }

        if (
            data.type ===
                'message_status_updated' ||
            data.type ===
                'message_delivery_updated'
        ) {
            if (
                Array.isArray(
                    data.message_ids
                )
            ) {
                refreshStatusMessages(
                    data.message_ids
                );

                return;
            }

            const messageId =
                data.message_id ||
                data.id ||
                data.message?.id;

            if (messageId) {
                refreshStatusMessages([
                    messageId
                ]);
            }

            return;
        }

        if (
            data.type ===
                'reaction_updated' ||
            data.type ===
                'message_reacted' ||
            data.type ===
                'message_updated' ||
            data.type ===
                'message_deleted'
        ) {
            const payload =
                data.message ||
                data.data ||
                data;

            const messageId =
                payload.message_id ||
                payload.id ||
                data.message_id ||
                data.id;

            if (messageId) {
                refreshMessageFragment(
                    messageId,
                    {
                        preserveScroll: true
                    }
                ).catch(function (error) {
                    console.error(
                        'Unable to refresh WebSocket message:',
                        error
                    );
                });
            }

            return;
        }

        if (
            data.type ===
            'error'
        ) {
            console.error(
                'WebSocket server error:',
                data.code,
                data.message
            );
        }
    }

    window.addEventListener(
        'agro:websocket-message',
        handleWebSocketMessage
    );

    window.addEventListener(
        'agro:websocket-open',
        function () {
            if (isChatAtBottom()) {
                markExistingReceivedMessagesAsRead();
            }
        }
    );

    window.addEventListener(
        'agro:chat-bottom-reached',
        function () {
            markExistingReceivedMessagesAsRead();
        }
    );

    window.agroChatController = {
        isAtBottom:
            isChatAtBottom,

        markMessageAsRead:
            markMessageAsRead,

        markExistingReceivedMessagesAsRead:
            markExistingReceivedMessagesAsRead,

        refreshMessageFragment:
            refreshMessageFragment,

        appendIncomingMessage:
            appendIncomingMessage
    };
});
