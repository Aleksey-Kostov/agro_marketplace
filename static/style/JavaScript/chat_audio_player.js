(function () {
    'use strict';

    let currentAudio = null;
    let currentPlayer = null;

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '0:00';
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        return minutes + ':' + String(remainingSeconds).padStart(2, '0');
    }

    function isValidDuration(value) {
        return Number.isFinite(value) && value > 0 && value !== Infinity;
    }

    function setDurationLabel(elements, seconds) {
        if (!elements.duration) {
            return;
        }

        elements.duration.textContent = formatTime(seconds);
    }

    function createWaveform(container) {
        if (!container || container.children.length > 0) {
            return;
        }

        const bars = 28;
        const pattern = [
            28, 42, 68, 38, 82, 52, 30, 74, 58, 40,
            70, 34, 86, 48, 62, 26, 56, 78, 36, 50,
            66, 32, 72, 44, 60, 28, 54, 46
        ];

        for (let i = 0; i < bars; i += 1) {
            const bar = document.createElement('span');
            bar.className = 'chat-audio-waveform-bar';
            bar.style.height = (pattern[i] || 40) + '%';
            container.appendChild(bar);
        }
    }

    function updateWaveformProgress(attachment, audio) {
        const waveform = attachment.querySelector('.chat-audio-waveform');
        if (!waveform || !audio || !isValidDuration(audio.duration)) {
            return;
        }

        const bars = waveform.querySelectorAll('span');
        if (!bars.length) {
            return;
        }

        const progress = Math.min(1, Math.max(0, audio.currentTime / audio.duration));
        const filled = Math.round(progress * bars.length);

        bars.forEach(function (bar, index) {
            if (index < filled) {
                bar.classList.add('is-played');
            } else {
                bar.classList.remove('is-played');
            }
        });
    }

    function clearWaveformProgress(attachment) {
        const waveform = attachment.querySelector('.chat-audio-waveform');
        if (!waveform) {
            return;
        }

        waveform.querySelectorAll('span.is-played').forEach(function (bar) {
            bar.classList.remove('is-played');
        });
    }

    function getPlayerElements(attachment) {
        return {
            button: attachment.querySelector('.chat-audio-play-btn'),
            icon: attachment.querySelector('.chat-audio-play-btn i'),
            waveform: attachment.querySelector('.chat-audio-waveform'),
            duration: attachment.querySelector('.chat-audio-duration'),
            audio: attachment.querySelector('.message-audio')
        };
    }

    function getKnownDuration(attachment, audio) {
        const raw =
            (attachment && (attachment.getAttribute('data-duration') || attachment.dataset.duration)) ||
            (audio && audio.getAttribute('data-duration'));

        const fromData = parseFloat(raw);
        if (isValidDuration(fromData)) {
            return fromData;
        }

        if (
            typeof window.__agroLastVoiceDuration === 'number' &&
            isValidDuration(window.__agroLastVoiceDuration)
        ) {
            return window.__agroLastVoiceDuration;
        }

        return 0;
    }

    /**
     * webm от MediaRecorder често дава duration = Infinity.
     * Хак: скачаме към края → браузърът открива реалната дължина.
     */
    function resolveAudioDuration(audio) {
        return new Promise(function (resolve) {
            if (!audio) {
                resolve(0);
                return;
            }

            if (isValidDuration(audio.duration)) {
                resolve(audio.duration);
                return;
            }

            let done = false;

            function finish(value) {
                if (done) {
                    return;
                }
                done = true;
                resolve(isValidDuration(value) ? value : 0);
            }

            function tryFinishFromAudio() {
                if (isValidDuration(audio.duration)) {
                    finish(audio.duration);
                }
            }

            function onMeta() {
                tryFinishFromAudio();
                if (done) {
                    return;
                }

                const onTimeUpdate = function () {
                    audio.removeEventListener('timeupdate', onTimeUpdate);
                    const d = audio.duration;
                    try {
                        audio.currentTime = 0;
                    } catch (e) {}
                    finish(d);
                };

                audio.addEventListener('timeupdate', onTimeUpdate);

                try {
                    audio.currentTime = 1e101;
                } catch (e) {
                    finish(0);
                }
            }

            audio.addEventListener('loadedmetadata', onMeta, { once: true });
            audio.addEventListener('durationchange', tryFinishFromAudio);

            if (audio.readyState >= 1) {
                onMeta();
            } else {
                try {
                    audio.load();
                } catch (e) {}
            }

            setTimeout(function () {
                finish(audio.duration);
            }, 1500);
        });
    }

    function resetPlayer(attachment) {
        if (!attachment) {
            return;
        }

        const elements = getPlayerElements(attachment);

        attachment.classList.remove('is-playing');
        clearWaveformProgress(attachment);

        if (elements.icon) {
            elements.icon.classList.remove('fa-pause');
            elements.icon.classList.add('fa-play');
        }

        if (elements.audio) {
            try {
                elements.audio.currentTime = 0;
            } catch (e) {}
        }

        if (elements.duration) {
            const fromData = parseFloat(attachment.dataset.duration || '');
            let d = 0;

            if (isValidDuration(fromData)) {
                d = fromData;
            } else if (elements.audio && isValidDuration(elements.audio.duration)) {
                d = elements.audio.duration;
            }

            elements.duration.textContent = formatTime(d);
        }
    }

    function pauseCurrentPlayer() {
        if (!currentAudio) {
            return;
        }

        currentAudio.pause();

        if (currentPlayer) {
            const el = getPlayerElements(currentPlayer);
            currentPlayer.classList.remove('is-playing');
            if (el.icon) {
                el.icon.classList.remove('fa-pause');
                el.icon.classList.add('fa-play');
            }
        }

        currentAudio = null;
        currentPlayer = null;
    }

    function setPlayingState(attachment) {
        const elements = getPlayerElements(attachment);
        attachment.classList.add('is-playing');

        if (elements.icon) {
            elements.icon.classList.remove('fa-play');
            elements.icon.classList.add('fa-pause');
        }
    }

    function setPausedState(attachment) {
        const elements = getPlayerElements(attachment);
        attachment.classList.remove('is-playing');

        if (elements.icon) {
            elements.icon.classList.remove('fa-pause');
            elements.icon.classList.add('fa-play');
        }
    }

    function seekFromWaveform(attachment, audio, event) {
        const waveform = attachment.querySelector('.chat-audio-waveform');
        if (!waveform || !audio || !isValidDuration(audio.duration)) {
            return;
        }

        const rect = waveform.getBoundingClientRect();
        const x = (event.clientX || 0) - rect.left;
        const ratio = Math.min(1, Math.max(0, x / rect.width));
        audio.currentTime = ratio * audio.duration;
        updateWaveformProgress(attachment, audio);
    }

    function initializePlayer(attachment) {
        if (!attachment || attachment.dataset.audioPlayerReady === 'true') {
            return;
        }

        const elements = getPlayerElements(attachment);

        if (!elements.button || !elements.audio) {
            return;
        }

        attachment.dataset.audioPlayerReady = 'true';
        createWaveform(elements.waveform);

        // 1) веднага: известна duration от запис / data-атрибут
        const known = getKnownDuration(attachment, elements.audio);
        if (known > 0) {
            setDurationLabel(elements, known);
            attachment.dataset.duration = String(known);

            if (window.__agroLastVoiceDuration === known) {
                window.__agroLastVoiceDuration = null;
            }
        }

        // 2) реална duration от файла (webm Infinity hack)
        resolveAudioDuration(elements.audio).then(function (dur) {
            if (dur > 0) {
                setDurationLabel(elements, dur);
                attachment.dataset.duration = String(dur);
            }
        });

        elements.audio.addEventListener('loadedmetadata', function () {
            if (isValidDuration(elements.audio.duration)) {
                setDurationLabel(elements, elements.audio.duration);
                attachment.dataset.duration = String(elements.audio.duration);
            }
        });

        elements.audio.addEventListener('timeupdate', function () {
            updateWaveformProgress(attachment, elements.audio);

            if (
                elements.duration &&
                !elements.audio.paused &&
                isValidDuration(elements.audio.duration)
            ) {
                const remaining = Math.max(
                    0,
                    elements.audio.duration - elements.audio.currentTime
                );
                elements.duration.textContent = formatTime(remaining);
            }
        });

        elements.audio.addEventListener('play', function () {
            if (currentAudio && currentAudio !== elements.audio) {
                pauseCurrentPlayer();
            }

            currentAudio = elements.audio;
            currentPlayer = attachment;
            setPlayingState(attachment);
        });

        elements.audio.addEventListener('pause', function () {
            setPausedState(attachment);

            if (currentAudio === elements.audio) {
                currentAudio = null;
                currentPlayer = null;
            }
        });

        elements.audio.addEventListener('ended', function () {
            resetPlayer(attachment);

            if (currentAudio === elements.audio) {
                currentAudio = null;
                currentPlayer = null;
            }
        });

        if (elements.waveform) {
            elements.waveform.style.cursor = 'pointer';
            elements.waveform.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                seekFromWaveform(attachment, elements.audio, event);
            });
        }

        elements.button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (elements.audio.paused) {
                if (currentAudio && currentAudio !== elements.audio) {
                    pauseCurrentPlayer();
                }

                const playPromise = elements.audio.play();

                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(function () {
                        setPausedState(attachment);
                    });
                }

                return;
            }

            elements.audio.pause();
        });
    }

    function initializePlayers(root) {
        const scope = root || document;

        if (scope instanceof Element && scope.matches('.chat-audio-attachment')) {
            initializePlayer(scope);
        }

        if (scope.querySelectorAll) {
            scope.querySelectorAll('.chat-audio-attachment').forEach(initializePlayer);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initializePlayers(document);

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return;
                    }
                    initializePlayers(node);
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    window.agroInitAudioPlayers = initializePlayers;
})();
