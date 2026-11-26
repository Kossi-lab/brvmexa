/* BRVMexa — cours de la BRVM en direct, à partir des fichiers publiés par le robot (GitHub). */
(function () {
  'use strict';

  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  if (!base) return;

  var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var tidy = function (s) { return s.replace(/[  ]/g, ' '); };
  var price = function (v) { return v == null ? '—' : tidy(nf0.format(v)); };
  var idx = function (v) { return v == null ? '—' : tidy(nf2.format(v)); };
  var pct = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + tidy(nf2.format(v)) + ' %'; };
  var tone = function (v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var sessionLabel = function (iso) {
    if (!iso) return '';
    var p = iso.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return DAYS[d.getUTCDay()] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
  };

  // Adresse de la fiche d'une action (même règle que le robot : scraper/src/stocks.mjs)
  var stockUrl = function (q) { var s = String(q.shortName || q.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'`]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); return '/actions/' + s + '-' + String(q.symbol).toLowerCase() + '/'; };

  var get = function (name) {
    var stamp = Math.floor(Date.now() / 30000); // « no-cache » : le navigateur revalide (réponse 304 si rien n'a changé)
    return fetch(base + '/' + name + '?t=' + stamp, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  };
  var shown = null;
  var load = function () {
    return Promise.all([get('quotes.json'), get('indices.json'), get('market.json')]).then(function (res) {
      if (res[0].updatedAt && res[0].updatedAt === shown) return; // rien de nouveau
      shown = res[0].updatedAt;
      render(res[0], res[1], res[2]);
    });
  };

  // Pendant la séance (jours ouvrés, 8 h 50 – 15 h 40 GMT) : nouveaux cours affichés sans recharger la page
  var inSession = function () {
    var d = new Date(), j = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
    return j >= 1 && j <= 5 && m >= 530 && m <= 940;
  };
  setInterval(function () { if (!document.hidden && inSession()) load().catch(function () {}); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && inSession()) load().catch(function () {}); });

  load()
    .catch(function () {
      document.querySelectorAll('[data-bx-ticker]').forEach(function (el) {
        el.innerHTML = '<div class="ticker-loading">Les cours sont momentanément indisponibles.</div>';
      });
      document.querySelectorAll('[data-bx-session]').forEach(function (el) { el.textContent = 'Cours indisponibles pour le moment'; });
      document.querySelectorAll('[data-bx-table]').forEach(function (el) { el.innerHTML = '<tr><td colspan="6">Les cours sont momentanément indisponibles. Réessayez plus tard.</td></tr>'; });
    });

  function render(quotes, indices, market) {
    var stocks = quotes.items || [];
    var ix = indices.items || [];
    var main = ix.filter(function (i) { return i.group === 'main'; });

    // Bandeau défilant (dupliqué pour une boucle continue)
    var tickerItems = main.map(function (i) {
      return '<span class="ticker-item"><b>' + esc(i.name) + '</b><span class="num">' + idx(i.close) + '</span><span class="num ' + tone(i.change) + '">' + pct(i.change) + '</span></span>';
    }).concat(stocks.map(function (q) {
      return '<span class="ticker-item"><b>' + esc(q.symbol) + '</b><span class="num">' + price(q.close) + '</span><span class="num ' + tone(q.change) + '">' + pct(q.change) + '</span></span>';
    })).join('');
    document.querySelectorAll('[data-bx-ticker]').forEach(function (el) {
      el.innerHTML = '<div class="ticker-track">' + tickerItems + tickerItems + '</div>';
    });

    // Carte flottante de l'accueil
    var composite = ix.filter(function (i) { return i.id === 'brvm-composite'; })[0];
    document.querySelectorAll('[data-bx-float="composite"] strong').forEach(function (el) {
      if (!composite) return;
      el.innerHTML = idx(composite.close) + ' <span class="' + tone(composite.change) + '">' + pct(composite.change) + '</span>';
    });

    var row = function (m) {
      return '<div class="row"><div><span class="sym">' + esc(m.symbol) + '</span><span class="name">' + esc(m.shortName) + '</span></div>' +
        '<div class="right"><span class="num">' + price(m.close) + ' F</span><span class="badge num ' + tone(m.change) + '">' + pct(m.change) + '</span></div></div>';
    };

    document.querySelectorAll('[data-bx-market]').forEach(function (box) {
      var session = box.querySelector('[data-bx-session]');
      if (session) session.textContent = 'Séance du ' + sessionLabel(quotes.sessionDate);

      var ixBox = box.querySelector('[data-bx-indices]');
      if (ixBox) {
        ixBox.innerHTML = main.slice(0, 4).map(function (i) {
          var diff = i.prevClose != null ? i.close - i.prevClose : null;
          return '<div class="index-card"><small>' + esc(i.name) + '</small><div class="val num">' + idx(i.close) + '</div>' +
            '<span class="num ' + tone(i.change) + '" style="font-weight:700;font-size:.9rem">' + (diff == null ? '' : (diff > 0 ? '+' : '') + idx(diff) + ' · ') + pct(i.change) + '</span></div>';
        }).join('');
      }
      var g = box.querySelector('[data-bx-gainers]');
      var l = box.querySelector('[data-bx-losers]');
      if (g) g.innerHTML = (market.gainers || []).slice(0, 5).map(row).join('') || '<p class="muted">Aucune hausse lors de cette séance.</p>';
      if (l) l.innerHTML = (market.losers || []).slice(0, 5).map(row).join('') || '<p class="muted">Aucune baisse lors de cette séance.</p>';

      var upd = box.querySelector('[data-bx-updated]');
      if (upd && quotes.updatedAt) {
        var d = new Date(quotes.updatedAt);
        upd.textContent = 'Mis à jour le ' + d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }

      if (box.getAttribute('data-full') === '1') table(box, stocks);
    });
  }

  function table(box, stocks) {
    // Rafraîchissement en direct : on garde la recherche, les filtres et le tri, seules les lignes changent
    if (box._bx) { box._bx.stocks = stocks; box._bx.draw(); return; }
    var st = box._bx = { stocks: stocks };
    var body = box.querySelector('[data-bx-table]');
    var search = box.querySelector('[data-bx-search]');
    var sector = box.querySelector('[data-bx-sector]');
    var country = box.querySelector('[data-bx-country]');
    var sortKey = 'symbol';
    var desc = false;

    var uniq = function (key) {
      var seen = {};
      return st.stocks.map(function (s) { return s[key]; }).filter(function (v) { if (!v || seen[v]) return false; seen[v] = 1; return true; }).sort();
    };
    uniq('sector').forEach(function (s) { sector.insertAdjacentHTML('beforeend', '<option>' + esc(s) + '</option>'); });
    uniq('countryName').forEach(function (s) { country.insertAdjacentHTML('beforeend', '<option>' + esc(s) + '</option>'); });

    var draw = function () {
      var q = (search.value || '').trim().toLowerCase();
      var list = st.stocks.filter(function (s) {
        return (!sector.value || s.sector === sector.value) &&
          (!country.value || s.countryName === country.value) &&
          (!q || (s.symbol + ' ' + s.name + ' ' + s.shortName).toLowerCase().indexOf(q) >= 0);
      }).sort(function (a, b) {
        var va = a[sortKey], vb = b[sortKey];
        var r = typeof va === 'string' ? va.localeCompare(vb, 'fr') : (va || 0) - (vb || 0);
        return desc ? -r : r;
      });
      body.innerHTML = list.length ? list.map(function (s) {
        return '<tr><td><b>' + esc(s.symbol) + '</b></td><td><a class="mk-link" href="' + esc(stockUrl(s)) + '">' + esc(s.shortName) + '</a></td><td>' + esc(s.countryName) + '</td>' +
          '<td class="r num"><b>' + price(s.close) + '</b></td><td class="r"><span class="badge num ' + tone(s.change) + '">' + pct(s.change) + '</span></td>' +
          '<td class="r num">' + price(s.volume) + '</td></tr>';
      }).join('') : '<tr><td colspan="6">Aucune action ne correspond à votre recherche.</td></tr>';
    };

    box.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        desc = sortKey === k ? !desc : (k === 'change' || k === 'volume' || k === 'close');
        sortKey = k;
        box.querySelectorAll('th[data-sort]').forEach(function (h) { h.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
        draw();
      });
    });
    [search, sector, country].forEach(function (el) { el.addEventListener('input', draw); });
    st.draw = draw;
    draw();
  }
})();
