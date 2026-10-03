document.addEventListener('DOMContentLoaded', function () {
    const messageBodyField =
        document.getElementById('message-body-input');

    if (!messageBodyField) {
        return;
    }

    /*
     * Размери на composer-а.
     *
     * Един ред:
     * - полето остава компактно
     * - бутоните стоят на долния ред
     *
     * При повече текст:
     * - textarea се разширява нагоре
     * - долу се оставя място за бутоните
     */
    const SINGLE_LINE_HEIGHT = 44;
    const ACTIONS_RESERVED_HEIGHT = 46;

    function getMaxHeight() {
        const computedStyle =
            window.getComputedStyle(messageBodyField);

        return parseFloat(computedStyle.maxHeight) || 160;
    }

    function setTextareaPadding(expanded) {
        /*
         * При един ред не губим вертикално пространство за бутоните.
         *
         * При разширено поле оставяме място отдолу,
         * за да не попадне последният ред под бутоните.
         */
        messageBodyField.style.paddingTop = '10px';
        messageBodyField.style.paddingRight = '14px';
        messageBodyField.style.paddingBottom =
            expanded
                ? `${ACTIONS_RESERVED_HEIGHT}px`
                : '10px';
        messageBodyField.style.paddingLeft = '14px';
    }

    function autoResizeMessageInput() {
        const chatComposerMain =
            messageBodyField.closest('.chat-composer-main');

        const maxHeight = getMaxHeight();

        /*
         * Първо връщаме полето в компактно състояние.
         * Това е важно, защото иначе след изтриване на текст
         * textarea може да остане излишно висока.
         */
        if (chatComposerMain) {
            chatComposerMain.classList.remove('is-expanded');
        }

        messageBodyField.style.height = 'auto';
        messageBodyField.style.overflowY = 'hidden';

        /*
         * Временно използваме компактния padding,
         * за да измерим реалната височина на текста.
         */
        setTextareaPadding(false);

        const naturalHeight =
            messageBodyField.scrollHeight;

        /*
         * Ако съдържанието се побира на един ред,
         * оставяме composer-а минимален.
         */
        if (naturalHeight <= SINGLE_LINE_HEIGHT + 4) {
            messageBodyField.style.height =
                `${SINGLE_LINE_HEIGHT}px`;

            messageBodyField.style.overflowY = 'hidden';

            return;
        }

        /*
         * Текстът вече има нужда от втори/следващ ред.
         * Тогава включваме разширения режим.
         */
        if (chatComposerMain) {
            chatComposerMain.classList.add('is-expanded');
        }

        /*
         * След включване на expanded режима измерваме отново,
         * защото долният padding вече е по-голям.
         */
        messageBodyField.style.height = 'auto';
        setTextareaPadding(true);

        const expandedHeight =
            messageBodyField.scrollHeight;

        const finalHeight =
            Math.min(
                Math.max(
                    expandedHeight,
                    SINGLE_LINE_HEIGHT + ACTIONS_RESERVED_HEIGHT
                ),
                maxHeight
            );

        messageBodyField.style.height =
            `${finalHeight}px`;

        /*
         * След достигане на максималната височина
         * самото textarea започва да скролира.
         */
        messageBodyField.style.overflowY =
            expandedHeight > maxHeight
                ? 'auto'
                : 'hidden';
    }

    messageBodyField.addEventListener(
        'input',
        autoResizeMessageInput
    );

    /*
     * При промяна на ширината на прозореца текстът може
     * да започне/спре да се пренася на нов ред.
     */
    window.addEventListener(
        'resize',
        autoResizeMessageInput
    );

    /*
     * Начално изчисляване.
     */
    autoResizeMessageInput();
});
