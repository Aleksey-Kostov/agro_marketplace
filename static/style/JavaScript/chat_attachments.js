document.addEventListener(
    'DOMContentLoaded',
    function () {
        'use strict';

        const replyForm =
            document.getElementById(
                'reply-form'
            );

        if (!replyForm) {
            return;
        }


        /* =========================================================
           ELEMENTS
           ========================================================= */

        const imageInput =
            document.getElementById(
                'id_image'
            );

        const videoInput =
            document.getElementById(
                'id_video'
            );

        const fileInput =
            document.getElementById(
                'id_file'
            );

        const imagePreview =
            document.getElementById(
                'image-preview'
            );

        const videoPreview =
            document.getElementById(
                'video-preview'
            );

        const imagePreviewWrap =
            document.getElementById(
                'image-preview-wrap'
            );

        const videoPreviewWrap =
            document.getElementById(
                'video-preview-wrap'
            );

        const filePreview =
            document.getElementById(
                'file-preview'
            );

        const filePreviewWrap =
            document.getElementById(
                'file-preview-wrap'
            );

        const attachImageBtn =
            document.getElementById(
                'attach-image-btn'
            );

        const attachVideoBtn =
            document.getElementById(
                'attach-video-btn'
            );

        const attachFileBtn =
            document.getElementById(
                'attach-file-btn'
            );

        const removeMediaBtn =
            document.getElementById(
                'remove-media-btn'
            );

        const chatWindow =
            document.getElementById(
                'chat-window'
            );

        const dropOverlay =
            document.getElementById(
                'chat-drop-overlay'
            );

        const uploadProgressWrap =
            document.getElementById(
                'upload-progress-wrap'
            );

        const uploadProgressBar =
            document.getElementById(
                'upload-progress-bar'
            );

        const uploadProgressText =
            document.getElementById(
                'upload-progress-text'
            );

        const uploadProgressPercent =
            document.getElementById(
                'upload-progress-percent'
            );

        const submitBtn =
            document.getElementById(
                'message-submit-btn'
            );


        /* =========================================================
           CONSTANTS
           ========================================================= */

        const MAX_IMAGE_SIZE =
            10 * 1024 * 1024;

        const MAX_VIDEO_SIZE =
            100 * 1024 * 1024;

        const MAX_FILE_SIZE =
            25 * 1024 * 1024;

        const ALLOWED_FILE_EXTENSIONS =
            new Set([
                '.pdf',
                '.txt',
                '.csv',
                '.doc',
                '.docx',
                '.xls',
                '.xlsx',
                '.ppt',
                '.pptx',
                '.zip'
            ]);


        /* =========================================================
           STATE
           ========================================================= */

        let imageObjectUrl = null;
        let videoObjectUrl = null;

        let dragCounter = 0;

        let isSubmittingAttachment =
            false;


        /* =========================================================
           HELPERS
           ========================================================= */

        function formatFileSize(bytes) {
            if (bytes < 1024) {
                return `${bytes} B`;
            }

            if (
                bytes <
                1024 * 1024
            ) {
                return (
                    `${(
                        bytes / 1024
                    ).toFixed(1)} KB`
                );
            }

            return (
                `${(
                    bytes /
                    1024 /
                    1024
                ).toFixed(1)} MB`
            );
        }


        function getExtension(file) {
            const name =
                file &&
                file.name
                    ? file.name
                    : '';

            const index =
                name.lastIndexOf(
                    '.'
                );

            if (index === -1) {
                return '';
            }

            return name
                .substring(index)
                .toLowerCase();
        }


        function setInputFile(
            input,
            file
        ) {
            if (
                !input ||
                !file
            ) {
                return false;
            }

            try {
                const dataTransfer =
                    new DataTransfer();

                dataTransfer.items.add(
                    file
                );

                input.files =
                    dataTransfer.files;

                return true;

            } catch (error) {
                console.error(
                    'Unable to assign attachment file:',
                    error
                );

                return false;
            }
        }


        /* =========================================================
           OBJECT URL CLEANUP
           ========================================================= */

        function revokeImageUrl() {
            if (
                imageObjectUrl
            ) {
                URL.revokeObjectURL(
                    imageObjectUrl
                );

                imageObjectUrl =
                    null;
            }
        }


        function revokeVideoUrl() {
            if (
                videoObjectUrl
            ) {
                URL.revokeObjectURL(
                    videoObjectUrl
                );

                videoObjectUrl =
                    null;
            }
        }


        /* =========================================================
           PREVIEW CLEANUP
           ========================================================= */

        function clearPreviewElements() {
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

            if (filePreviewWrap) {
                filePreviewWrap.classList.add(
                    'd-none'
                );
            }

            if (filePreview) {
                filePreview.innerHTML =
                    '';
            }
        }


        function clearMediaInputs() {
            if (imageInput) {
                imageInput.value =
                    '';
            }

            if (videoInput) {
                videoInput.value =
                    '';
            }

            if (fileInput) {
                fileInput.value =
                    '';
            }

            clearPreviewElements();

            if (removeMediaBtn) {
                removeMediaBtn.classList.add(
                    'd-none'
                );
            }
        }


        /* =========================================================
           VALIDATION
           ========================================================= */

        function validateImageFile(
            file
        ) {
            if (
                !file ||
                !file.type.startsWith(
                    'image/'
                )
            ) {
                alert(
                    'Please select a valid image file.'
                );

                return false;
            }

            if (
                file.size >
                MAX_IMAGE_SIZE
            ) {
                alert(
                    `Image is too large.\n\n` +
                    `Maximum size: 10 MB\n` +
                    `Selected: ${formatFileSize(
                        file.size
                    )}`
                );

                return false;
            }

            return true;
        }


        function validateVideoFile(
            file
        ) {
            if (
                !file ||
                !file.type.startsWith(
                    'video/'
                )
            ) {
                alert(
                    'Please select a valid video file.'
                );

                return false;
            }

            if (
                file.size >
                MAX_VIDEO_SIZE
            ) {
                alert(
                    `Video is too large.\n\n` +
                    `Maximum size: 100 MB\n` +
                    `Selected: ${formatFileSize(
                        file.size
                    )}`
                );

                return false;
            }

            return true;
        }


        function validateGenericFile(
            file
        ) {
            if (!file) {
                return false;
            }

            if (
                file.size >
                MAX_FILE_SIZE
            ) {
                alert(
                    `File is too large.\n\n` +
                    `Maximum size: 25 MB\n` +
                    `Selected: ${formatFileSize(
                        file.size
                    )}`
                );

                return false;
            }

            if (
                !ALLOWED_FILE_EXTENSIONS.has(
                    getExtension(file)
                )
            ) {
                alert(
                    'This file type is not allowed.'
                );

                return false;
            }

            return true;
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

            const genericFile =
                fileInput &&
                fileInput.files &&
                fileInput.files[0];

            const count =
                Number(
                    Boolean(
                        imageFile
                    )
                ) +
                Number(
                    Boolean(
                        videoFile
                    )
                ) +
                Number(
                    Boolean(
                        genericFile
                    )
                );

            if (count > 1) {
                alert(
                    'Please attach only one file per message.'
                );

                return false;
            }

            if (
                imageFile &&
                !validateImageFile(
                    imageFile
                )
            ) {
                return false;
            }

            if (
                videoFile &&
                !validateVideoFile(
                    videoFile
                )
            ) {
                return false;
            }

            if (
                genericFile &&
                !validateGenericFile(
                    genericFile
                )
            ) {
                return false;
            }

            return true;
        }


        function hasAttachment() {
            return Boolean(
                (
                    imageInput &&
                    imageInput.files &&
                    imageInput.files[0]
                ) ||
                (
                    videoInput &&
                    videoInput.files &&
                    videoInput.files[0]
                ) ||
                (
                    fileInput &&
                    fileInput.files &&
                    fileInput.files[0]
                )
            );
        }


        /* =========================================================
           REMOVE BUTTON
           ========================================================= */

        function showRemoveButton() {
            if (removeMediaBtn) {
                removeMediaBtn.classList.remove(
                    'd-none'
                );
            }
        }


        /* =========================================================
           IMAGE
           ========================================================= */

        function handleImageFile(
            file
        ) {
            if (
                !validateImageFile(
                    file
                )
            ) {
                return false;
            }

            if (videoInput) {
                videoInput.value =
                    '';
            }

            if (fileInput) {
                fileInput.value =
                    '';
            }

            revokeVideoUrl();

            if (!imagePreview) {
                return false;
            }

            revokeImageUrl();

            imageObjectUrl =
                URL.createObjectURL(
                    file
                );

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

            if (filePreviewWrap) {
                filePreviewWrap.classList.add(
                    'd-none'
                );
            }

            showRemoveButton();

            return true;
        }


        /* =========================================================
           VIDEO
           ========================================================= */

        function handleVideoFile(
            file
        ) {
            if (
                !validateVideoFile(
                    file
                )
            ) {
                return false;
            }

            if (imageInput) {
                imageInput.value =
                    '';
            }

            if (fileInput) {
                fileInput.value =
                    '';
            }

            revokeImageUrl();

            if (!videoPreview) {
                return false;
            }

            revokeVideoUrl();

            videoObjectUrl =
                URL.createObjectURL(
                    file
                );

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

            if (filePreviewWrap) {
                filePreviewWrap.classList.add(
                    'd-none'
                );
            }

            showRemoveButton();

            return true;
        }


        /* =========================================================
           GENERIC FILE
           ========================================================= */

        function handleGenericFile(
            file
        ) {
            if (
                !validateGenericFile(
                    file
                )
            ) {
                if (fileInput) {
                    fileInput.value =
                        '';
                }

                return false;
            }

            if (
                !setInputFile(
                    fileInput,
                    file
                )
            ) {
                return false;
            }

            if (imageInput) {
                imageInput.value =
                    '';
            }

            if (videoInput) {
                videoInput.value =
                    '';
            }

            clearPreviewElements();

            if (filePreview) {
                filePreview.innerHTML =
                    '';

                const icon =
                    document.createElement(
                        'i'
                    );

                icon.className =
                    'fas fa-file-alt';

                icon.setAttribute(
                    'aria-hidden',
                    'true'
                );

                const info =
                    document.createElement(
                        'div'
                    );

                info.className =
                    'file-preview-info';

                const name =
                    document.createElement(
                        'strong'
                    );

                name.className =
                    'file-preview-name';

                name.textContent =
                    file.name;

                const meta =
                    document.createElement(
                        'small'
                    );

                meta.className =
                    'file-preview-meta';

                meta.textContent =
                    `${
                        getExtension(
                            file
                        )
                            .replace(
                                '.',
                                ''
                            )
                            .toUpperCase()
                    } · ${
                        formatFileSize(
                            file.size
                        )
                    }`;

                info.appendChild(
                    name
                );

                info.appendChild(
                    meta
                );

                filePreview.appendChild(
                    icon
                );

                filePreview.appendChild(
                    info
                );
            }

            if (filePreviewWrap) {
                filePreviewWrap.classList.remove(
                    'd-none'
                );
            }

            showRemoveButton();

            return true;
        }


        /* =========================================================
           DROP OVERLAY
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


        function updateUploadProgress(
            percent
        ) {
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
                    String(
                        percent
                    )
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
           UPLOAD
           ========================================================= */

        function submitAttachment() {
            if (
                isSubmittingAttachment
            ) {
                return;
            }

            if (
                !validateAttachmentsBeforeSubmit()
            ) {
                return;
            }

            const sendUrl =
                replyForm.getAttribute(
                    'action'
                );

            if (!sendUrl) {
                alert(
                    'Message send URL is missing.'
                );

                return;
            }

            const shouldScroll =
                window.agroChatConversation &&
                typeof window.agroChatConversation.isAtBottom ===
                    'function'
                    ? window.agroChatConversation.isAtBottom()
                    : true;

            const formData =
                new FormData(
                    replyForm
                );

            const xhr =
                new XMLHttpRequest();

            isSubmittingAttachment =
                true;

            showUploadProgress();

            if (submitBtn) {
                submitBtn.disabled =
                    true;

                submitBtn.dataset.originalHtml =
                    submitBtn.innerHTML;

                submitBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin me-1"></i> Uploading...';
            }

            xhr.upload.addEventListener(
                'progress',
                function (event) {
                    if (
                        !event.lengthComputable
                    ) {
                        return;
                    }

                    updateUploadProgress(
                        Math.round(
                            (
                                event.loaded /
                                event.total
                            ) * 100
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
                        updateUploadProgress(
                            100
                        );

                        if (
                            uploadProgressText
                        ) {
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

                        if (
                            typeof window
                                .agroChatConversationAppend ===
                                'function'
                        ) {
                            window
                                .agroChatConversationAppend(
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

                        window.setTimeout(
                            hideUploadProgress,
                            300
                        );

                        clearMediaInputs();

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

                    } catch (error) {}

                    alert(
                        errorMessage
                    );

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

            const csrfInput =
                replyForm.querySelector(
                    '[name="csrfmiddlewaretoken"]'
                );

            if (csrfInput) {
                xhr.setRequestHeader(
                    'X-CSRFToken',
                    csrfInput.value
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

            xhr.send(
                formData
            );
        }


        function resetUploadButton() {
            hideUploadProgress();

            isSubmittingAttachment =
                false;

            if (submitBtn) {
                submitBtn.disabled =
                    false;

                submitBtn.innerHTML =
                    submitBtn.dataset.originalHtml ||
                    '<i class="fas fa-paper-plane me-1"></i> Send';

                delete submitBtn.dataset.originalHtml;
            }
        }


        /* =========================================================
           DROP
           ========================================================= */

        function handleDrop(
            event
        ) {
            const files =
                event.dataTransfer &&
                event.dataTransfer.files;

            if (
                !files ||
                !files.length
            ) {
                return;
            }

            const file =
                files[0];

            if (
                file.type.startsWith(
                    'image/'
                )
            ) {
                if (
                    !setInputFile(
                        imageInput,
                        file
                    )
                ) {
                    return;
                }

                handleImageFile(
                    file
                );

                return;
            }

            if (
                file.type.startsWith(
                    'video/'
                )
            ) {
                if (
                    !setInputFile(
                        videoInput,
                        file
                    )
                ) {
                    return;
                }

                handleVideoFile(
                    file
                );

                return;
            }

            if (
                validateGenericFile(
                    file
                )
            ) {
                handleGenericFile(
                    file
                );
            }
        }


        /* =========================================================
           BUTTONS
           ========================================================= */

        if (
            attachImageBtn &&
            imageInput
        ) {
            attachImageBtn.addEventListener(
                'click',
                function (event) {
                    event.preventDefault();

                    if (
                        !isSubmittingAttachment
                    ) {
                        imageInput.click();
                    }
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
                        !isSubmittingAttachment
                    ) {
                        videoInput.click();
                    }
                }
            );
        }


        if (
            attachFileBtn &&
            fileInput
        ) {
            attachFileBtn.addEventListener(
                'click',
                function (event) {
                    event.preventDefault();

                    if (
                        !isSubmittingAttachment
                    ) {
                        fileInput.click();
                    }
                }
            );
        }


        /* =========================================================
           INPUT CHANGE
           ========================================================= */

        if (imageInput) {
            imageInput.addEventListener(
                'change',
                function () {
                    const file =
                        imageInput.files &&
                        imageInput.files[0];

                    if (file) {
                        handleImageFile(
                            file
                        );
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
                        handleVideoFile(
                            file
                        );
                    }
                }
            );
        }


        if (fileInput) {
            fileInput.addEventListener(
                'change',
                function () {
                    const file =
                        fileInput.files &&
                        fileInput.files[0];

                    if (file) {
                        handleGenericFile(
                            file
                        );
                    }
                }
            );
        }


        /* =========================================================
           REMOVE
           ========================================================= */

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
           ========================================================= */

        if (chatWindow) {
            chatWindow.addEventListener(
                'dragenter',
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        isSubmittingAttachment
                    ) {
                        return;
                    }

                    dragCounter += 1;

                    showDropOverlay();
                }
            );


            chatWindow.addEventListener(
                'dragover',
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        isSubmittingAttachment
                    ) {
                        return;
                    }

                    if (
                        event.dataTransfer
                    ) {
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

                    dragCounter -= 1;

                    if (
                        dragCounter <=
                        0
                    ) {
                        dragCounter =
                            0;

                        hideDropOverlay();
                    }
                }
            );


            chatWindow.addEventListener(
                'drop',
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    dragCounter =
                        0;

                    hideDropOverlay();

                    if (
                        isSubmittingAttachment
                    ) {
                        return;
                    }

                    handleDrop(
                        event
                    );
                }
            );
        }


        /* =========================================================
           PASTE IMAGE
           ========================================================= */

        const messageBodyField =
            replyForm.querySelector(
                '[name="body"]'
            ) ||
            replyForm.querySelector(
                'textarea'
            );

        document.addEventListener(
            'paste',
            function (event) {
                if (
                    !messageBodyField ||
                    isSubmittingAttachment
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
                    event.clipboardData &&
                    event.clipboardData.items;

                if (!items) {
                    return;
                }

                for (
                    let i = 0;
                    i < items.length;
                    i++
                ) {
                    const item =
                        items[i];

                    if (
                        item.kind !==
                            'file' ||
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
                        !validateImageFile(
                            file
                        )
                    ) {
                        return;
                    }

                    if (
                        !setInputFile(
                            imageInput,
                            file
                        )
                    ) {
                        return;
                    }

                    handleImageFile(
                        file
                    );

                    event.preventDefault();

                    return;
                }
            }
        );


        /* =========================================================
           PUBLIC API
           ========================================================= */

        window.agroChatAttachments = {
            clear:
                clearMediaInputs,

            hasAttachment:
                hasAttachment,

            validate:
                validateAttachmentsBeforeSubmit,

            isBusy:
                function () {
                    return isSubmittingAttachment;
                },

            submit:
                submitAttachment
        };


        /* =========================================================
           AFTER MESSAGE SENT
           ========================================================= */

        window.addEventListener(
            'agro:message-sent',
            function () {
                clearMediaInputs();
            }
        );
    }
);
