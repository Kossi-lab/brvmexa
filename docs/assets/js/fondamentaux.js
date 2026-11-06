/* BRVMexa — analyse fondamentale des actions de la BRVM.
   Les comptes annuels (fondamentaux.json) sont combinés au dernier cours publié par le robot (quotes.json)
   pour calculer en direct le PER, le rendement, le taux de distribution, etc. */
(function () {
  'use strict';

  var root = document.querySelector('[data-fx]');
  if (!root) return;
  var cfg = window.BRVMEXA || {};
  var base = (cfg.dataUrl || '').replace(/\/$/, '');
  var fundUrl = root.getAttribute('data-fx-src');

  // ───────── Mise en forme ─────────
  var tidy = function (s) { return s.replace(/[  ]/g, ' '); };
  var nf = function (d) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var n0 = nf(0), n1 = nf(1), n2 = nf(2);
  var fmt = function (v, f) { return v == null || !isFinite(v) ? '—' : tidy(f.format(v)); };
  var money = function (v) { return fmt(v, n0); };
  var pctv = function (v, sign) { return v == null || !isFinite(v) ? '—' : (sign && v > 0 ? '+' : '') + tidy(n1.format(v * 100)) + ' %'; };
  var mult = function (v) { return v == null || !isFinite(v) ? '—' : tidy(n1.format(v)) + 'x'; };
  var bn = function (v) { // montant en FCFA → texte court
    if (v == null || !isFinite(v)) return '—';
    if (Math.abs(v) >= 1e11) return tidy(n0.format(v / 1e9)) + ' Mds';
    if (Math.abs(v) >= 1e9) return tidy(n1.format(v / 1e9)) + ' Mds';
    return tidy(n0.format(v / 1e6)) + ' M';
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var median = function (arr) {
    var a = arr.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  var getJson = function (url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  var isBank = function (s) { return /financ/i.test(s.sector || ''); };

  // ───────── Calcul des ratios ─────────
  function analyse(q, f) {
    var L = -1;
    for (var i = f.netIncome.length - 1; i >= 0; i--) if (f.netIncome[i] != null) { L = i; break; }
    var price = q.close;
    var rn = L >= 0 ? f.netIncome[L] : null;
    var rnPrev = L > 0 ? f.netIncome[L - 1] : null;
    var ca = L >= 0 ? f.revenue[L] : null;
    var caPrev = L > 0 ? f.revenue[L - 1] : null;
    var eps = L >= 0 ? f.eps[L] : null;
    if (eps == null && rn != null && f.shares) eps = rn * 1e6 / f.shares;
    var div = L >= 0 ? f.dividend[L] : null;
    var first = -1;
    for (var j = 0; j < L; j++) if (f.netIncome[j] != null) { first = j; break; }
    var span = L - first;
    var cagr = first >= 0 && span >= 2 && f.netIncome[first] > 0 && rn > 0 ? Math.pow(rn / f.netIncome[first], 1 / span) - 1 : null;
    return {
      sym: q.symbol, name: q.shortName || q.name, fullName: q.name, sector: q.sector, country: q.countryName,
      price: price, change: q.change, year: L >= 0 ? f.years[L] : null, f: f,
      cap: price && f.shares ? price * f.shares : null,
      eps: eps,
      per: eps > 0 && price ? price / eps : null,
      loss: rn != null && rn < 0,
      yield: div > 0 && price ? div / price : null,
      div: div,
      payout: div > 0 && eps > 0 ? div / eps : null,
      margin: rn != null && ca > 0 ? rn / ca : null,
      grRev: ca > 0 && caPrev > 0 ? ca / caPrev - 1 : null,
      grNet: rn > 0 && rnPrev > 0 ? rn / rnPrev - 1 : null,
      cagr: cagr, cagrSpan: span,
      divYears: f.dividend.filter(function (x) { return x > 0; }).length,
      years: f.years.length
    };
  }

  // ───────── Lecture rapide (repères pédagogiques, pas une recommandation) ─────────
  function signals(s, med) {
    var out = [];
    if (s.loss) out.push(['down', 'Exercice en perte']);
    else if (s.per != null) {
      if (s.per < 10) out.push(['up', 'Valorisation basse (PER < 10)']);
      else if (s.per <= 18) out.push(['flat', 'Valorisation modérée']);
      else out.push(['warn', 'Valorisation élevée (PER > 18)']);
      if (med.per[s.sector] && s.per < med.per[s.sector] * 0.85) out.push(['up', 'PER sous la médiane du secteur']);
    }
    if (s.yield != null) {
      if (s.yield >= 0.06) out.push(['up', 'Rendement élevé (≥ 6 %)']);
      else if (s.yield < 0.03) out.push(['flat', 'Rendement faible']);
    } else out.push(['flat', 'Pas de dividende sur le dernier exercice']);
    if (s.payout != null && s.payout > 1) out.push(['warn', 'Distribue plus que son bénéfice']);
    if (s.grNet != null) out.push(s.grNet >= 0 ? ['up', 'Bénéfice en hausse sur un an'] : ['down', 'Bénéfice en baisse sur un an']);
    if (s.divYears >= 5) out.push(['up', 'Dividende versé 5 années sur 5']);
    return out;
  }

  // ───────── Mini-graphique en barres (SVG) ─────────
  function bars(years, values, title, unit) {
    var w = 460, h = 150, pad = 22, n = years.length, bw = (w - 20) / n;
    var max = Math.max.apply(null, values.map(function (v) { return Math.abs(v || 0); })) || 1;
    var hasNeg = values.some(function (v) { return v < 0; });
    var zero = hasNeg ? (h - pad) / 2 + 6 : h - pad;
    var scale = (hasNeg ? (h - pad) / 2 - 8 : h - pad - 16) / max;
    var g = '';
    years.forEach(function (y, i) {
      var v = values[i], x = 10 + i * bw + bw * 0.18, bwi = bw * 0.64;
      if (v != null) {
        var bh = Math.max(2, Math.abs(v) * scale);
        var yy = v >= 0 ? zero - bh : zero;
        g += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bwi.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" class="' + (v >= 0 ? 'b-up' : 'b-down') + '"><title>' + esc(y + ' : ' + money(v) + ' ' + unit) + '</title></rect>';
      } else {
        g += '<text x="' + (x + bwi / 2).toFixed(1) + '" y="' + (zero - 4) + '" text-anchor="middle" class="b-na">—</text>';
      }
      g += '<text x="' + (x + bwi / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle" class="b-lbl">' + y + '</text>';
    });
    return '<figure class="fx-chart"><figcaption>' + esc(title) + '</figcaption><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(title) + '">' +
      '<line x1="6" x2="' + (w - 6) + '" y1="' + zero + '" y2="' + zero + '" class="b-axis"/>' + g + '</svg></figure>';
  }

  function card(label, value, hint, tone) {
    return '<div class="fx-card"><small>' + esc(label) + '</small><strong class="num' + (tone ? ' ' + tone : '') + '">' + value + '</strong>' + (hint ? '<span>' + hint + '</span>' : '') + '</div>';
  }

  function detail(s, med) {
    var f = s.f, bank = isBank(s);
    var mPer = med.per[s.sector], mYield = med.yield[s.sector];
    var rel = function (v, m, lowIsGood) { // couleur seulement si l’écart avec le secteur est net (> 5 %)
      if (v == null || !m) return '';
      var r = v / m;
      if (r > 0.95 && r < 1.05) return '';
      return (r < 1) === lowIsGood ? 'up' : 'down';
    };
    var cards = [
      card('BPA ' + (s.year || ''), s.eps != null ? money(s.eps) + ' F' : '—', 'Bénéfice net ÷ nombre d’actions'),
      card('PER', s.loss ? 'n.s.' : mult(s.per), mPer ? 'Médiane du secteur : ' + mult(mPer) : 'Cours ÷ BPA', rel(s.per, mPer, true)),
      card('Rendement net', pctv(s.yield), mYield ? 'Médiane du secteur : ' + pctv(mYield) : 'Dividende ÷ cours', rel(s.yield, mYield, false)),
      card('Taux de distribution', pctv(s.payout), 'Dividende ÷ BPA', s.payout > 1 ? 'down' : ''),
      card('Marge nette', pctv(s.margin), 'Bénéfice ÷ ' + (bank ? 'PNB' : 'chiffre d’affaires'), s.margin < 0 ? 'down' : ''),
      card('Croissance du bénéfice', pctv(s.grNet, true), 'Sur un an', s.grNet != null ? (s.grNet >= 0 ? 'up' : 'down') : ''),
      card('Croissance ' + (bank ? 'du PNB' : 'du CA'), pctv(s.grRev, true), 'Sur un an', s.grRev != null ? (s.grRev >= 0 ? 'up' : 'down') : ''),
      card('Croissance annuelle moyenne', pctv(s.cagr, true), s.cagrSpan > 0 ? 'Bénéfice, sur ' + s.cagrSpan + ' ans' : '', s.cagr != null ? (s.cagr >= 0 ? 'up' : 'down') : ''),
      card('Capitalisation', bn(s.cap) + ' FCFA', 'Cours × ' + money(f.shares) + ' actions'),
      card('Flottant', f.float != null ? tidy(n1.format(f.float)) + ' %' : '—', 'Part des actions échangées en bourse')
    ].join('');
    var chips = signals(s, med).map(function (c) { return '<span class="fx-chip ' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('');
    var row = function (label, arr, fn) {
      return '<tr><th>' + label + '</th>' + arr.map(function (v) { return '<td class="r num' + (v < 0 ? ' down' : '') + '">' + fn(v) + '</td>'; }).join('') + '</tr>';
    };
    var margins = f.netIncome.map(function (v, i) { return v != null && f.revenue[i] > 0 ? v / f.revenue[i] : null; });
    var payouts = f.dividend.map(function (v, i) { return v > 0 && f.eps[i] > 0 ? v / f.eps[i] : null; });
    var hist = '<div class="table-wrap"><table class="stocks fx-hist"><thead><tr><th>En millions de FCFA</th>' +
      f.years.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row(bank ? 'Produit net bancaire' : 'Chiffre d’affaires', f.revenue, money) +
      row('Résultat net', f.netIncome, money) +
      row('Marge nette', margins, function (v) { return pctv(v); }) +
      row('BPA (FCFA)', f.eps, function (v) { return v == null ? '—' : tidy(n2.format(v)); }) +
      row('Dividende net (FCFA)', f.dividend, function (v) { return v == null ? '—' : tidy(n2.format(v)); }) +
      row('Taux de distribution', payouts, function (v) { return pctv(v); }) +
      '</tbody></table></div>';
    return '<div class="fx-detail">' +
      '<div class="fx-detail-head"><div><h3>' + esc(s.fullName) + ' <span class="fx-sym">' + esc(s.sym) + '</span></h3>' +
      '<p>' + esc(s.sector) + ' · ' + esc(s.country) + ' · Dernier exercice publié : ' + esc(s.year) + '</p></div>' +
      '<div class="fx-price"><small>Dernier cours</small><strong class="num">' + money(s.price) + ' F</strong></div></div>' +
      '<div class="fx-chartbox" data-chartbox><p class="fx-tip">Chargement du graphique…</p></div>' +
      '<div class="fx-chips" aria-label="Lecture rapide">' + chips + '</div>' +
      '<div class="fx-cards">' + cards + '</div>' +
      '<div class="fx-charts">' + bars(f.years, f.netIncome, 'Résultat net (millions de FCFA)', 'M FCFA') + bars(f.years, f.dividend, 'Dividende net par action (FCFA)', 'FCFA') + '</div>' +
      hist + '</div>';
  }

  // ───────── Tableau principal ─────────
  var COLS = [
    ['sym', 'Société', ''], ['price', 'Cours', 'r'], ['cap', 'Capitalisation', 'r'], ['eps', 'BPA', 'r'], ['per', 'PER', 'r'],
    ['yield', 'Rendement', 'r'], ['payout', 'Distribution', 'r'], ['margin', 'Marge nette', 'r'], ['grNet', 'Bénéfice 1 an', 'r']
  ];

  function start(quotes, fund) {
    var items = fund.items || {};
    var rows = (quotes.items || []).filter(function (q) { return items[q.symbol]; }).map(function (q) { return analyse(q, items[q.symbol]); });
    var med = { per: {}, yield: {} };
    var sectors = {};
    rows.forEach(function (s) { (sectors[s.sector] = sectors[s.sector] || []).push(s); });
    Object.keys(sectors).forEach(function (k) {
      med.per[k] = median(sectors[k].map(function (s) { return s.per; }).filter(function (v) { return v > 0 && v < 100; }));
      med.yield[k] = median(sectors[k].map(function (s) { return s.yield; }));
    });

    // Chiffres clés du marché
    var stat = function (sel, v) { var el = root.querySelector(sel); if (el) el.textContent = v; };
    stat('[data-fx-stat="per"]', mult(median(rows.map(function (s) { return s.per; }).filter(function (v) { return v > 0 && v < 100; }))));
    stat('[data-fx-stat="yield"]', pctv(median(rows.map(function (s) { return s.yield; }))));
    stat('[data-fx-stat="payers"]', rows.filter(function (s) { return s.yield != null; }).length + ' / ' + rows.length);
    stat('[data-fx-stat="growth"]', rows.filter(function (s) { return s.grNet != null && s.grNet >= 0; }).length + ' / ' + rows.length);
    var upd = root.querySelector('[data-fx-updated]');
    if (upd) upd.textContent = 'Cours de la séance du ' + (quotes.sessionDate || '').split('-').reverse().join('/') + ' · Comptes annuels mis à jour le ' + (fund.updatedAt || '').split('-').reverse().join('/');

    var body = root.querySelector('[data-fx-body]');
    var search = root.querySelector('[data-fx-search]');
    var sector = root.querySelector('[data-fx-sector]');
    var country = root.querySelector('[data-fx-country]');
    var quick = root.querySelector('[data-fx-quick]');
    var count = root.querySelector('[data-fx-count]');
    var head = root.querySelector('[data-fx-head]');
    var sortKey = 'cap', desc = true, open = null;

    var uniq = function (k) { var seen = {}; return rows.map(function (s) { return s[k]; }).filter(function (v) { if (!v || seen[v]) return false; seen[v] = 1; return true; }).sort(); };
    uniq('sector').forEach(function (s) { sector.insertAdjacentHTML('beforeend', '<option>' + esc(s) + '</option>'); });
    uniq('country').forEach(function (s) { country.insertAdjacentHTML('beforeend', '<option>' + esc(s) + '</option>'); });

    head.innerHTML = COLS.map(function (c) {
      return '<th class="' + c[2] + '" data-k="' + c[0] + '" tabindex="0" role="columnheader">' + esc(c[1]) + '</th>';
    }).join('');

    var QUICK = {
      div: function (s) { return s.yield != null; },
      cheap: function (s) { return s.per != null && s.per < 12; },
      yield6: function (s) { return s.yield >= 0.06; },
      growth: function (s) { return s.grNet != null && s.grNet >= 0; },
      safe: function (s) { return s.payout != null && s.payout <= 0.8 && s.divYears >= 4; }
    };

    var cell = function (s) {
      var tone = function (v) { return v == null ? '' : v >= 0 ? 'up' : 'down'; };
      return '<td><button type="button" class="fx-open" aria-expanded="' + (open === s.sym) + '"><b>' + esc(s.sym) + '</b><span>' + esc(s.name) + (s.year && s.year < 2025 ? ' · comptes ' + s.year : '') + '</span></button></td>' +
        '<td class="r num">' + money(s.price) + '</td>' +
        '<td class="r num">' + bn(s.cap) + '</td>' +
        '<td class="r num">' + (s.eps != null ? money(s.eps) : '—') + '</td>' +
        '<td class="r num">' + (s.loss ? '<span class="down">Perte</span>' : mult(s.per)) + '</td>' +
        '<td class="r"><span class="badge num ' + (s.yield >= 0.06 ? 'up' : 'flat') + '">' + pctv(s.yield) + '</span></td>' +
        '<td class="r num' + (s.payout > 1 ? ' down' : '') + '">' + pctv(s.payout) + '</td>' +
        '<td class="r num ' + (s.margin < 0 ? 'down' : '') + '">' + pctv(s.margin) + '</td>' +
        '<td class="r num ' + tone(s.grNet) + '">' + pctv(s.grNet, true) + '</td>';
    };

    var histCache = {}, chartCtl = null;
    var loadHistory = function (sym) {
      if (!histCache[sym]) histCache[sym] = getJson(base + '/history/' + encodeURIComponent(sym) + '.json?t=' + Math.floor(Date.now() / 600000));
      return histCache[sym];
    };
    var symbols = rows.map(function (s) { return { sym: s.sym, name: s.name }; }).sort(function (a, b) { return a.sym.localeCompare(b.sym); });
    var mountChart = function (s) {
      var box = body.querySelector('[data-chartbox]');
      if (!box) return;
      loadHistory(s.sym).then(function (h) {
        if (open !== s.sym || !box.isConnected) return;
        if (!window.BxChart) { box.innerHTML = ''; return; }
        chartCtl = window.BxChart.mount(box, {
          sym: s.sym, name: s.fullName || s.name, history: h, symbols: symbols, loadHistory: loadHistory,
          onAnalyse: function () {
            if (!window.BxDavid || !chartCtl) return;
            window.BxDavid.open({ fx: s, med: med, chartData: chartCtl.data, onLevels: chartCtl.setAnalystLevels, returnFocus: box.querySelector('.cx-ai') });
          }
        });
        if (chartCtl && autoDavid) { autoDavid = false; box.querySelector('.cx-ai').click(); }
      }).catch(function () { box.innerHTML = '<p class="fx-tip">Le graphique est momentanément indisponible.</p>'; });
    };
    var autoDavid = /david/i.test(location.search);

    var draw = function () {
      if (chartCtl) { chartCtl.destroy(); chartCtl = null; }
      var q = (search.value || '').trim().toLowerCase();
      var qf = QUICK[quick.value];
      var list = rows.filter(function (s) {
        return (!sector.value || s.sector === sector.value) && (!country.value || s.country === country.value) && (!qf || qf(s)) &&
          (!q || (s.sym + ' ' + s.name + ' ' + s.fullName).toLowerCase().indexOf(q) >= 0);
      }).sort(function (a, b) {
        var va = a[sortKey], vb = b[sortKey];
        if (typeof va === 'string' || typeof vb === 'string') { var r0 = String(va || '').localeCompare(String(vb || ''), 'fr'); return desc ? -r0 : r0; }
        if (va == null && vb == null) return 0;
        if (va == null) return 1; // valeurs manquantes toujours en bas
        if (vb == null) return -1;
        return desc ? vb - va : va - vb;
      });
      count.textContent = list.length + (list.length > 1 ? ' sociétés' : ' société');
      body.innerHTML = list.length ? list.map(function (s) {
        var tr = '<tr data-sym="' + esc(s.sym) + '"' + (open === s.sym ? ' class="is-open"' : '') + '>' + cell(s) + '</tr>';
        if (open === s.sym) tr += '<tr class="fx-row-detail"><td colspan="' + COLS.length + '">' + detail(s, med) + '</td></tr>';
        return tr;
      }).join('') : '<tr><td colspan="' + COLS.length + '">Aucune société ne correspond à ces critères.</td></tr>';
      var wrap = body.closest('.table-wrap');
      var det = body.querySelector('.fx-detail');
      if (det && wrap) det.style.width = wrap.clientWidth + 'px';
      if (open) { var cur = rows.filter(function (s) { return s.sym === open; })[0]; if (cur) mountChart(cur); }
      head.querySelectorAll('th').forEach(function (th) {
        if (th.getAttribute('data-k') === sortKey) th.setAttribute('aria-sort', desc ? 'descending' : 'ascending'); else th.removeAttribute('aria-sort');
      });
    };

    var sortBy = function (k) {
      desc = sortKey === k ? !desc : !(k === 'sym' || k === 'per');
      sortKey = k;
      draw();
    };
    head.addEventListener('click', function (e) { var th = e.target.closest('th'); if (th) sortBy(th.getAttribute('data-k')); });
    head.addEventListener('keydown', function (e) { var th = e.target.closest('th'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(th.getAttribute('data-k')); } });
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('.fx-open');
      if (!btn) return;
      var sym = btn.closest('tr').getAttribute('data-sym');
      open = open === sym ? null : sym;
      draw();
      if (open) {
        var r = body.querySelector('tr[data-sym="' + open + '"]');
        if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#' + open);
      }
    });
    [search, sector, country, quick].forEach(function (el) { el.addEventListener('input', function () { draw(); }); });
    window.addEventListener('resize', function () {
      var det = body.querySelector('.fx-detail'), wrap = body.closest('.table-wrap');
      if (det && wrap) det.style.width = wrap.clientWidth + 'px';
    });

    // Lien direct vers une société : /fondamentaux/#SNTS
    var hash = decodeURIComponent((location.hash || '').slice(1)).toUpperCase();
    if (hash && items[hash]) open = hash;
    draw();
    if (open) { var r0 = body.querySelector('tr[data-sym="' + open + '"]'); if (r0) setTimeout(function () { r0.scrollIntoView({ block: 'start' }); }, 50); }
  }

  Promise.all([getJson(base + '/quotes.json?t=' + Math.floor(Date.now() / 60000)), getJson(fundUrl)])
    .then(function (r) { start(r[0], r[1]); })
    .catch(function () {
      var body = root.querySelector('[data-fx-body]');
      if (body) body.innerHTML = '<tr><td colspan="9">Les données sont momentanément indisponibles. Réessayez dans un instant.</td></tr>';
    });
})();
