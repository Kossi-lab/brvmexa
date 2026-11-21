/* BRVMexa — page d'article : les 3 articles les plus récents dans la colonne de droite (news.json, déjà en cache). */
(function () {
  'use strict';
  var box = document.querySelector('[data-as-recent]');
  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  if (!box || !base) return;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clean = function (id) { return String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); };
  var ago = function (iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return 'il y a ' + Math.max(1, Math.floor(s / 60)) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'hier';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };
  var here = (/\/actualites\/a\/([a-z0-9-]+)\//.exec(location.pathname) || [])[1];
  fetch(base + '/news.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      var items = (data.items || []).filter(function (n) { return n.rewritten && !n.pinned && clean(n.id) !== here; }).slice(0, 3);
      if (!items.length) throw new Error();
      box.innerHTML = items.map(function (n, i) {
        var tag = (n.symbols || [])[0];
        return '<li><a href="/actualites/a/' + clean(n.id) + '/"><span class="as-n">' + (i + 1) + '</span>' +
          '<span class="as-t"><b>' + esc(n.title) + '</b><small>' + (tag ? '<i>' + esc(tag) + '</i>' : '') + esc(ago(n.publishedAt)) + '</small></span></a></li>';
      }).join('');
    })
    .catch(function () { var s = box.closest('.as-recent'); if (s) s.hidden = true; });
})();
