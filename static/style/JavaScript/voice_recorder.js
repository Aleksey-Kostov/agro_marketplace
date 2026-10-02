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

        let audioInput = null;


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

            audioInput.type =
                'file';

            audioInput.id =
                'id_audio';

            audioInput.name =
                AUDIO_INPUT_NAME;

            audioInput.accept =
                'audio/*';

            audioInput.className =
                'd-none';

            /*
             * This input is intentionally created
             * dynamically because the voice recorder
             * owns the audio recording itself.
             */
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
                mimeType.includes(
                    'mp4'
                )
            ) {
                return 'm4a';
            }

            if (
                mimeType.includes(
                    'ogg'
                )
            ) {
                return 'ogg';
            }

            return 'webm';
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

            submitBtn.type =
                'button';

            submitBtn.disabled =
                false;

            submitBtn.title =
                'Record voice message';

            submitBtn.setAttribute(
                'aria-label',
                'Record voice message'
            );

            submitBtn.innerHTML =
                '<i class="fas fa-microphone" ' +
                'id="message-submit-icon"></i>';
        }


        function setSendButton() {
            if (
                !submitBtn ||
                isEditMode()
            ) {
                return;
            }

            submitBtn.type =
                'submit';

            submitBtn.disabled =
                false;

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
        }


        function setRecordingButton() {
            if (!submitBtn) {
                return;
            }

            submitBtn.type =
                'button';

            submitBtn.disabled =
                false;

            submitBtn.title =
                'Stop recording';

            submitBtn.setAttribute(
                'aria-label',
                'Stop recording'
            );

            submitBtn.innerHTML =
                '<i class="fas fa-stop" ' +
                'id="message-submit-icon"></i>' +
                '<span id="message-submit-text">' +
                ' Stop' +
                '</span>';
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

            /*
             * FileList is read-only, therefore
             * DataTransfer is used to populate
             * the dynamically-created input.
             */
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

            audioInput.value =
                '';
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

            isStartingRecording =
                true;

            try {
                /*
                 * Remove an old voice message
                 * before starting a new recording.
                 */
                clearAudioFile();

                mediaStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true
                        });

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

                        isRecording =
                            false;

                        isStartingRecording =
                            false;

                        updateButtonState();
                    }
                );

                mediaRecorder.start();

                isRecording =
                    true;

                isStartingRecording =
                    false;

                setRecordingButton();

            } catch (error) {
                console.error(
                    'Unable to start voice recording:',
                    error
                );

                cleanupMediaStream();

                isRecording =
                    false;

                isStartingRecording =
                    false;

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

        function stopRecording() {
            if (
                !mediaRecorder ||
                !isRecording
            ) {
                return;
            }

            if (
                mediaRecorder.state ===
                'recording'
            ) {
                mediaRecorder.stop();
            }

            isRecording =
                false;

            setSendButton();
        }


        /* =========================================================
           FINISH RECORDING
        ========================================================= */

        function finishRecording() {
            const mimeType =
                (
                    mediaRecorder &&
                    mediaRecorder.mimeType
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

            mediaRecorder =
                null;

            if (!blob.size) {
                updateButtonState();
                return;
            }

            setAudioFile(
                blob,
                mimeType
            );

            updateButtonState();
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

            mediaStream =
                null;
        }


        /* =========================================================
           BUTTON CLICK
        ========================================================= */

        submitBtn.addEventListener(
            'click',
            function (event) {
                /*
                 * Edit mode belongs to conversation.js.
                 */
                if (isEditMode()) {
                    return;
                }

                /*
                 * If there is text or another attachment,
                 * allow the normal form submit.
                 */
                if (
                    !isRecording &&
                    !isStartingRecording &&
                    (
                        hasText() ||
                        hasNormalAttachment() ||
                        hasAudioAttachment()
                    )
                ) {
                    return;
                }

                /*
                 * Empty composer:
                 * the button is the microphone.
                 */
                event.preventDefault();

                if (isRecording) {
                    stopRecording();
                    return;
                }

                startRecording();
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

                mediaRecorder =
                    null;

                isRecording =
                    false;

                isStartingRecording =
                    false;

                updateButtonState();
            }
        );


        /* =========================================================
           INITIALIZE
        ========================================================= */

        createAudioInput();

        updateButtonState();


        /* =========================================================
           CLEANUP
        ========================================================= */

        window.addEventListener(
            'beforeunload',
            function () {
                cleanupMediaStream();
            }
        );
    }
);
