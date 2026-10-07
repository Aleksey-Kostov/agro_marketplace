/**
 * Chat wallpaper — ден / нощ (+ сезон, готови слотове)
 * Работи само при body.chat-app-page
 */
(function () {
    'use strict';

    if (!document.body.classList.contains('chat-app-page')) {
        return;
    }

    // -------------------------------------------------------
    // Картинки
    // Сложи свои: chat-bg-day.png / chat-bg-night.png
    // Докато ги няма — fallback към наличните в static/images
    // -------------------------------------------------------
    const WALLPAPERS = {
        day: {
            spring: '/static/images/chat-bg-day.png',
            summer: '/static/images/chat-bg-day.png',
            autumn: '/static/images/chat-bg-day.png',
            winter: '/static/images/chat-bg-day.png',
            // fallback ако файлът липсва:
            _fallback: '/static/images/texture.jpg'
        },
        night: {
            spring: '/static/images/chat-bg-night.png',
            summer: '/static/images/chat-bg-night.png',
            autumn: '/static/images/chat-bg-night.png',
            winter: '/static/images/chat-bg-night.png',
            _fallback: '/static/images/pic3.jpg'
        }
    };

    // Ден: 06:00 – 19:59 | Нощ: 20:00 – 05:59
    const DAY_START_HOUR = 6;
    const DAY_END_HOUR = 20;

    function getSeason(date) {
        const month = date.getMonth() + 1; // 1–12
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    function isDaytime(date) {
        const hour = date.getHours();
        return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
    }

    function pickUrl(date) {
        const mode = isDaytime(date) ? 'day' : 'night';
        const season = getSeason(date);
        const pack = WALLPAPERS[mode];
        return pack[season] || pack._fallback;
    }

    function applyBodyStyles() {
        const body = document.body;
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundPosition = 'center center';
        body.style.backgroundSize = 'cover';
        body.style.backgroundAttachment = 'fixed';
        body.style.transition = 'background-image 0.8s ease';
    }

    function setWallpaper(url) {
        const body = document.body;
        // preload → после смяна (по-гладко)
        const img = new Image();
        img.onload = function () {
            body.style.backgroundImage = 'url("' + url + '")';
            body.dataset.chatWallpaper = url;
            body.dataset.chatWallpaperMode = isDaytime(new Date()) ? 'day' : 'night';
            body.dataset.chatWallpaperSeason = getSeason(new Date());
        };
        img.onerror = function () {
            // ако chat-bg-*.webp липсва → fallback
            const mode = isDaytime(new Date()) ? 'day' : 'night';
            const fallback = WALLPAPERS[mode]._fallback;
            if (url !== fallback) {
                setWallpaper(fallback);
            }
        };
        img.src = url;
    }

    function applyChatWallpaper() {
        applyBodyStyles();
        setWallpaper(pickUrl(new Date()));
    }

    applyChatWallpaper();

    // Проверка на всеки 5 мин (граница 6:00 / 20:00)
    setInterval(applyChatWallpaper, 5 * 60 * 1000);

    // За debug в конзолата: window.__agroRefreshChatWallpaper()
    window.__agroRefreshChatWallpaper = applyChatWallpaper;
})();
