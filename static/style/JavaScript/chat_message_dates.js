document.addEventListener(
    'DOMContentLoaded',
    function () {
        'use strict';


        /* =====================================================
           ELEMENTS
        ====================================================== */

        const chatWindow =
            document.getElementById('chat-window');

        const chatMessages =
            document.getElementById('chat-messages');

        if (
            !chatWindow ||
            !chatMessages
        ) {
            return;
        }


        /* =====================================================
           ENGLISH DATE NAMES
        ====================================================== */

        const MONTHS = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ];

        const WEEKDAYS = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];


        /* =====================================================
           FLOATING DATE
        ====================================================== */

        let floatingDate =
            chatWindow.querySelector(
                '.chat-floating-date'
            );

        if (!floatingDate) {
            floatingDate =
                document.createElement('div');

            floatingDate.className =
                'chat-floating-date';

            floatingDate.setAttribute(
                'aria-hidden',
                'true'
            );

            chatWindow.appendChild(
                floatingDate
            );
        }


        let hideFloatingDateTimer = null;


        /* =====================================================
           DATE HELPERS
        ====================================================== */

        function startOfDay(date) {
            return new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );
        }


        function differenceInDays(
            firstDate,
            secondDate
        ) {
            const first =
                startOfDay(firstDate);

            const second =
                startOfDay(secondDate);

            return Math.round(
                (
                    first.getTime() -
                    second.getTime()
                ) /
                86400000
            );
        }


        function isSameDay(
            firstDate,
            secondDate
        ) {
            return (
                firstDate.getFullYear() ===
                    secondDate.getFullYear()
                &&
                firstDate.getMonth() ===
                    secondDate.getMonth()
                &&
                firstDate.getDate() ===
                    secondDate.getDate()
            );
        }


        function isSameYear(
            firstDate,
            secondDate
        ) {
            return (
                firstDate.getFullYear() ===
                secondDate.getFullYear()
            );
        }


        function parseMessageDate(
            message
        ) {
            if (!message) {
                return null;
            }

            const timestamp =
                message.dataset.messageTimestamp;

            if (timestamp) {
                const date =
                    new Date(timestamp);

                if (
                    !Number.isNaN(
                        date.getTime()
                    )
                ) {
                    return date;
                }
            }

            const dateValue =
                message.dataset.messageDate;

            if (dateValue) {
                const date =
                    new Date(
                        `${dateValue}T12:00:00`
                    );

                if (
                    !Number.isNaN(
                        date.getTime()
                    )
                ) {
                    return date;
                }
            }

            return null;
        }


        /* =====================================================
           MESSAGE DATE LABEL
        ====================================================== */

        function getMessageDateLabel(
            date,
            now
        ) {
            if (
                !date ||
                !now
            ) {
                return '';
            }

            const daysAgo =
                differenceInDays(
                    now,
                    date
                );


            /* ---------------------------------------------
               TODAY
            --------------------------------------------- */

            if (
                isSameDay(
                    date,
                    now
                )
            ) {
                return 'Today';
            }


            /* ---------------------------------------------
               YESTERDAY
            --------------------------------------------- */

            if (
                daysAgo === 1
            ) {
                return 'Yesterday';
            }


            /* ---------------------------------------------
               THIS WEEK
               Monday ... Sunday
            --------------------------------------------- */

            if (
                daysAgo >= 2 &&
                daysAgo < 7 &&
                isSameYear(
                    date,
                    now
                )
            ) {
                return WEEKDAYS[
                    date.getDay()
                ];
            }


            /* ---------------------------------------------
               SAME YEAR
            --------------------------------------------- */

            if (
                isSameYear(
                    date,
                    now
                )
            ) {
                return (
                    date.getDate() +
                    ' ' +
                    MONTHS[
                        date.getMonth()
                    ]
                );
            }


            /* ---------------------------------------------
               OLDER YEAR
            --------------------------------------------- */

            return (
                date.getDate() +
                ' ' +
                MONTHS[
                    date.getMonth()
                ] +
                ' ' +
                date.getFullYear()
            );
        }


        /* =====================================================
           FLOATING MONTH / YEAR LABEL
        ====================================================== */

        function getFloatingDateLabel(
            date
        ) {
            if (!date) {
                return '';
            }

            return (
                MONTHS[
                    date.getMonth()
                ] +
                ' ' +
                date.getFullYear()
            );
        }


        /* =====================================================
           UPDATE MESSAGE DATE LABELS
        ====================================================== */

        function updateMessageDateLabels() {
            const now =
                new Date();

            const messages =
                chatMessages.querySelectorAll(
                    '.conversation-message'
                );

            messages.forEach(
                function (message) {
                    const date =
                        parseMessageDate(
                            message
                        );

                    if (!date) {
                        return;
                    }

                    const dateElement =
                        message.querySelector(
                            '.conversation-date'
                        );

                    if (!dateElement) {
                        return;
                    }

                    dateElement.textContent =
                        getMessageDateLabel(
                            date,
                            now
                        );
                }
            );
        }


        /* =====================================================
           FIND CURRENT MESSAGE WHILE SCROLLING
        ====================================================== */

        function getCurrentVisibleMessage() {
            const messages =
                Array.from(
                    chatMessages.querySelectorAll(
                        '.conversation-message'
                    )
                );

            if (!messages.length) {
                return null;
            }

            const windowRect =
                chatWindow.getBoundingClientRect();

            const activationLine =
                windowRect.top + 70;

            let currentMessage =
                messages[0];

            for (
                const message of messages
            ) {
                const rect =
                    message.getBoundingClientRect();

                if (
                    rect.top <=
                    activationLine
                ) {
                    currentMessage =
                        message;
                } else {
                    break;
                }
            }

            return currentMessage;
        }


        /* =====================================================
           SHOW FLOATING MONTH / YEAR
        ====================================================== */

        function showFloatingDate() {
            const message =
                getCurrentVisibleMessage();

            if (!message) {
                return;
            }

            const date =
                parseMessageDate(
                    message
                );

            if (!date) {
                return;
            }

            floatingDate.textContent =
                getFloatingDateLabel(
                    date
                );

            floatingDate.classList.add(
                'is-visible'
            );

            if (
                hideFloatingDateTimer
            ) {
                clearTimeout(
                    hideFloatingDateTimer
                );
            }

            hideFloatingDateTimer =
                setTimeout(
                    function () {
                        floatingDate.classList.remove(
                            'is-visible'
                        );
                    },
                    900
                );
        }


        /* =====================================================
           SCROLL
        ====================================================== */

        let scrollFrame = null;

        chatWindow.addEventListener(
            'scroll',
            function () {
                if (scrollFrame) {
                    return;
                }

                scrollFrame =
                    requestAnimationFrame(
                        function () {
                            scrollFrame = null;

                            showFloatingDate();
                        }
                    );
            },
            {
                passive: true
            }
        );


        /* =====================================================
           DYNAMIC MESSAGES
           WebSocket / AJAX
        ====================================================== */

        let mutationTimer = null;

        const observer =
            new MutationObserver(
                function () {
                    if (
                        mutationTimer
                    ) {
                        clearTimeout(
                            mutationTimer
                        );
                    }

                    mutationTimer =
                        setTimeout(
                            function () {
                                updateMessageDateLabels();
                            },
                            0
                        );
                }
            );

        observer.observe(
            chatMessages,
            {
                childList: true,
                subtree: true
            }
        );


        /* =====================================================
           INITIALIZE
        ====================================================== */

        updateMessageDateLabels();
    }
);
