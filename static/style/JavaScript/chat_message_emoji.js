/* =========================================================
   CHAT MESSAGE EMOJI
   Twemoji preparation / emoji-only messages
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


    function getEmojiSegments(text) {

        if (!text) {
            return [];
        }

        const trimmed = text.trim();

        if (!trimmed) {
            return [];
        }


        /*
         * Modern browsers:
         * use grapheme clusters so joined emoji such as
         * ❤️, 👨‍👩‍👧‍👦 and 🏳️‍🌈 stay together.
         */

        if (
            typeof Intl !== "undefined" &&
            typeof Intl.Segmenter === "function"
        ) {

            const segmenter =
                new Intl.Segmenter(
                    undefined,
                    {
                        granularity: "grapheme"
                    }
                );


            return Array.from(
                segmenter.segment(trimmed),
                item => item.segment
            );

        }


        /*
         * Fallback for browsers without Intl.Segmenter.
         */

        return Array.from(trimmed);
    }


    function getEmojiCount(text) {

        if (!text) {
            return 0;
        }


        const segments =
            getEmojiSegments(text);


        if (!segments.length) {
            return 0;
        }


        /*
         * Every grapheme must be an emoji.
         */

        const allEmoji =
            segments.every(
                segment =>
                    isEmojiCharacter(segment)
            );


        if (!allEmoji) {
            return 0;
        }


        return segments.length;
    }


    /* =====================================================
       MESSAGE BODY
    ===================================================== */

    function getMessageBody(
        messageBubble
    ) {

        if (!messageBubble) {
            return null;
        }


        return messageBubble.querySelector(
            ".message-body-html"
        );
    }


    function getMessageBodyText(
        messageBubble
    ) {

        const body =
            getMessageBody(
                messageBubble
            );


        if (!body) {
            return "";
        }


        return (
            body.textContent || ""
        );
    }


    /* =====================================================
       EMOJI CLASS
    ===================================================== */

    function clearEmojiClasses(
        messageBubble
    ) {

        messageBubble.classList.remove(
            "emoji-only",
            "emoji-only-1",
            "emoji-only-2",
            "emoji-only-3"
        );
    }


    function applyEmojiClass(
        messageBubble
    ) {

        if (!messageBubble) {
            return;
        }


        clearEmojiClasses(
            messageBubble
        );


        /*
         * Media messages are never emoji-only.
         */

        if (
            messageBubble.querySelector(
                ".media-wrap"
            )
        ) {
            return;
        }


        const text =
            getMessageBodyText(
                messageBubble
            );


        const emojiCount =
            getEmojiCount(text);


        /*
         * We only special-case
         * 1, 2 or 3 emojis.
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
       TWEMOJI SUPPORT
    ===================================================== */

    function getTwemojiUrl(
        emoji
    ) {

        if (!emoji) {
            return null;
        }


        /*
         * The catalog is the source of truth.
         *
         * We only return a URL when the emoji
         * exists in CHAT_EMOJIS.
         */

        if (
            typeof getChatEmojiByCharacter !==
            "function"
        ) {
            return null;
        }


        const catalogEmoji =
            getChatEmojiByCharacter(
                emoji
            );


        if (!catalogEmoji) {
            return null;
        }


        /*
         * Convert the Unicode code points
         * into the format used by Twemoji CDN.
         *
         * Example:
         * 😀 → 1f600
         * ❤️ → 2764-fe0f
         */

        const codePoints =
            Array.from(emoji)
                .map(
                    character =>
                        character
                            .codePointAt(0)
                            .toString(16)
                    )
                .join("-");


        return (
            "https://cdn.jsdelivr.net/gh/" +
            "twitter/twemoji@latest/assets/svg/" +
            codePoints +
            ".svg"
        );
    }


    /* =====================================================
       TWEMOJI RENDERING
    ===================================================== */

    function renderTwemoji(
        messageBubble
    ) {

        if (!messageBubble) {
            return;
        }


        const body =
            getMessageBody(
                messageBubble
            );


        if (!body) {
            return;
        }


        /*
         * Do not render normal text.
         */

        if (
            !messageBubble.classList.contains(
                "emoji-only"
            )
        ) {
            return;
        }


        /*
         * Prevent duplicate rendering.
         */

        if (
            body.dataset.twemojiRendered ===
            "true"
        ) {
            return;
        }


        const text =
            body.textContent.trim();


        const segments =
            getEmojiSegments(text);


        if (!segments.length) {
            return;
        }


        /*
         * Build the visual content using
         * <img> elements, while keeping the
         * original Unicode value in data-emoji.
         */

        const fragment =
            document.createDocumentFragment();


        segments.forEach(
            emoji => {

                const src =
                    getTwemojiUrl(
                        emoji
                    );


                /*
                 * If this emoji isn't currently
                 * in our catalog, keep the original
                 * Unicode character.
                 */

                if (!src) {

                    fragment.appendChild(
                        document.createTextNode(
                            emoji
                        )
                    );

                    return;
                }


                const image =
                    document.createElement(
                        "img"
                    );


                image.className =
                    "chat-twemoji";


                image.src =
                    src;


                image.alt =
                    emoji;


                image.setAttribute(
                    "draggable",
                    "false"
                );


                image.dataset.emoji =
                    emoji;


                image.loading =
                    "eager";


                fragment.appendChild(
                    image
                );
            }
        );


        body.replaceChildren(
            fragment
        );


        body.dataset.twemojiRendered =
            "true";
    }


    /* =====================================================
       PROCESS MESSAGE
    ===================================================== */

    function processMessage(
        message
    ) {

        if (!message) {
            return;
        }


        const messageBubble =
            message.querySelector(
                ".message-bubble"
            );


        if (!messageBubble) {
            return;
        }


        /*
         * First determine whether this is
         * an emoji-only message.
         */

        applyEmojiClass(
            messageBubble
        );


        /*
         * Then render the emoji visually.
         */

        renderTwemoji(
            messageBubble
        );
    }


    /* =====================================================
       PROCESS ALL EXISTING MESSAGES
    ===================================================== */

    function processAllMessages() {

        const messages =
            document.querySelectorAll(
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


                                    /*
                                     * Direct message.
                                     */

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


                                    /*
                                     * Message contained
                                     * inside an added element.
                                     */

                                    if (
                                        !node.querySelectorAll
                                    ) {
                                        return;
                                    }


                                    const messages =
                                        node.querySelectorAll(
                                            ".conversation-message"
                                        );


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
       INIT
    ===================================================== */

    function init() {

        processAllMessages();

        observeMessages();
    }


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
