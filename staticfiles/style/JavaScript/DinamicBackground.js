const images = [
    'url("/static/images/texture.jpg")',
    'url("/static/images/pic1.jpg")',
    'url("/static/images/pic2.jpg")',
    'url("/static/images/pic3.jpg")',
    'url("/static/images/pic4.jpg")'
];

function setRandomBackground() {
    const randomIndex = Math.floor(Math.random() * images.length);
    document.body.style.backgroundImage = images[randomIndex];
}

setRandomBackground();
setInterval(setRandomBackground, 10000);
