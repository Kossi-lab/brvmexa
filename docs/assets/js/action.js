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

/* Dividendes de la fiche : floutés pour tous ; les vrais montants ne s'affichent que pour un membre Premium connecté. */
(function () {
  'use strict';
  var sec = document.querySelector('[data-div-lock]');
  var page = document.querySelector('[data-st]');
  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  if (!sec || !page) return;
  var sym = page.getAttribute('data-st');
  var btn = sec.querySelector('[data-div-unlock]');
  if (btn) btn.addEventListener('click', function (e) {
    if (window.BxMember && window.BxMember.paywall) { e.preventDefault(); window.BxMember.paywall('dividendes'); }
  });
  if (!window.BxMember || !base) return;
  var nf = function (v, d) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/[  ]/g, ' '); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var day = function (iso, o) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', o || { day: 'numeric', month: 'long', year: 'numeric' }); };
  var amt = function (a) { return nf(a, a % 1 ? 2 : 0) + ' F'; };
  var stat = function (l, v, h) { return '<div class="st-stat"><small>' + esc(l) + '</small><b>' + v + '</b>' + (h ? '<span>' + h + '</span>' : '') + '</div>'; };
  window.BxMember.ready().then(function (st) {
    if (!st || !st.premium) return null;
    var t = Math.floor(Date.now() / 600000);
    return Promise.all([
      fetch(base + '/dividends.json?t=' + t).then(function (r) { return r.json(); }),
      fetch(base + '/quotes.json?t=' + t).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]);
  }).then(function (res) {
    if (!res) return;
    var d = res[0] && res[0].items && res[0].items[sym];
    if (!d || !d.history || !d.history.length) return;
    var q = res[1] && (res[1].items || []).filter(function (x) { return x.symbol === sym; })[0];
    var close = q && q.close;
    var last = d.last || d.history[d.history.length - 1];
    var y = d.annual && close ? nf(d.annual / close * 100, 2) + ' %' : '—';
    var next = last && last.d ? day(String(Number(last.d.slice(0, 4)) + 1) + last.d.slice(4), { month: 'long', year: 'numeric' }) : '—';
    var rows = d.history.slice(-8).reverse().map(function (h) {
      return '<tr><td>' + esc(day(h.d)) + '</td><td class="r">' + amt(h.a) + '</td><td class="r">' + (h.ex == null ? '—' : esc(h.ex)) + '</td></tr>';
    }).join('');
    var data = sec.querySelector('[data-div-data]');
    data.innerHTML = '<div class="st-stats st-stats--3">' +
      stat('Dernier dividende brut', amt(last.a), 'payé le ' + esc(day(last.d)) + (last.ex ? ' · exercice ' + esc(last.ex) : '')) +
      stat('Rendement brut', y, 'dividende annuel brut ÷ cours actuel') +
      stat('Prochain versement', esc(next), 'estimation, selon le calendrier habituel') + '</div>' +
      '<div class="st-table-wrap"><table class="st-table"><caption>Historique des dividendes bruts par action (FCFA)</caption><thead><tr><th scope="col">Date de paiement</th><th scope="col">Montant brut</th><th scope="col">Exercice</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    data.removeAttribute('aria-hidden');
    sec.classList.add('is-open');
    var cta = sec.querySelector('[data-div-cta]'); if (cta) cta.remove();
  }).catch(function () { /* on garde la version floutée */ });
})();
