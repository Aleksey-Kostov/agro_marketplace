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
     *
     * Съвпадат с chat_composer.css:
     * Desktop: 24 line + 10+10 padding = 44
     * Mobile:  22 line + 8+8  padding = 38
     */

    function getSingleLineHeight() {
        return isMobile() ? 38 : 44;
    }

    /*
     * Compact mode: по-малко резервирано място вдясно,
     * за да стигне текстът почти до бутоните преди 2-ри ред.
     *
     * Desktop: attachment (~40) + send (~120) + gap ≈ 130
     * Mobile:  attachment (~38) + send (~40) + gap ≈ 78
     */
    const DESKTOP_RIGHT_ACTION_SPACE = 130;
    const MOBILE_RIGHT_ACTION_SPACE = 78;

    /*
     * Compact left: emoji бутонът е извън textarea-та (grid col 1),
     * затова left padding е малък — само визуален въздух.
     */
    const DESKTOP_LEFT_PADDING_COMPACT = '12px';
    const MOBILE_LEFT_PADDING_COMPACT = '8px';

    const ACTIONS_RESERVED_HEIGHT = 46;

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

        messageBodyField.style.paddingTop =
            isMobile() ? '8px' : '10px';

        /*
         * Compact: малък left — emoji е в отделна grid колона.
         * Expanded: пълен width, бутоните са на 2-ри ред.
         */
        messageBodyField.style.paddingLeft =
            expanded
                ? '14px'
                : (
                    isMobile()
                        ? MOBILE_LEFT_PADDING_COMPACT
                        : DESKTOP_LEFT_PADDING_COMPACT
                );

        messageBodyField.style.paddingRight =
            expanded
                ? '14px'
                : `${rightSpace}px`;

        /*
         * Expanded: запазваме място долу за action bar.
         * Compact: стандартен vertical padding = 1 ред.
         */
        messageBodyField.style.paddingBottom =
            expanded
                ? `${ACTIONS_RESERVED_HEIGHT}px`
                : (
                    isMobile() ? '8px' : '10px'
                );
    }

    /*
     * =========================================================
     * VOICE CANCEL — ОСТАВА ДО SEND
     * =========================================================
     *
     * voice_recorder.js вече поставя cancel с insertBefore(submitBtn).
     * НЕ го местете в средата на grid-а — иначе е далеч от Send
     * и swipe-to-cancel не работи удобно.
     *
     * Ако някой друг код го е преместил, връщаме го до Send.
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

        /*
         * Cancel трябва да е непосредствено преди Send,
         * вътре в .chat-composer-actions-right.
         */
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

        /*
         * Force reflow преди измерване.
         */
        void messageBodyField.offsetHeight;

        const naturalHeight =
            messageBodyField.scrollHeight;

        /*
         * Един ред — само ако scrollHeight е близо до 1 ред.
         * Толеранс 6px заради subpixel / font metrics.
         */
        if (naturalHeight <= singleLineHeight + 6) {
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
         * Повече от 1 ред → expanded layout.
         */
        composerMain.classList.add('is-expanded');

        messageBodyField.style.height = 'auto';
        setTextareaPadding(true);

        void messageBodyField.offsetHeight;

        const expandedHeight =
            messageBodyField.scrollHeight;

        const finalHeight = Math.min(
            Math.max(
                expandedHeight,
                singleLineHeight + ACTIONS_RESERVED_HEIGHT
            ),
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

    /*
     * =========================================================
     * EVENTS
     * =========================================================
     */

    messageBodyField.addEventListener(
        'input',
        autoResizeMessageInput
    );

    window.addEventListener(
        'resize',
        autoResizeMessageInput
    );

    /*
     * Initial — след layout, за да няма 2 реда при load.
     */
    window.requestAnimationFrame(function () {
        autoResizeMessageInput();
        ensureCancelNextToSend();
    });
});
