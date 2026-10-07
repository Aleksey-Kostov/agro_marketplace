/**
 * Chat wallpaper — ден/нощ (+ сезон)
 * Само на mobile (≤768px) + body.chat-app-page
 * Desktop → нормален site фон (DynamicBackground)
 */
(function () {
    'use strict';

    if (!document.body.classList.contains('chat-app-page')) {
        return;
    }

    const MOBILE_MQ = window.matchMedia('(max-width: 768px)');

    const WALLPAPERS = {
        day: {
            spring: '/static/images/chat-bg-day.png',
            summer: '/static/images/chat-bg-day.png',
            autumn: '/static/images/chat-bg-day.png',
            winter: '/static/images/chat-bg-day.png',
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

    const DAY_START_HOUR = 6;
    const DAY_END_HOUR = 20;

    function getSeason(date) {
        const month = date.getMonth() + 1;
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

    function clearChatWallpaper() {
        const body = document.body;
        body.style.backgroundImage = '';
        body.style.backgroundRepeat = '';
        body.style.backgroundPosition = '';
        body.style.backgroundSize = '';
        body.style.backgroundAttachment = '';
        delete body.dataset.chatWallpaper;
        delete body.dataset.chatWallpaperMode;
        delete body.dataset.chatWallpaperSeason;
    }

    function setWallpaper(url) {
        const body = document.body;
        const img = new Image();
        img.onload = function () {
            if (!MOBILE_MQ.matches) return;
            body.style.backgroundImage = 'url("' + url + '")';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundPosition = 'center center';
            body.style.backgroundSize = 'cover';
            body.style.backgroundAttachment = 'fixed';
            body.style.transition = 'background-image 0.8s ease';
            body.dataset.chatWallpaper = url;
            body.dataset.chatWallpaperMode = isDaytime(new Date()) ? 'day' : 'night';
            body.dataset.chatWallpaperSeason = getSeason(new Date());
        };
        img.onerror = function () {
            const mode = isDaytime(new Date()) ? 'day' : 'night';
            const fallback = WALLPAPERS[mode]._fallback;
            if (url !== fallback) setWallpaper(fallback);
        };
        img.src = url;
    }

    function applyChatWallpaper() {
        if (!MOBILE_MQ.matches) {
            clearChatWallpaper();
            return;
        }
        setWallpaper(pickUrl(new Date()));
    }

    applyChatWallpaper();
    setInterval(applyChatWallpaper, 5 * 60 * 1000);

    if (typeof MOBILE_MQ.addEventListener === 'function') {
        MOBILE_MQ.addEventListener('change', applyChatWallpaper);
    } else if (typeof MOBILE_MQ.addListener === 'function') {
        MOBILE_MQ.addListener(applyChatWallpaper);
    }

    window.__agroRefreshChatWallpaper = applyChatWallpaper;
})();
