/**
 * Chat wallpaper — ден/нощ
 * Mobile: body (full screen)
 * Desktop: само .chat-conversation (прозорецът)
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

    const DAY_START = 6;
    const DAY_END = 20;

    function getSeason(d) {
        const m = d.getMonth() + 1;
        if (m >= 3 && m <= 5) return 'spring';
        if (m >= 6 && m <= 8) return 'summer';
        if (m >= 9 && m <= 11) return 'autumn';
        return 'winter';
    }

    function isDay(d) {
        const h = d.getHours();
        return h >= DAY_START && h < DAY_END;
    }

    function pickUrl(d) {
        const mode = isDay(d) ? 'day' : 'night';
        const pack = WALLPAPERS[mode];
        return pack[getSeason(d)] || pack._fallback;
    }

    function clearBodyChatBg() {
        const b = document.body;
        b.style.backgroundImage = '';
        b.style.backgroundRepeat = '';
        b.style.backgroundPosition = '';
        b.style.backgroundSize = '';
        b.style.backgroundAttachment = '';
        delete b.dataset.chatWallpaper;
        delete b.dataset.chatWallpaperMode;
    }

    function applyTo(el, url, mode) {
        if (!el) return;
        el.style.backgroundImage = 'url("' + url + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.dataset.chatWallpaperMode = mode;
    }

    function setWallpaper(url) {
        const img = new Image();
        img.onload = function () {
            const mode = isDay(new Date()) ? 'day' : 'night';
            const panel = document.querySelector('.chat-conversation');

            if (MOBILE_MQ.matches) {
                // mobile: body full screen
                applyTo(document.body, url, mode);
                document.body.style.backgroundAttachment = 'scroll';
                if (panel) {
                    panel.style.backgroundImage = '';
                }
            } else {
                // desktop: само прозореца; body = random от DynamicBackground
                clearBodyChatBg();
                applyTo(panel, url, mode);
            }
        };
        img.onerror = function () {
            const mode = isDay(new Date()) ? 'day' : 'night';
            const fb = WALLPAPERS[mode]._fallback;
            if (url !== fb) setWallpaper(fb);
        };
        img.src = url;
    }

    function apply() {
        setWallpaper(pickUrl(new Date()));
    }

    apply();
    setInterval(apply, 5 * 60 * 1000);

    if (MOBILE_MQ.addEventListener) {
        MOBILE_MQ.addEventListener('change', apply);
    } else if (MOBILE_MQ.addListener) {
        MOBILE_MQ.addListener(apply);
    }

    window.__agroRefreshChatWallpaper = apply;
})();
