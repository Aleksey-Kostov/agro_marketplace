/**
 * Desktop chat window — drag + resize + localStorage
 * Mobile: no-op
 */
(function () {
    'use strict';

    if (!document.body.classList.contains('chat-app-page')) return;

    const MQ = window.matchMedia('(min-width: 769px)');
    const STORAGE_KEY = 'agroChatWindowBounds';

    const MIN_W = 320;
    const MIN_H = 360;

    let shell = null;
    let header = null;
    let mode = null; // 'drag' | 'resize'
    let edge = null;
    let startX = 0;
    let startY = 0;
    let startL = 0;
    let startT = 0;
    let startW = 0;
    let startH = 0;

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function readSaved() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveBounds() {
        if (!shell || !MQ.matches) return;
        const r = shell.getBoundingClientRect();
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    left: Math.round(r.left),
                    top: Math.round(r.top),
                    width: Math.round(r.width),
                    height: Math.round(r.height)
                })
            );
        } catch (e) { /* ignore */ }
    }

    function applyBounds(b) {
        if (!shell || !b) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = clamp(b.width || 720, MIN_W, vw);
        const h = clamp(b.height || 780, MIN_H, vh);
        let left = typeof b.left === 'number' ? b.left : (vw - w) / 2;
        let top = typeof b.top === 'number' ? b.top : 80;
        left = clamp(left, 0, Math.max(0, vw - w));
        top = clamp(top, 0, Math.max(0, vh - h));

        shell.style.transform = 'none';
        shell.style.left = left + 'px';
        shell.style.top = top + 'px';
        shell.style.width = w + 'px';
        shell.style.height = h + 'px';
    }

    function defaultBounds() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(720, vw * 0.9);
        const h = Math.min(780, vh - 100);
        return {
            width: w,
            height: h,
            left: (vw - w) / 2,
            top: 80
        };
    }

    function ensureHandles() {
        if (!shell || shell.querySelector('.chat-window-handle')) return;
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (ed) {
            const h = document.createElement('div');
            h.className = 'chat-window-handle';
            h.dataset.edge = ed;
            h.addEventListener('mousedown', onResizeStart);
            shell.appendChild(h);
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

        const t = e.target;
        if (t.closest('a, button, input, textarea, select, label')) return;

        e.preventDefault();
        mode = 'drag';
        shell.classList.add('is-dragging');

        const r = shell.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startL = r.left;
        startT = r.top;
        startW = r.width;
        startH = r.height;

        shell.style.transform = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
    }

    function onResizeStart(e) {
        if (!MQ.matches || !shell) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

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

        shell.style.transform = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
    }

    function onMove(e) {
        if (!mode || !shell) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (mode === 'drag') {
            let left = startL + dx;
            let top = startT + dy;
            left = clamp(left, 0, Math.max(0, vw - startW));
            top = clamp(top, 0, Math.max(0, vh - startH));
            shell.style.left = left + 'px';
            shell.style.top = top + 'px';
            return;
        }

        if (mode === 'resize') {
            let left = startL;
            let top = startT;
            let w = startW;
            let h = startH;

            if (edge.indexOf('e') !== -1) {
                w = clamp(startW + dx, MIN_W, vw - startL);
            }
            if (edge.indexOf('s') !== -1) {
                h = clamp(startH + dy, MIN_H, vh - startT);
            }
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
    }

    function onEnd() {
        if (!shell) return;
        shell.classList.remove('is-dragging', 'is-resizing');
        mode = null;
        edge = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        saveBounds();
    }

    function enableDesktop() {
        shell = document.querySelector('.chat-shell');
        header = document.querySelector('.chat-header');
        if (!shell || !header) return;

        shell.classList.add('chat-window');
        applyBounds(readSaved() || defaultBounds());
        ensureHandles();

        header.addEventListener('mousedown', onDragStart);
    }

    function disableDesktop() {
        if (header) header.removeEventListener('mousedown', onDragStart);
        removeHandles();
        if (shell) {
            shell.classList.remove('chat-window', 'is-dragging', 'is-resizing');
            shell.style.left = '';
            shell.style.top = '';
            shell.style.width = '';
            shell.style.height = '';
            shell.style.transform = '';
        }
        mode = null;
    }

    function sync() {
        if (MQ.matches) enableDesktop();
        else disableDesktop();
    }

    function onResizeWindow() {
        if (!MQ.matches || !shell) return;
        const r = shell.getBoundingClientRect();
        applyBounds({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height
        });
        saveBounds();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }

    if (MQ.addEventListener) MQ.addEventListener('change', sync);
    else if (MQ.addListener) MQ.addListener(sync);

    window.addEventListener('resize', onResizeWindow);
})();
