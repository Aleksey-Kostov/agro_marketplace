document.addEventListener('DOMContentLoaded', function () {

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
       REPLY MEDIA PREVIEW
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


    /*
     * Remember the original form action.
     *
     * This is important because Edit temporarily changes
     * the form action to the edit URL.
     */

    const normalFormAction = replyForm
        ? (
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


    /* =========================================================
       WEBSOCKET STATE
    ========================================================== */

    let messageWebSocket = null;
    let websocketReconnectTimer = null;
    let websocketManuallyClosed = false;


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
       EMOJI
    ========================================================== */

    document.addEventListener('click', function (event) {

        const emojiButton =
            event.target.closest('.emoji-btn');

        if (!emojiButton || !messageBodyField) {
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
            document.getElementById('emoji-toggle-btn');

        if (toggle && window.bootstrap) {

            const instance =
                bootstrap.Dropdown.getInstance(toggle);

            if (instance) {
                instance.hide();
            }

        }

    });


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
                resizeObserver.observe(chatMessages);
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

        URL.revokeObjectURL(imageObjectUrl);

        imageObjectUrl = null;

    }


    function revokeVideoUrl() {

        if (!videoObjectUrl) {
            return;
        }

        URL.revokeObjectURL(videoObjectUrl);

        videoObjectUrl = null;

    }


    /* =========================================================
       REPLY MEDIA
    ========================================================== */

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


    function setReplyMedia(imageUrl, videoUrl) {

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

            imagePreview.removeAttribute('src');

        }

        if (videoPreview) {

            videoPreview.pause();

            videoPreview.removeAttribute('src');

            videoPreview.load();

        }

        hideMediaPreviews();

    }


    /* =========================================================
       HIDE MEDIA PREVIEWS
    ========================================================== */

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

            videoPreview.removeAttribute('src');

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

            imagePreview.removeAttribute('src');

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

    if (attachImageBtn && imageInput) {

        attachImageBtn.addEventListener(
            'click',
            function (event) {

                event.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit
                ) {
                    return;
                }

                imageInput.click();

            }
        );

    }


    if (attachVideoBtn && videoInput) {

        attachVideoBtn.addEventListener(
            'click',
            function (event) {

                event.preventDefault();

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit
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

                if (isSubmittingEdit) {
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

                if (isSubmittingEdit) {
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

                if (isSubmittingEdit) {
                    return;
                }

                const files =
                    event.dataTransfer &&
                    event.dataTransfer.files;

                if (!files || !files.length) {
                    return;
                }

                const file = files[0];


                /* IMAGE */

                if (file.type.startsWith('image/')) {

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


                /* VIDEO */

                if (file.type.startsWith('video/')) {

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

            if (isSubmittingEdit) {
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

        if (imageFile && videoFile) {

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

        if (!messageId || !editUrl) {
            return;
        }

        clearMediaInputs();

        if (replyToInput) {
            replyToInput.value = '';
        }

        if (replyBar) {
            replyBar.classList.add('d-none');
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
            editingBar.classList.add('d-none');
        }

        if (replyForm) {

            replyForm.setAttribute(
                'action',
                normalFormAction
            );

        }

        setSubmitMode('send');

        if (clearBody && messageBodyField) {
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
            editingBar.classList.add('d-none');
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

        if (clearBody && messageBodyField) {

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
                isSubmittingEdit
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
                isSubmittingEdit
            ) {
                return;
            }

            startReply(button);

        }
    );


    /* =========================================================
       CANCEL EDIT BUTTON
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
       CANCEL REPLY BUTTON
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
       FORM SUBMIT
    ========================================================== */

    if (replyForm) {

        replyForm.addEventListener(
            'submit',
            function (event) {

                if (
                    isSubmittingAttachment ||
                    isSubmittingEdit
                ) {

                    event.preventDefault();

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

                const hasAttachment =
                    Boolean(
                        imageFile ||
                        videoFile
                    );

                if (!hasAttachment) {

                    return;

                }

                if (
                    !validateAttachmentsBeforeSubmit()
                ) {

                    event.preventDefault();

                    return;

                }

                handleAttachmentSubmit(event);

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
       ATTACHMENT AJAX SUBMIT
    ========================================================== */

    function handleAttachmentSubmit(event) {

        event.preventDefault();

        if (
            !replyForm ||
            isSubmittingAttachment
        ) {
            return;
        }

        if (
            !validateAttachmentsBeforeSubmit()
        ) {
            return;
        }

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

                updateUploadProgress(percent);

            }
        );

        xhr.addEventListener(
            'load',
            function () {

                if (
                    xhr.status >= 200 &&
                    xhr.status < 400
                ) {

                    updateUploadProgress(100);

                    if (uploadProgressText) {

                        uploadProgressText.textContent =
                            'Upload complete';

                    }

                    setTimeout(function () {

                        if (xhr.responseURL) {

                            window.location.href =
                                xhr.responseURL;

                        } else {

                            window.location.reload();

                        }

                    }, 250);

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
            replyForm.action ||
            window.location.href,
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

                    setTimeout(function () {

                        button.innerHTML =
                            oldHtml;

                    }, 1200);

                    return;

                }

            } catch (error) {

                console.error(
                    'Clipboard failed:',
                    error
                );

            }

            const textarea =
                document.createElement('textarea');

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

            document.body.appendChild(textarea);

            textarea.focus();
            textarea.select();

            try {

                document.execCommand('copy');

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
        "{% static 'images/profile_picture.webp' %}";


    document.addEventListener(
        'click',
        async function (event) {

            const button =
                event.target.closest('.js-react');

            if (!button) {
                return;
            }

            event.preventDefault();

            if (
                button.dataset.loading === '1'
            ) {
                return;
            }

            button.dataset.loading = '1';

            const csrfToken =
                getCsrfToken();

            if (!csrfToken) {

                console.error(
                    'CSRF token not found.'
                );

                button.dataset.loading = '0';

                return;

            }

            try {

                const url =
                    button.getAttribute('href');

                if (!url) {

                    throw new Error(
                        'Reaction URL not found.'
                    );

                }

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
                        `Invalid server response (${response.status}).`
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

                const reaction =
                    data.reaction ||
                    button.dataset.reaction;

                const messageId =
                    data.message_id ||
                    button.dataset.msg;

                button.classList.toggle(
                    'active-like',
                    reaction === 'like' &&
                    Boolean(data.active)
                );

                button.classList.toggle(
                    'active-heart',
                    reaction === 'heart' &&
                    Boolean(data.active)
                );

                let avatarBox =
                    button.querySelector(
                        '[data-react-avatars]'
                    );

                if (
                    !avatarBox &&
                    messageId &&
                    reaction
                ) {

                    avatarBox =
                        document.querySelector(
                            `[data-react-avatars="${reaction}-${messageId}"]`
                        );

                }

                if (avatarBox) {

                    avatarBox.replaceChildren();

                    const reactors =
                        Array.isArray(data.reactors)
                            ? data.reactors
                            : [];

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

                if (
                    Array.isArray(data.reactors)
                ) {

                    const names =
                        data.reactors
                            .map(function (reactor) {
                                return reactor.username;
                            })
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

            } catch (error) {

                console.error(
                    'Reaction error:',
                    error
                );

            } finally {

                button.dataset.loading = '0';

            }

        }
    );


    /* =========================================================
       WEBSOCKET
       RECEIVE NEW MESSAGES WITHOUT REFRESH
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


    function getMessageFragmentUrl(messageId) {

        if (!chatWindow) {
            return null;
        }

        const template =
            chatWindow.dataset.messageFragmentUrl;

        if (!template) {

            console.error(
                'WebSocket: data-message-fragment-url is missing.'
            );

            return null;

        }

        /*
         * In message-read.html we have:
         *
         * data-message-fragment-url="{% url 'message-fragment' 0 %}"
         *
         * Example:
         *
         * /messages/0/fragment/
         *
         * Replace only the trailing /0/ part.
         */

        return template.replace(
            /\/0\/?$/,
            `/${encodeURIComponent(messageId)}/`
        );

    }


    function isUserAtBottom() {

        if (!chatWindow) {
            return true;
        }

        return (
            chatWindow.scrollTop +
            chatWindow.clientHeight
        ) >= (
            chatWindow.scrollHeight -
            50
        );

    }


    async function appendIncomingMessage(message) {

        if (!chatMessages || !message) {
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


        /*
         * Never add the same message twice.
         */

        if (
            document.getElementById(
                `msg-${messageId}`
            )
        ) {
            return;
        }


        /*
         * Current architecture:
         *
         * - normal text messages are created through HTTP POST;
         * - Django then broadcasts the created message through
         *   WebSocket;
         * - sender receives the HTTP response/page redirect;
         * - therefore we must not append our own WebSocket copy.
         */

        const currentUserId =
            chatWindow
                ? Number(
                    chatWindow.dataset.currentUserId
                )
                : null;

        if (
            currentUserId &&
            Number(message.sender_id) ===
                currentUserId
        ) {
            return;
        }


        const shouldScroll =
            isUserAtBottom();


        const fragmentUrl =
            getMessageFragmentUrl(messageId);

        if (!fragmentUrl) {
            return;
        }


        try {

            const response =
                await fetch(
                    fragmentUrl,
                    {
                        method: 'GET',
                        credentials: 'same-origin',
                        headers: {
                            'X-Requested-With':
                                'XMLHttpRequest',
                            'Accept':
                                'application/json'
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Unable to load message fragment (${response.status}).`
                );

            }


            let data;

            try {

                data =
                    await response.json();

            } catch (error) {

                throw new Error(
                    'Message fragment returned invalid JSON.'
                );

            }


            if (
                !data ||
                !data.ok ||
                !data.html
            ) {

                throw new Error(
                    'Invalid message fragment response.'
                );

            }


            /*
             * Check again after the asynchronous request.
             *
             * This prevents duplicates if two WebSocket events
             * or another request add the message while we are
             * waiting for Django.
             */

            if (
                document.getElementById(
                    `msg-${messageId}`
                )
            ) {
                return;
            }


            /*
             * Django rendered messages/_message.html.
             *
             * Therefore this HTML is exactly the same structure
             * as the messages rendered during the initial page load.
             */

            chatMessages.insertAdjacentHTML(
                'beforeend',
                data.html
            );


            /*
             * Verify that Django actually returned the expected
             * message element.
             */

            const insertedMessage =
                document.getElementById(
                    `msg-${messageId}`
                );

            if (!insertedMessage) {

                console.warn(
                    'Message fragment inserted, but expected message element was not found:',
                    messageId
                );

            }


            /*
             * Scroll only when the user was already at the bottom.
             */

            if (shouldScroll) {

                requestAnimationFrame(function () {

                    chatWindow.scrollTo({
                        top: chatWindow.scrollHeight,
                        behavior: 'smooth'
                    });

                });

            }


            updateScrollButtons();


        } catch (error) {

            console.error(
                'Unable to append WebSocket message:',
                error
            );

        }

    }


    function handleWebSocketMessage(event) {

        let data;

        try {

            data =
                JSON.parse(event.data);

        } catch (error) {

            console.error(
                'WebSocket invalid JSON:',
                error
            );

            return;

        }


        /*
         * Connection established.
         */

        if (
            data.type ===
            'connection_established'
        ) {

            console.log(
                'WebSocket connected.'
            );

            return;

        }


        /*
         * New message.
         */

        if (
            data.type ===
            'message_created'
        ) {

            if (data.message) {

                appendIncomingMessage(
                    data.message
                ).catch(function (error) {

                    console.error(
                        'WebSocket message rendering error:',
                        error
                    );

                });

            }

            return;

        }


        /*
         * Server error.
         */

        if (
            data.type ===
            'error'
        ) {

            console.error(
                'WebSocket server error:',
                data.code,
                data.message
            );

            return;

        }

    }


    function scheduleWebSocketReconnect() {

        if (websocketManuallyClosed) {
            return;
        }

        if (websocketReconnectTimer) {
            return;
        }

        websocketReconnectTimer =
            setTimeout(function () {

                websocketReconnectTimer =
                    null;

                connectWebSocket();

            }, WEBSOCKET_RECONNECT_DELAY);

    }


    function connectWebSocket() {

        if (!chatWindow) {
            return;
        }

        const url =
            getWebSocketUrl();

        if (!url) {
            return;
        }


        /*
         * Do not open a second connection.
         */

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


        websocketManuallyClosed = false;


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


    function closeWebSocket() {

        websocketManuallyClosed = true;


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


    /*
     * Start WebSocket after the page has initialized.
     */

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

                scrollButtonHideTimer = null;

            }

        }
    );

});
