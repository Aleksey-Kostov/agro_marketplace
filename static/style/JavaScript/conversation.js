document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /* =========================================================
       ELEMENTS
    ========================================================== */

    const replyForm = document.getElementById('reply-form');

    const messageBodyField = replyForm
        ? replyForm.querySelector(
            'textarea[name="body"], input[name="body"]'
        )
        : null;

    const imageInput = document.getElementById('id_image');
    const videoInput = document.getElementById('id_video');

    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');

    const imagePreviewWrap =
        document.getElementById('image-preview-wrap');

    const videoPreviewWrap =
        document.getElementById('video-preview-wrap');

    const attachImageBtn =
        document.getElementById('attach-image-btn');

    const attachVideoBtn =
        document.getElementById('attach-video-btn');

    const removeMediaBtn =
        document.getElementById('remove-media-btn');

    const chatWindow =
        document.getElementById('chat-window');

    const chatMessages =
        document.getElementById('chat-messages');

    const dropOverlay =
        document.getElementById('chat-drop-overlay');

    const scrollTopBtn =
        document.getElementById('scroll-top-btn');

    const scrollBottomBtn =
        document.getElementById('scroll-bottom-btn');

    const uploadProgressWrap =
        document.getElementById('upload-progress-wrap');

    const uploadProgressBar =
        document.getElementById('upload-progress-bar');

    const uploadProgressText =
        document.getElementById('upload-progress-text');

    const uploadProgressPercent =
        document.getElementById('upload-progress-percent');


    /* =========================================================
       EDIT
    ========================================================== */

    const editingBar =
        document.getElementById('editing-message-bar');

    const editingMessageId =
        document.getElementById('editing-message-id');

    const editingPreview =
        document.getElementById('editing-message-preview');

    const cancelEditBtn =
        document.getElementById('cancel-edit-btn');


    /* =========================================================
       REPLY
    ========================================================== */

    const replyBar =
        document.getElementById('replying-message-bar');

    const replyPreview =
        document.getElementById('replying-message-preview');

    const cancelReplyBtn =
        document.getElementById('cancel-reply-btn');

    const replyToInput =
        document.getElementById('reply-to');


    /* =========================================================
       REPLY MEDIA
    ========================================================== */

    const replyMedia =
        document.getElementById('replying-message-media');

    const replyImage =
        document.getElementById('replying-message-image');

    const replyVideo =
        document.getElementById('replying-message-video');

    const replyVideoPlayer =
        document.getElementById('replying-message-video-player');


    /* =========================================================
       SUBMIT
    ========================================================== */

    const submitBtn =
        document.getElementById('message-submit-btn');

    const submitText =
        document.getElementById('message-submit-text');

    const submitIcon =
        document.getElementById('message-submit-icon');


    /* =========================================================
       CONSTANTS
    ========================================================== */

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

    const SCROLL_EPSILON = 2;
    const SCROLL_BUTTON_HIDE_DELAY = 2000;

    const WEBSOCKET_RECONNECT_DELAY = 3000;


    /* =========================================================
       FORM URL
    ========================================================== */

    const normalFormAction = replyForm
        ? (
            replyForm.dataset.sendUrl ||
            replyForm.getAttribute('action') ||
            window.location.href
        )
        : window.location.href;


    /* =========================================================
       STATE
    ========================================================== */

    let imageObjectUrl = null;
    let videoObjectUrl = null;

    let scrollButtonHideTimer = null;

    let dragCounter = 0;

    let isSubmittingAttachment = false;
    let isSubmittingEdit = false;
    let isSubmittingMessage = false;


    /* =========================================================
       WEBSOCKET STATE
    ========================================================== */

    let messageWebSocket = null;
    let websocketReconnectTimer = null;
    let websocketManuallyClosed = false;


    /*
     * Messages currently being fetched for insertion.
     */
    const pendingMessageFragments = new Set();


    /*
     * IMPORTANT:
     *
     * This is a Map, not a Set.
     *
     * Multiple refresh requests for the same message are
     * queued instead of being silently ignored.
     *
     * This prevents race conditions between:
     *
     * reaction POST
     *     +
     * WebSocket reaction_updated
     *     +
     * status refresh
     */
    const pendingMessageRefreshes = new Map();


    /*
     * Prevent repeatedly sending mark_read for the same
     * message during the lifetime of this page.
     */
    const readMessagesSent = new Set();


    /* =========================================================
       CSRF
    ========================================================== */

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
       CURRENT USER
    ========================================================== */

    function getCurrentUserId() {
        if (!chatWindow) {
            return null;
        }

        const value =
            Number(
                chatWindow.dataset.currentUserId
            );

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }


    /* =========================================================
       WEBSOCKET SEND HELPER
    ========================================================== */

    function sendWebSocketPayload(payload) {
        if (
            !messageWebSocket ||
            messageWebSocket.readyState !==
                WebSocket.OPEN
        ) {
            return false;
        }

        try {
            messageWebSocket.send(
                JSON.stringify(payload)
            );

            return true;

        } catch (error) {
            console.error(
                'Unable to send WebSocket payload:',
                error
            );

            return false;
        }
    }


    /* =========================================================
       GENERAL MESSAGE HELPERS
    ========================================================== */

    function getMessageElement(messageId) {
        if (!messageId) {
            return null;
        }

        return document.getElementById(
            `msg-${messageId}`
        );
    }


    function getMessageIdFromElement(element) {
        if (!element) {
            return null;
        }

        if (element.dataset.messageId) {
            const id =
                Number(
                    element.dataset.messageId
                );

            if (id) {
                return id;
            }
        }

        const rawId =
            element.id || '';

        if (
            rawId.startsWith('msg-')
        ) {
            const id =
                Number(
                    rawId.substring(4)
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
            .querySelectorAll('.alert.alert-info')
            .forEach(function (element) {
                element.remove();
            });
    }


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

        if (getMessageElement(messageId)) {
            return false;
        }

        removeEmptyConversationMessage();

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

        if (
            shouldScroll &&
            chatWindow
        ) {
            requestAnimationFrame(function () {
                chatWindow.scrollTo({
                    top: chatWindow.scrollHeight,
                    behavior: 'smooth'
                });

                updateScrollButtons();
            });
        } else {
            updateScrollButtons();
        }

        return true;
    }


    /* =========================================================
       MESSAGE FRAGMENT URL
    ========================================================== */

    function getMessageFragmentUrl(messageId) {
        if (!chatWindow || !messageId) {
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

            /*
             * Expected:
             *
             * /messages/fragment/0/
             *
             * becomes:
             *
             * /messages/fragment/123/
             */
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


    /* =========================================================
       FETCH MESSAGE FRAGMENT
    ========================================================== */

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
       PERFORM ONE MESSAGE REFRESH
    ========================================================== */

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
         * Message is not currently in DOM.
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
         * Restore exact scroll position.
         */
        if (
            preserveScroll &&
            chatWindow
        ) {
            chatWindow.scrollTop =
                oldScrollTop;
        }

        updateScrollButtons();

        return true;
    }


    /* =========================================================
       QUEUED MESSAGE REFRESH
    ========================================================== */

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
         * If another refresh for this message is already
         * running, wait for it and then perform this refresh.
         *
         * This is critical for reactions/status updates.
         */
        const previous =
            pendingMessageRefreshes.get(id) ||
            Promise.resolve();

        const next =
            previous
                .catch(function () {
                    /*
                     * A failed previous refresh must not
                     * block future refreshes.
                     */
                })
                .then(function () {
                    return performMessageFragmentRefresh(
                        id,
                        options
                    );
                });

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


    /*
     * Backwards-compatible helper used by edit logic.
     */
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


    function resetComposerAfterSend() {
        if (messageBodyField) {
            messageBodyField.value = '';
        }

        if (replyToInput) {
            replyToInput.value = '';
        }

        clearReplyMedia();
        clearMediaInputs();

        if (editingMessageId) {
            editingMessageId.value = '';
        }

        if (editingBar) {
            editingBar.classList.add('d-none');
        }

        if (replyBar) {
            replyBar.classList.add('d-none');
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
       EMOJI
    ========================================================== */

    document.addEventListener(
        'click',
        function (event) {
            const emojiButton =
                event.target.closest('.emoji-btn');

            if (
                !emojiButton ||
                !messageBodyField
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const emoji =
                emojiButton.dataset.emoji || '';

            if (!emoji) {
                return;
            }

            const start =
                typeof messageBodyField.selectionStart === 'number'
                    ? messageBodyField.selectionStart
                    : messageBodyField.value.length;

            const end =
                typeof messageBodyField.selectionEnd === 'number'
                    ? messageBodyField.selectionEnd
                    : messageBodyField.value.length;

            const currentValue =
                messageBodyField.value;

            messageBodyField.value =
                currentValue.substring(0, start) +
                emoji +
                currentValue.substring(end);

            const newPosition =
                start + emoji.length;

            messageBodyField.focus();

            try {
                messageBodyField.setSelectionRange(
                    newPosition,
                    newPosition
                );
            } catch (error) {
                // Ignore.
            }

            const toggle =
                document.getElementById(
                    'emoji-toggle-btn'
                );

            if (
                toggle &&
                window.bootstrap
            ) {
                const instance =
                    bootstrap.Dropdown.getInstance(
                        toggle
                    );

                if (instance) {
                    instance.hide();
                }
            }
        }
    );


    /* =========================================================
       CHAT SCROLL
    ========================================================== */

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


    function updateScrollButtons() {
        if (!chatWindow) {
            return;
        }

        const currentScrollTop =
            chatWindow.scrollTop;

        const maxScrollTop =
            getMaxScrollTop();

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
            clearTimeout(
                scrollButtonHideTimer
            );
        }

        scrollButtonHideTimer =
            setTimeout(function () {
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
        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }


    function scrollToBottom() {
        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: 'smooth'
        });
    }


    function initializeChatPosition() {
        if (!chatWindow) {
            return;
        }

        requestAnimationFrame(function () {
            chatWindow.scrollTop =
                chatWindow.scrollHeight;

            updateScrollButtons();

            requestAnimationFrame(function () {
                chatWindow.scrollTop =
                    chatWindow.scrollHeight;

                updateScrollButtons();
            });
        });
    }


    function isUserAtBottom() {
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


    if (chatWindow) {
        updateScrollButtons();

        chatWindow.addEventListener(
            'scroll',
            function () {
                updateScrollButtons();
                showScrollButtons();
                scheduleScrollButtonHide();
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
                new ResizeObserver(function () {
                    updateScrollButtons();
                });

            resizeObserver.observe(chatWindow);

            if (chatMessages) {
                resizeObserver.observe(
                    chatMessages
                );
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
                scrollToBottom();
            }
        );
    }


    initializeChatPosition();

    window.addEventListener(
        'load',
        initializeChatPosition,
        {
            once: true
        }
    );


    /* =========================================================
       FILE SIZE
    ========================================================== */

    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(
                bytes / 1024
            ).toFixed(1)} KB`;
        }

        return `${(
            bytes / 1024 / 1024
        ).toFixed(1)} MB`;
    }


    /* =========================================================
       VALIDATE IMAGE
    ========================================================== */

    function validateImageFile(file) {
        if (!file) {
            return false;
        }

        if (!file.type.startsWith('image/')) {
            alert(
                'Please select a valid image file.'
            );

            return false;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            alert(
                'Image is too large.\n\n' +
                'Maximum size: 10 MB\n' +
                `Selected: ${formatFileSize(file.size)}`
            );

            return false;
        }

        return true;
    }


    /* =========================================================
       VALIDATE VIDEO
    ========================================================== */

    function validateVideoFile(file) {
        if (!file) {
            return false;
        }

        if (!file.type.startsWith('video/')) {
            alert(
                'Please select a valid video file.'
            );

            return false;
        }

        if (file.size > MAX_VIDEO_SIZE) {
            alert(
                'Video is too large.\n\n' +
                'Maximum size: 100 MB\n' +
                `Selected: ${formatFileSize(file.size)}`
            );

            return false;
        }

        return true;
    }


    /* =========================================================
       OBJECT URL CLEANUP
    ========================================================== */

    function revokeImageUrl() {
        if (!imageObjectUrl) {
            return;
        }

        URL.revokeObjectURL(
            imageObjectUrl
        );

        imageObjectUrl = null;
    }


    function revokeVideoUrl() {
        if (!videoObjectUrl) {
            return;
        }

        URL.revokeObjectURL(
            videoObjectUrl
        );

        videoObjectUrl = null;
    }


    /* =========================================================
       REPLY MEDIA
    ========================================================== */

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
       CLEAR MEDIA
    ========================================================== */

    function clearMediaInputs() {
        if (imageInput) {
            imageInput.value = '';
        }

        if (videoInput) {
            videoInput.value = '';
        }

        revokeImageUrl();
        revokeVideoUrl();

        if (imagePreview) {
            imagePreview.removeAttribute(
                'src'
            );
        }

        if (videoPreview) {
            videoPreview.pause();
            videoPreview.removeAttribute(
                'src'
            );
            videoPreview.load();
        }

        hideMediaPreviews();
    }


    function hideMediaPreviews() {
        if (imagePreviewWrap) {
            imagePreviewWrap.classList.add(
                'd-none'
            );
        }

        if (videoPreviewWrap) {
            videoPreviewWrap.classList.add(
                'd-none'
            );
        }

        if (removeMediaBtn) {
            removeMediaBtn.classList.add(
                'd-none'
            );
        }
    }


    /* =========================================================
       HANDLE IMAGE
    ========================================================== */

    function handleImageFile(file) {
        if (!validateImageFile(file)) {
            if (imageInput) {
                imageInput.value = '';
            }

            return false;
        }

        if (videoInput) {
            videoInput.value = '';
        }

        revokeVideoUrl();

        if (videoPreview) {
            videoPreview.pause();
            videoPreview.removeAttribute(
                'src'
            );
            videoPreview.load();
        }

        if (!imagePreview) {
            return false;
        }

        revokeImageUrl();

        imageObjectUrl =
            URL.createObjectURL(file);

        imagePreview.src =
            imageObjectUrl;

        if (imagePreviewWrap) {
            imagePreviewWrap.classList.remove(
                'd-none'
            );
        }

        if (videoPreviewWrap) {
            videoPreviewWrap.classList.add(
                'd-none'
            );
        }

        if (removeMediaBtn) {
            removeMediaBtn.classList.remove(
                'd-none'
            );
        }

        return true;
    }


    /* =========================================================
       HANDLE VIDEO
    ========================================================== */

    function handleVideoFile(file) {
        if (!validateVideoFile(file)) {
            if (videoInput) {
                videoInput.value = '';
            }

            return false;
        }

        if (imageInput) {
            imageInput.value = '';
        }

        revokeImageUrl();

        if (imagePreview) {
            imagePreview.removeAttribute(
                'src'
            );
        }

        if (!videoPreview) {
            return false;
        }

        revokeVideoUrl();

        videoObjectUrl =
            URL.createObjectURL(file);

        videoPreview.src =
            videoObjectUrl;

        videoPreview.load();

        if (videoPreviewWrap) {
            videoPreviewWrap.classList.remove(
                'd-none'
            );
        }

        if (imagePreviewWrap) {
            imagePreviewWrap.classList.add(
                'd-none'
            );
        }

        if (removeMediaBtn) {
            removeMediaBtn.classList.remove(
                'd-none'
            );
        }

        return true;
    }


    /* =========================================================
       FILE PICKERS
    ========================================================== */

    if (
        attachImageBtn &&
        imageInput
    ) {
        attachImageBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit ||
                    isSubmittingMessage
                ) {
                    return;
                }

                imageInput.click();
            }
        );
    }


    if (
        attachVideoBtn &&
        videoInput
    ) {
        attachVideoBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit ||
                    isSubmittingMessage
                ) {
                    return;
                }

                videoInput.click();
            }
        );
    }


    /* =========================================================
       IMAGE CHANGE
    ========================================================== */

    if (imageInput) {
        imageInput.addEventListener(
            'change',
            function () {
                const file =
                    imageInput.files &&
                    imageInput.files[0];

                if (!file) {
                    return;
                }

                handleImageFile(file);
            }
        );
    }


    /* =========================================================
       VIDEO CHANGE
    ========================================================== */

    if (videoInput) {
        videoInput.addEventListener(
            'change',
            function () {
                const file =
                    videoInput.files &&
                    videoInput.files[0];

                if (!file) {
                    return;
                }

                handleVideoFile(file);
            }
        );
    }


    /* =========================================================
       REMOVE MEDIA
    ========================================================== */

    if (removeMediaBtn) {
        removeMediaBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();
                clearMediaInputs();
            }
        );
    }


    /* =========================================================
       DRAG & DROP
    ========================================================== */

    function showDropOverlay() {
        if (!dropOverlay) {
            return;
        }

        dropOverlay.classList.add('active');
        dropOverlay.classList.add('show');

        dropOverlay.setAttribute(
            'aria-hidden',
            'false'
        );
    }


    function hideDropOverlay() {
        if (!dropOverlay) {
            return;
        }

        dropOverlay.classList.remove('active');
        dropOverlay.classList.remove('show');

        dropOverlay.setAttribute(
            'aria-hidden',
            'true'
        );
    }


    if (chatWindow) {
        chatWindow.addEventListener(
            'dragenter',
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                if (
                    isSubmittingEdit ||
                    isSubmittingAttachment ||
                    isSubmittingMessage
                ) {
                    return;
                }

                dragCounter++;

                showDropOverlay();
            }
        );


        chatWindow.addEventListener(
            'dragover',
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                if (
                    isSubmittingEdit ||
                    isSubmittingAttachment ||
                    isSubmittingMessage
                ) {
                    return;
                }

                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect =
                        'copy';
                }

                showDropOverlay();
            }
        );


        chatWindow.addEventListener(
            'dragleave',
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                dragCounter--;

                if (dragCounter <= 0) {
                    dragCounter = 0;
                    hideDropOverlay();
                }
            }
        );


        chatWindow.addEventListener(
            'drop',
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                dragCounter = 0;
                hideDropOverlay();

                if (
                    isSubmittingEdit ||
                    isSubmittingAttachment ||
                    isSubmittingMessage
                ) {
                    return;
                }

                const files =
                    event.dataTransfer &&
                    event.dataTransfer.files;

                if (
                    !files ||
                    !files.length
                ) {
                    return;
                }

                const file = files[0];

                if (
                    file.type.startsWith('image/')
                ) {
                    if (!validateImageFile(file)) {
                        return;
                    }

                    if (imageInput) {
                        try {
                            const dataTransfer =
                                new DataTransfer();

                            dataTransfer.items.add(file);

                            imageInput.files =
                                dataTransfer.files;
                        } catch (error) {
                            console.error(
                                'Unable to assign image file:',
                                error
                            );
                        }
                    }

                    handleImageFile(file);
                    return;
                }

                if (
                    file.type.startsWith('video/')
                ) {
                    if (!validateVideoFile(file)) {
                        return;
                    }

                    if (videoInput) {
                        try {
                            const dataTransfer =
                                new DataTransfer();

                            dataTransfer.items.add(file);

                            videoInput.files =
                                dataTransfer.files;
                        } catch (error) {
                            console.error(
                                'Unable to assign video file:',
                                error
                            );
                        }
                    }

                    handleVideoFile(file);
                    return;
                }

                alert(
                    'Only image and video files are allowed.'
                );
            }
        );
    }


    /* =========================================================
       PASTE IMAGE
    ========================================================== */

    document.addEventListener(
        'paste',
        function (event) {
            if (!messageBodyField) {
                return;
            }

            if (
                isSubmittingEdit ||
                isSubmittingAttachment ||
                isSubmittingMessage
            ) {
                return;
            }

            if (
                document.activeElement !==
                messageBodyField
            ) {
                return;
            }

            const clipboardItems =
                event.clipboardData &&
                event.clipboardData.items;

            if (!clipboardItems) {
                return;
            }

            for (
                let i = 0;
                i < clipboardItems.length;
                i++
            ) {
                const item =
                    clipboardItems[i];

                if (
                    item.kind !== 'file' ||
                    !item.type.startsWith('image/')
                ) {
                    continue;
                }

                const file =
                    item.getAsFile();

                if (!file) {
                    continue;
                }

                if (!validateImageFile(file)) {
                    return;
                }

                try {
                    const dataTransfer =
                        new DataTransfer();

                    dataTransfer.items.add(file);

                    if (imageInput) {
                        imageInput.files =
                            dataTransfer.files;
                    }
                } catch (error) {
                    console.error(
                        'Unable to assign pasted image:',
                        error
                    );

                    return;
                }

                handleImageFile(file);

                event.preventDefault();

                return;
            }
        }
    );


    /* =========================================================
       UPLOAD PROGRESS
    ========================================================== */

    function showUploadProgress() {
        if (!uploadProgressWrap) {
            return;
        }

        uploadProgressWrap.classList.remove(
            'd-none'
        );

        if (uploadProgressBar) {
            uploadProgressBar.style.width =
                '0%';

            uploadProgressBar.setAttribute(
                'aria-valuenow',
                '0'
            );
        }

        if (uploadProgressPercent) {
            uploadProgressPercent.textContent =
                '0%';
        }

        if (uploadProgressText) {
            uploadProgressText.textContent =
                'Uploading...';
        }
    }


    function updateUploadProgress(percent) {
        percent = Math.max(
            0,
            Math.min(
                100,
                percent
            )
        );

        if (uploadProgressBar) {
            uploadProgressBar.style.width =
                `${percent}%`;

            uploadProgressBar.setAttribute(
                'aria-valuenow',
                String(percent)
            );
        }

        if (uploadProgressPercent) {
            uploadProgressPercent.textContent =
                `${percent}%`;
        }
    }


    function hideUploadProgress() {
        if (uploadProgressWrap) {
            uploadProgressWrap.classList.add(
                'd-none'
            );
        }
    }


    /* =========================================================
       ATTACHMENT VALIDATION
    ========================================================== */

    function validateAttachmentsBeforeSubmit() {
        const imageFile =
            imageInput &&
            imageInput.files &&
            imageInput.files[0];

        const videoFile =
            videoInput &&
            videoInput.files &&
            videoInput.files[0];

        if (
            imageFile &&
            videoFile
        ) {
            alert(
                'Please attach either an image or a video, not both.'
            );

            return false;
        }

        if (
            imageFile &&
            !validateImageFile(imageFile)
        ) {
            return false;
        }

        if (
            videoFile &&
            !validateVideoFile(videoFile)
        ) {
            return false;
        }

        return true;
    }


    /* =========================================================
       UI STATE
    ========================================================== */

    function setSubmitMode(mode) {
        if (mode === 'edit') {
            if (submitText) {
                submitText.textContent =
                    'Save changes';
            }

            if (submitIcon) {
                submitIcon.classList.remove(
                    'fa-paper-plane'
                );

                submitIcon.classList.add(
                    'fa-save'
                );
            }

            return;
        }

        if (submitText) {
            submitText.textContent =
                'Send';
        }

        if (submitIcon) {
            submitIcon.classList.remove(
                'fa-save'
            );

            submitIcon.classList.add(
                'fa-paper-plane'
            );
        }
    }


    function setSendingState(isSending) {
        if (!submitBtn) {
            return;
        }

        if (isSending) {
            submitBtn.disabled = true;

            submitBtn.dataset.originalHtml =
                submitBtn.innerHTML;

            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin me-1"></i> Sending...';

            return;
        }

        submitBtn.disabled = false;

        submitBtn.innerHTML =
            submitBtn.dataset.originalHtml ||
            '<i class="fas fa-paper-plane me-1"></i> Send';

        delete submitBtn.dataset.originalHtml;
    }


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
    ========================================================== */

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
            button.dataset.messageBody || '';

        if (
            !messageId ||
            !editUrl
        ) {
            return;
        }

        clearMediaInputs();

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
                getMessagePreview(messageBody) ||
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
        } catch (error) {
            // Ignore.
        }

        replyForm.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }


    /* =========================================================
       CANCEL EDIT
    ========================================================== */

    function cancelEdit(options = {}) {
        const clearBody =
            options.clearBody !== false;

        if (editingMessageId) {
            editingMessageId.value = '';
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
    ========================================================== */

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
            button.dataset.messageBody || '';

        const imageUrl =
            button.dataset.replyImage || '';

        const videoUrl =
            button.dataset.replyVideo || '';

        if (!messageId) {
            return;
        }

        if (editingMessageId) {
            editingMessageId.value = '';
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
                getMessagePreview(messageBody) ||
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


    /* =========================================================
       CANCEL REPLY
    ========================================================== */

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
       EDIT BUTTON
    ========================================================== */

    document.addEventListener(
        'click',
        function (event) {
            const button =
                event.target.closest(
                    '.edit-message-side-btn'
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            if (
                isSubmittingAttachment ||
                isSubmittingEdit ||
                isSubmittingMessage
            ) {
                return;
            }

            startEdit(button);
        }
    );


    /* =========================================================
       REPLY BUTTON
    ========================================================== */

    document.addEventListener(
        'click',
        function (event) {
            const button =
                event.target.closest(
                    '.reply-message-side-btn'
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            if (
                isSubmittingAttachment ||
                isSubmittingEdit ||
                isSubmittingMessage
            ) {
                return;
            }

            startReply(button);
        }
    );


    /* =========================================================
       CANCEL EDIT
    ========================================================== */

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();

                cancelEdit();
            }
        );
    }


    /* =========================================================
       CANCEL REPLY
    ========================================================== */

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener(
            'click',
            function (event) {
                event.preventDefault();

                cancelReply();
            }
        );
    }


    /* =========================================================
       EDIT AJAX
    ========================================================== */

    async function handleEditSubmit(event) {
        event.preventDefault();

        if (isSubmittingEdit) {
            return;
        }

        if (
            !replyForm ||
            !editingMessageId ||
            !messageBodyField
        ) {
            return;
        }

        const messageId =
            editingMessageId.value;

        const editUrl =
            replyForm.getAttribute('action');

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

        clearMediaInputs();

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

        if (submitBtn) {
            submitBtn.disabled = true;
        }

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
                data.message_id || messageId
            );

            document
                .querySelectorAll(
                    '.edit-message-side-btn, .reply-message-side-btn'
                )
                .forEach(function (button) {
                    if (
                        button.dataset.messageId ===
                        String(messageId)
                    ) {
                        button.dataset.messageBody =
                            body;
                    }
                });

            cancelEdit({
                clearBody: true
            });

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

            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    }


    /* =========================================================
       NORMAL TEXT MESSAGE AJAX
    ========================================================== */

    async function handleTextMessageSubmit(event) {
        event.preventDefault();

        if (
            isSubmittingMessage ||
            isSubmittingEdit ||
            isSubmittingAttachment
        ) {
            return;
        }

        if (!replyForm) {
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

        const imageFile =
            imageInput &&
            imageInput.files &&
            imageInput.files[0];

        const videoFile =
            videoInput &&
            videoInput.files &&
            videoInput.files[0];

        if (
            imageFile ||
            videoFile
        ) {
            if (
                !validateAttachmentsBeforeSubmit()
            ) {
                return;
            }

            handleAttachmentSubmit(event);

            return;
        }

        if (!body) {
            if (messageBodyField) {
                messageBodyField.focus();
            }

            return;
        }

        const shouldScroll =
            isUserAtBottom();

        const formData =
            new FormData(replyForm);

        isSubmittingMessage = true;

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
                    'Unable to send message.'
                );
            }

            if (
                data.html &&
                data.message_id
            ) {
                appendRenderedMessage(
                    data.html,
                    data.message_id,
                    shouldScroll
                );
            }

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
            isSubmittingMessage = false;

            setSendingState(false);
        }
    }


    /* =========================================================
       ATTACHMENT AJAX SUBMIT
    ========================================================== */

    function handleAttachmentSubmit(event) {
        event.preventDefault();

        if (
            !replyForm ||
            isSubmittingAttachment ||
            isSubmittingEdit ||
            isSubmittingMessage
        ) {
            return;
        }

        if (
            !validateAttachmentsBeforeSubmit()
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

        const shouldScroll =
            isUserAtBottom();

        const formData =
            new FormData(replyForm);

        const xhr =
            new XMLHttpRequest();

        isSubmittingAttachment = true;

        showUploadProgress();

        if (submitBtn) {
            submitBtn.disabled = true;

            submitBtn.dataset.originalHtml =
                submitBtn.innerHTML;

            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin me-1"></i> Uploading...';
        }

        xhr.upload.addEventListener(
            'progress',
            function (event) {
                if (!event.lengthComputable) {
                    return;
                }

                const percent =
                    Math.round(
                        (
                            event.loaded /
                            event.total
                        ) * 100
                    );

                updateUploadProgress(
                    percent
                );
            }
        );


        xhr.addEventListener(
            'load',
            function () {
                if (
                    xhr.status >= 200 &&
                    xhr.status < 300
                ) {
                    updateUploadProgress(100);

                    if (uploadProgressText) {
                        uploadProgressText.textContent =
                            'Upload complete';
                    }

                    let data;

                    try {
                        data =
                            JSON.parse(
                                xhr.responseText
                            );

                    } catch (error) {
                        console.error(
                            'Invalid attachment response:',
                            xhr.responseText
                        );

                        alert(
                            'Server returned an invalid response.'
                        );

                        resetUploadButton();

                        return;
                    }

                    if (
                        !data.ok ||
                        !data.html ||
                        !data.message_id
                    ) {
                        alert(
                            data.error ||
                            'Message upload failed.'
                        );

                        resetUploadButton();

                        return;
                    }

                    appendRenderedMessage(
                        data.html,
                        data.message_id,
                        shouldScroll
                    );

                    setTimeout(
                        function () {
                            hideUploadProgress();
                        },
                        300
                    );

                    resetComposerAfterSend();

                    resetUploadButton();

                    return;
                }

                let errorMessage =
                    'Upload failed. Please try again.';

                try {
                    const data =
                        JSON.parse(
                            xhr.responseText
                        );

                    if (data.error) {
                        errorMessage =
                            data.error;
                    }

                } catch (error) {
                    // Ignore.
                }

                alert(errorMessage);

                resetUploadButton();
            }
        );


        xhr.addEventListener(
            'error',
            function () {
                alert(
                    'Upload failed. Please check your connection and try again.'
                );

                resetUploadButton();
            }
        );


        xhr.addEventListener(
            'abort',
            function () {
                resetUploadButton();
            }
        );


        xhr.open(
            'POST',
            sendUrl,
            true
        );

        const csrfToken =
            getCsrfToken();

        if (csrfToken) {
            xhr.setRequestHeader(
                'X-CSRFToken',
                csrfToken
            );
        }

        xhr.setRequestHeader(
            'X-Requested-With',
            'XMLHttpRequest'
        );

        xhr.setRequestHeader(
            'Accept',
            'application/json'
        );

        xhr.send(formData);
    }


    function resetUploadButton() {
        hideUploadProgress();

        isSubmittingAttachment = false;

        if (submitBtn) {
            submitBtn.disabled = false;

            submitBtn.innerHTML =
                submitBtn.dataset.originalHtml ||
                '<i class="fas fa-paper-plane me-1"></i> Send';

            delete submitBtn.dataset.originalHtml;
        }
    }


    /* =========================================================
       FORM SUBMIT
    ========================================================== */

    if (replyForm) {
        replyForm.addEventListener(
            'submit',
            function (event) {
                event.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit ||
                    isSubmittingMessage
                ) {
                    return;
                }

                const isEditing =
                    editingMessageId &&
                    editingMessageId.value;

                if (isEditing) {
                    handleEditSubmit(event);
                    return;
                }

                const imageFile =
                    imageInput &&
                    imageInput.files &&
                    imageInput.files[0];

                const videoFile =
                    videoInput &&
                    videoInput.files &&
                    videoInput.files[0];

                if (
                    imageFile ||
                    videoFile
                ) {
                    if (
                        !validateAttachmentsBeforeSubmit()
                    ) {
                        return;
                    }

                    handleAttachmentSubmit(event);
                    return;
                }

                handleTextMessageSubmit(event);
            }
        );
    }


    /* =========================================================
       SHARE MEDIA
    ========================================================== */

    document.addEventListener(
        'click',
        async function (event) {
            const button =
                event.target.closest(
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

            event.preventDefault();

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Shared media',
                        text: 'Check this out',
                        url: url
                    });

                    return;

                } catch (error) {
                    if (
                        error &&
                        error.name ===
                            'AbortError'
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

            } catch (error) {
                console.error(
                    'Clipboard failed:',
                    error
                );
            }

            const textarea =
                document.createElement(
                    'textarea'
                );

            textarea.value =
                url;

            textarea.style.position =
                'fixed';

            textarea.style.left =
                '-9999px';

            textarea.style.top =
                '-9999px';

            textarea.style.opacity =
                '0';

            document.body.appendChild(
                textarea
            );

            textarea.focus();
            textarea.select();

            try {
                document.execCommand(
                    'copy'
                );
            } catch (error) {
                console.error(
                    'Copy failed:',
                    error
                );
            }

            textarea.remove();
        }
    );


    /* =========================================================
       REACTIONS
    ========================================================== */

    const defaultAvatar =
        chatWindow?.dataset.defaultAvatar || '';


    function getReactionUrl(button) {
        if (!button) {
            return null;
        }

        /*
         * Prefer the actual Django-generated href.
         *
         * This is the safest option.
         */
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

        /*
         * Avoid depending on CSS.escape.
         *
         * This works even in browsers where CSS.escape
         * is unavailable.
         */
        const allAvatarBoxes =
            document.querySelectorAll(
                '[data-react-avatars]'
            );

        for (
            const box of allAvatarBoxes
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

            const reactors =
                Array.isArray(data.reactors)
                    ? data.reactors
                    : [];

            reactors.forEach(
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
            Array.isArray(data.reactors)
        ) {
            const names =
                data.reactors
                    .map(
                        function (reactor) {
                            return reactor.username;
                        }
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


    document.addEventListener(
        'click',
        async function (event) {
            const button =
                event.target.closest(
                    '.js-react'
                );

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (
                button.dataset.loading === '1'
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

            button.disabled = true;

            /*
             * Preserve exact scroll position.
             */
            const scrollTop =
                chatWindow
                    ? chatWindow.scrollTop
                    : 0;

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
                 * Update immediately.
                 */
                updateReactionUI(
                    button,
                    data
                );

                /*
                 * Then refresh authoritative server HTML.
                 *
                 * Because refreshMessageFragment() is queued,
                 * this cannot race with another refresh for
                 * the same message.
                 */
                await refreshMessageFragment(
                    data.message_id ||
                    messageId,
                    {
                        preserveScroll: true
                    }
                );

                if (chatWindow) {
                    chatWindow.scrollTop =
                        scrollTop;
                }

                updateScrollButtons();

            } catch (error) {
                console.error(
                    'Reaction error:',
                    error
                );

                /*
                 * If the POST failed, restore the authoritative
                 * state from Django.
                 */
                try {
                    await refreshMessageFragment(
                        messageId,
                        {
                            preserveScroll: true
                        }
                    );
                } catch (refreshError) {
                    console.error(
                        'Unable to restore reaction state:',
                        refreshError
                    );
                }

            } finally {
                button.dataset.loading =
                    '0';

                button.disabled = false;

                /*
                 * The button may have been replaced by
                 * refreshMessageFragment(), therefore find
                 * the current buttons again.
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
                        .forEach(function (
                            reactionButton
                        ) {
                            reactionButton.disabled =
                                false;

                            reactionButton.dataset.loading =
                                '0';
                        });
                }
            }
        }
    );


    /* =========================================================
       MARK MESSAGE AS READ
    ========================================================== */

    function markMessageAsRead(
        messageId,
        force = false
    ) {
        const id =
            Number(messageId);

        if (!id) {
            return false;
        }

        if (
            !force &&
            readMessagesSent.has(id)
        ) {
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
        if (!chatMessages) {
            return;
        }

        const currentUserId =
            getCurrentUserId();

        if (!currentUserId) {
            return;
        }

        /*
         * Django uses .received-message for messages
         * belonging to the other participant.
         */
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


    /* =========================================================
       WEBSOCKET URL
    ========================================================== */

    function getWebSocketUrl() {
        if (!chatWindow) {
            return null;
        }

        const rootMessageId =
            chatWindow.dataset.rootMessageId;

        if (!rootMessageId) {
            console.warn(
                'WebSocket: data-root-message-id is missing.'
            );

            return null;
        }

        const protocol =
            window.location.protocol === 'https:'
                ? 'wss:'
                : 'ws:';

        return (
            `${protocol}//` +
            `${window.location.host}` +
            `/ws/messages/${encodeURIComponent(rootMessageId)}/`
        );
    }


    /* =========================================================
       APPEND INCOMING MESSAGE
    ========================================================== */

    async function appendIncomingMessage(
        message
    ) {
        if (
            !chatMessages ||
            !message
        ) {
            return;
        }

        const messageId =
            Number(message.id);

        if (!messageId) {
            console.warn(
                'WebSocket: message id is missing.'
            );

            return;
        }

        if (
            getMessageElement(messageId)
        ) {
            /*
             * Message already exists.
             *
             * It may still need to be marked as read.
             */
            markMessageAsRead(
                messageId
            );

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
            isUserAtBottom();

        pendingMessageFragments.add(
            messageId
        );

        try {
            const data =
                await fetchMessageFragment(
                    messageId
                );

            /*
             * It could have been inserted while
             * the request was running.
             */
            if (
                getMessageElement(messageId)
            ) {
                markMessageAsRead(
                    messageId
                );

                return;
            }

            const inserted =
                appendRenderedMessage(
                    data.html,
                    messageId,
                    shouldScroll
                );

            if (inserted) {
                /*
                 * The message is now visible in the
                 * conversation, so tell the backend
                 * that it has been read.
                 */
                markMessageAsRead(
                    messageId
                );
            }

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


    /* =========================================================
       REFRESH STATUS MESSAGES
    ========================================================== */

    async function refreshStatusMessages(
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

        for (
            const messageId of uniqueIds
        ) {
            try {
                await refreshMessageFragment(
                    messageId,
                    {
                        preserveScroll: true
                    }
                );

            } catch (error) {
                console.error(
                    'Unable to refresh message status:',
                    messageId,
                    error
                );
            }
        }
    }


    /* =========================================================
       REFRESH ONE MESSAGE FROM WEBSOCKET
    ========================================================== */

    function refreshWebSocketMessage(
        messageId
    ) {
        const id =
            Number(messageId);

        if (!id) {
            return;
        }

        refreshMessageFragment(
            id,
            {
                preserveScroll: true
            }
        ).catch(function (error) {
            console.error(
                'Unable to refresh WebSocket message:',
                id,
                error
            );
        });
    }


    /* =========================================================
       WEBSOCKET MESSAGE HANDLER
    ========================================================== */

    function handleWebSocketMessage(
        event
    ) {
        let data;

        try {
            data =
                JSON.parse(
                    event.data
                );

        } catch (error) {
            console.error(
                'WebSocket invalid JSON:',
                error
            );

            return;
        }


        /* -----------------------------------------------------
           CONNECTION
        ------------------------------------------------------ */

        if (
            data.type ===
            'connection_established'
        ) {
            console.log(
                'Message WebSocket connected.'
            );

            /*
             * Mark all received messages in the currently
             * opened conversation as read.
             */
            markExistingReceivedMessagesAsRead();

            return;
        }


        /* -----------------------------------------------------
           NEW MESSAGE
        ------------------------------------------------------ */

        if (
            data.type ===
            'message_created'
        ) {
            if (data.message) {
                appendIncomingMessage(
                    data.message
                ).catch(
                    function (error) {
                        console.error(
                            'WebSocket message rendering error:',
                            error
                        );
                    }
                );
            }

            return;
        }


        /* -----------------------------------------------------
           READ / DELIVERY STATUS
        ------------------------------------------------------ */

        if (
            data.type ===
                'message_status_updated' ||
            data.type ===
                'message_delivery_updated'
        ) {
            /*
             * Support:
             *
             * {
             *     type: 'message_status_updated',
             *     message_ids: [1, 2, 3]
             * }
             *
             * and:
             *
             * {
             *     type: 'message_status_updated',
             *     message_id: 123
             * }
             */

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

            const singleMessageId =
                data.message_id ||
                data.id ||
                data.message?.id;

            if (singleMessageId) {
                refreshStatusMessages([
                    singleMessageId
                ]);
            }

            return;
        }


        /* -----------------------------------------------------
           REACTION UPDATE
        ------------------------------------------------------ */

        if (
            data.type ===
                'reaction_updated' ||
            data.type ===
                'message_reacted'
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
                refreshWebSocketMessage(
                    messageId
                );
            }

            return;
        }


        /* -----------------------------------------------------
           GENERIC MESSAGE UPDATE
        ------------------------------------------------------ */

        if (
            data.type ===
            'message_updated'
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
                refreshWebSocketMessage(
                    messageId
                );
            }

            return;
        }


        /* -----------------------------------------------------
           ERROR
        ------------------------------------------------------ */

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


    /* =========================================================
       WEBSOCKET RECONNECT
    ========================================================== */

    function scheduleWebSocketReconnect() {
        if (websocketManuallyClosed) {
            return;
        }

        if (websocketReconnectTimer) {
            return;
        }

        websocketReconnectTimer =
            setTimeout(
                function () {
                    websocketReconnectTimer =
                        null;

                    connectWebSocket();
                },
                WEBSOCKET_RECONNECT_DELAY
            );
    }


    /* =========================================================
       CONNECT WEBSOCKET
    ========================================================== */

    function connectWebSocket() {
        if (!chatWindow) {
            return;
        }

        const url =
            getWebSocketUrl();

        if (!url) {
            return;
        }

        if (
            messageWebSocket &&
            (
                messageWebSocket.readyState ===
                    WebSocket.OPEN ||
                messageWebSocket.readyState ===
                    WebSocket.CONNECTING
            )
        ) {
            return;
        }

        websocketManuallyClosed =
            false;

        try {
            messageWebSocket =
                new WebSocket(url);

        } catch (error) {
            console.error(
                'Unable to create WebSocket:',
                error
            );

            scheduleWebSocketReconnect();

            return;
        }


        messageWebSocket.addEventListener(
            'open',
            function () {
                console.log(
                    'Message WebSocket connected.'
                );

                /*
                 * As soon as the socket is connected,
                 * mark existing received messages as read.
                 */
                markExistingReceivedMessagesAsRead();
            }
        );


        messageWebSocket.addEventListener(
            'message',
            handleWebSocketMessage
        );


        messageWebSocket.addEventListener(
            'error',
            function (error) {
                console.error(
                    'Message WebSocket error:',
                    error
                );
            }
        );


        messageWebSocket.addEventListener(
            'close',
            function (event) {
                console.warn(
                    'Message WebSocket closed:',
                    event.code,
                    event.reason
                );

                messageWebSocket =
                    null;

                scheduleWebSocketReconnect();
            }
        );
    }


    /* =========================================================
       CLOSE WEBSOCKET
    ========================================================== */

    function closeWebSocket() {
        websocketManuallyClosed =
            true;

        if (websocketReconnectTimer) {
            clearTimeout(
                websocketReconnectTimer
            );

            websocketReconnectTimer =
                null;
        }

        if (messageWebSocket) {
            try {
                messageWebSocket.close(
                    1000,
                    'Page unloading'
                );

            } catch (error) {
                // Ignore.
            }

            messageWebSocket =
                null;
        }
    }


    /* =========================================================
       INITIALIZE WEBSOCKET
    ========================================================== */

    connectWebSocket();


    /* =========================================================
       BEFORE UNLOAD
    ========================================================== */

    window.addEventListener(
        'beforeunload',
        function () {
            revokeImageUrl();
            revokeVideoUrl();

            closeWebSocket();

            if (scrollButtonHideTimer) {
                clearTimeout(
                    scrollButtonHideTimer
                );

                scrollButtonHideTimer =
                    null;
            }
        }
    );
});
