(function () {
    'use strict';

    // Спирай random САМО на mobile chat
    function isMobileChat() {
        return (
            document.body.classList.contains('chat-app-page') &&
            window.matchMedia('(max-width: 768px)').matches
        );
    }

    if (isMobileChat()) {
        return;
    }

    const imageUrls = [
        '/static/images/texture.jpg',
        '/static/images/pic1.jpg',
        '/static/images/pic2.jpg',
        '/static/images/pic3.jpg',
        '/static/images/pic4.jpeg'
    ];

    imageUrls.forEach(function (src) {
        const img = new Image();
        img.src = src;
    });

    function setRandomBackground() {
        if (isMobileChat()) return;
        const i = Math.floor(Math.random() * imageUrls.length);
        document.body.style.backgroundImage = 'url("' + imageUrls[i] + '")';
    }

    setRandomBackground();
    setInterval(setRandomBackground, 10000);
})();
