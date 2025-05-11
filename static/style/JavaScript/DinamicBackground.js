const isProduction = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

const images = [
    isProduction
        ? 'url("https://agromarket601d170f.blob.core.windows.net/static-content/images/texture.jpg")'
        : 'url("/static/images/texture.jpg")',

    isProduction
        ? 'url("https://agromarket601d170f.blob.core.windows.net/static-content/images/pic1.jpg")'
        : 'url("/static/images/pic1.jpg")',

    isProduction
        ? 'url("https://agromarket601d170f.blob.core.windows.net/static-content/images/pic2.jpg")'
        : 'url("/static/images/pik2.jpg")',

    isProduction
        ? 'url("https://agromarket601d170f.blob.core.windows.net/static-content/images/pic3.jpg")'
        : 'url("/static/images/pik3.jpg")',

    isProduction
        ? 'url("https://agromarket601d170f.blob.core.windows.net/static-content/images/pic4.jpg")'
        : 'url("/static/images/pik4.jpg")'
];

function setRandomBackground() {
    const randomIndex = Math.floor(Math.random() * images.length);
    document.body.style.backgroundImage = images[randomIndex];
}

setRandomBackground();
setInterval(setRandomBackground, 10000);
