document.addEventListener('DOMContentLoaded', function () {


        /* =========================================================
           EMOJI
        ========================================================== */

        document.querySelectorAll('.emoji-btn').forEach(function (btn) {

            btn.addEventListener('click', function (e) {

                e.preventDefault();
                e.stopPropagation();

                const input =
                    document.getElementById('message-body-input') ||
                    document.querySelector('textarea[name="body"]') ||
                    document.querySelector('input[name="body"]');

                if (!input) {
                    return;
                }

                input.value += btn.dataset.emoji || '';

                input.focus();

            });

        });


        /* =========================================================
           CHAT SCROLL
        ========================================================== */

        const chatWindow =
            document.getElementById('chat-window');

        const scrollTopBtn =
            document.getElementById('scroll-top-btn');

        const scrollBottomBtn =
            document.getElementById('scroll-bottom-btn');


        /*
         * Вече няма 60px праг.
         *
         * Достатъчен е дори 1px scroll.
         */

        const SCROLL_EPSILON = 1;


        function getMaxScrollTop() {

            if (!chatWindow) {
                return 0;
            }

            return Math.max(
                0,
                chatWindow.scrollHeight -
                chatWindow.clientHeight
            );

        }


        function updateScrollButtons() {

            if (!chatWindow) {
                return;
            }


            const currentScrollTop =
                chatWindow.scrollTop;


            const maxScrollTop =
                getMaxScrollTop();


            /*
             * UP
             *
             * Показва се веднага щом сме
             * мръднали надолу от началото.
             */

            const atTop =
                currentScrollTop <= SCROLL_EPSILON;


            /*
             * DOWN
             *
             * Показва се веднага щом не сме
             * на самия край.
             */

            const atBottom =
                currentScrollTop >=
                maxScrollTop - SCROLL_EPSILON;


            if (scrollTopBtn) {

                scrollTopBtn.classList.toggle(
                    'd-none',
                    atTop
                );

            }


            if (scrollBottomBtn) {

                scrollBottomBtn.classList.toggle(
                    'd-none',
                    atBottom
                );

            }

        }


        /* =========================================================
           SCROLL TOP
        ========================================================== */

        function scrollToTop() {

            if (!chatWindow) {
                return;
            }

            chatWindow.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

        }


        /* =========================================================
           SCROLL BOTTOM
        ========================================================== */

        function scrollToBottom() {

            if (!chatWindow) {
                return;
            }

            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });

        }


        /* =========================================================
           SCROLL EVENTS
        ========================================================== */

        if (chatWindow) {

            /*
             * Първоначална проверка.
             */

            updateScrollButtons();


            /*
             * Проверка при всяко движение.
             */

            chatWindow.addEventListener(
                'scroll',
                updateScrollButtons,
                {
                    passive: true
                }
            );


            /*
             * Проверка при resize.
             */

            window.addEventListener(
                'resize',
                updateScrollButtons
            );


            /*
             * Много важно:
             *
             * Ако снимка/видео промени височината
             * на разговора, преизчисляваме бутоните.
             */

            if ('ResizeObserver' in window) {

                const resizeObserver =
                    new ResizeObserver(function () {

                        updateScrollButtons();

                    });


                resizeObserver.observe(
                    chatWindow
                );


                const messages =
                    document.getElementById(
                        'chat-messages'
                    );


                if (messages) {

                    resizeObserver.observe(
                        messages
                    );

                }

            }

        }


        /* =========================================================
           UP BUTTON
        ========================================================== */

        if (scrollTopBtn) {

            scrollTopBtn.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    scrollToTop();

                }
            );

        }


        /* =========================================================
           DOWN BUTTON
        ========================================================== */

        if (scrollBottomBtn) {

            scrollBottomBtn.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    scrollToBottom();

                }
            );

        }


        /* =========================================================
           INITIAL CHAT POSITION
        ========================================================== */

        function initializeChatPosition() {

            if (!chatWindow) {
                return;
            }


            /*
             * Изчакваме браузъра да изчисли
             * цялото съдържание.
             */

            requestAnimationFrame(function () {

                const maxScrollTop =
                    Math.max(
                        0,
                        chatWindow.scrollHeight -
                        chatWindow.clientHeight
                    );


                /*
                 * Отиваме директно на края.
                 */

                chatWindow.scrollTop =
                    maxScrollTop;


                /*
                 * Проверяваме веднага.
                 */

                updateScrollButtons();


                /*
                 * Втори кадър — важно за images/videos.
                 */

                requestAnimationFrame(function () {

                    const finalMaxScrollTop =
                        Math.max(
                            0,
                            chatWindow.scrollHeight -
                            chatWindow.clientHeight
                        );


                    chatWindow.scrollTop =
                        finalMaxScrollTop;


                    updateScrollButtons();

                });

            });

        }


        /*
         * Стартираме след зареждането.
         */

        if (document.readyState === 'complete') {

            initializeChatPosition();

        } else {

            window.addEventListener(
                'load',
                initializeChatPosition,
                {
                    once: true
                }
            );

        }


        /* =========================================================
           MEDIA ELEMENTS
        ========================================================== */

        const imageInput =
            document.getElementById('id_image');

        const videoInput =
            document.getElementById('id_video');

        const imagePreview =
            document.getElementById('image-preview');

        const videoPreview =
            document.getElementById('video-preview');

        const imagePreviewWrapper =
            document.getElementById('image-preview-wrap');

        const videoPreviewWrapper =
            document.getElementById('video-preview-wrap');

        const attachImageBtn =
            document.getElementById('attach-image-btn');

        const attachVideoBtn =
            document.getElementById('attach-video-btn');

        const removeMediaBtn =
            document.getElementById('remove-media-btn');


        let imageObjectUrl = null;
        let videoObjectUrl = null;


        /* =========================================================
           FILE PICKERS
        ========================================================== */

        if (attachImageBtn && imageInput) {

            attachImageBtn.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    imageInput.click();

                }
            );

        }


        if (attachVideoBtn && videoInput) {

            attachVideoBtn.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    videoInput.click();

                }
            );

        }


        /* =========================================================
           OBJECT URL CLEANUP
        ========================================================== */

        function revokeImageUrl() {

            if (!imageObjectUrl) {
                return;
            }

            URL.revokeObjectURL(
                imageObjectUrl
            );

            imageObjectUrl = null;

        }


        function revokeVideoUrl() {

            if (!videoObjectUrl) {
                return;
            }

            URL.revokeObjectURL(
                videoObjectUrl
            );

            videoObjectUrl = null;

        }


        function hideMediaPreviews() {

            if (imagePreviewWrapper) {

                imagePreviewWrapper.classList.add(
                    'd-none'
                );

            }

            if (videoPreviewWrapper) {

                videoPreviewWrapper.classList.add(
                    'd-none'
                );

            }

            if (removeMediaBtn) {

                removeMediaBtn.classList.add(
                    'd-none'
                );

            }

        }


        /* =========================================================
           IMAGE SELECT
        ========================================================== */

        if (imageInput) {

            imageInput.addEventListener(
                'change',
                function () {

                    const file =
                        imageInput.files &&
                        imageInput.files[0];


                    if (!file) {
                        return;
                    }


                    if (videoInput) {

                        videoInput.value = '';

                    }


                    revokeVideoUrl();


                    if (videoPreview) {

                        videoPreview.pause();

                        videoPreview.removeAttribute(
                            'src'
                        );

                        videoPreview.load();

                    }


                    if (!imagePreview) {
                        return;
                    }


                    revokeImageUrl();


                    imageObjectUrl =
                        URL.createObjectURL(file);


                    imagePreview.src =
                        imageObjectUrl;


                    if (imagePreviewWrapper) {

                        imagePreviewWrapper.classList.remove(
                            'd-none'
                        );

                    }


                    if (videoPreviewWrapper) {

                        videoPreviewWrapper.classList.add(
                            'd-none'
                        );

                    }


                    if (removeMediaBtn) {

                        removeMediaBtn.classList.remove(
                            'd-none'
                        );

                    }

                }
            );

        }


        /* =========================================================
           VIDEO SELECT
        ========================================================== */

        if (videoInput) {

            videoInput.addEventListener(
                'change',
                function () {

                    const file =
                        videoInput.files &&
                        videoInput.files[0];


                    if (!file) {
                        return;
                    }


                    if (imageInput) {

                        imageInput.value = '';

                    }


                    revokeImageUrl();


                    if (imagePreview) {

                        imagePreview.removeAttribute(
                            'src'
                        );

                    }


                    if (!videoPreview) {
                        return;
                    }


                    revokeVideoUrl();


                    videoObjectUrl =
                        URL.createObjectURL(file);


                    videoPreview.src =
                        videoObjectUrl;


                    videoPreview.load();


                    if (videoPreviewWrapper) {

                        videoPreviewWrapper.classList.remove(
                            'd-none'
                        );

                    }


                    if (imagePreviewWrapper) {

                        imagePreviewWrapper.classList.add(
                            'd-none'
                        );

                    }


                    if (removeMediaBtn) {

                        removeMediaBtn.classList.remove(
                            'd-none'
                        );

                    }

                }
            );

        }


        /* =========================================================
           REMOVE MEDIA
        ========================================================== */

        if (removeMediaBtn) {

            removeMediaBtn.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();


                    if (imageInput) {

                        imageInput.value = '';

                    }


                    if (videoInput) {

                        videoInput.value = '';

                    }


                    revokeImageUrl();

                    revokeVideoUrl();


                    if (imagePreview) {

                        imagePreview.removeAttribute(
                            'src'
                        );

                    }


                    if (videoPreview) {

                        videoPreview.pause();

                        videoPreview.removeAttribute(
                            'src'
                        );

                        videoPreview.load();

                    }


                    hideMediaPreviews();

                }
            );

        }


        /* =========================================================
           CLEANUP
        ========================================================== */

        window.addEventListener(
            'beforeunload',
            function () {

                revokeImageUrl();

                revokeVideoUrl();

            }
        );


        /* =========================================================
           SHARE
        ========================================================== */

        document.addEventListener(
            'click',
            async function (e) {

                const btn =
                    e.target.closest('.share-btn');


                if (!btn) {
                    return;
                }


                e.preventDefault();


                const url =
                    btn.dataset.url;


                if (!url) {
                    return;
                }


                if (navigator.share) {

                    try {

                        await navigator.share({
                            title: 'Shared media',
                            text: 'Check this out',
                            url: url
                        });

                        return;

                    } catch (error) {

                        if (
                            error &&
                            error.name === 'AbortError'
                        ) {

                            return;

                        }

                    }

                }


                try {

                    if (
                        navigator.clipboard &&
                        window.isSecureContext
                    ) {

                        await navigator.clipboard.writeText(
                            url
                        );


                        const oldHtml =
                            btn.innerHTML;


                        btn.innerHTML =
                            '✓';


                        setTimeout(
                            function () {

                                btn.innerHTML =
                                    oldHtml;

                            },
                            1200
                        );


                        return;

                    }

                } catch (error) {

                    console.error(
                        'Clipboard failed:',
                        error
                    );

                }


                const textarea =
                    document.createElement(
                        'textarea'
                    );


                textarea.value =
                    url;


                textarea.style.position =
                    'fixed';

                textarea.style.left =
                    '-9999px';

                textarea.style.top =
                    '-9999px';

                textarea.style.opacity =
                    '0';


                document.body.appendChild(
                    textarea
                );


                textarea.focus();

                textarea.select();


                try {

                    document.execCommand(
                        'copy'
                    );

                } catch (error) {

                    console.error(
                        'Copy failed:',
                        error
                    );

                }


                textarea.remove();

            }
        );


        /* =========================================================
           REACTIONS
        ========================================================== */

        const defaultAvatar =
            "{% static 'images/profile_picture.webp' %}";


        document.addEventListener(
            'click',
            async function (e) {

                const btn =
                    e.target.closest('.js-react');


                if (!btn) {
                    return;
                }


                e.preventDefault();


                if (btn.dataset.loading === '1') {
                    return;
                }


                btn.dataset.loading = '1';


                const csrfTokenElement =
                    document.querySelector(
                        '[name="csrfmiddlewaretoken"]'
                    );


                const csrfToken =
                    csrfTokenElement
                        ? csrfTokenElement.value
                        : '';


                if (!csrfToken) {

                    console.error(
                        'CSRF token not found.'
                    );

                    btn.dataset.loading = '0';

                    return;

                }


                try {

                    const url =
                        btn.href;


                    if (!url) {

                        throw new Error(
                            'Reaction URL not found.'
                        );

                    }


                    const response =
                        await fetch(
                            url,
                            {
                                method: 'POST',

                                credentials:
                                    'same-origin',

                                headers: {

                                    'X-Requested-With':
                                        'XMLHttpRequest',

                                    'Accept':
                                        'application/json',

                                    'X-CSRFToken':
                                        csrfToken

                                }

                            }
                        );


                    let data;


                    try {

                        data =
                            await response.json();

                    } catch (jsonError) {

                        throw new Error(
                            `Invalid server response (${response.status}).`
                        );

                    }


                    if (
                        !response.ok ||
                        !data.ok
                    ) {

                        throw new Error(
                            data.error ||
                            `Reaction failed (${response.status}).`
                        );

                    }


                    const reaction =
                        data.reaction ||
                        btn.dataset.reaction;


                    const messageId =
                        data.message_id ||
                        btn.dataset.msg;


                    /* =================================================
                       ACTIVE STATE
                    ================================================== */

                    btn.classList.toggle(
                        'active-like',
                        reaction === 'like' &&
                        Boolean(data.active)
                    );


                    btn.classList.toggle(
                        'active-heart',
                        reaction === 'heart' &&
                        Boolean(data.active)
                    );


                    /* =================================================
                       AVATAR BOX
                    ================================================== */

                    let avatarBox =
                        btn.querySelector(
                            '[data-react-avatars]'
                        );


                    if (
                        !avatarBox &&
                        messageId &&
                        reaction
                    ) {

                        avatarBox =
                            document.querySelector(
                                `[data-react-avatars="${reaction}-${messageId}"]`
                            );

                    }


                    /* =================================================
                       RENDER REACTORS
                    ================================================== */

                    if (avatarBox) {

                        avatarBox.replaceChildren();


                        const reactors =
                            Array.isArray(data.reactors)
                                ? data.reactors
                                : [];


                        reactors.forEach(
                            function (reactor) {

                                const img =
                                    document.createElement(
                                        'img'
                                    );


                                img.className =
                                    'react-avatar';


                                img.alt =
                                    reactor.username ||
                                    'User';


                                img.loading =
                                    'lazy';


                                img.src =
                                    reactor.photo ||
                                    defaultAvatar;


                                avatarBox.appendChild(
                                    img
                                );

                            }
                        );

                    }


                    /* =================================================
                       TOOLTIP
                    ================================================== */

                    if (
                        Array.isArray(
                            data.reactors
                        )
                    ) {

                        const names =
                            data.reactors
                                .map(
                                    function (reactor) {

                                        return reactor.username;

                                    }
                                )
                                .filter(Boolean);


                        if (names.length) {

                            btn.title =
                                names.join(', ');

                        } else {

                            btn.title =
                                reaction === 'heart'
                                    ? 'Heart'
                                    : 'Like';

                        }

                    }

                } catch (error) {

                    console.error(
                        'Reaction error:',
                        error
                    );

                } finally {

                    btn.dataset.loading =
                        '0';

                }

            }
        );

    });