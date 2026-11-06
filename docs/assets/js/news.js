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
  // Date et heure de publication, à l'heure d'Abidjan (GMT)
  var when = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    try {
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' }) +
        '\u00a0à\u00a0' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' }).replace(':', '\u00a0h\u00a0');
    } catch (e) { return d.toLocaleString('fr-FR'); }
  };
  var mark = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#16C47F"/><rect x="7" y="17" width="4" height="8" rx="1.5" fill="#0A0F1A"/><rect x="14" y="12" width="4" height="13" rx="1.5" fill="#0A0F1A"/><rect x="21" y="7" width="4" height="18" rx="1.5" fill="#0A0F1A"/><path d="M6 14 13 9l5 2 8-6" stroke="#0A0F1A" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fetch(base + '/news.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      var items = data.items || [];
      var byId = {};
      items.forEach(function (n) { byId[n.id] = n; });

      // Lecteur d'article de la rédaction
      var reader = null, lastFocus = null;
      var closeReader = function (keepHash) {
        if (!reader) return;
        reader.remove(); reader = null; document.body.classList.remove('nx-open');
        if (!keepHash && history.replaceState && /^#/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      };
      var openReader = function (n) {
        closeReader(true);
        lastFocus = document.activeElement;
        var tags = (n.symbols || []).map(function (s) { return '<span class="tag">' + esc(s) + '</span>'; }).join('');
        reader = document.createElement('div');
        reader.className = 'nx-reader';
        reader.innerHTML = '<div class="nx-dialog" role="dialog" aria-modal="true" aria-labelledby="nx-title" tabindex="-1">' +
          '<button type="button" class="nx-close" aria-label="Fermer l’article">×</button>' +
          '<p class="nx-cat">' + esc(n.category || 'Actualités') + '</p>' +
          '<h2 id="nx-title">' + esc(n.title) + '</h2>' +
          '<p class="nx-meta"><span class="nx-author">' + mark + esc(n.author) + '</span><span>Publié le ' + esc(when(n.publishedAt)) + '</span></p>' +
          (n.summary ? '<p class="nx-lead">' + esc(n.summary) + '</p>' : '') +
          (n.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
          (tags ? '<div class="tags">' + tags + '</div>' : '') +
          '</div>';
        document.body.appendChild(reader);
        document.body.classList.add('nx-open');
        reader.addEventListener('click', function (e) { if (e.target === reader || e.target.closest('.nx-close')) closeReader(); });
        reader.querySelector('.nx-dialog').focus();
        if (history.replaceState) history.replaceState(null, '', '#' + n.id);
      };
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeReader(); });
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-nx]');
        if (!a || !byId[a.getAttribute('data-nx')]) return;
        e.preventDefault(); openReader(byId[a.getAttribute('data-nx')]);
      });
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
            if (n.rewritten) {
              var href = '#' + esc(n.id), nx = ' data-nx="' + esc(n.id) + '"';
              return '<article class="post-card"><a class="thumb thumb--empty" href="' + href + '"' + nx + ' tabindex="-1" aria-hidden="true">' + mark + '</a>' +
                '<div class="body"><div class="meta">' + esc(n.author) + ' · ' + esc(when(n.publishedAt)) + '</div>' +
                '<h3><a href="' + href + '"' + nx + '>' + esc(n.title) + '</a></h3>' +
                (n.summary ? '<p>' + esc(n.summary) + '</p>' : '') +
                (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div></article>';
            }
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
      var fromHash = function () {
        var h = decodeURIComponent((location.hash || '').slice(1));
        if (h && byId[h] && byId[h].rewritten) { if (!reader) openReader(byId[h]); } else if (reader) closeReader(true);
      };
      window.addEventListener('hashchange', fromHash);
      fromHash();
    })
    .catch(function () {
      boxes.forEach(function (box) {
        var list = box.querySelector('[data-bx-news-list]') || box;
        list.innerHTML = '<p class="empty-state">Les actualités sont momentanément indisponibles.</p>';
      });
    });
})();
