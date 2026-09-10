document.addEventListener('DOMContentLoaded', function () {

    const chatMessages =
        document.getElementById('chat-messages');

    if (!chatMessages) {
        return;
    }

    const conversationId =
        chatMessages.dataset.conversationId;

    if (!conversationId) {
        console.error(
            'WebSocket: conversation ID not found.'
        );
        return;
    }

    /*
     * We get the current user ID from Django.
     * This lets us decide whether a newly received
     * message is an own-message or received-message.
     */
    const currentUserId =
        Number(chatMessages.dataset.currentUserId);

    const typingIndicator =
        document.getElementById('typing-indicator');

    const typingUsername =
        typingIndicator
            ? typingIndicator.querySelector(
                '.typing-username'
            )
            : null;

    const replyForm =
        document.getElementById('reply-form');

    const messageInput =
        document.getElementById(
            'message-body-input'
        );

    const scrollBottomBtn =
    document.getElementById(
        'scroll-bottom-btn'
    );

    let unreadNewMessages = 0;
    let userIsAtBottom = true;

    const wsProtocol =
        window.location.protocol === 'https:'
            ? 'wss'
            : 'ws';

    const wsUrl =
        `${wsProtocol}://${window.location.host}` +
        `/ws/messages/${conversationId}/`;

    console.log(
        'WebSocket: connecting to',
        wsUrl
    );

    const chatSocket =
        new WebSocket(wsUrl);

    let typingTimeout = null;


    // =========================================================
    // SCROLL
    // =========================================================

    function scrollToBottom() {

        const conversationScroll =
            chatMessages.closest(
                '.conversation-scroll'
            );

        if (!conversationScroll) {
            return;
        }

        conversationScroll.scrollTo({
            top: conversationScroll.scrollHeight,
            behavior: 'smooth'
        });
    }

    function isAtBottom() {
    const conversationScroll =
        chatMessages.closest(
            '.conversation-scroll'
        );

    if (!conversationScroll) {
        return true;
    }

    const threshold = 5;

    return (
        conversationScroll.scrollHeight -
        conversationScroll.scrollTop -
        conversationScroll.clientHeight
    ) <= threshold;
}


    function updateNewMessageBadge() {

    if (!scrollBottomBtn) {
        return;
    }

    let badge =
        scrollBottomBtn.querySelector(
            '.new-message-badge'
        );

    if (!badge) {

        badge =
            document.createElement('span');

        badge.className =
            'new-message-badge';

        scrollBottomBtn.appendChild(
            badge
        );
    }

    if (unreadNewMessages > 0) {

        badge.textContent =
            unreadNewMessages > 99
                ? '99+'
                : String(unreadNewMessages);

        badge.classList.remove(
            'd-none'
        );

    } else {

        badge.classList.add(
            'd-none'
        );
    }
}


    function clearNewMessageBadge() {

    unreadNewMessages = 0;

    updateNewMessageBadge();
}


    // =========================================================
    // ESCAPE HTML
    // =========================================================

    function escapeHtml(value) {

        const div =
            document.createElement('div');

        div.textContent =
            value == null
                ? ''
                : String(value);

        return div.innerHTML;
    }


    // =========================================================
    // TYPING INDICATOR
    // =========================================================

    function showTyping(username) {

        if (!typingIndicator) {
            return;
        }

        const wasAtBottom =
            isAtBottom();

        if (typingUsername) {

            typingUsername.textContent =
                 username || 'Someone';
        }

        typingIndicator.classList.remove(
            'd-none'
        );

        if (wasAtBottom) {
           scrollToBottom();
        }

    }

    function hideTyping() {

        if (!typingIndicator) {
            return;
        }

        typingIndicator.classList.add(
            'd-none'
        );
    }


    function sendTypingStatus(isTyping) {

        if (
            chatSocket.readyState !==
            WebSocket.OPEN
        ) {
            return;
        }

        chatSocket.send(
            JSON.stringify({
                type: 'typing',
                is_typing: isTyping
            })
        );
    }


    // =========================================================
    // TYPING EVENTS
    // =========================================================

    if (messageInput) {

        messageInput.addEventListener(
            'input',
            function () {

                sendTypingStatus(true);

                clearTimeout(
                    typingTimeout
                );

                typingTimeout =
                    setTimeout(
                        function () {

                            sendTypingStatus(
                                false
                            );

                        },
                        1000
                    );
            }
        );
    }


    if (replyForm) {

        replyForm.addEventListener(
            'submit',
            function () {

                clearTimeout(
                    typingTimeout
                );

                sendTypingStatus(false);
            }
        );
    }


    // =========================================================
    // CREATE REACTION HTML
    // =========================================================

    function createReactionHtml(
    messageId,
    reaction
) {
    const emoji =
        reaction === 'heart'
            ? '❤️'
            : '👍';

    const title =
        reaction === 'heart'
            ? 'Heart'
            : 'Like';

    const reactionUrl =
        `/messages/react/${messageId}/${reaction}/`;

    return `
        <a href="${reactionUrl}"
           class="tg-reaction js-react"
           data-reaction="${reaction}"
           data-msg="${messageId}"
           title="${title}">

                <span class="tg-emoji">
                    ${emoji}
                </span>

                <span class="tg-avatars"
                      data-react-avatars="${reaction}-${messageId}">
                </span>

            </a>
        `;
    }


    // =========================================================
    // CREATE MESSAGE ELEMENT
    // =========================================================

    function createMessageElement(message) {

        const messageElement =
            document.createElement('div');


        // -----------------------------------------------------
        // MESSAGE CLASSES
        // -----------------------------------------------------

        const isOwnMessage =
            Number(message.sender_id) ===
            currentUserId;

        messageElement.classList.add(
            'conversation-message'
        );

        messageElement.classList.add(
            isOwnMessage
                ? 'own-message'
                : 'received-message'
        );

        messageElement.id =
            `msg-${message.id}`;

        messageElement.dataset.messageId =
            message.id;


        // -----------------------------------------------------
        // AVATAR
        // -----------------------------------------------------

        const avatarUrl =
            message.sender_avatar_url ||
            '/static/images/profile_picture.webp';


        // -----------------------------------------------------
        // USERNAME
        // -----------------------------------------------------

        const username =
            escapeHtml(
                message.sender_username ||
                'User'
            );


        // -----------------------------------------------------
        // TIMESTAMP
        // -----------------------------------------------------

        let timestamp = '';

        if (message.timestamp) {

            const date =
                new Date(
                    message.timestamp
                );

            if (!isNaN(date.getTime())) {

                timestamp =
                    date.toLocaleString(
                        'bg-BG',
                        {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }
                    );
            }
        }


        // -----------------------------------------------------
        // BODY
        // -----------------------------------------------------

        const body =
            message.body || '';


        // -----------------------------------------------------
        // IMAGE
        // -----------------------------------------------------

        let imageHtml = '';

        if (message.image_url) {

            const imageUrl =
                escapeHtml(
                    message.image_url
                );

            imageHtml = `
                <div class="media-wrap mt-1">

                    <a href="${imageUrl}"
                       target="_blank"
                       rel="noopener">

                        <img src="${imageUrl}"
                             alt="Attachment"
                             class="message-image">

                    </a>

                    <button type="button"
                            class="btn btn-sm btn-light share-btn"
                            data-url="${imageUrl}"
                            title="Copy link">

                        <i class="fas fa-share-alt"></i>

                    </button>

                </div>
            `;
        }


        // -----------------------------------------------------
        // VIDEO
        // -----------------------------------------------------

        let videoHtml = '';

        if (message.video_url) {

            const videoUrl =
                escapeHtml(
                    message.video_url
                );

            videoHtml = `
                <div class="media-wrap mt-1">

                    <video class="message-video"
                           controls
                           preload="metadata">

                        <source src="${videoUrl}">

                    </video>

                    <button type="button"
                            class="btn btn-sm btn-light share-btn"
                            data-url="${videoUrl}"
                            title="Copy link">

                        <i class="fas fa-share-alt"></i>

                    </button>

                </div>
            `;
        }


        // -----------------------------------------------------
        // DELETED MESSAGE
        // -----------------------------------------------------

        let messageContentHtml = '';

        if (message.is_removed) {

            messageContentHtml = `
                <em class="text-muted">
                    This message was deleted.
                </em>
            `;

        } else {

            messageContentHtml = `

                ${
                    body
                        ? `
                            <div class="mb-1">
                                ${body}
                            </div>
                          `
                        : ''
                }

                ${imageHtml}

                ${videoHtml}

                <!-- =========================================
                     REACTIONS
                ========================================== -->

                ${
                    !message.is_system
                        ? `
                            <div class="tg-reactions mt-1">

                                ${createReactionHtml(
                                    message.id,
                                    'like'
                                )}

                                ${createReactionHtml(
                                    message.id,
                                    'heart'
                                )}

                                ${
                                    isOwnMessage
                                        ? `
                                            <form method="post"
                                                  action="/messages/delete-one/${message.id}/"
                                                  class="d-inline delete-message-form"
                                                  onsubmit="return confirm('Delete this message?');">

                                                <input type="hidden"
                                                       name="csrfmiddlewaretoken"
                                                       value="${getCsrfToken()}">

                                                <button type="submit"
                                                        class="tg-reaction delete-message-reaction"
                                                        title="Delete"
                                                        aria-label="Delete message">

                                                    <span class="tg-emoji">
                                                        🗑️
                                                    </span>

                                                </button>

                                            </form>
                                          `
                                        : ''
                                }

                            </div>
                          `
                        : ''
                }

            `;
        }


        // -----------------------------------------------------
        // AVATAR HTML
        // -----------------------------------------------------

        let avatarHtml = '';

        if (isOwnMessage) {
            avatarHtml = `
                <div class="conversation-avatar">
                    <a href="/accounts/${message.sender_id}/details/">
                        <img src="${avatarUrl}"
                             class="message-avatar"
                             alt="">
                    </a>
                </div>
            `;

        } else {
            avatarHtml = `
                <div class="conversation-avatar">
                    <img src="${avatarUrl}"
                         class="message-avatar"
                         alt="">
                </div>
            `;
        }


        // -----------------------------------------------------
        // DELIVERY STATUS
        // -----------------------------------------------------

        let deliveryStatusHtml = '';

        if (isOwnMessage) {

            deliveryStatusHtml = `
                <span class="message-delivery-status"
                      title="Sent">
                    ✓
                </span>
            `;
        }


        // -----------------------------------------------------
        // COMPLETE MESSAGE
        // -----------------------------------------------------

        messageElement.innerHTML = `

            ${avatarHtml}

            <div class="conversation-message-body">

                <div class="conversation-meta">

                    <span class="conversation-name">
                        ${username}
                    </span>

                    <span class="conversation-date">
                        ${timestamp}
                    </span>

                    ${deliveryStatusHtml}

                </div>


                <div class="message-bubble">

                    ${messageContentHtml}

                </div>

            </div>

        `;


        return messageElement;
    }


    // =========================================================
    // CSRF TOKEN
    // =========================================================

    function getCsrfToken() {

        const csrfInput =
            document.querySelector(
                '#reply-form input[name="csrfmiddlewaretoken"]'
            );

        if (csrfInput) {
            return csrfInput.value;
        }

        const cookies =
            document.cookie.split(';');

        for (
            let i = 0;
            i < cookies.length;
            i++
        ) {

            const cookie =
                cookies[i].trim();

            if (
                cookie.startsWith(
                    'csrftoken='
                )
            ) {

                return decodeURIComponent(
                    cookie.substring(
                        'csrftoken='.length
                    )
                );
            }
        }

        return '';
    }


    // =========================================================
    // WEBSOCKET OPEN
    // =========================================================

    chatSocket.onopen = function () {

        console.log(
            'WebSocket: connected.'
        );
    };


    // =========================================================
    // WEBSOCKET MESSAGE
    // =========================================================

    chatSocket.onmessage = function (event) {

        console.log(
            'WebSocket: message received:',
            event.data
        );

        try {

            const data =
                JSON.parse(event.data);


            // -------------------------------------------------
            // TYPING
            // -------------------------------------------------

            if (
                data.type === 'typing'
            ) {

                if (data.is_typing) {

                    showTyping(
                        data.username
                    );

                } else {

                    hideTyping();
                }

                return;
            }


            // -------------------------------------------------
            // NEW MESSAGE
            // -------------------------------------------------
            if (data.type === 'reaction_update') {

                const messageId =
                    data.message_id;

                const reaction =
                    data.reaction;

                if (!messageId || !reaction) {
                    return;
                }

                const avatarBox =
                    document.querySelector(
                        `[data-react-avatars="${reaction}-${messageId}"]`
                    );

                const reactionButton =
                    document.querySelector(
                         `.js-react[data-msg="${messageId}"][data-reaction="${reaction}"]`
                    );

                const reactors =
                    Array.isArray(data.reactors)
                    ? data.reactors
                    : [];

    /*
     * Update reactor avatars.
     */

                if (avatarBox) {

                    avatarBox.replaceChildren();

                    reactors.forEach(function (reactor) {

                        const img =
                            document.createElement('img');

                        img.className =
                            'react-avatar';

                        img.alt =
                             reactor.username ||
                             'User';

                        img.loading =
                             'lazy';

                        img.src =
                             reactor.photo ||
                             defaultAvatar;

                        avatarBox.appendChild(img);

                    });

                }

                   /*
                    * Update tooltip.
                    */

                if (reactionButton) {

                    const names =
                        reactors
                            .map(function (reactor) {
                                return reactor.username;
                            })
                            .filter(Boolean);

                    reactionButton.title =
                        names.length
                            ? names.join(', ')
                            : (
                                reaction === 'heart'
                                    ? 'Heart'
                                    : 'Like'
                            );

                }

                return;
     }
            if (
                data.type !== 'new_message' ||
                !data.message
            ) {
                return;
            }


            hideTyping();


            const message =
                data.message;

            const wasAtBottom =
                isAtBottom();


            // -------------------------------------------------
            // AVOID DUPLICATES
            // -------------------------------------------------

            const existingMessage =
                document.getElementById(
                    `msg-${message.id}`
                );

            if (existingMessage) {
                return;
            }


            // -------------------------------------------------
            // CREATE MESSAGE
            // -------------------------------------------------

            const messageElement =
                createMessageElement(
                    message
                );


            // -------------------------------------------------
            // ADD MESSAGE
            // -------------------------------------------------

            chatMessages.appendChild(
                messageElement
            );

           const isOwnMessage =
               Number(message.sender_id) ===
               currentUserId;

           if (wasAtBottom) {

               scrollToBottom();
               clearNewMessageBadge();

           } else if (!isOwnMessage) {

               unreadNewMessages++;
               updateNewMessageBadge();

           if (scrollBottomBtn) {
               scrollBottomBtn.classList.remove(
                   'scroll-buttons-hidden'
               );
           }
     }


        } catch (error) {

            console.error(
                'WebSocket: invalid message data:',
                error
            );
        }
    };


    // =========================================================
    // WEBSOCKET CLOSE
    // =========================================================

    chatSocket.onclose = function (event) {

        console.log(
            'WebSocket: disconnected.',
            event.code,
            event.reason
        );
    };


    // =========================================================
    // WEBSOCKET ERROR
    // =========================================================

    chatSocket.onerror = function (error) {

        console.error(
            'WebSocket: error:',
            error
        );
    };

});
