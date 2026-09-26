document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const replyForm = document.getElementById('reply-form');

    const messageBodyField = replyForm
        ? (
            replyForm.querySelector('[name="body"]') ||
            replyForm.querySelector('textarea')
        )
        : null;

    const imageInput = document.getElementById('id_image');
    const videoInput = document.getElementById('id_video');

    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');

    const imagePreviewWrap = document.getElementById('image-preview-wrap');
    const videoPreviewWrap = document.getElementById('video-preview-wrap');

    const attachImageBtn = document.getElementById('attach-image-btn');
    const attachVideoBtn = document.getElementById('attach-video-btn');
    const removeMediaBtn = document.getElementById('remove-media-btn');

    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');

    const dropOverlay = document.getElementById('chat-drop-overlay');

    const uploadProgressWrap = document.getElementById('upload-progress-wrap');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadProgressText = document.getElementById('upload-progress-text');
    const uploadProgressPercent = document.getElementById('upload-progress-percent');

    const editingBar = document.getElementById('editing-message-bar');
    const editingMessageId = document.getElementById('editing-message-id');
    const editingPreview = document.getElementById('editing-message-preview');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    const replyBar = document.getElementById('replying-message-bar');
    const replyPreview = document.getElementById('replying-message-preview');
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');
    const replyToInput = document.getElementById('reply-to');

    const replyMedia = document.getElementById('replying-message-media');
    const replyImage = document.getElementById('replying-message-image');
    const replyVideo = document.getElementById('replying-message-video');
    const replyVideoPlayer = document.getElementById('replying-message-video-player');

    const submitBtn = document.getElementById('message-submit-btn');
    const submitText = document.getElementById('message-submit-text');
    const submitIcon = document.getElementById('message-submit-icon');

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

    const normalFormAction = replyForm
        ? (
            replyForm.dataset.sendUrl ||
            replyForm.getAttribute('action') ||
            window.location.href
        )
        : window.location.href;

    let imageObjectUrl = null;
    let videoObjectUrl = null;

    let dragCounter = 0;

    let isSubmittingAttachment = false;
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
            typeof window.agroChatNavigation.isAtBottom === 'function'
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
            ? replyForm.querySelector('[name="csrfmiddlewaretoken"]')
            : document.querySelector('[name="csrfmiddlewaretoken"]');

        return csrfInput ? csrfInput.value : '';
    }


    /* =========================================================
       MESSAGE HELPERS
       ========================================================= */

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
            const id = Number(element.dataset.messageId);

            if (id) {
                return id;
            }
        }

        const rawId = element.id || '';

        if (rawId.startsWith('msg-')) {
            const id = Number(rawId.substring(4));

            if (id) {
                return id;
            }
        }

        const child = element.querySelector('[data-message-id]');

        if (child) {
            const id = Number(child.dataset.messageId);

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

        if (getMessageElement(messageId)) {
            return false;
        }

        removeEmptyConversationMessage();

        const computedStyle =
            window.getComputedStyle(chatMessages);

        const isColumnReverse =
            computedStyle.flexDirection === 'column-reverse';

        /*
         * Messages are displayed newest at the bottom.
         *
         * With column-reverse, the first DOM element is
         * displayed at the visual bottom.
         *
         * Therefore:
         *   column-reverse -> afterbegin
         *   normal         -> beforeend
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
         * Tell chat_navigation.js that a new message
         * has been rendered.
         *
         * shouldScroll is true when the user was already
         * at the bottom, so the navigation layer can keep
         * the conversation at the bottom.
         *
         * When false, the user is reading older messages,
         * so their current scroll position is preserved
         * and unread handling remains active.
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
            const url = new URL(
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
        const id = Number(messageId);

        if (!id) {
            return Promise.resolve(false);
        }

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
       COMPOSER RESET
       ========================================================= */

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
       ========================================================= */

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
            } catch (e) {}

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
       FILE HELPERS
       ========================================================= */

    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

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
                `Image is too large.\n\nMaximum size: 10 MB\nSelected: ${formatFileSize(file.size)}`
            );

            return false;
        }

        return true;
    }

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
                `Video is too large.\n\nMaximum size: 100 MB\nSelected: ${formatFileSize(file.size)}`
            );

            return false;
        }

        return true;
    }

    function revokeImageUrl() {
        if (imageObjectUrl) {
            URL.revokeObjectURL(
                imageObjectUrl
            );

            imageObjectUrl = null;
        }
    }

    function revokeVideoUrl() {
        if (videoObjectUrl) {
            URL.revokeObjectURL(
                videoObjectUrl
            );

            videoObjectUrl = null;
        }
    }


    /* =========================================================
       REPLY MEDIA
       ========================================================= */

    function clearReplyMedia() {
        if (replyMedia) {
            replyMedia.classList.add('d-none');
        }

        if (replyImage) {
            replyImage.classList.add('d-none');
            replyImage.removeAttribute('src');
        }

        if (replyVideo) {
            replyVideo.classList.add('d-none');
        }

        if (replyVideoPlayer) {
            replyVideoPlayer.pause();
            replyVideoPlayer.removeAttribute('src');
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
            replyImage.src = imageUrl;

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
       MEDIA INPUTS
       ========================================================= */

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
       ATTACHMENTS
       ========================================================= */

    if (
        attachImageBtn &&
        imageInput
    ) {
        attachImageBtn.addEventListener(
            'click',
            function (e) {
                e.preventDefault();

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
            function (e) {
                e.preventDefault();

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

    if (imageInput) {
        imageInput.addEventListener(
            'change',
            function () {
                const file =
                    imageInput.files &&
                    imageInput.files[0];

                if (file) {
                    handleImageFile(file);
                }
            }
        );
    }

    if (videoInput) {
        videoInput.addEventListener(
            'change',
            function () {
                const file =
                    videoInput.files &&
                    videoInput.files[0];

                if (file) {
                    handleVideoFile(file);
                }
            }
        );
    }

    if (removeMediaBtn) {
        removeMediaBtn.addEventListener(
            'click',
            function (e) {
                e.preventDefault();
                clearMediaInputs();
            }
        );
    }


    /* =========================================================
       DRAG & DROP
       ========================================================= */

    function showDropOverlay() {
        if (!dropOverlay) {
            return;
        }

        dropOverlay.classList.add(
            'active',
            'show'
        );

        dropOverlay.setAttribute(
            'aria-hidden',
            'false'
        );
    }

    function hideDropOverlay() {
        if (!dropOverlay) {
            return;
        }

        dropOverlay.classList.remove(
            'active',
            'show'
        );

        dropOverlay.setAttribute(
            'aria-hidden',
            'true'
        );
    }

    if (chatWindow) {
        chatWindow.addEventListener(
            'dragenter',
            function (e) {
                e.preventDefault();
                e.stopPropagation();

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
            function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (
                    isSubmittingEdit ||
                    isSubmittingAttachment ||
                    isSubmittingMessage
                ) {
                    return;
                }

                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect =
                        'copy';
                }

                showDropOverlay();
            }
        );

        chatWindow.addEventListener(
            'dragleave',
            function (e) {
                e.preventDefault();
                e.stopPropagation();

                dragCounter--;

                if (dragCounter <= 0) {
                    dragCounter = 0;
                    hideDropOverlay();
                }
            }
        );

        chatWindow.addEventListener(
            'drop',
            function (e) {
                e.preventDefault();
                e.stopPropagation();

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
                    e.dataTransfer &&
                    e.dataTransfer.files;

                if (
                    !files ||
                    !files.length
                ) {
                    return;
                }

                const file = files[0];

                if (
                    file.type.startsWith(
                        'image/'
                    )
                ) {
                    if (
                        !validateImageFile(
                            file
                        )
                    ) {
                        return;
                    }

                    if (imageInput) {
                        try {
                            const dt =
                                new DataTransfer();

                            dt.items.add(file);

                            imageInput.files =
                                dt.files;

                        } catch (err) {
                            console.error(
                                'Unable to assign image file:',
                                err
                            );
                        }
                    }

                    handleImageFile(file);

                    return;
                }

                if (
                    file.type.startsWith(
                        'video/'
                    )
                ) {
                    if (
                        !validateVideoFile(
                            file
                        )
                    ) {
                        return;
                    }

                    if (videoInput) {
                        try {
                            const dt =
                                new DataTransfer();

                            dt.items.add(file);

                            videoInput.files =
                                dt.files;

                        } catch (err) {
                            console.error(
                                'Unable to assign video file:',
                                err
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
       ========================================================= */

    document.addEventListener(
        'paste',
        function (e) {
            if (
                !messageBodyField ||
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

            const items =
                e.clipboardData &&
                e.clipboardData.items;

            if (!items) {
                return;
            }

            for (
                let i = 0;
                i < items.length;
                i++
            ) {
                const item = items[i];

                if (
                    item.kind !== 'file' ||
                    !item.type.startsWith(
                        'image/'
                    )
                ) {
                    continue;
                }

                const file =
                    item.getAsFile();

                if (
                    !file ||
                    !validateImageFile(file)
                ) {
                    return;
                }

                try {
                    const dt =
                        new DataTransfer();

                    dt.items.add(file);

                    if (imageInput) {
                        imageInput.files =
                            dt.files;
                    }

                } catch (err) {
                    console.error(
                        'Unable to assign pasted image:',
                        err
                    );

                    return;
                }

                handleImageFile(file);

                e.preventDefault();

                return;
            }
        }
    );


    /* =========================================================
       UPLOAD PROGRESS
       ========================================================= */

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
        percent =
            Math.max(
                0,
                Math.min(100, percent)
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
       SUBMIT BUTTON
       ========================================================= */

    function setSubmitMode(mode) {
        if (!submitBtn) {
            return;
        }

        const isEditMode =
            mode === 'edit';

        submitBtn.innerHTML =
            isEditMode
                ? (
                    '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                    '<span id="message-submit-text">Save changes</span>'
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
                '<i class="fas fa-spinner fa-spin me-1"></i> Sending...';

            return;
        }

        submitBtn.disabled = false;

        /*
         * IMPORTANT:
         *
         * setSendingState(true) replaces submitBtn.innerHTML,
         * which removes the original #message-submit-icon and
         * #message-submit-text elements from the DOM.
         *
         * Therefore we must rebuild the button HTML here instead
         * of calling setSubmitMode(), which would operate on the
         * old detached DOM references.
         */

        if (
            editingMessageId &&
            editingMessageId.value
        ) {
            submitBtn.innerHTML =
                '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                '<span id="message-submit-text">Save changes</span>';

            return;
        }

        submitBtn.innerHTML =
            '<i class="fas fa-paper-plane me-1" id="message-submit-icon"></i>' +
            '<span id="message-submit-text">Send</span>';
    }

    function handleMessageAcknowledged(event) {
        const detail = event.detail || {};
        const messageId = Number(detail.messageId);

        if (!messageId || !isSubmittingMessage) {
            return;
        }

        /*
         * The WebSocket controller has confirmed that our message
         * was created and rendered. The HTTP request may still be
         * waiting for its response, so the visual Sending... state
         * must not depend on fetch() finishing.
         */
        isSubmittingMessage = false;
        activeMessageSendToken += 1;

        setSendingState(false);

        window.dispatchEvent(
            new CustomEvent('agro:message-sent')
        );

        resetComposerAfterSend();
    }

    window.addEventListener(
        'agro:message-acknowledged',
         handleMessageAcknowledged
    );


/* =========================================================
   SAVING STATE
   ========================================================= */


    function setSavingState(isSaving) {
        if (!submitBtn) {
            return;
        }

        if (isSaving) {
            submitBtn.disabled = true;

            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';

            return;
        }

        submitBtn.disabled = false;

        /*
         * setSavingState(true) replaces submitBtn.innerHTML,
         * which removes the original #message-submit-icon and
         * #message-submit-text elements from the DOM.
         *
         * Rebuild the button instead of using the old DOM references.
         */

        if (
            editingMessageId &&
            editingMessageId.value
        ) {
            submitBtn.innerHTML =
                '<i class="fas fa-save me-1" id="message-submit-icon"></i>' +
                '<span id="message-submit-text">Save changes</span>';

            return;
        }

        submitBtn.innerHTML =
            '<i class="fas fa-paper-plane me-1" id="message-submit-icon"></i>' +
            '<span id="message-submit-text">Send</span>';
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
                isSubmittingAttachment ||
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
                submitButton.disabled = true;
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
                form.dataset.loading = '0';

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
            isSubmittingAttachment ||
            !replyForm
        ) {
            return;
        }

        const sendUrl = getSendUrl();

        if (!sendUrl) {
            alert('Message send URL is missing.');
            return;
        }

        const body = messageBodyField
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

        if (imageFile || videoFile) {
            if (!validateAttachmentsBeforeSubmit()) {
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

        const shouldScroll = isChatAtBottom();
        const formData = new FormData(replyForm);

        isSubmittingMessage = true;
        const sendToken = ++activeMessageSendToken;

        setSendingState(true);

        try {
            const response = await fetch(
                sendUrl,
                {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    }
                }
            );

            const responseText = await response.text();

            let data = null;

            if (responseText) {
                try {
                    data = JSON.parse(responseText);
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

            if (data && data.ok === false) {
                throw new Error(
                    data.error ||
                    'Unable to send message.'
                );
            }

            /*
             * If the normal HTTP response contains the message,
             * render it immediately.
             *
             * If WebSocket already rendered it first,
             * appendRenderedMessage() safely ignores the duplicate.
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

            /*
             * Tell the typing controller that the message
             * has been successfully sent.
             */
            window.dispatchEvent(
                new CustomEvent('agro:message-sent')
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
             * If the WebSocket acknowledgement already completed
             * this send, do not let the HTTP request's finally block
             * reset the state of a newer send operation.
             */
            if (activeMessageSendToken === sendToken) {
                isSubmittingMessage = false;
                setSendingState(false);
            }
        }
    }


    /* =========================================================
       ATTACHMENT AJAX
       ========================================================= */

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

        if (!validateAttachmentsBeforeSubmit()) {
            return;
        }

        const sendUrl = getSendUrl();

        if (!sendUrl) {
            alert('Message send URL is missing.');
            return;
        }

        const shouldScroll = isChatAtBottom();
        const formData = new FormData(replyForm);
        const xhr = new XMLHttpRequest();

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
            function (e) {
                if (!e.lengthComputable) {
                    return;
                }

                updateUploadProgress(
                    Math.round(
                        (e.loaded / e.total) * 100
                    )
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
                        data = JSON.parse(
                            xhr.responseText
                        );
                    } catch (err) {
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

                    window.dispatchEvent(
                        new CustomEvent(
                            'agro:message-sent'
                        )
                    );

                    setTimeout(
                        hideUploadProgress,
                        300
                    );

                    resetComposerAfterSend();
                    resetUploadButton();

                    return;
                }

                let errorMessage =
                    'Upload failed. Please try again.';

                try {
                    const data = JSON.parse(
                        xhr.responseText
                    );

                    if (data.error) {
                        errorMessage = data.error;
                    }
                } catch (e) {}

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
            resetUploadButton
        );

        xhr.open(
            'POST',
            sendUrl,
            true
        );

        const csrfToken = getCsrfToken();

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
                '<i class="fas fa-paper-plane fa-paper-plane me-1"></i> Send';

            delete submitBtn.dataset.originalHtml;
        }
    }


    /* =========================================================
       FORM SUBMIT
       ========================================================= */

    if (replyForm) {
        replyForm.addEventListener(
            'submit',
            function (e) {
                e.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit ||
                    isSubmittingMessage
                ) {
                    return;
                }

                if (
                    editingMessageId &&
                    editingMessageId.value
                ) {
                    handleEditSubmit(e);
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

                if (imageFile || videoFile) {
                    if (
                        !validateAttachmentsBeforeSubmit()
                    ) {
                        return;
                    }

                    handleAttachmentSubmit(e);
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

            const url = button.dataset.url;

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

                    button.innerHTML = '✓';

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
                document.createElement('textarea');

            textarea.value = url;

            textarea.style.cssText =
                'position:fixed;left:-9999px;top:-9999px;opacity:0';

            document.body.appendChild(textarea);

            textarea.focus();
            textarea.select();

            try {
                document.execCommand('copy');
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
            const url = new URL(
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
                Array.isArray(data.reactors)
                    ? data.reactors
                    : []
            ).forEach(function (reactor) {
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

        if (Array.isArray(data.reactors)) {
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

    document.addEventListener(
        'click',
        async function (e) {
            const button =
                e.target.closest('.js-react');

            if (!button) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

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

            button.dataset.loading = '1';
            button.disabled = true;

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

                updateReactionUI(
                    button,
                    data
                );

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

                    chatWindow.dispatchEvent(
                        new Event('scroll')
                    );
                }

            } catch (error) {
                console.error(
                    'Reaction error:',
                    error
                );

                try {
                    await refreshMessageFragment(
                        messageId,
                        {
                            preserveScroll: true
                        }
                    );

                    if (chatWindow) {
                        chatWindow.scrollTop =
                            scrollTop;

                        chatWindow.dispatchEvent(
                            new Event('scroll')
                        );
                    }

                } catch (refreshError) {
                    console.error(
                        'Unable to restore reaction state:',
                        refreshError
                    );
                }

            } finally {
                button.dataset.loading = '0';
                button.disabled = false;

                const currentMessage =
                    getMessageElement(
                        messageId
                    );

                if (currentMessage) {
                    currentMessage
                        .querySelectorAll('.js-react')
                        .forEach(
                            function (btn) {
                                btn.disabled = false;
                                btn.dataset.loading = '0';
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
             * The separate WebSocket manager owns socket
             * cleanup. This file only releases local
             * media URLs.
             */
            revokeImageUrl();
            revokeVideoUrl();
        }
    );
});
