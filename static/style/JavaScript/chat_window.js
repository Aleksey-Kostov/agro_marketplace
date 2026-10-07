/**
 * Desktop chat window
 * - старт: docked (скролва с страницата)
 * - след drag: floating (fixed) + resize + localStorage
 * Mobile: no-op
 */
(function () {
    'use strict';

    if (!document.body.classList.contains('chat-app-page')) return;

    const MQ = window.matchMedia('(min-width: 769px)');
    const STORAGE_KEY = 'agroChatWindowState';
    const MIN_W = 320;
    const MIN_H = 360;

    let shell = null;
    let header = null;
    let mode = null; // drag | resize
    let edge = null;
    let windowMode = 'docked'; // docked | floating
    let startX = 0, startY = 0, startL = 0, startT = 0, startW = 0, startH = 0;

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveState() {
        if (!shell || !MQ.matches) return;
        try {
            const data = { mode: windowMode };
            if (windowMode === 'floating') {
                const r = shell.getBoundingClientRect();
                data.left = Math.round(r.left);
                data.top = Math.round(r.top);
                data.width = Math.round(r.width);
                data.height = Math.round(r.height);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function setDocked() {
        windowMode = 'docked';
        shell.classList.add('is-docked');
        shell.classList.remove('is-floating');
        shell.style.left = '';
        shell.style.top = '';
        shell.style.width = '';
        shell.style.height = '';
        shell.style.transform = '';
        saveState();
    }

    function setFloating(bounds) {
        windowMode = 'floating';
        shell.classList.remove('is-docked');
        shell.classList.add('is-floating');

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = clamp((bounds && bounds.width) || shell.offsetWidth || 720, MIN_W, vw);
        const h = clamp((bounds && bounds.height) || shell.offsetHeight || 780, MIN_H, vh);
        let left = bounds && typeof bounds.left === 'number' ? bounds.left : (vw - w) / 2;
        let top = bounds && typeof bounds.top === 'number' ? bounds.top : 80;
        left = clamp(left, 0, Math.max(0, vw - w));
        top = clamp(top, 0, Math.max(0, vh - h));

        shell.style.transform = 'none';
        shell.style.left = left + 'px';
        shell.style.top = top + 'px';
        shell.style.width = w + 'px';
        shell.style.height = h + 'px';
        saveState();
    }

    function ensureHandles() {
        if (!shell || shell.querySelector('.chat-window-handle')) return;
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (ed) {
            const el = document.createElement('div');
            el.className = 'chat-window-handle';
            el.dataset.edge = ed;
            el.addEventListener('mousedown', onResizeStart);
            shell.appendChild(el);
        });
    }

    function removeHandles() {
        if (!shell) return;
        shell.querySelectorAll('.chat-window-handle').forEach(function (h) {
            h.remove();
        });
    }

    function onDragStart(e) {
        if (!MQ.matches || !shell) return;
        if (e.button != null && e.button !== 0) return;
        if (e.target.closest('a, button, input, textarea, select, label')) return;

        e.preventDefault();

        // Първо местене → превключване към floating
        if (windowMode === 'docked') {
            const r = shell.getBoundingClientRect();
            setFloating({
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height
            });
        }

        mode = 'drag';
        shell.classList.add('is-dragging');

        const r = shell.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startL = r.left;
        startT = r.top;
        startW = r.width;
        startH = r.height;

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
    }

    function onResizeStart(e) {
        if (!MQ.matches || !shell) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        if (windowMode === 'docked') {
            const r = shell.getBoundingClientRect();
            setFloating({
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height
            });
        }

        mode = 'resize';
        edge = e.currentTarget.dataset.edge;
        shell.classList.add('is-resizing');

        const r = shell.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startL = r.left;
        startT = r.top;
        startW = r.width;
        startH = r.height;

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
    }

    function onMove(e) {
        if (!mode || !shell || windowMode !== 'floating') return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (mode === 'drag') {
            shell.style.left = clamp(startL + dx, 0, Math.max(0, vw - startW)) + 'px';
            shell.style.top = clamp(startT + dy, 0, Math.max(0, vh - startH)) + 'px';
            return;
        }

        let left = startL, top = startT, w = startW, h = startH;

        if (edge.indexOf('e') !== -1) w = clamp(startW + dx, MIN_W, vw - startL);
        if (edge.indexOf('s') !== -1) h = clamp(startH + dy, MIN_H, vh - startT);
        if (edge.indexOf('w') !== -1) {
            const newW = clamp(startW - dx, MIN_W, startL + startW);
            left = startL + (startW - newW);
            w = newW;
        }
        if (edge.indexOf('n') !== -1) {
            const newH = clamp(startH - dy, MIN_H, startT + startH);
            top = startT + (startH - newH);
            h = newH;
        }

        left = clamp(left, 0, vw - MIN_W);
        top = clamp(top, 0, vh - MIN_H);
        w = clamp(w, MIN_W, vw - left);
        h = clamp(h, MIN_H, vh - top);

        shell.style.left = left + 'px';
        shell.style.top = top + 'px';
        shell.style.width = w + 'px';
        shell.style.height = h + 'px';
    }

    function onEnd() {
        if (!shell) return;
        shell.classList.remove('is-dragging', 'is-resizing');
        mode = null;
        edge = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        saveState();
    }

    function enableDesktop() {
        shell = document.querySelector('.chat-shell');
        header = document.querySelector('.chat-header');
        if (!shell || !header) return;

        shell.classList.add('chat-window');
        ensureHandles();
        header.addEventListener('mousedown', onDragStart);

        const saved = readState();
        if (saved && saved.mode === 'floating') {
            setFloating(saved);
        } else {
            setDocked();
        }
    }

    function disableDesktop() {
        if (header) header.removeEventListener('mousedown', onDragStart);
        removeHandles();
        if (shell) {
            shell.classList.remove(
                'chat-window', 'is-docked', 'is-floating',
                'is-dragging', 'is-resizing'
            );
            shell.style.left = '';
            shell.style.top = '';
            shell.style.width = '';
            shell.style.height = '';
            shell.style.transform = '';
        }
    }

    function sync() {
        if (MQ.matches) enableDesktop();
        else disableDesktop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }

    if (MQ.addEventListener) MQ.addEventListener('change', sync);
    else if (MQ.addListener) MQ.addListener(sync);

    // Двоен клик на header → връщане в docked (по желание)
    document.addEventListener('dblclick', function (e) {
        if (!MQ.matches || !shell || !header) return;
        if (!e.target.closest('.chat-header')) return;
        if (e.target.closest('a, button')) return;
        setDocked();
    });
})();
