document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const replyForm = document.getElementById('reply-form');

    const messageBodyField = replyForm
        ? (
            replyForm.querySelector('[name="body"]') ||
            replyForm.querySelector('textarea')
        )
        : null;

    const chatWindow =
        document.getElementById('chat-window');

    const chatMessages =
        document.getElementById('chat-messages');

    const editingBar =
        document.getElementById('editing-message-bar');

    const editingMessageId =
        document.getElementById('editing-message-id');

    const editingPreview =
        document.getElementById('editing-message-preview');

    const cancelEditBtn =
        document.getElementById('cancel-edit-btn');

    const replyBar =
        document.getElementById('replying-message-bar');

    const replyPreview =
        document.getElementById('replying-message-preview');

    const cancelReplyBtn =
        document.getElementById('cancel-reply-btn');

    const replyToInput =
        document.getElementById('reply-to');

    const replyMedia =
        document.getElementById('replying-message-media');

    const replyImage =
        document.getElementById('replying-message-image');

    const replyVideo =
        document.getElementById('replying-message-video');

    const replyVideoPlayer =
        document.getElementById(
            'replying-message-video-player'
        );

    const submitBtn =
        document.getElementById('message-submit-btn');

    const normalFormAction = replyForm
        ? (
            replyForm.dataset.sendUrl ||
            replyForm.getAttribute('action') ||
            window.location.href
        )
        : window.location.href;

    let isSubmittingEdit = false;
    let isSubmittingMessage = false;

    let activeMessageSendToken = 0;

    const pendingMessageRefreshes = new Map();


    /* =========================================================
       NAVIGATION API
       ========================================================= */

    function isChatAtBottom() {
        if (
            window.agroChatNavigation &&
            typeof window.agroChatNavigation.isAtBottom ===
                'function'
        ) {
            return window.agroChatNavigation.isAtBottom();
        }

        if (!chatWindow) {
            return true;
        }

        return (
            chatWindow.scrollTop +
            chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight - 50
        );
    }


    /* =========================================================
       CSRF
       ========================================================= */

    function getCsrfToken() {
        const csrfInput = replyForm
            ? replyForm.querySelector(
                '[name="csrfmiddlewaretoken"]'
            )
            : document.querySelector(
                '[name="csrfmiddlewaretoken"]'
            );

        return csrfInput
            ? csrfInput.value
            : '';
    }


    /* =========================================================
       MESSAGE HELPERS
       ========================================================= */

    function getMessageElement(messageId) {
        return messageId
            ? document.getElementById(
                `msg-${messageId}`
            )
            : null;
    }

    function getMessageIdFromElement(element) {
        if (!element) {
            return null;
        }

        if (element.dataset.messageId) {
            const id =
                Number(element.dataset.messageId);

            if (id) {
                return id;
            }
        }

        const rawId =
            element.id || '';

        if (rawId.startsWith('msg-')) {
            const id =
                Number(
                    rawId.substring(4)
                );

            if (id) {
                return id;
            }
        }

        const child =
            element.querySelector(
                '[data-message-id]'
            );

        if (child) {
            const id =
                Number(
                    child.dataset.messageId
                );

            if (id) {
                return id;
            }
        }

        return null;
    }

    function removeEmptyConversationMessage() {
        if (!chatMessages) {
            return;
        }

        chatMessages
            .querySelectorAll(
                '.alert.alert-info'
            )
            .forEach(function (el) {
                el.remove();
            });
    }


    /* =========================================================
       RENDER MESSAGE
       ========================================================= */

    function appendRenderedMessage(
        html,
        messageId,
        shouldScroll = true
    ) {
        if (
            !chatMessages ||
            !html ||
            !messageId
        ) {
            return false;
        }

        if (
            getMessageElement(messageId)
        ) {
            return false;
        }

        removeEmptyConversationMessage();

        const computedStyle =
            window.getComputedStyle(
                chatMessages
            );

        const isColumnReverse =
            computedStyle.flexDirection ===
            'column-reverse';

        /*
         * Current chat order is normally ascending
         * in the DOM:
         *
         * oldest
         * ...
         * newest
         *
         * Therefore normal flex direction uses beforeend.
         *
         * Keep column-reverse compatibility for old layouts.
         */
        if (isColumnReverse) {
            chatMessages.insertAdjacentHTML(
                'afterbegin',
                html
            );
        } else {
            chatMessages.insertAdjacentHTML(
                'beforeend',
                html
            );
        }

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
         * - scroll-to-bottom
         * - unread counter
         * - latest button
         *
         * We only notify it that the message exists.
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


    /* =========================================================
       MESSAGE FRAGMENT
       ========================================================= */

    function getMessageFragmentUrl(messageId) {
        if (
            !chatWindow ||
            !messageId
        ) {
            return null;
        }

        const template =
            chatWindow.dataset.messageFragmentUrl;

        if (!template) {
            console.error(
                'data-message-fragment-url is missing.'
            );

            return null;
        }

        try {
            const url =
                new URL(
                    template,
                    window.location.origin
                );

            url.pathname =
                url.pathname.replace(
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

        const response =
            await fetch(
                fragmentUrl,
                {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        'X-Requested-With':
                            'XMLHttpRequest',
                        'Accept':
                            'application/json'
                    }
                }
            );

        let data;

        try {
            data =
                await response.json();

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


    /* =========================================================
       MESSAGE REFRESH
       ========================================================= */

    async function performMessageFragmentRefresh(
        id,
        options = {}
    ) {
        const preserveScroll =
            options.preserveScroll !== false;

        const oldScrollTop =
            chatWindow
                ? chatWindow.scrollTop
                : 0;

        const data =
            await fetchMessageFragment(id);

        const currentMessage =
            getMessageElement(id);

        /*
         * If the message disappeared while the request
         * was running, render the returned fragment again.
         */
        if (!currentMessage) {
            return appendRenderedMessage(
                data.html,
                data.message_id || id,
                false
            );
        }

        const wrapper =
            document.createElement('div');

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

        /*
         * Full message refreshes preserve the user's
         * current scroll position.
         *
         * Reaction clicks NEVER use this function.
         */
        if (
            preserveScroll &&
            chatWindow
        ) {
            chatWindow.scrollTop =
                oldScrollTop;

            chatWindow.dispatchEvent(
                new Event('scroll')
            );
        }

        return true;
    }

    function refreshMessageFragment(
        messageId,
        options = {}
    ) {
        const id =
            Number(messageId);

        if (!id) {
            return Promise.resolve(false);
        }

        /*
         * Serialize refreshes for the same message.
         *
         * This prevents two fast full-message updates
         * from racing and rendering an older response last.
         */
        const previous =
            pendingMessageRefreshes.get(id) ||
            Promise.resolve();

        const next =
            previous
                .catch(() => {})
                .then(() =>
                    performMessageFragmentRefresh(
                        id,
                        options
                    )
                );

        let trackedPromise;

        trackedPromise =
            next.finally(function () {
                if (
                    pendingMessageRefreshes.get(id) ===
                    trackedPromise
                ) {
                    pendingMessageRefreshes.delete(id);
                }
            });

        pendingMessageRefreshes.set(
            id,
            trackedPromise
        );

        return trackedPromise;
    }

    async function replaceMessageWithFragment(
        messageId
    ) {
        return refreshMessageFragment(
            messageId,
            {
                preserveScroll: true
            }
        );
    }


    /* =========================================================
       PUBLIC CONVERSATION API
       ========================================================= */

    /*
     * chat_attachments.js uses this API after its own
     * attachment upload succeeds.
     *
     * IMPORTANT:
     * Attachment upload is NOT implemented here.
     * chat_attachments.js owns it.
     */
    window.agroChatConversation = {
        appendRenderedMessage,
        refreshMessageFragment,
        isChatAtBottom
        resetComposerAfterSend
    };


    /* =========================================================
       SEND URL
       ========================================================= */

    function getSendUrl() {
        if (!replyForm) {
            return null;
        }

        return (
            replyForm.dataset.sendUrl ||
            replyForm.getAttribute('action') ||
            normalFormAction
        );
    }


    /* =========================================================
       REPLY MEDIA
       ========================================================= */

    function clearReplyMedia() {
        if (replyMedia) {
            replyMedia.classList.add(
                'd-none'
            );
        }

        if (replyImage) {
            replyImage.classList.add(
                'd-none'
            );

            replyImage.removeAttribute(
                'src'
            );
        }

        if (replyVideo) {
            replyVideo.classList.add(
                'd-none'
            );
        }

        if (replyVideoPlayer) {
            replyVideoPlayer.pause();

            replyVideoPlayer.removeAttribute(
                'src'
            );

            replyVideoPlayer.load();
        }
    }

    function setReplyMedia(
        imageUrl,
        videoUrl
    ) {
        clearReplyMedia();

        if (
            imageUrl &&
            replyMedia &&
            replyImage
        ) {
            replyImage.src =
                imageUrl;

            replyImage.classList.remove(
                'd-none'
            );

            replyMedia.classList.remove(
                'd-none'
            );

            return;
        }

        if (
            videoUrl &&
            replyMedia &&
            replyVideo &&
            replyVideoPlayer
        ) {
            replyVideoPlayer.src =
                videoUrl;

            replyVideoPlayer.load();

            replyVideo.classList.remove(
                'd-none'
            );

            replyMedia.classList.remove(
                'd-none'
            );
        }
    }


    /* =========================================================
       COMPOSER RESET
       ========================================================= */

    function resetComposerAfterSend() {
        if (messageBodyField) {
            messageBodyField.value = '';
            messageBodyField.style.height = 'auto';
            messageBodyField.style.overflowY = 'hidden';
        }

        if (replyToInput) {
            replyToInput.value = '';
        }

        clearReplyMedia();

        /*
         * Attachment state belongs to chat_attachments.js.
         *
         * Do not manipulate:
         * - id_image
         * - id_video
         * - id_file
         * - attachment previews
         * - object URLs
         * - upload progress
         *
         * here.
         */
        if (
            window.agroChatAttachments &&
            typeof window.agroChatAttachments.clear ===
                'function'
        ) {
            window.agroChatAttachments.clear();
        }

        if (editingMessageId) {
            editingMessageId.value = '';
        }

        if (editingBar) {
            editingBar.classList.add(
                'd-none'
            );
        }

        if (replyBar) {
            replyBar.classList.add(
                'd-none'
            );
        }

        if (replyForm) {
            replyForm.setAttribute(
                'action',
                normalFormAction
            );
        }

        setSubmitMode('send');
    }


    /* =========================================================
       SUBMIT BUTTON
       ========================================================= */

    function setSubmitMode(mode) {
        if (!submitBtn) {
            return;
        }

        const isEditMode =
            mode === 'edit';

        /*
         * Edit and reply are normal form submissions.
         *
         * voice_recorder.js changes the button to
         * type="button" when it is acting as a microphone.
         *
         * When entering edit/reply mode we must explicitly
         * restore submit behaviour.
         */
        submitBtn.type =
            'submit';

        submitBtn.disabled =
            false;

        submitBtn.innerHTML =
            isEditMode
                ? (
                    '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                    '<span id="message-submit-text">Save</span>'
                )
                : (
                    '<i class="fas fa-paper-plane me-1" id="message-submit-icon"></i>' +
                    '<span id="message-submit-text">Send</span>'
                );
    }

    function setSendingState(isSending) {
        if (!submitBtn) {
            return;
        }

        if (isSending) {
            submitBtn.disabled = true;

            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>' +
                '<span class="chat-submit-status">Sending...</span>';

            return;
        }

        submitBtn.disabled = false;

        /*
         * setSendingState(true) replaces innerHTML,
         * so the original child references no longer exist.
         *
         * Rebuild the button instead of trying to reuse
         * detached DOM references.
         */
        if (
            editingMessageId &&
            editingMessageId.value
        ) {
            submitBtn.innerHTML =
                '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                '<span id="message-submit-text">Save</span>';

            return;
        }

        submitBtn.innerHTML =
            '<i class="fas fa-paper-plane me-1" id="message-submit-icon"></i>' +
            '<span id="message-submit-text">Send</span>';
    }

    function setSavingState(isSaving) {
        if (!submitBtn) {
            return;
        }

        if (isSaving) {
            submitBtn.disabled = true;

            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>' +
                '<span class="chat-submit-status">Saving...</span>';

            return;
        }

        submitBtn.disabled = false;

        /*
         * setSavingState(true) replaces innerHTML,
         * so rebuild the button after saving.
         */
        if (
            editingMessageId &&
            editingMessageId.value
        ) {
            submitBtn.innerHTML =
                '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                '<span id="message-submit-text">Save</span>';

            return;
        }

        submitBtn.innerHTML =
            '<i class="fas fa-paper-plane me-1" id="message-submit-icon"></i>' +
            '<span id="message-submit-text">Send</span>';
    }


    /* =========================================================
       WEBSOCKET MESSAGE ACKNOWLEDGEMENT
       ========================================================= */

    function handleMessageAcknowledged(event) {
        const detail =
            event.detail || {};

        const messageId =
            Number(detail.messageId);

        if (
            !messageId ||
            !isSubmittingMessage
        ) {
            return;
        }

        /*
         * WebSocket has confirmed that the message exists.
         *
         * Do not wait for the HTTP response to remove
         * the Sending state.
         */
        isSubmittingMessage = false;
        activeMessageSendToken += 1;
        setSendingState(false);

        resetComposerAfterSend();

        window.dispatchEvent(
            new CustomEvent('agro:message-sent')
        );
    }

    window.addEventListener(
        'agro:message-acknowledged',
        handleMessageAcknowledged
    );


    /* =========================================================
       MESSAGE PREVIEW
       ========================================================= */

    function getMessagePreview(text) {
        let preview =
            (text || '').trim();

        if (preview.length > 100) {
            preview =
                preview.substring(0, 100) +
                '...';
        }

        return preview;
    }


    /* =========================================================
       EDIT MODE
       ========================================================= */

    function startEdit(button) {
        if (
            !replyForm ||
            !messageBodyField ||
            !editingMessageId
        ) {
            return;
        }

        const messageId =
            button.dataset.messageId;

        const editUrl =
            button.dataset.editUrl;

        const messageBody =
            button.dataset.messageBody ||
            '';

        if (
            !messageId ||
            !editUrl
        ) {
            return;
        }

        /*
         * Attachments are owned by chat_attachments.js.
         * Clear them through its public API.
         */
        if (
            window.agroChatAttachments &&
            typeof window.agroChatAttachments.clear ===
                'function'
        ) {
            window.agroChatAttachments.clear();
        }

        if (replyToInput) {
            replyToInput.value = '';
        }

        if (replyBar) {
            replyBar.classList.add(
                'd-none'
            );
        }

        clearReplyMedia();

        messageBodyField.value =
            messageBody;

        editingMessageId.value =
            messageId;

        replyForm.setAttribute(
            'action',
            editUrl
        );

        if (editingBar) {
            editingBar.classList.remove(
                'd-none'
            );
        }

        if (editingPreview) {
            editingPreview.textContent =
                getMessagePreview(
                    messageBody
                ) ||
                'Edit your message';
        }

        setSubmitMode('edit');

        messageBodyField.focus();

        try {
            const length =
                messageBodyField.value.length;

            messageBodyField.setSelectionRange(
                length,
                length
            );
        } catch (e) {}

        replyForm.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function cancelEdit(options = {}) {
        const clearBody =
            options.clearBody !== false;

        if (editingMessageId) {
            editingMessageId.value =
                '';
        }

        if (editingBar) {
            editingBar.classList.add(
                'd-none'
            );
        }

        if (replyForm) {
            replyForm.setAttribute(
                'action',
                normalFormAction
            );
        }

        setSubmitMode('send');

        if (
            clearBody &&
            messageBodyField
        ) {
            messageBodyField.value = '';
        }

        if (replyToInput) {
            replyToInput.value = '';
        }

        clearReplyMedia();
    }


    /* =========================================================
       REPLY MODE
       ========================================================= */

    function startReply(button) {
        if (
            !replyForm ||
            !messageBodyField
        ) {
            return;
        }

        const messageId =
            button.dataset.messageId;

        const messageBody =
            button.dataset.messageBody ||
            '';

        const imageUrl =
            button.dataset.replyImage ||
            '';

        const videoUrl =
            button.dataset.replyVideo ||
            '';

        if (!messageId) {
            return;
        }

        if (editingMessageId) {
            editingMessageId.value =
                '';
        }

        if (editingBar) {
            editingBar.classList.add(
                'd-none'
            );
        }

        replyForm.setAttribute(
            'action',
            normalFormAction
        );

        if (replyToInput) {
            replyToInput.value =
                messageId;
        }

        if (replyPreview) {
            replyPreview.textContent =
                getMessagePreview(
                    messageBody
                ) ||
                (
                    imageUrl
                        ? 'Photo'
                        : videoUrl
                            ? 'Video'
                            : 'Reply to this message'
                );
        }

        setReplyMedia(
            imageUrl,
            videoUrl
        );

        if (replyBar) {
            replyBar.classList.remove(
                'd-none'
            );
        }

        setSubmitMode('send');

        messageBodyField.focus();

        replyForm.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function cancelReply(options = {}) {
        const clearBody =
            options.clearBody !== false;

        if (replyToInput) {
            replyToInput.value = '';
        }

        if (replyBar) {
            replyBar.classList.add(
                'd-none'
            );
        }

        clearReplyMedia();

        if (
            clearBody &&
            messageBodyField
        ) {
            messageBodyField.value = '';
        }
    }


    /* =========================================================
       EDIT / REPLY BUTTONS
       ========================================================= */

    document.addEventListener(
        'click',
        function (e) {
            const button =
                e.target.closest(
                    '.edit-message-side-btn'
                );

            if (!button) {
                return;
            }

            e.preventDefault();

            if (
                isSubmittingEdit ||
                isSubmittingMessage
            ) {
                return;
            }

            startEdit(button);
        }
    );

    document.addEventListener(
        'click',
        function (e) {
            const button =
                e.target.closest(
                    '.reply-message-side-btn'
                );

            if (!button) {
                return;
            }

            e.preventDefault();

            if (
                isSubmittingEdit ||
                isSubmittingMessage
            ) {
                return;
            }

            startReply(button);
        }
    );


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    document.addEventListener(
        'submit',
        async function (event) {
            const form =
                event.target.closest(
                    '.delete-message-form'
                );

            if (!form) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (
                typeof event.stopImmediatePropagation ===
                'function'
            ) {
                event.stopImmediatePropagation();
            }

            if (
                form.dataset.loading === '1'
            ) {
                return;
            }

            const messageElement =
                form.closest(
                    '.conversation-message'
                );

            if (!messageElement) {
                console.error(
                    'Delete: conversation-message element not found.'
                );

                return;
            }

            const messageId =
                getMessageIdFromElement(
                    messageElement
                );

            if (!messageId) {
                console.error(
                    'Delete: message ID not found.'
                );

                return;
            }

            const deleteUrl =
                form.getAttribute('action');

            if (!deleteUrl) {
                console.error(
                    'Delete: form action is missing.'
                );

                return;
            }

            const csrfToken =
                getCsrfToken();

            if (!csrfToken) {
                console.error(
                    'Delete: CSRF token not found.'
                );

                alert(
                    'CSRF token not found. Please refresh the page.'
                );

                return;
            }

            if (
                !window.confirm(
                    'Are you sure you want to delete this message?'
                )
            ) {
                return;
            }

            form.dataset.loading = '1';

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {
                submitButton.disabled =
                    true;
            }

            const oldScrollTop =
                chatWindow
                    ? chatWindow.scrollTop
                    : 0;

            try {
                const formData =
                    new FormData(form);

                const response =
                    await fetch(
                        deleteUrl,
                        {
                            method: 'POST',
                            body: formData,
                            credentials: 'same-origin',
                            headers: {
                                'X-Requested-With':
                                    'XMLHttpRequest',
                                'Accept':
                                    'application/json'
                            }
                        }
                    );

                const responseText =
                    await response.text();

                let data = null;

                if (responseText) {
                    try {
                        data =
                            JSON.parse(
                                responseText
                            );
                    } catch (jsonError) {
                        console.error(
                            'Delete: server did not return JSON:',
                            responseText
                        );
                    }
                }

                if (!response.ok) {
                    throw new Error(
                        (data && data.error) ||
                        `Unable to delete message (${response.status}).`
                    );
                }

                if (
                    data &&
                    data.ok === false
                ) {
                    throw new Error(
                        data.error ||
                        'Unable to delete message.'
                    );
                }

                console.log(
                    'Message deleted successfully:',
                    messageId
                );

                if (chatWindow) {
                    chatWindow.scrollTop =
                        oldScrollTop;

                    chatWindow.dispatchEvent(
                        new Event('scroll')
                    );
                }

            } catch (error) {
                console.error(
                    'Delete message error:',
                    error
                );

                alert(
                    error.message ||
                    'Unable to delete message.'
                );

            } finally {
                form.dataset.loading =
                    '0';

                if (
                    submitButton &&
                    submitButton.isConnected
                ) {
                    submitButton.disabled =
                        false;
                }
            }
        }
    );


    /* =========================================================
       CANCEL EDIT / REPLY
       ========================================================= */

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener(
            'click',
            function (e) {
                e.preventDefault();
                cancelEdit();
            }
        );
    }

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener(
            'click',
            function (e) {
                e.preventDefault();
                cancelReply();
            }
        );
    }


    /* =========================================================
       EDIT AJAX
       ========================================================= */

    async function handleEditSubmit(event) {
        event.preventDefault();

        if (
            isSubmittingEdit ||
            !replyForm ||
            !editingMessageId ||
            !messageBodyField
        ) {
            return;
        }

        const messageId =
            editingMessageId.value;

        const editUrl =
            replyForm.getAttribute(
                'action'
            );

        const body =
            messageBodyField.value.trim();

        if (!messageId) {
            return;
        }

        if (!editUrl) {
            alert(
                'Edit URL is missing.'
            );

            return;
        }

        if (!body) {
            alert(
                'Message cannot be empty.'
            );

            messageBodyField.focus();

            return;
        }

        /*
         * Editing a message must never carry an attachment.
         * Attachment cleanup is delegated to chat_attachments.js.
         */
        if (
            window.agroChatAttachments &&
            typeof window.agroChatAttachments.clear ===
                'function'
        ) {
            window.agroChatAttachments.clear();
        }

        if (replyToInput) {
            replyToInput.value = '';
        }

        const formData =
            new FormData();

        formData.append(
            'body',
            body
        );

        const csrfToken =
            getCsrfToken();

        if (csrfToken) {
            formData.append(
                'csrfmiddlewaretoken',
                csrfToken
            );
        }

        isSubmittingEdit = true;

        setSavingState(true);

        try {
            const response =
                await fetch(
                    editUrl,
                    {
                        method: 'POST',
                        body: formData,
                        credentials: 'same-origin',
                        headers: {
                            'X-Requested-With':
                                'XMLHttpRequest',
                            'Accept':
                                'application/json'
                        }
                    }
                );

            let data;

            try {
                data =
                    await response.json();

            } catch (jsonError) {
                throw new Error(
                    `Invalid server response (${response.status}).`
                );
            }

            if (
                !response.ok ||
                !data.ok
            ) {
                throw new Error(
                    data.error ||
                    'Unable to edit message.'
                );
            }

            await replaceMessageWithFragment(
                data.message_id ||
                messageId
            );

            document
                .querySelectorAll(
                    '.edit-message-side-btn, .reply-message-side-btn'
                )
                .forEach(function (btn) {
                    if (
                        btn.dataset.messageId ===
                        String(messageId)
                    ) {
                        btn.dataset.messageBody =
                            body;
                    }
                });

            cancelEdit({
                clearBody: true
            });

            window.dispatchEvent(
                new CustomEvent('agro:message-sent')
            );

        } catch (error) {
            console.error(
                'Edit message error:',
                error
            );

            alert(
                error.message ||
                'Unable to edit message.'
            );

        } finally {
            isSubmittingEdit = false;

            setSavingState(false);
        }
    }


    /* =========================================================
       TEXT MESSAGE AJAX
       ========================================================= */

    async function handleTextMessageSubmit(event) {
        event.preventDefault();

        if (
            isSubmittingMessage ||
            isSubmittingEdit ||
            !replyForm
        ) {
            return;
        }

        const sendUrl =
            getSendUrl();

        if (!sendUrl) {
            alert(
                'Message send URL is missing.'
            );

            return;
        }

        const body =
            messageBodyField
                ? messageBodyField.value.trim()
                : '';

        const audioInput =
            replyForm.querySelector(
                '[name="audio"]'
            );

        const hasAudioAttachment = Boolean(
            audioInput &&
            audioInput.files &&
            audioInput.files.length
        );

        /*
         * Attachment submit is owned by chat_attachments.js.
         *
         * Its submit listener runs in capture phase and
         * intercepts normal attachment submissions before this
         * function reaches the network.
         *
         * Audio is different:
         * voice_recorder.js creates the audio input dynamically
         * and audio is sent directly with this FormData request.
         */
        if (
            window.agroChatAttachments &&
            typeof window.agroChatAttachments.hasAttachment ===
                'function' &&
            window.agroChatAttachments.hasAttachment()
        ) {
            return;
        }

        if (
            !body &&
            !hasAudioAttachment
        ) {
            if (messageBodyField) {
                messageBodyField.focus();
            }

            return;
        }

        const shouldScroll =
            isChatAtBottom();

        const formData =
            new FormData(replyForm);

        isSubmittingMessage = true;

        const sendToken =
            ++activeMessageSendToken;

        setSendingState(true);

        try {
            const response =
                await fetch(
                    sendUrl,
                    {
                        method: 'POST',
                        body: formData,
                        credentials: 'same-origin',
                        headers: {
                            'X-Requested-With':
                                'XMLHttpRequest',
                            'Accept':
                                'application/json'
                        }
                    }
                );

            const responseText =
                await response.text();

            let data = null;

            if (responseText) {
                try {
                    data =
                        JSON.parse(
                            responseText
                        );
                } catch (jsonError) {
                    console.warn(
                        'Send message: invalid JSON response:',
                        responseText
                    );
                }
            }

            if (!response.ok) {
                throw new Error(
                    (data && data.error) ||
                    `Unable to send message (${response.status}).`
                );
            }

            if (
                data &&
                data.ok === false
            ) {
                throw new Error(
                    data.error ||
                    'Unable to send message.'
                );
            }

            /*
             * If HTTP returned the rendered message,
             * render it immediately.
             *
             * If WebSocket already rendered it,
             * appendRenderedMessage() detects the duplicate.
             */
            if (
                data &&
                data.html &&
                data.message_id
            ) {
                appendRenderedMessage(
                    data.html,
                    data.message_id,
                    shouldScroll
                );
            }

            window.dispatchEvent(
                new CustomEvent(
                    'agro:message-sent'
                )
            );

            resetComposerAfterSend();

        } catch (error) {
            console.error(
                'Send message error:',
                error
            );

            alert(
                error.message ||
                'Unable to send message.'
            );

        } finally {
            /*
             * If WebSocket acknowledgement already finished
             * this send, don't let an older HTTP request reset
             * a newer sending state.
             */
            if (
                activeMessageSendToken ===
                sendToken
            ) {
                isSubmittingMessage =
                    false;

                setSendingState(false);
            }
        }
    }


    /* =========================================================
       FORM SUBMIT
       ========================================================= */

    if (replyForm) {
        replyForm.addEventListener(
            'submit',
            function (e) {
                /*
                 * chat_attachments.js owns attachment submits
                 * and listens in capture phase.
                 *
                 * If an attachment exists, that controller
                 * will stop this event before it reaches here.
                 */

                if (
                    isSubmittingEdit ||
                    isSubmittingMessage
                ) {
                    e.preventDefault();
                    return;
                }

                if (
                    editingMessageId &&
                    editingMessageId.value
                ) {
                    handleEditSubmit(e);
                    return;
                }

                handleTextMessageSubmit(e);
            }
        );
    }


    /* =========================================================
       SHARE MEDIA
       ========================================================= */

    document.addEventListener(
        'click',
        async function (e) {
            const button =
                e.target.closest(
                    '.media-share-btn, .share-btn'
                );

            if (!button) {
                return;
            }

            const url =
                button.dataset.url;

            if (!url) {
                return;
            }

            e.preventDefault();

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Shared media',
                        text: 'Check this out',
                        url
                    });

                    return;

                } catch (err) {
                    if (
                        err &&
                        err.name === 'AbortError'
                    ) {
                        return;
                    }
                }
            }

            try {
                if (
                    navigator.clipboard &&
                    window.isSecureContext
                ) {
                    await navigator.clipboard.writeText(
                        url
                    );

                    const oldHtml =
                        button.innerHTML;

                    button.innerHTML =
                        '✓';

                    setTimeout(
                        function () {
                            button.innerHTML =
                                oldHtml;
                        },
                        1200
                    );

                    return;
                }

            } catch (err) {
                console.error(
                    'Clipboard failed:',
                    err
                );
            }

            const textarea =
                document.createElement(
                    'textarea'
                );

            textarea.value =
                url;

            textarea.style.cssText =
                'position:fixed;left:-9999px;top:-9999px;opacity:0';

            document.body.appendChild(
                textarea
            );

            textarea.focus();
            textarea.select();

            try {
                document.execCommand(
                    'copy'
                );
            } catch (err) {
                console.error(
                    'Copy failed:',
                    err
                );
            }

            textarea.remove();
        }
    );


    /* =========================================================
       REACTIONS
       ========================================================= */

    const defaultAvatar =
        chatWindow?.dataset.defaultAvatar ||
        '';

    function getReactionUrl(button) {
        if (!button) {
            return null;
        }

        const href =
            button.getAttribute('href');

        if (href) {
            return href;
        }

        const messageElement =
            button.closest(
                '.conversation-message'
            );

        const messageId =
            button.dataset.msg ||
            getMessageIdFromElement(
                messageElement
            );

        const reaction =
            button.dataset.reaction;

        if (
            !messageId ||
            !reaction
        ) {
            return null;
        }

        const template =
            chatWindow?.dataset.reactionUrl;

        if (!template) {
            return null;
        }

        try {
            const url =
                new URL(
                    template,
                    window.location.origin
                );

            url.pathname =
                url.pathname.replace(
                    /\/0\/REACTION\/?$/,
                    `/${encodeURIComponent(messageId)}/${encodeURIComponent(reaction)}/`
                );

            return url.toString();

        } catch (error) {
            console.error(
                'Unable to build reaction URL:',
                error
            );

            return null;
        }
    }

    function findReactionAvatarBox(
        button,
        reaction,
        messageId
    ) {
        if (!button) {
            return null;
        }

        let avatarBox =
            button.querySelector(
                '[data-react-avatars]'
            );

        if (avatarBox) {
            return avatarBox;
        }

        if (
            !reaction ||
            !messageId
        ) {
            return null;
        }

        for (
            const box of
            document.querySelectorAll(
                '[data-react-avatars]'
            )
        ) {
            if (
                box.dataset.reactAvatars ===
                `${reaction}-${messageId}`
            ) {
                return box;
            }
        }

        return null;
    }

    function updateReactionUI(
        button,
        data
    ) {
        if (!button) {
            return;
        }

        const reaction =
            data.reaction ||
            button.dataset.reaction ||
            '';

        const active =
            Boolean(data.active);

        button.classList.toggle(
            'active-like',
            reaction === 'like' &&
            active
        );

        button.classList.toggle(
            'active-heart',
            reaction === 'heart' &&
            active
        );

        button.setAttribute(
            'aria-pressed',
            active
                ? 'true'
                : 'false'
        );

        const messageElement =
            button.closest(
                '.conversation-message'
            );

        const messageId =
            data.message_id ||
            button.dataset.msg ||
            getMessageIdFromElement(
                messageElement
            );

        const avatarBox =
            findReactionAvatarBox(
                button,
                reaction,
                messageId
            );

        if (avatarBox) {
            avatarBox.replaceChildren();

            (
                Array.isArray(
                    data.reactors
                )
                    ? data.reactors
                    : []
            ).forEach(
                function (reactor) {
                    const img =
                        document.createElement(
                            'img'
                        );

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

                    avatarBox.appendChild(
                        img
                    );
                }
            );
        }

        if (
            Array.isArray(
                data.reactors
            )
        ) {
            const names =
                data.reactors
                    .map(
                        r => r.username
                    )
                    .filter(Boolean);

            button.title =
                names.length
                    ? names.join(', ')
                    : (
                        reaction === 'heart'
                            ? 'Heart'
                            : 'Like'
                    );
        }
    }


    /*
     * =========================================================
     * REACTION CLICK
     * =========================================================
     *
     * IMPORTANT:
     *
     * A reaction changes ONLY reaction state.
     *
     * NEVER call refreshMessageFragment() here.
     *
     * refreshMessageFragment() replaces the complete
     * .conversation-message DOM node, which would:
     *
     * - recreate <video>
     * - reset video.currentTime
     * - restart preview
     * - blink text messages
     * - recreate images/media
     *
     * The local response already contains the new
     * reaction state, so updateReactionUI() is enough.
     *
     * WebSocket reaction_updated/message_reacted events
     * are handled by chat_controller.js and use the
     * reaction-only refreshMessageReactions() function.
     */
    document.addEventListener(
        'click',
        async function (e) {
            const button =
                e.target.closest(
                    '.js-react'
                );

            if (!button) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (
                button.dataset.loading ===
                '1'
            ) {
                return;
            }

            const messageElement =
                button.closest(
                    '.conversation-message'
                );

            if (!messageElement) {
                return;
            }

            const messageId =
                getMessageIdFromElement(
                    messageElement
                );

            if (!messageId) {
                return;
            }

            const csrfToken =
                getCsrfToken();

            if (!csrfToken) {
                console.error(
                    'CSRF token not found.'
                );

                return;
            }

            const reaction =
                button.dataset.reaction ||
                '';

            if (!reaction) {
                console.error(
                    'Reaction type is missing.'
                );

                return;
            }

            const url =
                getReactionUrl(button);

            if (!url) {
                console.error(
                    'Reaction URL not found.'
                );

                return;
            }

            button.dataset.loading =
                '1';

            button.disabled =
                true;

            try {
                const response =
                    await fetch(
                        url,
                        {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'X-Requested-With':
                                    'XMLHttpRequest',
                                'Accept':
                                    'application/json',
                                'X-CSRFToken':
                                    csrfToken
                            }
                        }
                    );

                let data;

                try {
                    data =
                        await response.json();

                } catch (jsonError) {
                    throw new Error(
                        `Invalid reaction response (${response.status}).`
                    );
                }

                if (
                    !response.ok ||
                    !data.ok
                ) {
                    throw new Error(
                        data.error ||
                        `Reaction failed (${response.status}).`
                    );
                }

                /*
                 * IMPORTANT:
                 *
                 * Update ONLY the clicked reaction.
                 *
                 * Do NOT refresh the whole message.
                 *
                 * The video element remains the exact same
                 * DOM node and therefore keeps:
                 *
                 * - currentTime
                 * - playback state
                 * - preview state
                 * - muted state
                 * - controls state
                 */
                updateReactionUI(
                    button,
                    data
                );

            } catch (error) {
                console.error(
                    'Reaction error:',
                    error
                );

                /*
                 * If the POST failed, synchronize ONLY
                 * the reaction area with the server.
                 *
                 * Never fall back to refreshMessageFragment()
                 * because that would recreate the video/message.
                 */
                try {
                    if (
                        window.agroChatController &&
                        typeof window.agroChatController
                            .refreshMessageReactions ===
                            'function'
                    ) {
                        await window.agroChatController
                            .refreshMessageReactions(
                                messageId
                            );
                    }

                } catch (refreshError) {
                    console.error(
                        'Unable to restore reaction state:',
                        refreshError
                    );
                }

            } finally {
                button.dataset.loading =
                    '0';

                button.disabled =
                    false;

                /*
                 * The reaction-only WebSocket refresh may have
                 * replaced the reaction button while the request
                 * was running, so always find the current message
                 * again before re-enabling its reaction buttons.
                 */
                const currentMessage =
                    getMessageElement(
                        messageId
                    );

                if (currentMessage) {
                    currentMessage
                        .querySelectorAll(
                            '.js-react'
                        )
                        .forEach(
                            function (btn) {
                                btn.disabled =
                                    false;

                                btn.dataset.loading =
                                    '0';
                            }
                        );
                }
            }
        }
    );


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        'beforeunload',
        function () {
            /*
             * No attachment/object-URL cleanup here.
             *
             * chat_attachments.js owns attachment previews
             * and their object URLs.
             *
             * conversation.js only owns conversation state.
             */
        }
    );
});
