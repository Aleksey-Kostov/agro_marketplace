const imageUrls = [
    "/static/images/texture.jpg",
    "/static/images/pic1.jpg",
    "/static/images/pic2.jpg",
    "/static/images/pic3.jpg",
    "/static/images/pic4.jpeg"
];

// Preload images
const preloadedImages = [];

imageUrls.forEach((src) => {
    const img = new Image();
    img.src = src;
    preloadedImages.push(img);
});

function setRandomBackground() {
    const randomIndex = Math.floor(Math.random() * imageUrls.length);

    document.body.style.backgroundImage =
        `url("${imageUrls[randomIndex]}")`;
}

setRandomBackground();

setInterval(setRandomBackground, 10000);
