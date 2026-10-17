/* BRVMexa — dernières actualités des marchés, publiées automatiquement par le robot (news.json). */
(function () {
  'use strict';
  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  var boxes = document.querySelectorAll('[data-bx-news]');
  if (!base || !boxes.length) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var safeUrl = function (u) { return /^https?:\/\//i.test(u || '') ? u : '#'; };
  var ago = function (iso) {
    if (!iso) return '';
    var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (s < 3600) return 'il y a ' + Math.max(1, Math.floor(s / 60)) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  var mark = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#16C47F"/><rect x="7" y="17" width="4" height="8" rx="1.5" fill="#0A0F1A"/><rect x="14" y="12" width="4" height="13" rx="1.5" fill="#0A0F1A"/><rect x="21" y="7" width="4" height="18" rx="1.5" fill="#0A0F1A"/><path d="M6 14 13 9l5 2 8-6" stroke="#0A0F1A" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fetch(base + '/news.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      var items = data.items || [];
      boxes.forEach(function (box) {
        var limit = parseInt(box.getAttribute('data-limit') || '24', 10);
        var filter = box.querySelector('[data-bx-news-filter]');
        var list = box.querySelector('[data-bx-news-list]') || box;
        var draw = function () {
          var cat = filter ? filter.value : '';
          var shown = items.filter(function (n) { return !cat || n.category === cat; }).slice(0, limit);
          list.innerHTML = shown.length ? shown.map(function (n) {
            var thumb = n.image
              ? '<img src="' + esc(safeUrl(n.image)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
              : mark;
            var tags = (n.symbols || []).slice(0, 3).map(function (s) { return '<span class="tag">' + esc(s) + '</span>'; }).join('');
            return '<article class="post-card"><a class="thumb' + (n.image ? '' : ' thumb--empty') + '" href="' + esc(safeUrl(n.url)) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + thumb + '</a>' +
              '<div class="body"><div class="meta">' + esc(n.source) + ' · ' + esc(ago(n.publishedAt)) + '</div>' +
              '<h3><a href="' + esc(safeUrl(n.url)) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a></h3>' +
              (n.summary ? '<p>' + esc(n.summary) + '</p>' : '') +
              (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div></article>';
          }).join('') : '<p class="empty-state">Aucune actualité pour le moment.</p>';
        };
        if (filter) {
          var cats = {};
          items.forEach(function (n) { if (n.category) cats[n.category] = 1; });
          Object.keys(cats).sort().forEach(function (c) { filter.insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>'); });
          filter.addEventListener('change', draw);
        }
        draw();
      });
    })
    .catch(function () {
      boxes.forEach(function (box) {
        var list = box.querySelector('[data-bx-news-list]') || box;
        list.innerHTML = '<p class="empty-state">Les actualités sont momentanément indisponibles.</p>';
      });
    });
})();
