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

    const SINGLE_LINE_HEIGHT = 44;

    /*
     * Space reserved at the bottom when the textarea grows.
     * The action buttons stay inside this area.
     */
    const ACTIONS_RESERVED_HEIGHT = 46;

    /*
     * Horizontal space reserved for the right-side controls
     * while the textarea is still on one line.
     *
     * Desktop:
     * attachment + cancel + send
     */
    const DESKTOP_RIGHT_ACTION_SPACE = 150;

    /*
     * Mobile:
     * attachment + cancel + circular send
     */
    const MOBILE_RIGHT_ACTION_SPACE = 92;

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

        /*
         * Compact:
         * reserve horizontal space for the buttons.
         *
         * Expanded:
         * buttons are on the bottom row, so the text can use
         * the full width again.
         */
        messageBodyField.style.paddingTop =
            isMobile()
                ? '8px'
                : '10px';

        messageBodyField.style.paddingLeft =
            expanded
                ? '14px'
                : (
                    isMobile()
                        ? '48px'
                        : '52px'
                );

        messageBodyField.style.paddingRight =
            expanded
                ? '14px'
                : `${rightSpace}px`;

        messageBodyField.style.paddingBottom =
            expanded
                ? `${ACTIONS_RESERVED_HEIGHT}px`
                : (
                    isMobile()
                        ? '8px'
                        : '10px'
                );
    }

    /*
     * =========================================================
     * MOVE VOICE CANCEL OUT OF THE EMOJI GROUP
     * =========================================================
     *
     * voice_recorder.js creates the cancel button inside
     * .chat-composer-actions-right.
     *
     * For the professional composer layout we want:
     *
     * Emoji | spacer | Attachment | Cancel | Send
     *
     * So the cancel button becomes a direct child of the
     * action bar.
     *
     * We do this here instead of changing the recorder itself.
     */

    function normalizeVoiceCancelButton() {
        if (!composerActions) {
            return;
        }

        const cancelBtn =
            document.getElementById(
                'voice-recording-cancel-btn'
            );

        if (!cancelBtn) {
            return;
        }

        if (
            cancelBtn.parentElement ===
            composerActions
        ) {
            return;
        }

        composerActions.appendChild(
            cancelBtn
        );
    }

    /*
     * The recorder creates the button dynamically,
     * therefore observe the composer for it.
     */
    if (composerActions) {
        const composerObserver =
            new MutationObserver(function () {
                normalizeVoiceCancelButton();
            });

        composerObserver.observe(
            composerActions,
            {
                childList: true,
                subtree: true
            }
        );

        /*
         * Also try immediately in case the recorder has
         * already created it.
         */
        normalizeVoiceCancelButton();
    }


    /*
     * =========================================================
     * RESIZE
     * =========================================================
     */

    function autoResizeMessageInput() {
        const maxHeight =
            getMaxHeight();

        /*
         * Always start from compact state.
         * This allows the textarea to shrink again.
         */
        composerMain.classList.remove(
            'is-expanded'
        );

        messageBodyField.style.height =
            'auto';

        messageBodyField.style.overflowY =
            'hidden';

        /*
         * Compact measurement.
         *
         * Right-side buttons are reserved here so text cannot
         * run underneath Send while still on one line.
         */
        setTextareaPadding(false);

        const naturalHeight =
            messageBodyField.scrollHeight;

        /*
         * One-line message.
         */
        if (
            naturalHeight <=
            SINGLE_LINE_HEIGHT + 4
        ) {
            messageBodyField.style.height =
                `${SINGLE_LINE_HEIGHT}px`;

            messageBodyField.style.overflowY =
                'hidden';

            return;
        }

        /*
         * Message needs additional lines.
         *
         * From this point onward the textarea gets the full
         * horizontal width and the action buttons occupy the
         * bottom area.
         */
        composerMain.classList.add(
            'is-expanded'
        );

        messageBodyField.style.height =
            'auto';

        setTextareaPadding(true);

        const expandedHeight =
            messageBodyField.scrollHeight;

        const finalHeight =
            Math.min(
                Math.max(
                    expandedHeight,
                    SINGLE_LINE_HEIGHT +
                    ACTIONS_RESERVED_HEIGHT
                ),
                maxHeight
            );
        const dropdownShift =
            Math.max(
                0,
                finalHeight -
                SINGLE_LINE_HEIGHT
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
     *
     * conversation.js already dispatches:
     *
     * agro:message-sent
     *
     * after a successful send/edit.
     *
     * Use that event to force the composer back to one line.
     */

    function resetComposerLayout() {
        /*
         * Wait one frame so that any DOM update performed by
         * conversation.js has already completed.
         */
        window.requestAnimationFrame(
            function () {
                composerMain.classList.remove(
                    'is-expanded'
                );

                messageBodyField.style.height =
                    'auto';

                messageBodyField.style.overflowY =
                    'hidden';

                /*
                 * Recalculate using the now-empty textarea.
                 */
                autoResizeMessageInput();

                /*
                 * Make sure any dynamically-created voice
                 * cancel button has its correct parent.
                 */
                normalizeVoiceCancelButton();
            }
        );
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

    /*
     * When the viewport changes width, the amount of wrapping
     * can change as well.
     */
    window.addEventListener(
        'resize',
        autoResizeMessageInput
    );

    /*
     * Initial state.
     */
    autoResizeMessageInput();
});
