document.addEventListener('DOMContentLoaded', function () {
    const messageBodyField =
        document.getElementById('message-body-input');

    if (!messageBodyField) {
        return;
    }

    function autoResizeMessageInput() {
        /*
         * Първо връщаме автоматична височина,
         * за да може полето и да се свива при изтриване.
         */
        messageBodyField.style.height = 'auto';

        const computedStyle =
            window.getComputedStyle(messageBodyField);

        const minHeight =
            parseFloat(computedStyle.minHeight) || 42;

        const maxHeight =
            parseFloat(computedStyle.maxHeight) || 160;

        const newHeight =
            Math.min(
                Math.max(
                    messageBodyField.scrollHeight,
                    minHeight
                ),
                maxHeight
            );

        messageBodyField.style.height =
            `${newHeight}px`;

        /*
         * До лимита няма вътрешен scroll.
         * След лимита текстът започва да се скролира
         * вътре в полето.
         */
        messageBodyField.style.overflowY =
            messageBodyField.scrollHeight > maxHeight
                ? 'auto'
                : 'hidden';
    }

    messageBodyField.addEventListener(
        'input',
        autoResizeMessageInput
    );

    /*
     * Изчисляваме височината и при първоначално зареждане.
     */
    autoResizeMessageInput();
});
