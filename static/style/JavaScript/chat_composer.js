document.addEventListener('DOMContentLoaded', function () {
    const messageBodyField =
        document.getElementById('message-body-input');

    const composerMain =
        document.querySelector('.chat-composer-main');

    const composerActions =
        document.querySelector('.chat-composer-actions');

    if (!messageBodyField || !composerMain) {
        return;
    }

    /*
     * =========================================================
     * DIMENSIONS
     * =========================================================
     */

    function getSingleLineHeight() {
        return isMobile() ? 38 : 44;
    }

    /*
     * Compact: textarea е в средната grid колона.
     * Бутоните (Attachment, Send) са вдясно от нея — НЕ върху текста.
     * Затова right padding е само визуален въздух, не ширина на бутоните.
     * Текстът стига почти до Attachment, после минава на 2-ри ред.
     */
    const DESKTOP_RIGHT_ACTION_SPACE = 4;
    const MOBILE_RIGHT_ACTION_SPACE = 2;

    const DESKTOP_LEFT_PADDING_COMPACT = '10px';
    const MOBILE_LEFT_PADDING_COMPACT = '6px';

    /*
     * =========================================================
     * HELPERS
     * =========================================================
     */

    function isMobile() {
        return window.matchMedia(
            '(max-width: 767.98px)'
        ).matches;
    }

    function getMaxHeight() {
        const computedStyle =
            window.getComputedStyle(messageBodyField);

        return (
            parseFloat(
                computedStyle.maxHeight
            ) || 160
        );
    }

    function setTextareaPadding(expanded) {
        const rightSpace = isMobile()
            ? MOBILE_RIGHT_ACTION_SPACE
            : DESKTOP_RIGHT_ACTION_SPACE;

        const vPad = isMobile() ? '8px' : '10px';

        messageBodyField.style.paddingTop = vPad;

        /*
         * Expanded: бутоните са на grid ред 2, НЕ вътре в textarea.
         * Затова нормален padding от всички страни — БЕЗ 46px долу.
         */
        if (expanded) {
            messageBodyField.style.paddingLeft = '14px';
            messageBodyField.style.paddingRight = '14px';
            messageBodyField.style.paddingBottom = vPad;
            return;
        }

        /*
         * Compact: малко място вляво, резерв вдясно за бутоните.
         */
        messageBodyField.style.paddingLeft = isMobile()
            ? MOBILE_LEFT_PADDING_COMPACT
            : DESKTOP_LEFT_PADDING_COMPACT;

        messageBodyField.style.paddingRight =
            `${rightSpace}px`;

        messageBodyField.style.paddingBottom = vPad;
    }

    /*
     * =========================================================
     * VOICE CANCEL — до Send
     * =========================================================
     */

    function ensureCancelNextToSend() {
        const cancelBtn =
            document.getElementById(
                'voice-recording-cancel-btn'
            );

        const submitBtn =
            document.getElementById(
                'message-submit-btn'
            );

        if (!cancelBtn || !submitBtn) {
            return;
        }

        const rightActions =
            document.querySelector(
                '.chat-composer-actions-right'
            );

        if (!rightActions) {
            return;
        }

        if (
            cancelBtn.parentElement !== rightActions ||
            cancelBtn.nextElementSibling !== submitBtn
        ) {
            rightActions.insertBefore(
                cancelBtn,
                submitBtn
            );
        }
    }

    if (composerActions) {
        const composerObserver =
            new MutationObserver(function () {
                ensureCancelNextToSend();
            });

        composerObserver.observe(
            composerActions,
            {
                childList: true,
                subtree: true
            }
        );

        ensureCancelNextToSend();
    }


    /*
     * =========================================================
     * RESIZE
     * =========================================================
     */

    function autoResizeMessageInput() {
        const maxHeight = getMaxHeight();
        const singleLineHeight = getSingleLineHeight();

        composerMain.classList.remove('is-expanded');

        messageBodyField.style.height = 'auto';
        messageBodyField.style.overflowY = 'hidden';

        setTextareaPadding(false);

        void messageBodyField.offsetHeight;

        const naturalHeight =
            messageBodyField.scrollHeight;

        /*
         * Един ред — толеранс 2px (не 6), за да не скача рано.
         */
        if (naturalHeight <= singleLineHeight + 2) {
            messageBodyField.style.height =
                `${singleLineHeight}px`;

            messageBodyField.style.overflowY = 'hidden';

            composerMain.style.setProperty(
                '--composer-dropdown-shift',
                '0px'
            );

            return;
        }

        /*
         * Повече от 1 ред → expanded.
         * Бутоните отиват на grid ред 2 — textarea без extra bottom padding.
         */
        composerMain.classList.add('is-expanded');

        messageBodyField.style.height = 'auto';
        setTextareaPadding(true);

        void messageBodyField.offsetHeight;

        const expandedHeight =
            messageBodyField.scrollHeight;

        /*
         * Височина = само текст + нормален padding.
         * БЕЗ + ACTIONS_RESERVED_HEIGHT (това правеше 2 празни реда).
         */
        const finalHeight = Math.min(
            Math.max(expandedHeight, singleLineHeight),
            maxHeight
        );

        const dropdownShift = Math.max(
            0,
            finalHeight - singleLineHeight
        );

        composerMain.style.setProperty(
            '--composer-dropdown-shift',
            `${dropdownShift}px`
        );

        messageBodyField.style.height =
            `${finalHeight}px`;

        messageBodyField.style.overflowY =
            expandedHeight > maxHeight
                ? 'auto'
                : 'hidden';
    }

    /*
     * =========================================================
     * RESET AFTER SEND
     * =========================================================
     */

    function resetComposerLayout() {
        window.requestAnimationFrame(function () {
            composerMain.classList.remove('is-expanded');

            messageBodyField.style.height = 'auto';
            messageBodyField.style.overflowY = 'hidden';

            autoResizeMessageInput();
            ensureCancelNextToSend();
        });
    }

    window.addEventListener(
        'agro:message-sent',
        resetComposerLayout
    );

    messageBodyField.addEventListener(
        'input',
        autoResizeMessageInput
    );

    window.addEventListener(
        'resize',
        autoResizeMessageInput
    );

    window.requestAnimationFrame(function () {
        autoResizeMessageInput();
        ensureCancelNextToSend();
    });
});


