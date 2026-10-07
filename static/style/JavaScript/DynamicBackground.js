(function () {
    'use strict';

    // Само mobile chat ползва chat_wallpaper — desktop си върти нормално
    if (
        document.body.classList.contains('chat-app-page') &&
        window.matchMedia('(max-width: 768px)').matches
    ) {
        return;
    }

    const imageUrls = [
        '/static/images/texture.jpg',
        '/static/images/pic1.jpg',
        '/static/images/pic2.jpg',
        '/static/images/pic3.jpg',
        '/static/images/pic4.jpeg'
    ];

    const preloadedImages = [];

    imageUrls.forEach(function (src) {
        const img = new Image();
        img.src = src;
        preloadedImages.push(img);
    });

    function setRandomBackground() {
        if (
            document.body.classList.contains('chat-app-page') &&
            window.matchMedia('(max-width: 768px)').matches
        ) {
            return;
        }
        const randomIndex = Math.floor(Math.random() * imageUrls.length);
        document.body.style.backgroundImage =
            'url("' + imageUrls[randomIndex] + '")';
    }

    setRandomBackground();
    setInterval(setRandomBackground, 10000);
})();
