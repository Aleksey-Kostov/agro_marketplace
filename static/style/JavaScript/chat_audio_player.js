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

    function createWaveform(container) {
        if (!container || container.children.length > 0) {
            return;
        }

        const bars = 28;
        // по-естествен pattern (не чисто random)
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
        if (!waveform || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
        }

        const bars = waveform.querySelectorAll('span');
        if (!bars.length) return;

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
        if (!waveform) return;

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

    function resetPlayer(attachment) {
        if (!attachment) return;

        const elements = getPlayerElements(attachment);

        attachment.classList.remove('is-playing');
        clearWaveformProgress(attachment);

        if (elements.icon) {
            elements.icon.classList.remove('fa-pause');
            elements.icon.classList.add('fa-play');
        }

        if (elements.audio) {
            elements.audio.currentTime = 0;
        }

        if (elements.duration && elements.audio) {
            const d = elements.audio.duration;
            elements.duration.textContent = Number.isFinite(d)
                ? formatTime(d)
                : '0:00';
        }
    }

    function pauseCurrentPlayer() {
        if (!currentAudio) return;

        currentAudio.pause();

        if (currentPlayer) {
            // не reset до 0 — само pause UI
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
        if (!waveform || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
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

        elements.audio.addEventListener('loadedmetadata', function () {
            if (elements.duration) {
                elements.duration.textContent = formatTime(elements.audio.duration);
            }
        });

        elements.audio.addEventListener('timeupdate', function () {
            updateWaveformProgress(attachment, elements.audio);

            if (elements.duration) {
                // оставащо време докато свири; пълно при пауза в началото
                if (!elements.audio.paused && elements.audio.currentTime > 0) {
                    const remaining = Math.max(
                        0,
                        elements.audio.duration - elements.audio.currentTime
                    );
                    elements.duration.textContent = formatTime(remaining);
                }
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

        // клик по вълната → seek
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
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
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
