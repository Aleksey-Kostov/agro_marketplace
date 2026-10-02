document.addEventListener(
    'DOMContentLoaded',
    function () {
        'use strict';

        const replyForm =
            document.getElementById('reply-form');

        const messageBodyField =
            replyForm
                ? (
                    replyForm.querySelector('[name="body"]') ||
                    replyForm.querySelector('textarea')
                )
                : null;

        const submitBtn =
            document.getElementById(
                'message-submit-btn'
            );

        const editingMessageId =
            document.getElementById(
                'editing-message-id'
            );

        if (
            !replyForm ||
            !submitBtn
        ) {
            return;
        }


        /* =========================================================
           STATE
        ========================================================= */

        let mediaRecorder = null;
        let mediaStream = null;
        let recordedChunks = [];

        let isRecording = false;
        let isStartingRecording = false;
        let cancelRecording = false;

        let recordingTimer = null;
        let recordingStartedAt = 0;

        let audioInput = null;

        let pointerIsDown = false;
        let stopAfterStart = false;

        let isCancelTarget = false;

        let originalPlaceholder =
            messageBodyField
                ? messageBodyField.getAttribute('placeholder') || ''
                : '';


        /* =========================================================
           CONSTANTS
        ========================================================= */

        const AUDIO_INPUT_NAME = 'audio';

        const MIME_TYPES = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];


        /* =========================================================
           AUDIO INPUT
        ========================================================= */

        function createAudioInput() {
            audioInput =
                document.getElementById(
                    'id_audio'
                );

            if (audioInput) {
                return audioInput;
            }

            audioInput =
                document.createElement('input');

            audioInput.type = 'file';
            audioInput.id = 'id_audio';
            audioInput.name = AUDIO_INPUT_NAME;
            audioInput.accept = 'audio/*';
            audioInput.className = 'd-none';

            replyForm.appendChild(
                audioInput
            );

            return audioInput;
        }


        /* =========================================================
           HELPERS
        ========================================================= */

        function hasText() {
            return Boolean(
                messageBodyField &&
                messageBodyField.value.trim()
            );
        }


        function hasNormalAttachment() {
            const imageInput =
                document.getElementById('id_image');

            const videoInput =
                document.getElementById('id_video');

            const fileInput =
                document.getElementById('id_file');

            return Boolean(
                (
                    imageInput &&
                    imageInput.files &&
                    imageInput.files.length
                ) ||
                (
                    videoInput &&
                    videoInput.files &&
                    videoInput.files.length
                ) ||
                (
                    fileInput &&
                    fileInput.files &&
                    fileInput.files.length
                )
            );
        }


        function hasAudioAttachment() {
            return Boolean(
                audioInput &&
                audioInput.files &&
                audioInput.files.length
            );
        }


        function isEditMode() {
            return Boolean(
                editingMessageId &&
                editingMessageId.value
            );
        }


        function getSupportedMimeType() {
            if (
                typeof MediaRecorder ===
                'undefined'
            ) {
                return '';
            }

            for (
                const mimeType of MIME_TYPES
            ) {
                if (
                    MediaRecorder.isTypeSupported(
                        mimeType
                    )
                ) {
                    return mimeType;
                }
            }

            return '';
        }


        function getFileExtension(
            mimeType
        ) {
            if (
                mimeType.includes('mp4')
            ) {
                return 'm4a';
            }

            if (
                mimeType.includes('ogg')
            ) {
                return 'ogg';
            }

            return 'webm';
        }


        function formatRecordingTime(
            seconds
        ) {
            const minutes =
                Math.floor(
                    seconds / 60
                );

            const remainingSeconds =
                seconds % 60;

            return (
                minutes +
                ':' +
                String(
                    remainingSeconds
                ).padStart(2, '0')
            );
        }


        /* =========================================================
           CANCEL / SLIDER
        ========================================================= */

        function createCancelButton() {
            let cancelBtn =
                document.getElementById(
                    'voice-recording-cancel-btn'
                );

            if (cancelBtn) {
                return cancelBtn;
            }

            cancelBtn =
                document.createElement('button');

            cancelBtn.type = 'button';

            cancelBtn.id =
                'voice-recording-cancel-btn';

            cancelBtn.className =
                'chat-voice-cancel-btn d-none';

            cancelBtn.innerHTML =
                '<i class="fas fa-times"></i>';

            cancelBtn.setAttribute(
                'aria-label',
                'Cancel voice recording'
            );

            cancelBtn.title =
                'Cancel recording';

            submitBtn.parentNode.insertBefore(
                cancelBtn,
                submitBtn
            );

            cancelBtn.addEventListener(
                'click',
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    cancelCurrentRecording();
                }
            );

            return cancelBtn;
        }


        function setDragProgress(
            progress
        ) {
            const safeProgress =
                Math.max(
                    0,
                    Math.min(
                        1,
                        progress
                    )
                );

            submitBtn.style.setProperty(
                '--voice-drag-progress',
                safeProgress.toString()
            );
        }


        function showCancelButton() {
            const cancelBtn =
                createCancelButton();

            cancelBtn.classList.remove(
                'd-none'
            );

            setDragProgress(0);
        }


        function hideCancelButton() {
            const cancelBtn =
                document.getElementById(
                    'voice-recording-cancel-btn'
                );

            if (cancelBtn) {
                cancelBtn.classList.add(
                    'd-none'
                );

                cancelBtn.classList.remove(
                    'is-active'
                );
            }

            setDragProgress(0);
        }


        function setCancelTarget(active) {
            const cancelBtn =
                document.getElementById(
                    'voice-recording-cancel-btn'
                );

            if (!cancelBtn) {
                return;
            }

            isCancelTarget = active;

            cancelBtn.classList.toggle(
                'is-active',
                active
            );
        }


        function updateCancelTarget(event) {
            if (
                !pointerIsDown ||
                !isRecording
            ) {
                return;
            }

            const cancelBtn =
                document.getElementById(
                    'voice-recording-cancel-btn'
                );

            if (!cancelBtn) {
                return;
            }

            const submitRect =
                submitBtn.getBoundingClientRect();

            const cancelRect =
                cancelBtn.getBoundingClientRect();

            /*
             * Start of the drag:
             * center of the Voice button.
             */
            const startX =
                submitRect.left +
                submitRect.width / 2;

            /*
             * Cancel target:
             * center of the X button.
             */
            const cancelX =
                cancelRect.left +
                cancelRect.width / 2;

            /*
             * How far the pointer has moved
             * towards the Cancel button.
             */
            const totalDistance =
                Math.max(
                    1,
                    startX - cancelX
                );

            const currentDistance =
                Math.max(
                    0,
                    startX - event.clientX
                );

            const progress =
                Math.min(
                    1,
                    currentDistance /
                    totalDistance
                );

            setDragProgress(
                progress
            );

            /*
             * Cancel when the pointer enters
             * the actual X button.
             */
            const isInside =
                event.clientX >= cancelRect.left &&
                event.clientX <= cancelRect.right &&
                event.clientY >= cancelRect.top &&
                event.clientY <= cancelRect.bottom;

            setCancelTarget(
                isInside
            );
        }


        /* =========================================================
           TIMER
        ========================================================= */

        function updateRecordingTimer() {
            if (
                !messageBodyField ||
                !isRecording
            ) {
                return;
            }

            const elapsedSeconds =
                Math.floor(
                    (
                        Date.now() -
                        recordingStartedAt
                    ) / 1000
                );

            const recordingTime =
            formatRecordingTime(elapsedSeconds);

            const isMobile =
            window.matchMedia('(max-width: 767.98px)').matches;

            messageBodyField.setAttribute(
                 'placeholder',
                  isMobile
                      ? recordingTime
                      : 'Recording ' + recordingTime
            );
        }


        function startRecordingTimer() {
            recordingStartedAt =
                Date.now();

            updateRecordingTimer();

            clearInterval(
                recordingTimer
            );

            recordingTimer =
                setInterval(
                    updateRecordingTimer,
                    250
                );
        }


        function stopRecordingTimer() {
            clearInterval(
                recordingTimer
            );

            recordingTimer = null;

            if (messageBodyField) {
                messageBodyField.setAttribute(
                    'placeholder',
                    originalPlaceholder
                );
            }
        }


        /* =========================================================
           BUTTON UI
        ========================================================= */

        function setVoiceButton() {
            if (
                !submitBtn ||
                isEditMode()
            ) {
                return;
            }

            submitBtn.classList.remove(
                'voice-recording'
            );

            submitBtn.type = 'button';
            submitBtn.disabled = false;

            submitBtn.title =
                'Hold to record voice message';

            submitBtn.setAttribute(
                'aria-label',
                'Hold to record voice message'
            );

            submitBtn.innerHTML =
                '<i class="fas fa-microphone" ' +
                'id="message-submit-icon"></i>' +
                '<span id="message-submit-text">' +
                'Voice' +
                '</span>';

            setDragProgress(0);
        }


        function setSendButton() {
            if (
                !submitBtn ||
                isEditMode()
            ) {
                return;
            }

            submitBtn.classList.remove(
                'voice-recording'
            );

            submitBtn.type = 'submit';
            submitBtn.disabled = false;

            submitBtn.title =
                'Send message';

            submitBtn.setAttribute(
                'aria-label',
                'Send message'
            );

            submitBtn.innerHTML =
                '<i class="fas fa-paper-plane me-1" ' +
                'id="message-submit-icon"></i>' +
                '<span id="message-submit-text">' +
                'Send' +
                '</span>';

            setDragProgress(0);
        }


        function setRecordingButton() {
            if (!submitBtn) {
                return;
            }

            submitBtn.classList.add(
                'voice-recording'
            );

            submitBtn.type = 'button';
            submitBtn.disabled = false;

            submitBtn.title =
                'Release to send';

            submitBtn.setAttribute(
                'aria-label',
                'Release to send voice message'
            );

            submitBtn.innerHTML =
                '<i class="fas fa-microphone" ' +
                'id="message-submit-icon"></i>';

            setDragProgress(0);
        }


        function updateButtonState() {
            if (
                !submitBtn ||
                isRecording ||
                isStartingRecording ||
                isEditMode()
            ) {
                return;
            }

            if (
                hasText() ||
                hasNormalAttachment() ||
                hasAudioAttachment()
            ) {
                setSendButton();
                return;
            }

            setVoiceButton();
        }


        /* =========================================================
           FILE INPUT
        ========================================================= */

        function setAudioFile(
            blob,
            mimeType
        ) {
            if (!audioInput) {
                createAudioInput();
            }

            const extension =
                getFileExtension(
                    mimeType
                );

            const file =
                new File(
                    [blob],
                    `voice-message.${extension}`,
                    {
                        type:
                            mimeType ||
                            'audio/webm'
                    }
                );

            const dataTransfer =
                new DataTransfer();

            dataTransfer.items.add(
                file
            );

            audioInput.files =
                dataTransfer.files;

            audioInput.dispatchEvent(
                new Event(
                    'change',
                    {
                        bubbles: true
                    }
                )
            );
        }


        function clearAudioFile() {
            if (!audioInput) {
                return;
            }

            audioInput.value = '';
        }


        /* =========================================================
           RECORDING UI
        ========================================================= */

        function beginRecordingUI() {
            setCancelTarget(false);
            setDragProgress(0);

            if (messageBodyField) {
                messageBodyField.readOnly = true;
            }

            showCancelButton();
            setRecordingButton();
            startRecordingTimer();
        }


        function endRecordingUI() {
            setCancelTarget(false);
            setDragProgress(0);

            stopRecordingTimer();
            hideCancelButton();

            if (messageBodyField) {
                messageBodyField.readOnly = false;
            }
        }


        /* =========================================================
           START RECORDING
        ========================================================= */

        async function startRecording() {
            if (
                isRecording ||
                isStartingRecording
            ) {
                return;
            }

            if (
                typeof navigator.mediaDevices ===
                    'undefined' ||
                typeof navigator.mediaDevices.getUserMedia !==
                    'function'
            ) {
                alert(
                    'Voice recording is not supported by this browser.'
                );

                return;
            }

            if (
                typeof MediaRecorder ===
                'undefined'
            ) {
                alert(
                    'Voice recording is not supported by this browser.'
                );

                return;
            }

            isStartingRecording = true;
            stopAfterStart = false;
            cancelRecording = false;

            try {
                clearAudioFile();

                mediaStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true
                        });

                if (!pointerIsDown) {
                    stopAfterStart = true;
                }

                const mimeType =
                    getSupportedMimeType();

                mediaRecorder =
                    mimeType
                        ? new MediaRecorder(
                            mediaStream,
                            {
                                mimeType
                            }
                        )
                        : new MediaRecorder(
                            mediaStream
                        );

                recordedChunks = [];

                mediaRecorder.addEventListener(
                    'dataavailable',
                    function (event) {
                        if (
                            event.data &&
                            event.data.size > 0
                        ) {
                            recordedChunks.push(
                                event.data
                            );
                        }
                    }
                );

                mediaRecorder.addEventListener(
                    'stop',
                    function () {
                        finishRecording();
                    }
                );

                mediaRecorder.addEventListener(
                    'error',
                    function (event) {
                        console.error(
                            'MediaRecorder error:',
                            event
                        );

                        cleanupMediaStream();

                        isRecording = false;
                        isStartingRecording = false;

                        endRecordingUI();
                        updateButtonState();
                    }
                );

                mediaRecorder.start();

                isRecording = true;
                isStartingRecording = false;

                beginRecordingUI();

                if (
                    stopAfterStart
                ) {
                    stopRecording(
                        cancelRecording
                    );
                }

            } catch (error) {
                console.error(
                    'Unable to start voice recording:',
                    error
                );

                cleanupMediaStream();

                isRecording = false;
                isStartingRecording = false;

                endRecordingUI();

                if (
                    error &&
                    error.name ===
                        'NotAllowedError'
                ) {
                    alert(
                        'Microphone permission was denied.'
                    );
                } else {
                    alert(
                        'Unable to access the microphone.'
                    );
                }

                updateButtonState();
            }
        }


        /* =========================================================
           STOP RECORDING
        ========================================================= */

        function stopRecording(
            shouldCancel = false
        ) {
            if (
                !mediaRecorder ||
                !isRecording
            ) {
                return;
            }

            cancelRecording =
                Boolean(
                    shouldCancel
                );

            if (
                mediaRecorder.state ===
                'recording'
            ) {
                mediaRecorder.stop();
            }
        }


        /* =========================================================
           CANCEL
        ========================================================= */

        function cancelCurrentRecording() {
            if (
                !isRecording &&
                !isStartingRecording
            ) {
                return;
            }

            cancelRecording = true;
            pointerIsDown = false;

            setCancelTarget(false);
            setDragProgress(0);

            if (
                mediaRecorder &&
                mediaRecorder.state ===
                    'recording'
            ) {
                mediaRecorder.stop();
                return;
            }

            cleanupMediaStream();

            endRecordingUI();
            updateButtonState();
        }


        /* =========================================================
           FINISH RECORDING
        ========================================================= */

        function finishRecording() {
            const shouldCancel =
                cancelRecording;

            const recorder =
                mediaRecorder;

            const mimeType =
                (
                    recorder &&
                    recorder.mimeType
                ) ||
                'audio/webm';

            const blob =
                new Blob(
                    recordedChunks,
                    {
                        type: mimeType
                    }
                );

            recordedChunks = [];

            cleanupMediaStream();

            mediaRecorder = null;

            isRecording = false;
            isStartingRecording = false;

            endRecordingUI();

            if (
                shouldCancel ||
                !blob.size
            ) {
                clearAudioFile();
                updateButtonState();
                return;
            }

            setAudioFile(
                blob,
                mimeType
            );

            if (
                typeof replyForm.requestSubmit ===
                'function'
            ) {
                replyForm.requestSubmit();
            } else {
                replyForm.dispatchEvent(
                    new Event(
                        'submit',
                        {
                            bubbles: true,
                            cancelable: true
                        }
                    )
                );
            }
        }


        /* =========================================================
           CLEANUP
        ========================================================= */

        function cleanupMediaStream() {
            if (!mediaStream) {
                return;
            }

            mediaStream
                .getTracks()
                .forEach(
                    function (track) {
                        track.stop();
                    }
                );

            mediaStream = null;
        }


        /* =========================================================
           PRESS & HOLD
        ========================================================= */

        submitBtn.addEventListener(
            'pointerdown',
            function (event) {
                if (
                    isEditMode()
                ) {
                    return;
                }

                if (
                    hasText() ||
                    hasNormalAttachment() ||
                    hasAudioAttachment()
                ) {
                    return;
                }

                event.preventDefault();

                pointerIsDown = true;
                cancelRecording = false;
                isCancelTarget = false;

                startRecording();
            }
        );


        document.addEventListener(
            'pointermove',
            function (event) {
                updateCancelTarget(event);
            }
        );


        document.addEventListener(
            'pointerup',
            function (event) {
                if (
                    isEditMode() ||
                    !pointerIsDown
                ) {
                    return;
                }

                event.preventDefault();

                const shouldCancel =
                    isCancelTarget;

                pointerIsDown = false;

                if (shouldCancel) {
                    cancelCurrentRecording();
                    return;
                }

                if (isStartingRecording) {
                    stopAfterStart = true;
                    return;
                }

                if (isRecording) {
                    stopRecording(false);
                }
            }
        );


        submitBtn.addEventListener(
            'pointercancel',
            function () {
                pointerIsDown = false;

                setCancelTarget(false);
                setDragProgress(0);

                if (
                    isRecording ||
                    isStartingRecording
                ) {
                    cancelCurrentRecording();
                }
            }
        );


        submitBtn.addEventListener(
            'click',
            function (event) {
                if (
                    isEditMode()
                ) {
                    return;
                }

                if (
                    hasText() ||
                    hasNormalAttachment() ||
                    hasAudioAttachment()
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
            }
        );


        /* =========================================================
           TEXT CHANGES
        ========================================================= */

        if (messageBodyField) {
            messageBodyField.addEventListener(
                'input',
                function () {
                    updateButtonState();
                }
            );
        }


        /* =========================================================
           ATTACHMENT CHANGES
        ========================================================= */

        [
            'id_image',
            'id_video',
            'id_file'
        ].forEach(
            function (inputId) {
                const input =
                    document.getElementById(
                        inputId
                    );

                if (!input) {
                    return;
                }

                input.addEventListener(
                    'change',
                    function () {
                        updateButtonState();
                    }
                );
            }
        );


        /* =========================================================
           MESSAGE SENT
        ========================================================= */

        window.addEventListener(
            'agro:message-sent',
            function () {
                clearAudioFile();

                recordedChunks = [];

                cleanupMediaStream();

                mediaRecorder = null;

                isRecording = false;
                isStartingRecording = false;
                pointerIsDown = false;
                cancelRecording = false;
                isCancelTarget = false;

                endRecordingUI();

                setTimeout(
                    function () {
                        updateButtonState();
                    },
                    0
                );
            }
        );


        /* =========================================================
           INITIALIZE
        ========================================================= */

        createAudioInput();

        createCancelButton();

        updateButtonState();


        /* =========================================================
           CLEANUP
        ========================================================= */

        window.addEventListener(
            'beforeunload',
            function () {
                cleanupMediaStream();

                clearInterval(
                    recordingTimer
                );
            }
        );
    }
);
