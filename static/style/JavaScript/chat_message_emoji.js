/* =========================================================
   CHAT MESSAGE EMOJI
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       EMOJI DETECTION
       ===================================================== */

    function isEmojiCharacter(char) {
        if (!char) {
            return false;
        }

        return /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(
            char
        );
    }


    function getEmojiCount(text) {
        if (!text) {
            return 0;
        }

        const trimmed = text.trim();

        if (!trimmed) {
            return 0;
        }

        /*
         * Intl.Segmenter разделя emoji комбинации
         * като 👨‍👩‍👧‍👦 или ❤️ правилно.
         */
        if (typeof Intl !== "undefined" &&
            typeof Intl.Segmenter === "function") {

            const segmenter = new Intl.Segmenter(
                undefined,
                {
                    granularity: "grapheme"
                }
            );

            const segments = Array.from(
                segmenter.segment(trimmed),
                item => item.segment
            );

            if (!segments.length) {
                return 0;
            }

            const allEmoji = segments.every(
                segment => isEmojiCharacter(segment)
            );

            if (!allEmoji) {
                return 0;
            }

            return segments.length;
        }

        /*
         * Fallback за браузъри без Intl.Segmenter.
         */
        const emojiMatches = trimmed.match(
            /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu
        );

        if (!emojiMatches) {
            return 0;
        }

        /*
         * Ако има нормални символи, това не е
         * emoji-only съобщение.
         */
        const cleaned = trimmed
            .replace(
                /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu,
                ""
            )
            .replace(
                /[\uFE0F\u200D\u20E3]/g,
                ""
            )
            .trim();

        if (cleaned) {
            return 0;
        }

        return emojiMatches.length;
    }


    /* =====================================================
       MESSAGE BODY TEXT
       ===================================================== */

    function getMessageBodyText(messageBubble) {
        const body = messageBubble.querySelector(
            ".message-body-html"
        );

        if (!body) {
            return "";
        }

        return body.textContent || "";
    }


    /* =====================================================
       APPLY EMOJI CLASS
       ===================================================== */

    function applyEmojiClass(messageBubble) {
        if (!messageBubble) {
            return;
        }

        /*
         * Премахваме старите emoji класове,
         * за да може функцията безопасно да се
         * извиква повече от веднъж.
         */
        messageBubble.classList.remove(
            "emoji-only",
            "emoji-only-1",
            "emoji-only-2",
            "emoji-only-3"
        );

        /*
         * Ако има media, не обработваме съобщението
         * като emoji-only.
         */
        if (
            messageBubble.querySelector(".media-wrap")
        ) {
            return;
        }

        const text = getMessageBodyText(
            messageBubble
        );

        const emojiCount = getEmojiCount(text);

        /*
         * Само 1, 2 или 3 emoji имат специално
         * Viber-подобно поведение.
         */
        if (
            emojiCount < 1 ||
            emojiCount > 3
        ) {
            return;
        }

        messageBubble.classList.add(
            "emoji-only"
        );

        messageBubble.classList.add(
            `emoji-only-${emojiCount}`
        );
    }


    /* =====================================================
       PROCESS MESSAGE
       ===================================================== */

    function processMessage(message) {
        if (!message) {
            return;
        }

        const messageBubble = message.querySelector(
            ".message-bubble"
        );

        if (!messageBubble) {
            return;
        }

        applyEmojiClass(messageBubble);
    }


    /* =====================================================
       PROCESS ALL EXISTING MESSAGES
       ===================================================== */

    function processAllMessages() {
        const messages = document.querySelectorAll(
            ".conversation-message"
        );

        messages.forEach(
            processMessage
        );
    }


    /* =====================================================
       OBSERVE NEW MESSAGES
       ===================================================== */

    function observeMessages() {
        const chatWindow =
            document.querySelector(
                "#chat-window"
            ) ||
            document.querySelector(
                ".chat-window"
            ) ||
            document.querySelector(
                ".conversation-messages"
            );

        if (!chatWindow) {
            return;
        }

        const observer =
            new MutationObserver(
                mutations => {

                    mutations.forEach(
                        mutation => {

                            mutation.addedNodes.forEach(
                                node => {

                                    if (
                                        node.nodeType !==
                                        Node.ELEMENT_NODE
                                    ) {
                                        return;
                                    }

                                    if (
                                        node.matches &&
                                        node.matches(
                                            ".conversation-message"
                                        )
                                    ) {
                                        processMessage(
                                            node
                                        );

                                        return;
                                    }

                                    const messages =
                                        node.querySelectorAll
                                            ? node.querySelectorAll(
                                                ".conversation-message"
                                            )
                                            : [];

                                    messages.forEach(
                                        processMessage
                                    );
                                }
                            );
                        }
                    );
                }
            );

        observer.observe(
            chatWindow,
            {
                childList: true,
                subtree: true
            }
        );
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function init() {
        processAllMessages();
        observeMessages();
    }


    /* =====================================================
       DOM READY
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {
        init();
    }

})();
