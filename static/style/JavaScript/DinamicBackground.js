const isProduction = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

const imageUrls = [
    isProduction
        ? "https://agromarket601d170f.blob.core.windows.net/static-content/images/texture.jpg"
        : "/static/images/texture.jpg",

    isProduction
        ? "https://agromarket601d170f.blob.core.windows.net/static-content/images/pic1.jpg"
        : "/static/images/pic1.jpg",

    isProduction
        ? "https://agromarket601d170f.blob.core.windows.net/static-content/images/pic2.jpg"
        : "/static/images/pic2.jpg",

    isProduction
        ? "https://agromarket601d170f.blob.core.windows.net/static-content/images/pic3.jpg"
        : "/static/images/pic3.jpg",

    isProduction
        ? "https://agromarket601d170f.blob.core.windows.net/static-content/images/pic4.jpg"
        : "/static/images/pic4.jpg"
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
    document.body.style.backgroundImage = `url("${imageUrls[randomIndex]}")`;
}

setRandomBackground();
setInterval(setRandomBackground, 10000);
