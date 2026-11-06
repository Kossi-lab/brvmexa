/* BRVMexa — graphique d'analyse technique d'une action (bibliothèque Lightweight Charts™ de TradingView, licence Apache 2.0).
   Périodes, aire / ligne / chandeliers, moyennes mobiles, Bollinger, volume, RSI, MACD, supports et résistances,
   comparaison, échelle logarithmique, tracés, plein écran et capture d'image. */
(function () {
  'use strict';
  var LW = window.LightweightCharts;

  var C = {
    bg: '#0D1422', grid: 'rgba(163,174,194,.07)', text: '#A3AEC2', border: '#1F2A3D',
    up: '#16C47F', down: '#F0526B', gold: '#F2B33D', blue: '#4C9BFF', violet: '#B07CFF', cyan: '#2EC5CE', white: '#F3F6FB'
  };

  // ───────── Calculs ─────────
  function sma(vals, n) {
    var out = [], s = 0;
    for (var i = 0; i < vals.length; i++) {
      s += vals[i];
      if (i >= n) s -= vals[i - n];
      out.push(i >= n - 1 ? s / n : null);
    }
    return out;
  }
  function ema(vals, n) {
    var k = 2 / (n + 1), out = [], prev = null;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] == null) { out.push(null); continue; }
      prev = prev == null ? vals[i] : vals[i] * k + prev * (1 - k);
      out.push(i >= n - 1 ? prev : null);
    }
    return out;
  }
  function stdev(vals, n, means) {
    return vals.map(function (_, i) {
      if (means[i] == null) return null;
      var s = 0;
      for (var j = i - n + 1; j <= i; j++) s += Math.pow(vals[j] - means[i], 2);
      return Math.sqrt(s / n);
    });
  }
  function rsi(vals, n) {
    var out = [null], g = 0, l = 0;
    for (var i = 1; i < vals.length; i++) {
      var ch = vals[i] - vals[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
      if (i <= n) { g += up / n; l += dn / n; out.push(i === n ? (l === 0 ? 100 : 100 - 100 / (1 + g / l)) : null); continue; }
      g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n;
      out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return out;
  }
  function macd(vals) {
    var e12 = ema(vals, 12), e26 = ema(vals, 26);
    var line = vals.map(function (_, i) { return e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null; });
    var start = line.findIndex(function (v) { return v != null; });
    var sig = ema(line.slice(start), 9);
    var signal = line.map(function (_, i) { return i < start ? null : sig[i - start]; });
    return { line: line, signal: signal, hist: line.map(function (v, i) { return v != null && signal[i] != null ? v - signal[i] : null; }) };
  }
  /** Supports et résistances : sommets et creux locaux regroupés par zones de prix */
  function levels(pts, look) {
    var piv = [], w = 8;
    var from = Math.max(w, pts.length - look);
    for (var i = from; i < pts.length - w; i++) {
      var c = pts[i].c, hi = true, lo = true;
      for (var j = i - w; j <= i + w; j++) { if (pts[j].c > c) hi = false; if (pts[j].c < c) lo = false; }
      if (hi || lo) piv.push(c);
    }
    piv.sort(function (a, b) { return a - b; });
    var zones = [];
    piv.forEach(function (p) {
      var z = zones[zones.length - 1];
      if (z && p <= z.avg * 1.03) { z.sum += p; z.n++; z.avg = z.sum / z.n; } else zones.push({ sum: p, n: 1, avg: p });
    });
    var last = pts[pts.length - 1].c;
    var sup = zones.filter(function (z) { return z.avg < last * 0.995; }).sort(function (a, b) { return b.avg - a.avg || b.n - a.n; });
    var res = zones.filter(function (z) { return z.avg > last * 1.005; }).sort(function (a, b) { return a.avg - b.avg || b.n - a.n; });
    return { supports: sup.slice(0, 2).map(function (z) { return { p: z.avg, n: z.n }; }), resistances: res.slice(0, 2).map(function (z) { return { p: z.avg, n: z.n }; }) };
  }
  /** Écarte les cours aberrants d'un seul jour (erreur de saisie dans l'historique) */
  function clean(hist) {
    var h = hist.filter(function (p) { return p && p.c > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.d); });
    return h.filter(function (p, i) {
      if (i === 0 || i === h.length - 1) return true;
      var a = h[i - 1].c, b = h[i + 1].c;
      return !(Math.abs(p.c / a - 1) > 0.4 && Math.abs(p.c / b - 1) > 0.4 && Math.abs(a / b - 1) < 0.1);
    });
  }
  function compute(hist) {
    var pts = clean(hist);
    var c = pts.map(function (p) { return p.c; });
    var m20 = sma(c, 20), sd = stdev(c, 20, m20);
    return {
      pts: pts, closes: c,
      ma20: m20, ma50: sma(c, 50), ma200: sma(c, 200),
      bbU: m20.map(function (m, i) { return m == null ? null : m + 2 * sd[i]; }),
      bbL: m20.map(function (m, i) { return m == null ? null : m - 2 * sd[i]; }),
      rsi: rsi(c, 14), macd: macd(c),
      levels: pts.length > 40 ? levels(pts, 250) : { supports: [], resistances: [] }
    };
  }

  // ───────── Mise en forme ─────────
  var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var tidy = function (s) { return s.replace(/[  ]/g, ' '); };
  var price = function (v) { return v == null ? '—' : tidy((v >= 100 ? nf0 : nf2).format(v)); };
  var pct = function (v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + tidy(nf2.format(v)) + ' %'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dateFr = function (d) { var p = String(d).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  var shift = function (d, days) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); };

  var ICON = {
    cross: '<path d="M12 3v18M3 12h18"/>',
    trend: '<path d="M4 19 20 5"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/>',
    hline: '<path d="M3 12h18"/><path d="M7 8h2M15 8h2" opacity=".5"/>',
    erase: '<path d="m7 21 10-10M4 15l6 6h10M14 4l6 6-9 9-6-6z"/>',
    log: '<path d="M4 20c4-1 7-6 9-11s4-5 7-5"/><path d="M4 4v16h16"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shot: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/><circle cx="4" cy="6" r="1.6"/><circle cx="20" cy="18" r="1.6"/>',
    long: '<path d="M4 4v16h16"/><rect x="8" y="5" width="10" height="7" fill="currentColor" opacity=".35" stroke="none"/><rect x="8" y="12" width="10" height="5" fill="currentColor" opacity=".15" stroke="none"/><path d="M8 12h10"/><path d="m11 8 2-2 2 2"/>',
    short: '<path d="M4 4v16h16"/><rect x="8" y="12" width="10" height="7" fill="currentColor" opacity=".35" stroke="none"/><rect x="8" y="7" width="10" height="5" fill="currentColor" opacity=".15" stroke="none"/><path d="M8 12h10"/><path d="m11 16 2 2 2-2"/>',
    fib: '<path d="M3 5h18M3 9.5h18M3 13h18M3 16.5h18M3 20h18" /><path d="M5 20 19 5" opacity=".6"/>',
    measure: '<path d="M4 20 20 4"/><path d="M7 17l-2-2M10 14l-1.5-1.5M13 11l-2-2M16 8l-1.5-1.5"/>',
    brush: '<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z"/><path d="M3 21c2.5 0 3.5-1 4-3"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    label: '<path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="16" cy="10" r="1.3" fill="currentColor"/><path d="M12 21c-1.5 0-2-1-2-2s1-2 2.5-2H15a3 3 0 0 0 3-3"/>',
    zin: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M10.5 7.5v6M7.5 10.5h6"/>',
    zout: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M7.5 10.5h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path d="M8 12h8"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    spark: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'
  };
  var icon = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>'; };

  var TOOLS = [
    ['cross', 'Réticule', 'cross'], ['trend', 'Ligne de tendance', 'trend'], ['hline', 'Ligne horizontale', 'hline'], ['rect', 'Rectangle', 'rect'], '|',
    ['long', 'Position longue (achat)', 'long'], ['short', 'Position courte (vente)', 'short'], ['fib', 'Retracement de Fibonacci', 'fib'], ['measure', 'Mesure (prix et durée)', 'measure'], '|',
    ['brush', 'Pinceau', 'brush'], ['text', 'Texte', 'text'], ['label', 'Étiquette de prix', 'label']
  ];
  var HINTS = {
    trend: 'Ligne de tendance : cliquez-glissez, ou cliquez sur deux points.', hline: 'Ligne horizontale : cliquez sur le niveau de prix.',
    rect: 'Rectangle : cliquez-glissez pour tracer la zone.', long: 'Position longue : cliquez sur le prix d’achat, puis déplacez l’objectif et le stop.',
    short: 'Position courte : cliquez sur le prix de vente, puis déplacez l’objectif et le stop.', fib: 'Fibonacci : tracez du plus bas au plus haut (ou l’inverse).',
    measure: 'Mesure : cliquez-glissez pour mesurer la variation et la durée.', brush: 'Pinceau : dessinez librement en maintenant le clic.',
    text: 'Texte : cliquez à l’endroit voulu, écrivez puis appuyez sur Entrée.', label: 'Étiquette de prix : cliquez sur un point du graphique.'
  };
  var PERIODS = [['1M', 31], ['3M', 92], ['6M', 183], ['1A', 365], ['3A', 1096], ['5A', 1827], ['Max', 0]];
  var IND = [
    ['vol', 'Volume', true], ['ma20', 'MM 20', false], ['ma50', 'MM 50', true], ['ma200', 'MM 200', true],
    ['bb', 'Bollinger', false], ['sr', 'Supports / résistances', true], ['hl', 'Plus haut / bas 52 sem.', false],
    ['rsi', 'RSI 14', true], ['macd', 'MACD', false]
  ];

  function mount(root, opts) {
    if (!LW) { root.innerHTML = '<p class="fx-tip">Le graphique ne peut pas s’afficher sur ce navigateur.</p>'; return null; }
    var data = compute(opts.history);
    var pts = data.pts;
    if (pts.length < 10) { root.innerHTML = '<p class="fx-tip">Historique de cours insuffisant pour afficher le graphique.</p>'; return null; }
    var on = {}; IND.forEach(function (x) { on[x[0]] = x[2]; });
    var type = 'area', period = '1A', tool = 'cross', logScale = false, compareSym = '';
    var mobile = window.matchMedia('(max-width: 760px)').matches;

    root.innerHTML =
      '<div class="cx">' +
      '<div class="cx-top"><div><strong>' + esc(opts.name) + '</strong><span>' + esc(opts.sym) + ' · Analyse technique</span></div>' +
        '<button type="button" class="cx-ai" data-act="ai">' + icon('spark') + '<span>Analyser l’action</span></button></div>' +
      '<div class="cx-bar">' +
        '<div class="cx-seg" role="group" aria-label="Période">' + PERIODS.map(function (p) { return '<button type="button" data-period="' + p[0] + '">' + p[0] + '</button>'; }).join('') + '</div>' +
        '<div class="cx-seg" role="group" aria-label="Type de graphique">' +
          '<button type="button" data-type="area" title="Aire">Aire</button><button type="button" data-type="line" title="Ligne">Ligne</button><button type="button" data-type="candle" title="Chandeliers ouverture / clôture">Bougies</button></div>' +
        '<details class="cx-menu"><summary>Indicateurs</summary><div class="cx-pop">' +
          IND.map(function (x) { return '<label><input type="checkbox" data-ind="' + x[0] + '"' + (x[2] ? ' checked' : '') + '> ' + esc(x[1]) + '</label>'; }).join('') + '</div></details>' +
        '<label class="cx-cmp"><span class="screen-reader-text">Comparer avec</span><select data-compare><option value="">Comparer…</option>' +
          (opts.symbols || []).filter(function (s) { return s.sym !== opts.sym; }).map(function (s) { return '<option value="' + esc(s.sym) + '">' + esc(s.sym + ' · ' + s.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="cx-seg cx-tools" role="group" aria-label="Affichage">' +
          '<button type="button" data-act="log" title="Échelle logarithmique">' + icon('log') + '</button>' +
          '<button type="button" data-act="full" title="Plein écran">' + icon('full') + '</button>' +
          '<button type="button" data-act="shot" title="Enregistrer l’image">' + icon('shot') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="cx-legend" data-legend></div>' +
      '<div class="cx-body">' +
        '<div class="cx-side" role="toolbar" aria-label="Outils de dessin">' +
          TOOLS.map(function (t) { return t === '|' ? '<span class="cx-sep"></span>' : '<button type="button" data-tool="' + t[0] + '" title="' + esc(t[1]) + '" aria-label="' + esc(t[1]) + '">' + icon(t[2]) + '</button>'; }).join('') +
          '<span class="cx-sep"></span>' +
          '<div class="cx-palwrap"><button type="button" data-act="palette" title="Couleur et épaisseur" aria-label="Couleur et épaisseur" aria-expanded="false"><span class="cx-swatch" data-swatch></span></button>' +
            '<div class="cx-pal" data-pal hidden><p>Couleur</p><div class="cx-colors">' +
              (window.BxDraw ? window.BxDraw.COLORS : []).map(function (c) { return '<button type="button" data-color="' + c + '" style="background:' + c + '" aria-label="Couleur ' + c + '"></button>'; }).join('') +
            '</div><p>Épaisseur</p><div class="cx-widths">' + [1, 2, 3, 4].map(function (w) { return '<button type="button" data-width="' + w + '" aria-label="Épaisseur ' + w + '"><i style="height:' + w + 'px"></i></button>'; }).join('') + '</div>' +
            '<p>Capital simulé (positions)</p><label class="cx-cap"><input type="number" min="1000" step="1000" data-capital> F</label></div></div>' +
          '<button type="button" data-act="zin" title="Zoomer" aria-label="Zoomer">' + icon('zin') + '</button>' +
          '<button type="button" data-act="zout" title="Dézoomer" aria-label="Dézoomer">' + icon('zout') + '</button>' +
          '<button type="button" data-act="fit" title="Tout afficher" aria-label="Tout afficher">' + icon('fit') + '</button>' +
          '<span class="cx-sep"></span>' +
          '<button type="button" data-act="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler">' + icon('undo') + '</button>' +
          '<button type="button" data-act="hide" title="Masquer / afficher les tracés" aria-label="Masquer les tracés">' + icon('eye') + '</button>' +
          '<button type="button" data-act="del" title="Supprimer le tracé sélectionné (Suppr) ; tout effacer si aucun n’est sélectionné" aria-label="Supprimer">' + icon('trash') + '</button>' +
        '</div>' +
        '<div class="cx-panes">' +
          '<div class="cx-hint" data-hint hidden></div>' +
          '<div class="cx-main" data-main></div>' +
          '<div class="cx-sub" data-rsi><span class="cx-sub-lbl">RSI 14</span></div>' +
          '<div class="cx-sub" data-macd><span class="cx-sub-lbl">MACD 12 · 26 · 9</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="cx-foot"><span data-stats></span><span>Cours ajustés des fractionnements · Graphique : <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView Lightweight Charts™</a></span></div>' +
      '</div>';

    var $ = function (s) { return root.querySelector(s); };
    var mainEl = $('[data-main]'), rsiEl = $('[data-rsi]'), macdEl = $('[data-macd]');
    var base = {
      autoSize: true,
      layout: { background: { type: 'solid', color: C.bg }, textColor: C.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, rightOffset: 4, minBarSpacing: 0.5 },
      crosshair: { mode: 0, vertLine: { color: 'rgba(243,246,251,.35)', labelBackgroundColor: '#182133' }, horzLine: { color: 'rgba(243,246,251,.35)', labelBackgroundColor: '#182133' } },
      localization: { locale: 'fr-FR', priceFormatter: price, dateFormat: 'dd/MM/yyyy' },
      handleScale: { axisPressedMouseMove: true }, handleScroll: { vertTouchDrag: false }
    };
    var chart = LW.createChart(mainEl, base);
    var sub = function (el) {
      var c = LW.createChart(el, Object.assign({}, base, {
        layout: Object.assign({}, base.layout, { attributionLogo: false }),
        timeScale: { visible: false, borderColor: C.border }, rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.12, bottom: 0.08 } }
      }));
      c.addLineSeries({ lastValueVisible: false, priceLineVisible: false }).setData(pts.map(function (p) { return { time: p.d }; }));
      return c;
    };
    var rsiChart = sub(rsiEl), macdChart = sub(macdEl);

    var T = function (i) { return pts[i].d; };
    var line = function (arr, src) { var out = []; arr.forEach(function (v, i) { if (v != null) out.push({ time: (src || pts)[i].d, value: v }); }); return out; };

    // Séries principales
    var S = {};
    S.area = chart.addAreaSeries({ lineColor: C.up, topColor: 'rgba(22,196,127,.32)', bottomColor: 'rgba(22,196,127,0)', lineWidth: 2, priceLineColor: C.up, lastValueVisible: true });
    S.line = chart.addLineSeries({ color: C.up, lineWidth: 2, visible: false });
    S.candle = chart.addCandlestickSeries({ upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickVisible: false, visible: false });
    var closeData = pts.map(function (p) { return { time: p.d, value: p.c }; });
    S.area.setData(closeData); S.line.setData(closeData);
    S.candle.setData(pts.map(function (p, i) {
      var o = p.o > 0 ? p.o : (i ? pts[i - 1].c : p.c);
      return { time: p.d, open: o, close: p.c, high: Math.max(o, p.c), low: Math.min(o, p.c) };
    }));
    S.vol = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    S.vol.setData(pts.map(function (p, i) { return { time: p.d, value: p.v || 0, color: i && p.c < pts[i - 1].c ? 'rgba(240,82,107,.38)' : 'rgba(22,196,127,.38)' }; }));
    var mk = function (color, width, style) { return chart.addLineSeries({ color: color, lineWidth: width || 1.5, lineStyle: style || 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false }); };
    S.ma20 = mk(C.cyan); S.ma20.setData(line(data.ma20));
    S.ma50 = mk(C.gold); S.ma50.setData(line(data.ma50));
    S.ma200 = mk(C.violet, 2); S.ma200.setData(line(data.ma200));
    S.bbU = mk('rgba(76,155,255,.75)', 1); S.bbU.setData(line(data.bbU));
    S.bbL = mk('rgba(76,155,255,.75)', 1); S.bbL.setData(line(data.bbL));
    S.bbM = mk('rgba(76,155,255,.45)', 1, 2); S.bbM.setData(line(data.ma20));

    var rsiS = rsiChart.addLineSeries({ color: C.violet, lineWidth: 1.5, lastValueVisible: true, priceLineVisible: false });
    rsiS.setData(line(data.rsi));
    [[70, C.down], [30, C.up]].forEach(function (l) { rsiS.createPriceLine({ price: l[0], color: l[1], lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '' }); });
    var mh = macdChart.addHistogramSeries({ lastValueVisible: false, priceLineVisible: false });
    mh.setData(data.macd.hist.map(function (v, i) { return v == null ? null : { time: T(i), value: v, color: v >= 0 ? 'rgba(22,196,127,.6)' : 'rgba(240,82,107,.6)' }; }).filter(Boolean));
    var ml = macdChart.addLineSeries({ color: C.blue, lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false }); ml.setData(line(data.macd.line));
    var msg = macdChart.addLineSeries({ color: C.gold, lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false }); msg.setData(line(data.macd.signal));

    // Synchronisation des trois graphiques
    var syncing = false;
    var charts = [chart, rsiChart, macdChart];
    charts.forEach(function (c) {
      c.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
        if (syncing || !r) return;
        syncing = true;
        charts.forEach(function (o) { if (o !== c) o.timeScale().setVisibleLogicalRange(r); });
        syncing = false;
      });
    });

    // Lignes de niveaux (supports, résistances, plus haut / bas, niveaux de l'analyste)
    var priceLines = { sr: [], hl: [], ai: [] };
    var mainSeries = function () { return S[type]; };
    var clearLines = function (k) { priceLines[k].forEach(function (pl) { try { pl.s.removePriceLine(pl.l); } catch (e) {} }); priceLines[k] = []; };
    var addLine = function (k, p, color, title, style) { var s = mainSeries(); priceLines[k].push({ s: s, l: s.createPriceLine({ price: p, color: color, lineWidth: 1, lineStyle: style == null ? 2 : style, axisLabelVisible: true, title: title }) }); };
    var aiLevels = null;
    function drawLevels() {
      ['sr', 'hl', 'ai'].forEach(clearLines);
      if (on.sr) {
        data.levels.supports.forEach(function (z, i) { addLine('sr', z.p, C.up, 'Support ' + (i + 1)); });
        data.levels.resistances.forEach(function (z, i) { addLine('sr', z.p, C.down, 'Résistance ' + (i + 1)); });
      }
      if (on.hl) {
        var y = pts.filter(function (p) { return p.d >= shift(pts[pts.length - 1].d, -365); }).map(function (p) { return p.c; });
        addLine('hl', Math.max.apply(null, y), C.white, 'Plus haut 52 s.', 1);
        addLine('hl', Math.min.apply(null, y), C.white, 'Plus bas 52 s.', 1);
      }
      if (aiLevels) aiLevels.forEach(function (l) { addLine('ai', l.p, l.color, l.title, 0); });
    }

    // Comparaison avec une autre action (échelle en %)
    var cmpSeries = null;
    function setCompare(sym) {
      compareSym = sym;
      if (cmpSeries) { chart.removeSeries(cmpSeries); cmpSeries = null; }
      chart.priceScale('right').applyOptions({ mode: sym ? 2 : (logScale ? 1 : 0) });
      if (!sym || !opts.loadHistory) { legend(); return; }
      opts.loadHistory(sym).then(function (h) {
        if (compareSym !== sym) return;
        var cp = clean(h);
        cmpSeries = chart.addLineSeries({ color: C.blue, lineWidth: 2, lastValueVisible: true, priceLineVisible: false, title: sym });
        cmpSeries.setData(cp.map(function (p) { return { time: p.d, value: p.c }; }));
        legend();
      }).catch(function () {});
    }

    var timeStr = function (t) { return typeof t === 'string' ? t : t && t.year ? t.year + '-' + String(t.month).padStart(2, '0') + '-' + String(t.day).padStart(2, '0') : null; };
    // Légende (au survol : cours de la séance pointée)
    var legendEl = $('[data-legend]');
    var byTime = {}; pts.forEach(function (p, i) { byTime[p.d] = i; });
    var visibleChange = function () {
      var r = chart.timeScale().getVisibleRange();
      if (!r) return null;
      var from = timeStr(r.from), to = timeStr(r.to), a = null, b = null;
      for (var i = 0; i < pts.length; i++) { if (pts[i].d >= from && a == null) a = pts[i]; if (pts[i].d <= to) b = pts[i]; }
      return a && b ? (b.c / a.c - 1) * 100 : null;
    };
    function legend(i) {
      var k = i == null ? pts.length - 1 : i, p = pts[k], prev = k ? pts[k - 1].c : null;
      var ch = prev ? (p.c / prev - 1) * 100 : null, vc = visibleChange();
      var item = function (l, v, cls) { return '<span><small>' + l + '</small><b class="num ' + (cls || '') + '">' + v + '</b></span>'; };
      var ma = function (key, label, color) { return on[key] && data[key][k] != null ? '<span><small style="color:' + color + '">' + label + '</small><b class="num">' + price(data[key][k]) + '</b></span>' : ''; };
      legendEl.innerHTML = '<span class="cx-name">' + esc(opts.name) + ' <em>' + esc(opts.sym) + '</em></span>' +
        item('Séance', dateFr(p.d)) + item('Ouv.', price(p.o)) + item('Clôt.', price(p.c)) +
        item('Var.', pct(ch), ch > 0 ? 'up' : ch < 0 ? 'down' : '') + item('Volume', tidy(nf0.format(p.v || 0))) +
        item('Sur la période', pct(vc), vc > 0 ? 'up' : vc < 0 ? 'down' : '') +
        ma('ma20', 'MM20', C.cyan) + ma('ma50', 'MM50', C.gold) + ma('ma200', 'MM200', C.violet) +
        (on.rsi && data.rsi[k] != null ? item('RSI', tidy(nf0.format(data.rsi[k]))) : '') +
        (compareSym ? '<span><small style="color:' + C.blue + '">Comparée à</small><b>' + esc(compareSym) + '</b></span>' : '');
    }
    chart.subscribeCrosshairMove(function (param) {
      var i = param && param.time != null ? byTime[timeStr(param.time)] : null;
      legend(i == null ? undefined : i);
    });
    chart.timeScale().subscribeVisibleTimeRangeChange(function () { legend(); });

    // Outils de dessin (moteur BxDraw : tracés ancrés, déplaçables, sauvegardés sur cet appareil)
    var hint = $('[data-hint]');
    var say = function (t) { hint.hidden = !t; hint.textContent = t || ''; };
    var swatch = $('[data-swatch]'), pal = $('[data-pal]'), capIn = $('[data-capital]');
    var draw = window.BxDraw ? window.BxDraw.create({
      chart: chart, host: mainEl, getSeries: mainSeries, pts: pts, sym: opts.sym,
      onToolDone: function () { setTool('cross'); },
      onChange: function (st) { var d = root.querySelector('[data-act="del"]'); if (d) d.classList.toggle('is-armed', !!st.selected); }
    }) : null;
    var curColor = window.BxDraw ? window.BxDraw.COLORS[0] : '#16C47F', curWidth = 2;
    function paintSwatch() {
      swatch.style.background = curColor;
      root.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-color') === curColor); });
      root.querySelectorAll('[data-width]').forEach(function (b) { b.classList.toggle('is-on', +b.getAttribute('data-width') === curWidth); });
    }
    if (capIn && draw) capIn.value = draw.capital();
    function setTool(t) {
      tool = t;
      if (draw) draw.setTool(t);
      root.querySelectorAll('[data-tool]').forEach(function (b) { var on2 = b.getAttribute('data-tool') === t; b.classList.toggle('is-on', on2); b.setAttribute('aria-pressed', on2); });
      say(HINTS[t] || '');
    }
    function zoom(f) {
      var r = chart.timeScale().getVisibleLogicalRange();
      if (!r) return;
      var span = (r.to - r.from) * f, to = r.to;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(-5, to - span), to: to });
    }

    // Affichage
    function applyType() {
      ['area', 'line', 'candle'].forEach(function (k) { S[k].applyOptions({ visible: k === type }); });
      if (typeof draw !== 'undefined' && draw) draw.redraw();
      root.querySelectorAll('[data-type]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-type') === type); });
      drawLevels();
    }
    function applyInd() {
      S.vol.applyOptions({ visible: on.vol });
      S.ma20.applyOptions({ visible: on.ma20 }); S.ma50.applyOptions({ visible: on.ma50 }); S.ma200.applyOptions({ visible: on.ma200 });
      [S.bbU, S.bbL, S.bbM].forEach(function (s) { s.applyOptions({ visible: on.bb }); });
      rsiEl.hidden = !on.rsi; macdEl.hidden = !on.macd;
      drawLevels(); legend();
    }
    function applyPeriod() {
      root.querySelectorAll('[data-period]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-period') === period); });
      var days = PERIODS.filter(function (p) { return p[0] === period; })[0][1];
      var last = pts[pts.length - 1].d;
      var from = days ? shift(last, -days) : pts[0].d;
      if (from < pts[0].d) from = pts[0].d;
      var range = { from: from, to: last };
      charts.forEach(function (c) { try { c.timeScale().setVisibleRange(range); } catch (e) {} });
      legend();
    }
    var statsEl = $('[data-stats]');
    (function () {
      var y = pts.filter(function (p) { return p.d >= shift(pts[pts.length - 1].d, -365); }).map(function (p) { return p.c; });
      statsEl.textContent = 'Historique depuis le ' + dateFr(pts[0].d) + ' · ' + pts.length + ' séances · Plus haut 52 s. : ' + price(Math.max.apply(null, y)) + ' · Plus bas 52 s. : ' + price(Math.min.apply(null, y));
    })();

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-period')) { period = b.getAttribute('data-period'); applyPeriod(); }
      else if (b.hasAttribute('data-type')) { type = b.getAttribute('data-type'); applyType(); }
      else if (b.hasAttribute('data-tool')) setTool(b.getAttribute('data-tool') === tool && tool !== 'cross' ? 'cross' : b.getAttribute('data-tool'));
      else {
        var a = b.getAttribute('data-act');
        if (!b.closest('.cx-palwrap') && pal) pal.hidden = true;
        if (a === 'palette') { pal.hidden = !pal.hidden; b.setAttribute('aria-expanded', !pal.hidden); }
        else if (b.hasAttribute('data-color')) { curColor = b.getAttribute('data-color'); if (draw) draw.setColor(curColor); paintSwatch(); }
        else if (b.hasAttribute('data-width')) { curWidth = +b.getAttribute('data-width'); if (draw) draw.setWidth(curWidth); paintSwatch(); }
        else if (a === 'zin') zoom(0.7);
        else if (a === 'zout') zoom(1.45);
        else if (a === 'fit') chart.timeScale().fitContent();
        else if (a === 'undo' && draw) draw.undo();
        else if (a === 'hide' && draw) b.classList.toggle('is-on', !draw.toggle());
        else if (a === 'del' && draw) { if (b.classList.contains('is-armed')) draw.remove(); else if (draw.count() && window.confirm('Effacer tous les tracés de ce graphique ?')) draw.clear(); }
        else if (a === 'log') {
          logScale = !logScale; b.classList.toggle('is-on', logScale);
          if (!compareSym) chart.priceScale('right').applyOptions({ mode: logScale ? 1 : 0 });
        } else if (a === 'full') {
          var box = root.querySelector('.cx');
          if (document.fullscreenElement) document.exitFullscreen(); else if (box.requestFullscreen) box.requestFullscreen().catch(function () {});
        } else if (a === 'shot') {
          try {
            var cv = chart.takeScreenshot(), overlay = mainEl.querySelector('canvas.cx-draw');
            if (overlay && overlay.width) cv.getContext('2d').drawImage(overlay, 0, 0, cv.width * (overlay.clientWidth / mainEl.clientWidth), overlay.clientHeight * (cv.width / mainEl.clientWidth));
            var link = document.createElement('a');
            link.href = cv.toDataURL('image/png'); link.download = 'BRVMexa-' + opts.sym + '-' + pts[pts.length - 1].d + '.png';
            document.body.appendChild(link); link.click(); link.remove();
          } catch (er) {}
        } else if (a === 'ai' && opts.onAnalyse) opts.onAnalyse();
      }
    });
    root.querySelectorAll('[data-ind]').forEach(function (cb) {
      cb.addEventListener('change', function () { on[cb.getAttribute('data-ind')] = cb.checked; applyInd(); });
    });
    $('[data-compare]').addEventListener('change', function (e) { setCompare(e.target.value); if (draw) draw.redraw(); });
    if (capIn) capIn.addEventListener('change', function () { var v = Math.round(+capIn.value); if (draw && v >= 1000) draw.setCapital(v); });
    document.addEventListener('click', function (e) { if (pal && !pal.hidden && !e.target.closest('.cx-palwrap')) pal.hidden = true; });

    if (mobile) { on.macd = false; }
    applyType(); applyInd(); setTool('cross'); paintSwatch();
    requestAnimationFrame(applyPeriod);

    return {
      data: data,
      /** Affiche les niveaux proposés par l'analyste (entrée, stop, objectif) */
      setAnalystLevels: function (lv) { aiLevels = lv; drawLevels(); },
      destroy: function () { if (draw) draw.destroy(); charts.forEach(function (c) { try { c.remove(); } catch (e) {} }); }
    };
  }

  window.BxChart = { mount: mount, compute: compute, clean: clean };
})();
