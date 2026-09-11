document.addEventListener('DOMContentLoaded', function () {


    /* =========================================================
       EMOJI
    ========================================================== */

    document.querySelectorAll('.emoji-btn').forEach(function (btn) {

        btn.addEventListener('click', function (e) {

            e.preventDefault();
            e.stopPropagation();

            const input =
                document.getElementById('message-body-input') ||
                document.querySelector('textarea[name="body"]') ||
                document.querySelector('input[name="body"]');

            if (!input) {
                return;
            }

            input.value += btn.dataset.emoji || '';

            input.focus();

        });

    });


    /* =========================================================
       CHAT SCROLL
    ========================================================== */

    const chatWindow =
        document.getElementById('chat-window');

    const scrollTopBtn =
        document.getElementById('scroll-top-btn');

    const scrollBottomBtn =
        document.getElementById('scroll-bottom-btn');


    const SCROLL_EPSILON = 1;

    /*
     * След колко милисекунди без движение
     * стрелките да се скрият.
     */
    const SCROLL_BUTTON_HIDE_DELAY = 2000;

    let scrollButtonHideTimer = null;


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


    /* =========================================================
       SHOW SCROLL BUTTONS
    ========================================================== */

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


    /* =========================================================
       HIDE SCROLL BUTTONS AFTER INACTIVITY
    ========================================================== */

    function scheduleScrollButtonHide() {

        if (scrollButtonHideTimer) {

            clearTimeout(
                scrollButtonHideTimer
            );

        }


        scrollButtonHideTimer =
            setTimeout(
                function () {

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

                },
                SCROLL_BUTTON_HIDE_DELAY
            );

    }


    /* =========================================================
       UPDATE SCROLL BUTTON STATE
    ========================================================== */

    function updateScrollButtons() {

        if (!chatWindow) {
            return;
        }


        const currentScrollTop =
            chatWindow.scrollTop;


        const maxScrollTop =
            getMaxScrollTop();


        /*
         * UP
         */

        const atTop =
            currentScrollTop <=
            SCROLL_EPSILON;


        /*
         * DOWN
         */

        const atBottom =
            currentScrollTop >=
            maxScrollTop -
            SCROLL_EPSILON;


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


    /* =========================================================
       SCROLL TOP
    ========================================================== */

    function scrollToTop() {

        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

    }


    /* =========================================================
       SCROLL BOTTOM
    ========================================================== */

    function scrollToBottom() {

        if (!chatWindow) {
            return;
        }

        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: 'smooth'
        });

    }


    /* =========================================================
       SCROLL EVENTS
    ========================================================== */

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
            function () {

                updateScrollButtons();

            }
        );


        /*
         * Images/videos могат да променят
         * височината на conversation-а.
         */

        if ('ResizeObserver' in window) {

            const resizeObserver =
                new ResizeObserver(
                    function () {

                        updateScrollButtons();

                    }
                );


            resizeObserver.observe(
                chatWindow
            );


            const messages =
                document.getElementById(
                    'chat-messages'
                );


            if (messages) {

                resizeObserver.observe(
                    messages
                );

            }

        }

    }


    /* =========================================================
       UP BUTTON
    ========================================================== */

    if (scrollTopBtn) {

        scrollTopBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();

                scrollToTop();

            }
        );

    }


    /* =========================================================
       DOWN BUTTON
    ========================================================== */

    if (scrollBottomBtn) {

        scrollBottomBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();

                scrollToBottom();

            }
        );

    }


    /* =========================================================
       INITIAL CHAT POSITION
    ========================================================== */

    function initializeChatPosition() {

        if (!chatWindow) {
            return;
        }


        requestAnimationFrame(
            function () {

                const maxScrollTop =
                    Math.max(
                        0,
                        chatWindow.scrollHeight -
                        chatWindow.clientHeight
                    );


                chatWindow.scrollTop =
                    maxScrollTop;


                updateScrollButtons();


                requestAnimationFrame(
                    function () {

                        const finalMaxScrollTop =
                            Math.max(
                                0,
                                chatWindow.scrollHeight -
                                chatWindow.clientHeight
                            );


                        chatWindow.scrollTop =
                            finalMaxScrollTop;


                        updateScrollButtons();

                    }
                );

            }
        );

    }


    if (document.readyState === 'complete') {

        initializeChatPosition();

    } else {

        window.addEventListener(
            'load',
            initializeChatPosition,
            {
                once: true
            }
        );

    }


    /* =========================================================
       MEDIA ELEMENTS
    ========================================================== */

    const imageInput =
        document.getElementById('id_image');

    const videoInput =
        document.getElementById('id_video');

    const imagePreview =
        document.getElementById('image-preview');

    const videoPreview =
        document.getElementById('video-preview');

    const imagePreviewWrapper =
        document.getElementById('image-preview-wrap');

    const videoPreviewWrapper =
        document.getElementById('video-preview-wrap');

    const attachImageBtn =
        document.getElementById('attach-image-btn');

    const attachVideoBtn =
        document.getElementById('attach-video-btn');

    const removeMediaBtn =
        document.getElementById('remove-media-btn');

    const replyForm =
        document.getElementById('reply-form');

    const dropOverlay =
        document.getElementById('chat-drop-overlay');

    const uploadProgressWrap =
        document.getElementById('upload-progress-wrap');

    const uploadProgressBar =
        document.getElementById('upload-progress-bar');

    const uploadProgressText =
        document.getElementById('upload-progress-text');

    const uploadProgressPercent =
        document.getElementById('upload-progress-percent');


    /* =========================================================
       FILE SIZE LIMITS
    ========================================================== */

    const MAX_IMAGE_SIZE =
        10 * 1024 * 1024;

    const MAX_VIDEO_SIZE =
        100 * 1024 * 1024;


    let imageObjectUrl = null;
    let videoObjectUrl = null;


    /* =========================================================
       FORMAT FILE SIZE
    ========================================================== */

    function formatFileSize(bytes) {

        if (bytes < 1024) {

            return `${bytes} B`;

        }


        if (bytes < 1024 * 1024) {

            return `${(bytes / 1024).toFixed(1)} KB`;

        }


        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    }


    /* =========================================================
       IMAGE VALIDATION
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
                `Image is too large.\n\n` +
                `Maximum size: 10 MB\n` +
                `Selected: ${formatFileSize(file.size)}`
            );

            return false;

        }


        return true;

    }


    /* =========================================================
       VIDEO VALIDATION
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
                `Video is too large.\n\n` +
                `Maximum size: 100 MB\n` +
                `Selected: ${formatFileSize(file.size)}`
            );

            return false;

        }


        return true;

    }


    /* =========================================================
       FILE PICKERS
    ========================================================== */

    if (attachImageBtn && imageInput) {

        attachImageBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();

                imageInput.click();

            }
        );

    }


    if (attachVideoBtn && videoInput) {

        attachVideoBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();

                videoInput.click();

            }
        );

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
       HIDE MEDIA PREVIEWS
    ========================================================== */

    function hideMediaPreviews() {

        if (imagePreviewWrapper) {

            imagePreviewWrapper.classList.add(
                'd-none'
            );

        }


        if (videoPreviewWrapper) {

            videoPreviewWrapper.classList.add(
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
       HANDLE IMAGE FILE
    ========================================================== */

    function handleImageFile(file) {

        if (!validateImageFile(file)) {

            if (imageInput) {
                imageInput.value = '';
            }

            return;

        }


        /*
         * Remove video.
         */

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
            return;
        }


        revokeImageUrl();


        imageObjectUrl =
            URL.createObjectURL(file);


        imagePreview.src =
            imageObjectUrl;


        if (imagePreviewWrapper) {

            imagePreviewWrapper.classList.remove(
                'd-none'
            );

        }


        if (videoPreviewWrapper) {

            videoPreviewWrapper.classList.add(
                'd-none'
            );

        }


        if (removeMediaBtn) {

            removeMediaBtn.classList.remove(
                'd-none'
            );

        }

    }


    /* =========================================================
       HANDLE VIDEO FILE
    ========================================================== */

    function handleVideoFile(file) {

        if (!validateVideoFile(file)) {

            if (videoInput) {
                videoInput.value = '';
            }

            return;

        }


        /*
         * Remove image.
         */

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
            return;
        }


        revokeVideoUrl();


        videoObjectUrl =
            URL.createObjectURL(file);


        videoPreview.src =
            videoObjectUrl;


        videoPreview.load();


        if (videoPreviewWrapper) {

            videoPreviewWrapper.classList.remove(
                'd-none'
            );

        }


        if (imagePreviewWrapper) {

            imagePreviewWrapper.classList.add(
                'd-none'
            );

        }


        if (removeMediaBtn) {

            removeMediaBtn.classList.remove(
                'd-none'
            );

        }

    }


    /* =========================================================
       IMAGE SELECT
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
       VIDEO SELECT
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
       DRAG & DROP
    ========================================================== */

    let dragCounter = 0;


    function showDropOverlay() {

        if (!dropOverlay) {
            return;
        }


        dropOverlay.classList.add(
            'active'
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
            'active'
        );


        dropOverlay.setAttribute(
            'aria-hidden',
            'true'
        );

    }


    if (chatWindow && dropOverlay) {

        chatWindow.addEventListener(
            'dragenter',
            function (e) {

                e.preventDefault();
                e.stopPropagation();

                dragCounter++;

                showDropOverlay();

            }
        );


        chatWindow.addEventListener(
            'dragover',
            function (e) {

                e.preventDefault();
                e.stopPropagation();


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


                const files =
                    e.dataTransfer &&
                    e.dataTransfer.files;


                if (
                    !files ||
                    !files.length
                ) {

                    return;

                }


                const file =
                    files[0];


                /*
                 * IMAGE
                 */

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


                    const dataTransfer =
                        new DataTransfer();


                    dataTransfer.items.add(
                        file
                    );


                    if (imageInput) {

                        imageInput.files =
                            dataTransfer.files;

                    }


                    if (videoInput) {

                        videoInput.value =
                            '';

                    }


                    handleImageFile(
                        file
                    );

                    return;

                }


                /*
                 * VIDEO
                 */

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


                    const dataTransfer =
                        new DataTransfer();


                    dataTransfer.items.add(
                        file
                    );


                    if (videoInput) {

                        videoInput.files =
                            dataTransfer.files;

                    }


                    if (imageInput) {

                        imageInput.value =
                            '';

                    }


                    handleVideoFile(
                        file
                    );

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
        function (e) {

            const activeElement =
                document.activeElement;


            /*
             * Paste image only when
             * inside message input.
             */

            if (
                !activeElement ||
                !(
                    activeElement.matches(
                        'textarea[name="body"]'
                    ) ||
                    activeElement.matches(
                        'input[name="body"]'
                    ) ||
                    activeElement.id ===
                        'message-body-input'
                )
            ) {

                return;

            }


            const clipboardItems =
                e.clipboardData &&
                e.clipboardData.items;


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
                    !item.type.startsWith(
                        'image/'
                    )
                ) {

                    continue;

                }


                const file =
                    item.getAsFile();


                if (!file) {
                    continue;
                }


                if (
                    !validateImageFile(
                        file
                    )
                ) {

                    return;

                }


                const dataTransfer =
                    new DataTransfer();


                dataTransfer.items.add(
                    file
                );


                if (imageInput) {

                    imageInput.files =
                        dataTransfer.files;

                }


                if (videoInput) {

                    videoInput.value =
                        '';

                }


                handleImageFile(
                    file
                );


                /*
                 * Не позволява изображението
                 * да бъде поставено в textarea.
                 */

                e.preventDefault();

                return;

            }

        }
    );


    /* =========================================================
       REMOVE MEDIA
    ========================================================== */

    if (removeMediaBtn) {

        removeMediaBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();


                if (imageInput) {

                    imageInput.value =
                        '';

                }


                if (videoInput) {

                    videoInput.value =
                        '';

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
        );

    }


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

        percent =
            Math.max(
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
       VALIDATE ATTACHMENTS BEFORE SUBMIT
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


        /*
         * Само един attachment.
         */

        if (
            imageFile &&
            videoFile
        ) {

            alert(
                'Please attach either an image or a video, not both.'
            );

            return false;

        }


        if (imageFile) {

            if (
                !validateImageFile(
                    imageFile
                )
            ) {

                return false;

            }

        }


        if (videoFile) {

            if (
                !validateVideoFile(
                    videoFile
                )
            ) {

                return false;

            }

        }


        return true;

    }


    /* =========================================================
       AJAX UPLOAD WITH PROGRESS
    ========================================================== */

    if (replyForm) {

        replyForm.addEventListener(
            'submit',
            function (e) {

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


                /*
                 * Text-only message:
                 * normal Django submit.
                 */

                if (!hasAttachment) {

                    return;

                }


                if (
                    !validateAttachmentsBeforeSubmit()
                ) {

                    e.preventDefault();

                    return;

                }


                e.preventDefault();


                const formData =
                    new FormData(
                        replyForm
                    );


                const xhr =
                    new XMLHttpRequest();


                showUploadProgress();


                const submitButton =
                    replyForm.querySelector(
                        'button[type="submit"]'
                    );


                if (submitButton) {

                    submitButton.disabled =
                        true;


                    submitButton.dataset.originalHtml =
                        submitButton.innerHTML;


                    submitButton.innerHTML =
                        '<i class="fas fa-spinner fa-spin me-1"></i> Uploading...';

                }


                /*
                 * Upload progress.
                 */

                xhr.upload.addEventListener(
                    'progress',
                    function (event) {

                        if (
                            !event.lengthComputable
                        ) {

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


                /*
                 * Request complete.
                 */

                xhr.addEventListener(
                    'load',
                    function () {

                        if (
                            xhr.status >= 200 &&
                            xhr.status < 400
                        ) {

                            updateUploadProgress(
                                100
                            );


                            if (
                                uploadProgressText
                            ) {

                                uploadProgressText.textContent =
                                    'Upload complete';

                            }


                            setTimeout(
                                function () {

                                    if (
                                        xhr.responseURL
                                    ) {

                                        window.location.href =
                                            xhr.responseURL;

                                    } else {

                                        window.location.reload();

                                    }

                                },
                                250
                            );


                        } else {

                            alert(
                                'Upload failed. Please try again.'
                            );


                            hideUploadProgress();


                            if (submitButton) {

                                submitButton.disabled =
                                    false;


                                submitButton.innerHTML =
                                    submitButton.dataset.originalHtml ||
                                    '<i class="fas fa-paper-plane me-1"></i> Send';

                            }

                        }

                    }
                );


                /*
                 * Network error.
                 */

                xhr.addEventListener(
                    'error',
                    function () {

                        alert(
                            'Upload failed. Please check your connection and try again.'
                        );


                        hideUploadProgress();


                        if (submitButton) {

                            submitButton.disabled =
                                false;


                            submitButton.innerHTML =
                                submitButton.dataset.originalHtml ||
                                '<i class="fas fa-paper-plane me-1"></i> Send';

                        }

                    }
                );


                /*
                 * Request aborted.
                 */

                xhr.addEventListener(
                    'abort',
                    function () {

                        hideUploadProgress();


                        if (submitButton) {

                            submitButton.disabled =
                                false;


                            submitButton.innerHTML =
                                submitButton.dataset.originalHtml ||
                                '<i class="fas fa-paper-plane me-1"></i> Send';

                        }

                    }
                );


                xhr.open(
                    'POST',
                    replyForm.action ||
                    window.location.href,
                    true
                );


                /*
                 * CSRF
                 */

                const csrfTokenElement =
                    replyForm.querySelector(
                        '[name="csrfmiddlewaretoken"]'
                    );


                if (csrfTokenElement) {

                    xhr.setRequestHeader(
                        'X-CSRFToken',
                        csrfTokenElement.value
                    );

                }


                xhr.setRequestHeader(
                    'X-Requested-With',
                    'XMLHttpRequest'
                );


                xhr.send(
                    formData
                );

            }
        );

    }


    /* =========================================================
       CLEANUP
    ========================================================== */

    window.addEventListener(
        'beforeunload',
        function () {

            revokeImageUrl();

            revokeVideoUrl();


            if (scrollButtonHideTimer) {

                clearTimeout(
                    scrollButtonHideTimer
                );

            }

        }
    );


    /* =========================================================
       SHARE
    ========================================================== */

    document.addEventListener(
        'click',
        async function (e) {

            const btn =
                e.target.closest(
                    '.share-btn'
                );


            if (!btn) {
                return;
            }


            e.preventDefault();


            const url =
                btn.dataset.url;


            if (!url) {
                return;
            }


            /*
             * Native share.
             */

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


            /*
             * Clipboard API.
             */

            try {

                if (
                    navigator.clipboard &&
                    window.isSecureContext
                ) {

                    await navigator.clipboard.writeText(
                        url
                    );


                    const oldHtml =
                        btn.innerHTML;


                    btn.innerHTML =
                        '✓';


                    setTimeout(
                        function () {

                            btn.innerHTML =
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


            /*
             * Fallback copy.
             */

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
        "{% static 'images/profile_picture.webp' %}";


    document.addEventListener(
        'click',
        async function (e) {

            const btn =
                e.target.closest(
                    '.js-react'
                );


            if (!btn) {
                return;
            }


            e.preventDefault();


            if (
                btn.dataset.loading ===
                '1'
            ) {

                return;

            }


            btn.dataset.loading =
                '1';


            const csrfTokenElement =
                document.querySelector(
                    '[name="csrfmiddlewaretoken"]'
                );


            const csrfToken =
                csrfTokenElement
                    ? csrfTokenElement.value
                    : '';


            if (!csrfToken) {

                console.error(
                    'CSRF token not found.'
                );


                btn.dataset.loading =
                    '0';


                return;

            }


            try {

                const url =
                    btn.href;


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

                            credentials:
                                'same-origin',

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
                    btn.dataset.reaction;


                const messageId =
                    data.message_id ||
                    btn.dataset.msg;


                /* =================================================
                   ACTIVE STATE
                ================================================== */

                btn.classList.toggle(
                    'active-like',
                    reaction === 'like' &&
                    Boolean(data.active)
                );


                btn.classList.toggle(
                    'active-heart',
                    reaction === 'heart' &&
                    Boolean(data.active)
                );


                /* =================================================
                   AVATAR BOX
                ================================================== */

                let avatarBox =
                    btn.querySelector(
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


                /* =================================================
                   RENDER REACTORS
                ================================================== */

                if (avatarBox) {

                    avatarBox.replaceChildren();


                    const reactors =
                        Array.isArray(
                            data.reactors
                        )
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


                /* =================================================
                   TOOLTIP
                ================================================== */

                if (
                    Array.isArray(
                        data.reactors
                    )
                ) {

                    const names =
                        data.reactors
                            .map(
                                function (reactor) {

                                    return reactor.username;

                                }
                            )
                            .filter(Boolean);


                    if (names.length) {

                        btn.title =
                            names.join(', ');

                    } else {

                        btn.title =
                            reaction === 'heart'
                                ? 'Heart'
                                : 'Like';

                    }

                }

            } catch (error) {

                console.error(
                    'Reaction error:',
                    error
                );

            } finally {

                btn.dataset.loading =
                    '0';

            }

        }
    );

});
