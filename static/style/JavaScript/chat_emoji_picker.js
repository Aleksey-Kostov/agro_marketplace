document.addEventListener('DOMContentLoaded', function () {
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

    const emojiPicker =
        document.querySelector('.emoji-picker');

    const emojiGrid =
        emojiPicker
            ? emojiPicker.querySelector('.emoji-grid')
            : null;

    const emojiToggleBtn =
        document.getElementById('emoji-toggle-btn');

    let activeEmojiCategory =
        'smileys_people';


    /* =========================================================
       INSERT EMOJI
    ========================================================= */

    function insertEmojiIntoComposer(emoji) {
        if (
            !emoji ||
            !messageBodyField
        ) {
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

        try {
            messageBodyField.setSelectionRange(
                newPosition,
                newPosition
            );
        } catch (error) {
            /*
             * Some mobile browsers may not allow selection
             * changes while the textarea is not focused.
             */
        }

        /*
         * IMPORTANT:
         *
         * Tell all composer controllers that the message
         * content changed.
         *
         * This is required so voice_recorder.js can switch
         * from the microphone button to the send button
         * after an emoji is inserted.
         */
        messageBodyField.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        if (
            typeof addRecentChatEmoji ===
            'function'
        ) {
            addRecentChatEmoji(
                emoji
            );
        }
    }


    /* =========================================================
       CATEGORY HELPERS
    ========================================================= */

    function getEmojiCategoryList() {
        if (
            typeof CHAT_EMOJI_CATEGORIES ===
            'undefined'
        ) {
            return [];
        }

        return Object.values(
            CHAT_EMOJI_CATEGORIES
        );
    }


    function getRecentEmojiList() {
        if (
            typeof getRecentChatEmojis !==
            'function'
        ) {
            return [];
        }

        return getRecentChatEmojis();
    }


    function getEmojisForCategory(
        categoryId
    ) {
        if (
            categoryId === 'recent'
        ) {
            return getRecentEmojiList();
        }

        if (
            typeof CHAT_EMOJI_CATEGORIES ===
            'undefined'
        ) {
            return [];
        }

        const category =
            CHAT_EMOJI_CATEGORIES[
                categoryId
            ];

        if (!category) {
            return [];
        }

        return Array.isArray(
            category.emojis
        )
            ? category.emojis
            : [];
    }


    /* =========================================================
       CATEGORY BAR
    ========================================================= */

    function createEmojiCategoryBar() {
        if (!emojiPicker) {
            return null;
        }

        let categoryBar =
            emojiPicker.querySelector(
                '.emoji-category-bar'
            );

        if (categoryBar) {
            return categoryBar;
        }

        categoryBar =
            document.createElement('div');

        categoryBar.className =
            'emoji-category-bar';

        const categories =
            getEmojiCategoryList();

        categories.forEach(
            function (category) {
                const button =
                    document.createElement(
                        'button'
                    );

                button.type =
                    'button';

                button.className =
                    'emoji-category-btn';

                button.dataset.category =
                    category.id;

                button.title =
                    category.name;

                button.setAttribute(
                    'aria-label',
                    category.name
                );

                button.textContent =
                    category.icon;

                if (
                    category.id ===
                    activeEmojiCategory
                ) {
                    button.classList.add(
                        'active'
                    );
                }

                categoryBar.appendChild(
                    button
                );
            }
        );

        if (emojiGrid) {
            emojiGrid.parentNode.insertBefore(
                categoryBar,
                emojiGrid
            );
        } else {
            emojiPicker.appendChild(
                categoryBar
            );
        }

        return categoryBar;
    }


    /* =========================================================
       RENDER CATEGORY
    ========================================================= */

    function renderEmojiCategory(
        categoryId
    ) {
        if (!emojiGrid) {
            return;
        }

        const emojis =
            getEmojisForCategory(
                categoryId
            );

        emojiGrid.replaceChildren();

        if (!emojis.length) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.className =
                'emoji-empty';

            empty.textContent =
                'No recent emojis';

            emojiGrid.appendChild(
                empty
            );

            return;
        }

        emojis.forEach(
            function (emoji) {
                const button =
                    document.createElement(
                        'button'
                    );

                button.type =
                    'button';

                button.className =
                    'btn btn-sm btn-light emoji-btn';

                button.dataset.emoji =
                    emoji;

                button.textContent =
                    emoji;

                button.setAttribute(
                    'aria-label',
                    emoji
                );

                emojiGrid.appendChild(
                    button
                );
            }
        );
    }


    /* =========================================================
       ACTIVE CATEGORY
    ========================================================= */

    function setActiveEmojiCategory(
        categoryId
    ) {
        if (!categoryId) {
            return;
        }

        activeEmojiCategory =
            categoryId;

        if (emojiPicker) {
            emojiPicker
                .querySelectorAll(
                    '.emoji-category-btn'
                )
                .forEach(
                    function (button) {
                        button.classList.toggle(
                            'active',
                            button.dataset.category ===
                                categoryId
                        );
                    }
                );
        }

        renderEmojiCategory(
            categoryId
        );
    }


    /* =========================================================
       MOBILE KEYBOARD CONTROL
    ========================================================= */

    function blurMessageComposer() {
        if (!messageBodyField) {
            return;
        }

        if (
            document.activeElement ===
            messageBodyField
        ) {
            messageBodyField.blur();
        }
    }


    /* =========================================================
       EMOJI TOGGLE
    ========================================================= */

    if (emojiToggleBtn) {
        emojiToggleBtn.addEventListener(
            'pointerdown',
            function () {
                blurMessageComposer();
            }
        );

        emojiToggleBtn.addEventListener(
            'mousedown',
            function () {
                blurMessageComposer();
            }
        );

        emojiToggleBtn.addEventListener(
            'touchstart',
            function () {
                blurMessageComposer();
            },
            {
                passive: true
            }
        );
    }


    /* =========================================================
       PICKER CLICK HANDLER
    ========================================================= */

    if (emojiPicker) {
        emojiPicker.addEventListener(
            'click',
            function (event) {
                const categoryButton =
                    event.target.closest(
                        '.emoji-category-btn'
                    );

                if (categoryButton) {
                    event.preventDefault();
                    event.stopPropagation();

                    setActiveEmojiCategory(
                        categoryButton.dataset.category
                    );

                    return;
                }

                const emojiButton =
                    event.target.closest(
                        '.emoji-btn'
                    );

                if (!emojiButton) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                const emoji =
                    emojiButton.dataset.emoji ||
                    '';

                if (!emoji) {
                    return;
                }

                blurMessageComposer();

                insertEmojiIntoComposer(
                    emoji
                );

                /*
                 * Keep the picker open so multiple
                 * emojis can be selected.
                 */
            }
        );
    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    function initializeEmojiPicker() {
        if (!emojiPicker) {
            return;
        }

        if (
            typeof CHAT_EMOJI_CATEGORIES ===
            'undefined'
        ) {
            console.warn(
                'CHAT_EMOJI_CATEGORIES is not loaded.'
            );

            return;
        }

        createEmojiCategoryBar();

        setActiveEmojiCategory(
            'smileys_people'
        );
    }

    initializeEmojiPicker();
});
