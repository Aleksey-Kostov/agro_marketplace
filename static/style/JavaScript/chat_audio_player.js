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

        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function createWaveform(container) {
        if (!container || container.children.length > 0) {
            return;
        }

        const bars = 32;

        for (let index = 0; index < bars; index += 1) {
            const bar = document.createElement('span');

            bar.className = 'chat-audio-waveform-bar';

            const height = 25 + Math.floor(Math.random() * 65);
            bar.style.height = `${height}%`;

            container.appendChild(bar);
        }
    }

    function getPlayerElements(attachment) {
        return {
            button: attachment.querySelector('.chat-audio-play-btn'),
            icon: attachment.querySelector('.chat-audio-play-btn i'),
            waveform: attachment.querySelector('.chat-audio-waveform'),
            duration: attachment.querySelector('.chat-audio-duration'),
            audio: attachment.querySelector('.message-audio'),
        };
    }

    function resetPlayer(attachment) {
        if (!attachment) {
            return;
        }

        const elements = getPlayerElements(attachment);

        attachment.classList.remove('is-playing');

        if (elements.icon) {
            elements.icon.classList.remove('fa-pause');
            elements.icon.classList.add('fa-play');
        }

        if (elements.audio) {
            elements.audio.currentTime = 0;
        }

        if (elements.duration && elements.audio) {
            elements.duration.textContent = formatTime(
                elements.audio.duration
            );
        }
    }

    function pauseCurrentPlayer() {
        if (!currentAudio) {
            return;
        }

        currentAudio.pause();

        if (currentPlayer) {
            resetPlayer(currentPlayer);
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
                elements.duration.textContent = formatTime(
                    elements.audio.duration
                );
            }
        });

        elements.audio.addEventListener('timeupdate', function () {
            if (elements.duration) {
                const remaining = Math.max(
                    0,
                    elements.audio.duration - elements.audio.currentTime
                );

                elements.duration.textContent = formatTime(remaining);
            }
        });

        elements.audio.addEventListener('play', function () {
            if (
                currentAudio &&
                currentAudio !== elements.audio
            ) {
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

        elements.button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (elements.audio.paused) {
                pauseCurrentPlayer();

                const playPromise = elements.audio.play();

                if (
                    playPromise &&
                    typeof playPromise.catch === 'function'
                ) {
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

        if (
            scope instanceof Element &&
            scope.matches('.chat-audio-attachment')
        ) {
            initializePlayer(scope);
        }

        scope
            .querySelectorAll('.chat-audio-attachment')
            .forEach(initializePlayer);
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
            subtree: true,
        });
    });
})();
