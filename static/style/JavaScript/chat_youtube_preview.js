(function () {
    'use strict';

    var YT_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^\s<]*)?/gi;

    function extractId(url) {
        var m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.exec(url);
        return m ? m[1] : null;
    }

    function buildCard(videoId, originalUrl) {
        var watchUrl = 'https://www.youtube.com/watch?v=' + videoId;
        var thumb = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';

        var card = document.createElement('a');
        card.className = 'yt-preview-card';
        card.href = watchUrl;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.dataset.ytId = videoId;

        card.innerHTML =
            '<span class="yt-preview-thumb-wrap">' +
                '<img class="yt-preview-thumb" src="' + thumb + '" alt="YouTube" loading="lazy">' +
                '<span class="yt-preview-play"><i class="fas fa-play"></i></span>' +
            '</span>' +
            '<span class="yt-preview-meta">' +
                '<span class="yt-preview-title">YouTube video</span>' +
                '<span class="yt-preview-host">youtube.com</span>' +
            '</span>';

        // опционално: заглавие през oEmbed (без API key)
        fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(watchUrl) + '&format=json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data || !data.title) return;
                var t = card.querySelector('.yt-preview-title');
                if (t) t.textContent = data.title;
                if (data.author_name) {
                    var h = card.querySelector('.yt-preview-host');
                    if (h) h.textContent = data.author_name;
                }
            })
            .catch(function () { /* thumbnail + линк са достатъчни */ });

        return card;
    }

    function processNode(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.classList.contains('yt-preview-card')) return;
        if (node.closest && node.closest('.yt-preview-card')) return;

        // вече обработено
        if (node.dataset.ytPreviewDone === '1') return;

        var html = node.innerHTML;
        if (!html || !/youtu(\.be|be\.com)/i.test(html)) {
            node.dataset.ytPreviewDone = '1';
            return;
        }

        // събираме уникални video id
        var ids = [];
        var seen = {};
        var match;
        YT_RE.lastIndex = 0;
        while ((match = YT_RE.exec(html)) !== null) {
            var id = match[1];
            if (id && !seen[id]) {
                seen[id] = true;
                ids.push({ id: id, url: match[0] });
            }
        }

        if (!ids.length) {
            node.dataset.ytPreviewDone = '1';
            return;
        }

        // правим URL в текста кликаеми (ако още не са <a>)
        node.innerHTML = html.replace(YT_RE, function (full, id) {
            var href = 'https://www.youtube.com/watch?v=' + id;
            // ако вече е вътре в <a>, не пипаме грубо — опростен вариант:
            return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="yt-inline-link">' + full + '</a>';
        });

        ids.forEach(function (item) {
            var card = buildCard(item.id, item.url);
            node.appendChild(card);
        });

        node.dataset.ytPreviewDone = '1';
    }

    function scan(root) {
        var scope = root || document;
        var nodes = scope.querySelectorAll('.message-body-html');
        for (var i = 0; i < nodes.length; i++) {
            processNode(nodes[i]);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        scan(document);

        // нови съобщения (live chat / AJAX)
        var scroll = document.querySelector('.conversation-scroll');
        if (scroll && window.MutationObserver) {
            var obs = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                    m.addedNodes.forEach(function (n) {
                        if (n.nodeType !== 1) return;
                        if (n.matches && n.matches('.message-body-html')) {
                            processNode(n);
                        } else if (n.querySelectorAll) {
                            scan(n);
                        }
                    });
                });
            });
            obs.observe(scroll, { childList: true, subtree: true });
        }
    });

    window.agroScanYoutubePreviews = scan;
})();