document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const main = document.querySelector('.chat-composer-main');
    if (!main) return;

    const items = [
        {
            btn: document.getElementById('emoji-toggle-btn'),
            menu: document.getElementById('emoji-picker-menu')
        },
        {
            btn: document.getElementById('attachment-toggle-btn'),
            menu: document.getElementById('attachment-picker-menu')
        }
    ];

    function closeItem(item) {
        if (!item.btn || !item.menu) return;
        item.menu.classList.remove('is-open');
        item.menu.hidden = true;
        item.btn.setAttribute('aria-expanded', 'false');
    }

    function closeAll(exceptMenu) {
        items.forEach(function (item) {
            if (!item.btn || !item.menu) return;
            if (exceptMenu && item.menu === exceptMenu) return;
            closeItem(item);
        });
    }

    function openItem(item) {
        if (!item.btn || !item.menu) return;
        closeAll(item.menu);
        item.menu.hidden = false;
        item.menu.classList.add('is-open');
        item.btn.setAttribute('aria-expanded', 'true');
    }

    function toggleItem(item) {
        if (!item.menu) return;
        if (item.menu.classList.contains('is-open') && !item.menu.hidden) {
            closeAll();
        } else {
            openItem(item);
        }
    }

    items.forEach(function (item) {
        if (!item.btn || !item.menu) return;

        item.btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleItem(item);
        });
    });

    // клик извън менютата и бутоните → затваря
    document.addEventListener('click', function (e) {
        if (e.target.closest('.chat-composer-menu')) return;
        if (e.target.closest('#emoji-toggle-btn, #attachment-toggle-btn')) return;
        closeAll();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
    });

    // Attachment: при избор на Image / Video / File → затвори менюто
    const attachItem = items[1];
    if (attachItem.menu) {
        attachItem.menu.addEventListener('click', function (e) {
            if (e.target.closest('.attachment-option')) {
                closeItem(attachItem);
            }
        });
    }

    // Emoji: остава отворен при избор (chat_emoji_picker.js вмъква emoji)
    // нищо не затваряме тук нарочно
});
