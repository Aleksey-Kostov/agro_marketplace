(function () {
    'use strict';

    if (document.body.classList.contains('chat-app-page')) {
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
        const randomIndex = Math.floor(Math.random() * imageUrls.length);
        document.body.style.backgroundImage =
            'url("' + imageUrls[randomIndex] + '")';
    }

    setRandomBackground();
    setInterval(setRandomBackground, 10000);
})();
