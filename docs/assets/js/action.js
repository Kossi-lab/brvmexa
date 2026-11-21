/* BRVMexa — fiche d'une action : remplace le cours de la page (mis à jour par le robot toutes les 6 h)
   par le tout dernier cours publié (quotes.json), sans recharger la page. */
(function () {
  'use strict';
  var page = document.querySelector('[data-st]');
  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  if (!page || !base) return;
  var sym = page.getAttribute('data-st');
  var nf = function (v, d) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/[  ]/g, ' '); };
  fetch(base + '/quotes.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (q) {
      var it = (q.items || []).filter(function (x) { return x.symbol === sym; })[0];
      if (!it || !q.sessionDate || q.sessionDate < page.getAttribute('data-session')) return;
      var c = page.querySelector('[data-live="close"]'), ch = page.querySelector('[data-live="change"]'), w = page.querySelector('[data-live="when"]');
      if (c) c.innerHTML = nf(it.close, 0) + ' <small>FCFA</small>';
      if (ch) { ch.textContent = (it.change > 0 ? '+' : '') + nf(it.change, 2) + ' %'; ch.className = 'st-chg ' + (it.change > 0 ? 'up' : it.change < 0 ? 'down' : 'flat'); }
      if (w) {
        var d = new Date(q.sessionDate + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        w.textContent = d + (q.sessionTime ? ' (données publiées à ' + q.sessionTime.replace(':', ' h ') + ' GMT)' : '');
        w.setAttribute('datetime', q.sessionDate);
      }
    })
    .catch(function () { /* on garde le cours affiché par la page */ });
})();
