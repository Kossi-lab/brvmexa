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

  // ───────── Prochain dividende (estimation d'après l'historique, comme dans l'application) ─────────
  var DAY = 864e5;
  var isoD = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var addYear = function (d) { return ((Number(d.slice(0, 4)) + 1) + d.slice(4)).replace(/-02-29$/, '-02-28'); };
  var frDate = function (d) { return d ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z')) : '—'; };
  var prevBusinessDay = function (d) { // séance précédant la date (samedi et dimanche exclus)
    var t = new Date(d + 'T00:00:00Z');
    do { t.setUTCDate(t.getUTCDate() - 1); } while (t.getUTCDay() === 0 || t.getUTCDay() === 6);
    return t.toISOString().slice(0, 10);
  };
  var tradingDay = function (d) { // pas de séance le week-end : on reporte au lundi
    var t = new Date(d + 'T00:00:00Z');
    while (t.getUTCDay() === 0 || t.getUTCDay() === 6) t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };
  function nextDividend(info, price, today) {
    today = today || isoD(Date.now());
    var t = Date.parse(today), year = Number(today.slice(0, 4));
    var hist = (info && info.history ? info.history : []).slice().sort(function (a, b) { return a.d.localeCompare(b.d); });
    if (!hist.length) return { none: true, last: null, paid5: 0 };
    var years = {};
    hist.forEach(function (p) { var y = Number(p.d.slice(0, 4)); if (y >= year - 4 && y <= year) years[y] = 1; });
    var paid5 = Object.keys(years).length, last = info.last || hist[hist.length - 1];
    if (!info.annual) return { none: true, last: last, paid5: paid5 }; // aucun versement depuis 18 mois
    // Versements du dernier « cycle » (acompte + solde éventuels) : ceux des 8 mois précédant le dernier
    var list = hist.filter(function (p) { return Date.parse(p.d) > Date.parse(last.d) - 240 * DAY; }).map(function (p) {
      var date = addYear(p.d);
      while (Date.parse(date) < t - 30 * DAY) date = addYear(date);
      var amount = info.exceptional && info.usual && p.d === last.d ? info.usual : p.a;
      date = tradingDay(date);
      return { date: date, amount: amount, due: Date.parse(date) < t };
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var nx = list[0];
    return { date: nx.date, amount: nx.amount, due: nx.due, then: list[1] || null, days: Math.round((Date.parse(nx.date) - t) / DAY),
      buyBy: prevBusinessDay(nx.date), yield: price ? nx.amount / price : null, last: last, paid5: paid5 };
  }

  // ───────── Calcul des ratios ─────────
  function analyse(q, f) {
    if (!f.netIncome) { // version gratuite : seuls le cours et la capitalisation sont calculables
      return { sym: q.symbol, name: q.shortName || q.name, fullName: q.name, sector: q.sector, country: q.countryName,
        price: q.close, change: q.change, year: f.year || null, f: f, cap: q.close && f.shares ? q.close * f.shares : null, locked: true };
    }
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
      divYears: f.divYears != null ? f.divYears : f.dividend.filter(function (x) { return x > 0; }).length,
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

  function divBlock(s) {
    var nd = s.nd;
    if (!nd) return ''; // calendrier des dividendes indisponible
    var lastTxt = nd.last ? frDate(nd.last.d) : '—';
    var lastHint = nd.last ? money(nd.last.a) + ' F brut par action' + (nd.last.ex ? ' · exercice ' + nd.last.ex : '') : '';
    var reg = card('Régularité', nd.paid5 + ' année' + (nd.paid5 > 1 ? 's' : '') + ' sur 5', 'Avec au moins un versement', nd.paid5 >= 4 ? 'up' : nd.paid5 <= 1 ? 'down' : '');
    var head = '<div class="fx-nd" aria-label="Prochain dividende"><div class="fx-nd-head"><h4>Prochain dividende</h4>' +
      '<span class="fx-chip ' + (nd.none ? 'flat' : nd.due ? 'warn' : 'up') + '">' + (nd.none ? 'Aucun versement prévu' : nd.due ? 'Annonce attendue' : 'Estimation') + '</span></div>';
    if (nd.none) return head + '<div class="fx-cards fx-nd-cards">' + card('Prochain dividende', 'Non prévu', 'Aucun versement depuis plus de 18 mois') +
      card('Dernier versement', lastTxt, lastHint) + reg + '</div></div>';
    return head + '<div class="fx-cards fx-nd-cards">' +
      card('Date de détachement estimée', (nd.due ? 'Vers le ' : '') + frDate(nd.date), nd.due ? 'Date habituelle passée : annonce imminente' : 'Dans ' + nd.days + ' jour' + (nd.days > 1 ? 's' : ''), nd.due ? 'up' : '') +
      card('Achetez au plus tard le', nd.due ? 'Avant le détachement' : frDate(nd.buyBy), 'Il faut détenir l’action avant la date de détachement') +
      card('Montant brut estimé', money(nd.amount) + ' F', 'Par action, avant impôt') +
      card('Rendement estimé', pctv(nd.yield), 'Au cours actuel', nd.yield >= 0.06 ? 'up' : '') +
      card('Dernier versement', lastTxt, lastHint) + reg + '</div>' +
      (nd.then ? '<p class="fx-nd-then">Puis un second versement estimé vers le ' + frDate(nd.then.date) + ' (environ ' + money(nd.then.amount) + ' F brut par action).</p>' : '') +
      '<p class="fx-nd-note">Estimation d’après le calendrier des années précédentes : seule l’annonce officielle de la société fait foi (date exacte et montant). Montants bruts, avant impôt.</p></div>';
  }

  // Petites explications (icône « i » en haut à droite de chaque carte, au survol ou au toucher)
  var TIPS = [
    [/^Date de détachement/, 'Le jour où le dividende se « détache » de l’action : à partir de cette date, un nouvel acheteur n’y a plus droit. Elle est estimée d’après les années précédentes ; la société annonce la date exacte quelques semaines avant.'],
    [/^Achetez au plus tard/, 'Dernière séance pour acheter l’action et toucher ce dividende. Si vous achetez le jour du détachement ou après, c’est le vendeur qui le recevra.'],
    [/^Montant brut/, 'Ce que la société versera pour chaque action détenue, avant l’impôt retenu à la source (son taux dépend du pays de la société). Estimé d’après le dernier versement.'],
    [/^Rendement estimé/, 'Ce que ce dividende vous rapporte par rapport au prix actuel de l’action. Exemple : 5 % = 5 000 F de dividende pour 100 000 F investis.'],
    [/^Dernier versement/, 'Le dernier dividende réellement payé par la société, avec l’exercice (l’année de bénéfices) auquel il correspond.'],
    [/^Régularité/, 'Nombre d’années, sur les 5 dernières, où la société a versé au moins un dividende. 5 sur 5 : un payeur fidèle.'],
    [/^Prochain dividende/, 'La société n’a rien versé depuis plus de 18 mois : aucun versement n’est prévisible pour l’instant. À surveiller lors de ses prochains résultats.'],
    [/^BPA/, 'Bénéfice par action : la part du bénéfice annuel qui revient à chaque action. S’il progresse d’année en année, c’est bon signe.'],
    [/^PER/, 'Combien d’années de bénéfices il faut pour « rembourser » le prix de l’action. Plus il est bas, moins l’action est chère. Comparez-le à la médiane du secteur.'],
    [/^Rendement net/, 'Dividende net du dernier exercice divisé par le cours actuel : le revenu annuel que l’action vous verse, en pourcentage de votre mise.'],
    [/^Taux de distribution/, 'Part du bénéfice reversée aux actionnaires. Au-delà de 100 %, la société distribue plus qu’elle ne gagne : le dividende risque de baisser.'],
    [/^Marge nette/, 'Sur 100 F de chiffre d’affaires (ou de produit net bancaire pour une banque), ce qu’il reste en bénéfice. Plus elle est haute, plus l’entreprise est rentable.'],
    [/^Croissance du bénéfice/, 'Évolution du bénéfice net par rapport à l’exercice précédent : la société gagne-t-elle plus ou moins d’argent ?'],
    [/^Croissance du (CA|PNB)/, 'Évolution des ventes (ou du produit net bancaire pour une banque) sur un an : l’activité de la société grandit-elle ?'],
    [/^Croissance annuelle moyenne/, 'Progression moyenne du bénéfice chaque année sur la période : elle lisse les bonnes et les mauvaises années.'],
    [/^Capitalisation/, 'Valeur totale de la société en bourse : cours de l’action × nombre d’actions.'],
    [/^Flottant/, 'Part des actions réellement disponibles à l’achat en bourse. Un flottant faible rend l’action plus difficile à acheter ou à vendre.']
  ];
  var INFO = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="6.4" r="1.05" fill="currentColor"/><path d="M10 9.2v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var tipId = 0;
  function card(label, value, hint, tone) {
    var tip = TIPS.filter(function (t) { return t[0].test(label); })[0], info = '';
    if (tip) {
      var id = 'fx-tip-' + (++tipId);
      info = '<button type="button" class="fx-i" aria-label="Qu’est-ce que « ' + esc(label) + ' » ?" aria-describedby="' + id + '">' + INFO + '</button>' +
        '<span class="fx-bubble" role="tooltip" id="' + id + '"><b>' + esc(label) + '</b>' + esc(tip[1]) + '</span>';
    }
    return '<div class="fx-card' + (tip ? ' has-tip' : '') + '">' + info + '<small>' + esc(label) + '</small><strong class="num' + (tone ? ' ' + tone : '') + '">' + value + '</strong>' + (hint ? '<span>' + hint + '</span>' : '') + '</div>';
  }

  // Société fictive affichée floutée derrière le message Premium (aucune vraie donnée dans la page)
  var DEMO = { years: [2021, 2022, 2023, 2024, 2025], shares: 50000000, float: 24.5, revenue: [182400, 196300, 214800, 229100, 247600],
    netIncome: [21400, 24100, 26900, 29800, 32700], eps: [428, 482, 538, 596, 654], dividend: [256, 289, 323, 358, 392] };
  var DEMO_ND = { date: '2027-06-24', amount: 392, due: false, then: null, days: 218, buyBy: '2027-06-23', yield: 0.061, last: { d: '2026-06-25', a: 358, ex: 2025 }, paid5: 5 };
  var LOCK = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var memberHref = function (sym) {
    var u = window.BxMember ? window.BxMember.url(location.pathname + '#' + sym) : '../membre/';
    return u;
  };

  function locked(s, med) {
    var demo = analyse({ symbol: s.sym, name: s.fullName, sector: s.sector, close: 6400 }, DEMO);
    demo.nd = DEMO_ND;
    var inner = fullDetail(demo, med, true);
    return '<div class="fx-locked"><div class="fx-locked-blur" aria-hidden="true" inert>' + inner + '</div>' +
      '<div class="fx-locked-cta"><div class="fx-locked-card" role="region" aria-label="Contenu Premium">' +
      '<div class="pw-ico">' + LOCK + '</div>' +
      '<h4>Devenez membre Premium pour profiter des analyses</h4>' +
      '<p>Date du prochain dividende, ratios clés, comptes sur 5 ans, lecture rapide et avis de David pour ' + esc(s.fullName) + ' et toutes les sociétés de la BRVM.</p>' +
      '<div class="pw-actions"><a class="btn btn--primary" href="' + esc(memberHref(s.sym)) + '#offres">Devenir membre Premium</a>' +
      '<a class="btn btn--ghost" href="' + esc(memberHref(s.sym)) + '">Se connecter</a></div>' +
      '<small>Dès 3\u00a0000\u00a0FCFA par mois · Sans engagement</small></div></div></div>';
  }

  function detail(s, med, premium) {
    return '<div class="fx-detail">' +
      '<div class="fx-detail-head"><div><h3>' + esc(s.fullName) + ' <span class="fx-sym">' + esc(s.sym) + '</span></h3>' +
      '<p>' + esc(s.sector) + ' · ' + esc(s.country) + ' · Dernier exercice publié : ' + esc(s.year) + '</p></div>' +
      '<div class="fx-price"><small>Dernier cours</small><strong class="num">' + money(s.price) + ' F</strong></div></div>' +
      '<div class="fx-chartbox" data-chartbox><p class="fx-tip">Chargement du graphique…</p></div>' +
      (premium ? fullDetail(s, med) : locked(s, med)) + '</div>';
  }

  function fullDetail(s, med, demo) {
    var f = s.f, bank = !demo && isBank(s);
    var mPer = demo ? 12.8 : med.per[s.sector], mYield = demo ? 0.052 : med.yield[s.sector];
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
    var chips = signals(s, demo ? { per: {}, yield: {} } : med).map(function (c) { return '<span class="fx-chip ' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('');
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
    return '<div class="fx-chips" aria-label="Lecture rapide">' + chips + '</div>' +
      divBlock(s) +
      '<div class="fx-cards">' + cards + '</div>' +
      '<div class="fx-charts">' + bars(f.years, f.netIncome, 'Résultat net (millions de FCFA)', 'M FCFA') + bars(f.years, f.dividend, 'Dividende net par action (FCFA)', 'FCFA') + '</div>' +
      hist;
  }

  // ───────── Tableau principal ─────────
  var COLS = [
    ['sym', 'Société', ''], ['price', 'Cours', 'r'], ['cap', 'Capitalisation', 'r'], ['eps', 'BPA', 'r'], ['per', 'PER', 'r'],
    ['yield', 'Rendement', 'r'], ['payout', 'Distribution', 'r'], ['margin', 'Marge nette', 'r'], ['grNet', 'Bénéfice 1 an', 'r']
  ];

  function start(quotes, fund, member) {
    var items, rows, med, premium = false;
    var compute = function (fd) {
      items = fd.items || {};
      rows = (quotes.items || []).filter(function (q) { return items[q.symbol]; }).map(function (q) { return analyse(q, items[q.symbol]); });
      med = { per: {}, yield: {} };
      var sectors = {};
      rows.forEach(function (s) { (sectors[s.sector] = sectors[s.sector] || []).push(s); });
      Object.keys(sectors).forEach(function (k) {
        med.per[k] = median(sectors[k].map(function (s) { return s.per; }).filter(function (v) { return v > 0 && v < 100; }));
        med.yield[k] = median(sectors[k].map(function (s) { return s.yield; }));
      });
    };
    compute(fund);

    // Chiffres clés du marché (réservés Premium : floutés dans la version gratuite)
    var FAKE_STATS = { per: '11,8x', yield: '6,4 %', payers: '36 / 47', growth: '29 / 47' };
    var stats = function () {
      var put = function (k, v) {
        var el = root.querySelector('[data-fx-stat="' + k + '"]');
        if (!el) return;
        el.textContent = premium ? v : FAKE_STATS[k];
        el.classList.toggle('fx-blur', !premium);
        var box = el.closest('.fx-stat');
        if (box) { box.classList.toggle('is-locked', !premium); if (!premium) box.setAttribute('data-lock', ''); else box.removeAttribute('data-lock'); }
      };
      if (!premium) { ['per', 'yield', 'payers', 'growth'].forEach(function (k) { put(k, ''); }); return; }
      put('per', mult(median(rows.map(function (s) { return s.per; }).filter(function (v) { return v > 0 && v < 100; }))));
      put('yield', pctv(median(rows.map(function (s) { return s.yield; }))));
      put('payers', rows.filter(function (s) { return s.yield != null; }).length + ' / ' + rows.length);
      put('growth', rows.filter(function (s) { return s.grNet != null && s.grNet >= 0; }).length + ' / ' + rows.length);
    };
    stats();
    // Icône « i » et bulle d'explication sur les chiffres clés du marché
    var STAT_TIPS = {
      per: 'La moitié des actions de la BRVM ont un PER plus bas que ce chiffre, l’autre moitié plus haut. C’est un repère : une action dont le PER est inférieur est plutôt bon marché.',
      yield: 'Le rendement « typique » d’une action de la BRVM : la moitié rapporte plus, l’autre moitié moins. Comparez-y le rendement d’une société pour savoir s’il est élevé.',
      payers: 'Nombre de sociétés qui ont versé un dividende au titre de leur dernier exercice publié, sur l’ensemble des sociétés cotées suivies.',
      growth: 'Nombre de sociétés dont le bénéfice net a augmenté par rapport à l’exercice précédent : un thermomètre de la santé des entreprises de la cote.'
    };
    root.querySelectorAll('.fx-stat').forEach(function (box) {
      var el = box.querySelector('[data-fx-stat]'), k = el && el.getAttribute('data-fx-stat'), lbl = box.querySelector('small');
      if (!STAT_TIPS[k] || box.querySelector('.fx-i')) return;
      var id = 'fx-tip-stat-' + k, name = lbl ? lbl.textContent : '';
      box.classList.add('has-tip');
      box.insertAdjacentHTML('afterbegin', '<button type="button" class="fx-i" aria-label="Qu’est-ce que « ' + esc(name) + ' » ?" aria-describedby="' + id + '">' + INFO + '</button>' +
        '<span class="fx-bubble" role="tooltip" id="' + id + '"><b>' + esc(name) + '</b>' + esc(STAT_TIPS[k]) + '</span>');
    });
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

    var FREE = { sym: 1, price: 1, cap: 1 };
    var LOCK_S = '<svg class="fx-lockico" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
    var drawHead = function () {
      head.innerHTML = COLS.map(function (c) {
        var lock = !premium && !FREE[c[0]];
        return '<th class="' + c[2] + (lock ? ' is-locked' : '') + '" data-k="' + c[0] + '" tabindex="0" role="columnheader"' + (lock ? ' title="Réservé aux membres Premium"' : '') + '>' + (lock ? LOCK_S : '') + esc(c[1]) + '</th>';
      }).join('');
      Array.prototype.forEach.call(quick.options, function (o) { if (o.value) o.textContent = o.textContent.replace(/ 🔒$/, '') + (premium ? '' : ' 🔒'); });
    };
    drawHead();

    // Bandeau d'invitation (version gratuite)
    var promo = document.createElement('div');
    promo.className = 'fx-promo';
    promo.innerHTML = '<div class="fx-promo-ico" aria-hidden="true">' + LOCK + '</div>' +
      '<div class="fx-promo-txt"><strong>Débloquez les ratios des ' + rows.length + ' sociétés de la BRVM</strong>' +
      '<span>Date du prochain dividende, BPA, PER, rendement, taux de distribution, marge nette, croissance du bénéfice, filtres et avis de David.</span></div>' +
      '<a class="btn btn--primary fx-promo-btn" href="' + esc(memberHref('')) + '#offres">Devenir Premium · dès 3 000 F/mois</a>';
    var wrapEl = root.querySelector('.table-wrap');
    if (wrapEl) wrapEl.parentNode.insertBefore(promo, wrapEl);
    var paywall = function () { if (window.BxMember) window.BxMember.paywall('ratios'); else location.href = memberHref(''); };

    // Valeurs fictives (floutées) pour que le tableau garde son aspect : aucune vraie donnée dans la page
    var fake = function (sym) {
      var h = 0; for (var i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 9973;
      var r = function (k) { return ((h * (k + 7)) % 1000) / 1000; };
      return { eps: 80 + r(1) * 900, per: 6 + r(2) * 14, yield: 0.02 + r(3) * 0.07, payout: 0.3 + r(4) * 0.6, margin: 0.05 + r(5) * 0.25, grNet: -0.1 + r(6) * 0.3 };
    };

    var QUICK = {
      div: function (s) { return s.yield != null; },
      cheap: function (s) { return s.per != null && s.per < 12; },
      yield6: function (s) { return s.yield >= 0.06; },
      growth: function (s) { return s.grNet != null && s.grNet >= 0; },
      safe: function (s) { return s.payout != null && s.payout <= 0.8 && s.divYears >= 4; }
    };

    var cell = function (s) {
      var tone = function (v) { return v == null ? '' : v >= 0 ? 'up' : 'down'; };
      if (!premium) {
        var z = fake(s.sym), lk = function (inner, cls) { return '<td class="r num fx-locktd' + (cls ? ' ' + cls : '') + '" data-lock title="Réservé aux membres Premium"><span class="fx-blur" aria-hidden="true">' + inner + '</span></td>'; };
        return '<td><button type="button" class="fx-open" aria-expanded="' + (open === s.sym) + '"><b>' + esc(s.sym) + '</b><span>' + esc(s.name) + '</span></button></td>' +
          '<td class="r num">' + money(s.price) + '</td>' +
          '<td class="r num">' + bn(s.cap) + '</td>' +
          lk(money(z.eps)) + lk(mult(z.per)) + lk('<span class="badge num flat">' + pctv(z.yield) + '</span>') +
          lk(pctv(z.payout)) + lk(pctv(z.margin)) + lk(pctv(z.grNet, true), tone(z.grNet));
      }
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
            if (!premium) { if (window.BxMember) window.BxMember.paywall('david'); else location.href = memberHref(s.sym); return; }
            if (!window.BxDavid || !chartCtl) return;
            window.BxDavid.open({ fx: s, med: med, chartData: chartCtl.data, onLevels: chartCtl.setAnalystLevels, returnFocus: box.querySelector('.cx-ai') });
          }
        });
        if (chartCtl && autoDavid && premium) { autoDavid = false; box.querySelector('.cx-ai').click(); }
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
        if (open === s.sym) tr += '<tr class="fx-row-detail"><td colspan="' + COLS.length + '">' + detail(s, med, premium) + '</td></tr>';
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
      if (!premium && !FREE[k]) return paywall();
      desc = sortKey === k ? !desc : !(k === 'sym' || k === 'per');
      sortKey = k;
      draw();
    };
    head.addEventListener('click', function (e) { var th = e.target.closest('th'); if (th) sortBy(th.getAttribute('data-k')); });
    head.addEventListener('keydown', function (e) { var th = e.target.closest('th'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(th.getAttribute('data-k')); } });
    root.addEventListener('click', function (e) {
      if (!premium && e.target.closest('[data-lock]') && !e.target.closest('.fx-i')) { e.preventDefault(); paywall(); }
    });
    // Bulles d'explication : au toucher sur mobile, une seule ouverte à la fois
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.fx-i');
      root.querySelectorAll('.tip-open').forEach(function (c) { if (!btn || c !== btn.parentNode) c.classList.remove('tip-open'); });
      if (btn) btn.parentNode.classList.toggle('tip-open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') root.querySelectorAll('.tip-open').forEach(function (c) { c.classList.remove('tip-open'); });
    });
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
    [search, sector, country, quick].forEach(function (el) {
      el.addEventListener('input', function () {
        if (el === quick && !premium && quick.value) { quick.value = ''; paywall(); return; }
        draw();
      });
    });
    window.addEventListener('resize', function () {
      var det = body.querySelector('.fx-detail'), wrap = body.closest('.table-wrap');
      if (det && wrap) det.style.width = wrap.clientWidth + 'px';
    });

    // Lien direct vers une société : /fondamentaux/#SNTS
    var hash = decodeURIComponent((location.hash || '').slice(1)).toUpperCase();
    if (hash && items[hash]) open = hash;
    if (member && member.premium) promo.hidden = true; // les vraies données arrivent dans un instant
    if (!open && items.SNTS) open = 'SNTS'; // Sonatel ouverte par défaut pour tous, sans défilement
    draw();
    if (open && hash) { var r0 = body.querySelector('tr[data-sym="' + open + '"]'); if (r0) setTimeout(function () { r0.scrollIntoView({ block: 'start' }); }, 50); }

    // Membre Premium : les comptes détaillés sont lus dans la base protégée (refusés aux autres comptes)
    if (member && member.premium && window.BxMember) {
      var divs = getJson(base + '/dividends.json?t=' + Math.floor(Date.now() / 600000)).catch(function () { return null; });
      Promise.all([window.BxMember.data('fondamentaux'), divs]).then(function (res) {
        var full = res[0], dv = res[1] && res[1].items ? res[1].items : null;
        premium = true;
        compute(full);
        if (dv) rows.forEach(function (s) { s.nd = nextDividend(dv[s.sym], s.price); });
        promo.remove();
        drawHead();
        stats();
        draw();
      }).catch(function () { /* accès refusé ou réseau : la fiche reste verrouillée */ });
    }
  }

  // État du membre (connecté, Premium) : on ne l’attend pas plus de 4 secondes
  var member = window.BxMember
    ? Promise.race([window.BxMember.ready(), new Promise(function (ok) { setTimeout(function () { ok(null); }, 4000); })])
    : Promise.resolve(null);
  Promise.all([getJson(base + '/quotes.json?t=' + Math.floor(Date.now() / 60000)), getJson(fundUrl), member])
    .then(function (r) { start(r[0], r[1], r[2]); })
    .catch(function () {
      var body = root.querySelector('[data-fx-body]');
      if (body) body.innerHTML = '<tr><td colspan="9">Les données sont momentanément indisponibles. Réessayez dans un instant.</td></tr>';
    });
})();
