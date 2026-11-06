/* BRVMexa — « David », l'analyste virtuel.
   Moteur d'analyse qui combine l'analyse technique (tendance, momentum, risque, liquidité, supports et résistances)
   et l'analyse fondamentale (valorisation, dividende, croissance, qualité), compare la société à son secteur,
   puis rend un avis argumenté, un plan d'action chiffré et répond aux questions de l'investisseur.
   Tout est calculé dans le navigateur, à partir des données publiques affichées sur la page. */
(function () {
  'use strict';

  // ───────── Outils ─────────
  var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var tidy = function (s) { return s.replace(/[  ]/g, ' '); };
  var F = function (v) { return v == null || !isFinite(v) ? '—' : tidy(nf0.format(v)) + ' F'; };
  var P = function (v, sign) { return v == null || !isFinite(v) ? '—' : (sign && v > 0 ? '+' : '') + tidy(nf1.format(v * 100)) + ' %'; };
  var X = function (v) { return v == null || !isFinite(v) ? '—' : tidy(nf1.format(v)) + 'x'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var last = function (arr) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; };
  var at = function (arr, back) { var i = arr.length - 1 - back; return i >= 0 ? arr[i] : null; };
  var shift = function (d, days) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); };

  // ───────── 1. Analyse technique ─────────
  function technical(cd) {
    var pts = cd.pts, c = cd.closes, n = c.length, px = c[n - 1], lastD = pts[n - 1].d;
    var ma50 = last(cd.ma50), ma200 = last(cd.ma200), ma200Old = at(cd.ma200, 60);
    var perfBack = function (k) { return n > k ? px / c[n - 1 - k] - 1 : null; };
    var oneYear = pts.filter(function (p) { return p.d >= shift(lastD, -365); });
    var y = oneYear.map(function (p) { return p.c; });
    var hi52 = Math.max.apply(null, y), lo52 = Math.min.apply(null, y);
    var rets = [];
    for (var i = Math.max(1, n - 250); i < n; i++) rets.push(Math.log(c[i] / c[i - 1]));
    var mean = rets.reduce(function (s, r) { return s + r; }, 0) / (rets.length || 1);
    var vol = Math.sqrt(rets.reduce(function (s, r) { return s + Math.pow(r - mean, 2); }, 0) / (rets.length || 1)) * Math.sqrt(250);
    var peak = 0, dd = 0;
    y.forEach(function (v) { peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); });
    var recent = pts.slice(-63);
    var traded = recent.reduce(function (s, p) { return s + p.c * (p.v || 0); }, 0) / (recent.length || 1);
    var idle = recent.filter(function (p) { return !p.v; }).length / (recent.length || 1);
    var rsi = last(cd.rsi), h = cd.macd.hist, hNow = last(h), hPrev = at(h, 3);
    var crossUp = false, crossDown = false;
    for (var k = Math.max(1, n - 30); k < n; k++) {
      var a0 = cd.ma50[k - 1], b0 = cd.ma200[k - 1], a1 = cd.ma50[k], b1 = cd.ma200[k];
      if (a0 != null && b0 != null && a1 != null && b1 != null) { if (a0 <= b0 && a1 > b1) crossUp = true; if (a0 >= b0 && a1 < b1) crossDown = true; }
    }
    var t = {
      price: px, date: lastD, ma50: ma50, ma200: ma200, slope200: ma200 && ma200Old ? ma200 / ma200Old - 1 : null,
      p1m: perfBack(21), p3m: perfBack(63), p6m: perfBack(126), p1y: oneYear.length > 200 ? px / y[0] - 1 : null,
      hi52: hi52, lo52: lo52, fromHi: px / hi52 - 1, fromLo: px / lo52 - 1, vol: vol, dd: dd,
      rsi: rsi, macdUp: hNow != null ? hNow > 0 : null, macdTurn: hNow != null && hPrev != null ? (hNow > 0 && hPrev <= 0 ? 'up' : hNow < 0 && hPrev >= 0 ? 'down' : null) : null,
      crossUp: crossUp, crossDown: crossDown, traded: traded, idle: idle,
      sup: cd.levels.supports, res: cd.levels.resistances, sessions: n
    };
    // Tendance
    var tr = 50;
    if (ma200 != null) { tr += px > ma200 ? 15 : -15; }
    if (ma50 != null && ma200 != null) tr += ma50 > ma200 ? 10 : -10;
    if (t.slope200 != null) tr += t.slope200 > 0.02 ? 10 : t.slope200 < -0.02 ? -10 : 0;
    if (ma50 != null) tr += px > ma50 ? 5 : -5;
    if (crossUp) tr += 8; if (crossDown) tr -= 8;
    // Momentum
    var mo = 50;
    if (rsi != null) mo += rsi > 75 ? -18 : rsi > 70 ? -12 : rsi >= 45 ? 6 : rsi >= 30 ? 10 : 4;
    if (t.macdUp != null) mo += t.macdUp ? 10 : -10;
    if (t.macdTurn === 'up') mo += 6; if (t.macdTurn === 'down') mo -= 6;
    if (t.p3m != null) mo += t.p3m > 0.1 ? 6 : t.p3m < -0.1 ? -6 : 0;
    var risk = 0;
    if (vol > 0.45) risk -= 10; else if (vol > 0.3) risk -= 4;
    if (t.fromHi > -0.03 && rsi > 70) risk -= 5;
    t.trend = clamp(tr, 0, 100); t.momentum = clamp(mo, 0, 100);
    t.score = clamp(Math.round(0.6 * t.trend + 0.4 * t.momentum + risk), 0, 100);
    t.liq = traded < 2e6 || idle > 0.35 ? 'faible' : traded < 20e6 ? 'moyenne' : 'bonne';
    return t;
  }

  // ───────── 2. Analyse fondamentale ─────────
  function fundamental(fx, med) {
    var bank = /financ/i.test(fx.sector || '');
    var mPer = med.per[fx.sector], mYield = med.yield[fx.sector];
    var f = fx.f, losses = f.netIncome.filter(function (v) { return v != null && v < 0; }).length;
    var val = fx.loss ? 15 : fx.per == null ? 35 : fx.per < 8 ? 85 : fx.per < 10 ? 78 : fx.per < 12 ? 70 : fx.per < 15 ? 60 : fx.per < 18 ? 50 : fx.per < 25 ? 35 : 20;
    if (fx.per != null && mPer) val += fx.per / mPer < 0.85 ? 8 : fx.per / mPer > 1.2 ? -8 : 0;
    var y = fx.yield;
    var dv = y == null ? 25 : y >= 0.08 ? 90 : y >= 0.06 ? 80 : y >= 0.04 ? 65 : y >= 0.02 ? 50 : 40;
    if (fx.payout != null && fx.payout > 1) dv -= 25; else if (fx.payout != null && fx.payout > 0.9) dv -= 10;
    dv += fx.divYears >= 5 ? 8 : fx.divYears <= 2 ? -8 : 0;
    var g = fx.grNet;
    var gr = g == null ? (fx.loss ? 20 : 40) : g > 0.2 ? 85 : g > 0.05 ? 70 : g > -0.05 ? 55 : g > -0.2 ? 40 : 25;
    if (fx.cagr != null) gr += fx.cagr > 0.1 ? 8 : fx.cagr < 0 ? -8 : 0;
    if (fx.grRev != null) gr += fx.grRev > 0 ? 4 : -4;
    var m = fx.margin;
    var q = m == null ? 40 : bank ? (m > 0.35 ? 85 : m > 0.25 ? 70 : m > 0.15 ? 55 : m > 0 ? 40 : 15) : (m > 0.15 ? 85 : m > 0.08 ? 70 : m > 0.03 ? 55 : m > 0 ? 40 : 15);
    q -= losses * 10;
    var r = {
      bank: bank, mPer: mPer, mYield: mYield, losses: losses,
      valuation: clamp(val, 0, 100), dividend: clamp(dv, 0, 100), growth: clamp(gr, 0, 100), quality: clamp(q, 0, 100)
    };
    r.score = Math.round(0.3 * r.valuation + 0.25 * r.dividend + 0.25 * r.growth + 0.2 * r.quality);
    if (fx.year && fx.year < 2024) r.score -= 10; // comptes anciens
    r.score = clamp(r.score, 0, 100);
    // Juste valeur indicative : bénéfice × PER du secteur, et dividende ÷ rendement du secteur
    var fv = [];
    if (fx.eps > 0 && mPer) fv.push(fx.eps * mPer);
    if (fx.div > 0 && mYield) fv.push(fx.div / mYield);
    r.fair = fv.length ? fv.reduce(function (s, v) { return s + v; }, 0) / fv.length : null;
    r.upside = r.fair ? r.fair / fx.price - 1 : null;
    return r;
  }

  // ───────── 3. Verdict et plan d'action ─────────
  var VERDICTS = [
    [72, 'Achat', 'up', 'Les signaux techniques et fondamentaux sont alignés en faveur de l’action.'],
    [62, 'Achat progressif', 'up', 'Le dossier est solide, mais mieux vaut entrer en plusieurs fois.'],
    [50, 'Conserver / surveiller', 'flat', 'Le dossier est équilibré : pas d’urgence à acheter, pas de raison de vendre.'],
    [38, 'Prudence', 'warn', 'Plusieurs signaux invitent à la patience avant d’investir.'],
    [0, 'Éviter pour le moment', 'down', 'Les fragilités l’emportent : il vaut mieux attendre une amélioration.']
  ];
  function decide(t, fu, fx) {
    var score = Math.round(0.6 * fu.score + 0.4 * t.score);
    var caps = [];
    if (fx.loss) { score = Math.min(score, 45); caps.push('dernier exercice en perte'); }
    if (fx.payout > 1.2 && score > 61) { score = 61; caps.push('dividende supérieur au bénéfice'); }
    if (t.liq === 'faible' && score > 71) { score = 71; caps.push('titre peu échangé'); }
    var v = VERDICTS.filter(function (x) { return score >= x[0]; })[0];
    var conf = 0;
    if (t.sessions >= 250) conf++; if (t.sessions >= 750) conf++;
    if (fx.f.netIncome.filter(function (x) { return x != null; }).length >= 4) conf++;
    if (fx.year >= 2025) conf++; if (t.liq !== 'faible') conf++;
    return { score: score, label: v[1], tone: v[2], line: v[3], caps: caps, confidence: conf >= 4 ? 'élevée' : conf >= 3 ? 'moyenne' : 'faible' };
  }
  function plan(t, fu, fx, d) {
    var px = t.price, s1 = t.sup[0] && t.sup[0].p, r1 = t.res[0] && t.res[0].p;
    var nearSup = s1 && px / s1 - 1 < 0.05;
    var entryLo = s1 && s1 > px * 0.85 ? s1 : px * 0.95, entryHi = px;
    // Stop : juste sous le support s'il est proche, sinon 10 % sous le cours ; toujours entre -5 % et -20 %
    var stop = s1 && s1 > px * 0.8 ? s1 * 0.95 : px * 0.9;
    stop = clamp(stop, px * 0.8, px * 0.95);
    var targets = [];
    var t1 = r1 && r1 > px * 1.03 ? r1 : px * 1.1;
    targets.push(t1);
    var t2 = Math.min(Math.max(fu.fair || 0, t.hi52 || 0), px * 1.5); // objectif lointain plafonné à +50 %
    if (t2 > t1 * 1.03) targets.push(t2);
    // Dossier fragile : pas d'achat, mais un seuil à surveiller pour reconsidérer (résistance ou moyenne 200 jours)
    var watch = d.score < 50;
    var reprise = Math.max(r1 && r1 > px * 1.01 ? r1 : 0, t.ma200 && t.ma200 > px ? t.ma200 : 0) || px * 1.1;
    var rr = (t1 - px) / (px - stop);
    var size = fx.loss ? 3 : t.liq === 'faible' ? 5 : t.vol > 0.35 ? 5 : d.score >= 62 ? 10 : 7;
    var steps = d.score >= 72 && t.trend >= 60 ? 2 : 3;
    return { watch: watch, reprise: reprise, entryLo: entryLo, entryHi: entryHi, nearSup: nearSup, stop: stop, targets: targets, rr: rr, size: size, steps: steps,
      horizon: fx.yield >= 0.05 ? 'long terme (3 à 5 ans), pour encaisser les dividendes' : 'moyen à long terme (2 à 5 ans)' };
  }

  // ───────── 4. Textes ─────────
  function bullets(t, fu, fx) {
    var tech = [], fund = [], pros = [], cons = [];
    var px = t.price;
    if (t.ma200 != null) {
      var above = px > t.ma200;
      tech.push('Le cours (' + F(px) + ') est ' + (above ? 'au-dessus' : 'en dessous') + ' de sa moyenne mobile 200 jours (' + F(t.ma200) + ') : tendance de fond ' + (above ? 'haussière' : 'baissière') + '.');
      (above ? pros : cons).push('Tendance de fond ' + (above ? 'haussière' : 'baissière') + ' (cours ' + (above ? 'au-dessus de' : 'sous') + ' la moyenne 200 jours)');
    }
    if (t.ma50 != null && t.ma200 != null) tech.push('Moyenne 50 jours ' + (t.ma50 > t.ma200 ? 'au-dessus' : 'en dessous') + ' de la moyenne 200 jours' + (t.crossUp ? ' — croisement haussier récent (« golden cross »)' : t.crossDown ? ' — croisement baissier récent (« death cross »)' : '') + '.');
    if (t.crossUp) pros.push('Croisement haussier récent des moyennes 50 et 200 jours');
    if (t.crossDown) cons.push('Croisement baissier récent des moyennes 50 et 200 jours');
    if (t.rsi != null) {
      var r = Math.round(t.rsi);
      tech.push('RSI à ' + r + ' : ' + (r > 70 ? 'zone de surachat, le titre a beaucoup monté et pourrait souffler.' : r < 30 ? 'zone de survente, un rebond est possible mais la faiblesse est réelle.' : r >= 50 ? 'dynamique positive sans excès.' : 'dynamique hésitante.'));
      if (r > 70) cons.push('RSI en surachat (' + r + ') : risque de repli à court terme');
      if (r < 30) pros.push('RSI en survente (' + r + ') : point d’entrée potentiel');
    }
    if (t.macdUp != null) tech.push('MACD ' + (t.macdUp ? 'positif' : 'négatif') + (t.macdTurn === 'up' ? ', il vient de repasser au-dessus de son signal (signal d’achat).' : t.macdTurn === 'down' ? ', il vient de passer sous son signal (signal de vente).' : '.'));
    tech.push('Performances : ' + P(t.p1m, true) + ' sur 1 mois, ' + P(t.p3m, true) + ' sur 3 mois' + (t.p1y != null ? ', ' + P(t.p1y, true) + ' sur 1 an.' : '.'));
    tech.push('Le cours est à ' + P(t.fromHi) + ' de son plus haut sur 52 semaines (' + F(t.hi52) + ') et à ' + P(t.fromLo, true) + ' de son plus bas (' + F(t.lo52) + ').');
    if (t.sup.length || t.res.length) tech.push((t.sup.length ? 'Support principal vers ' + F(t.sup[0].p) : 'Pas de support proche identifié') + (t.res.length ? ', résistance vers ' + F(t.res[0].p) + '.' : ', aucune résistance proche : le titre évolue près de ses sommets.'));
    tech.push('Volatilité annuelle de ' + P(t.vol) + ' (' + (t.vol > 0.35 ? 'élevée' : t.vol > 0.2 ? 'moyenne' : 'faible') + '), baisse maximale sur un an de ' + P(t.dd) + '. Liquidité ' + t.liq + ' : environ ' + F(t.traded) + ' échangés par séance.');
    if (t.liq === 'faible') cons.push('Titre peu échangé : acheter ou revendre peut prendre du temps');
    if (t.vol > 0.35) cons.push('Volatilité élevée (' + P(t.vol) + ' par an)');

    var yr = fx.year;
    if (fx.loss) { fund.push('La société a été en perte sur l’exercice ' + yr + ' : le PER n’est pas significatif.'); cons.push('Exercice ' + yr + ' en perte'); }
    else if (fx.per != null) {
      fund.push('PER de ' + X(fx.per) + (fu.mPer ? ' contre ' + X(fu.mPer) + ' pour la médiane de son secteur' : '') + ' : valorisation ' + (fx.per < 10 ? 'basse' : fx.per <= 18 ? 'modérée' : 'élevée') + '.');
      if (fu.mPer && fx.per < fu.mPer * 0.85) pros.push('Moins chère que son secteur (PER ' + X(fx.per) + ' contre ' + X(fu.mPer) + ')');
      if (fx.per > 20) cons.push('Valorisation exigeante (PER ' + X(fx.per) + ')');
    }
    if (fx.yield != null) {
      fund.push('Rendement net de ' + P(fx.yield) + (fu.mYield ? ' (secteur : ' + P(fu.mYield) + ')' : '') + ', avec un taux de distribution de ' + P(fx.payout) + ' du bénéfice. Dividende versé ' + fx.divYears + ' années sur ' + fx.years + '.');
      if (fx.yield >= 0.06) pros.push('Rendement du dividende élevé (' + P(fx.yield) + ')');
      if (fx.payout > 1) cons.push('Le dividende dépasse le bénéfice (' + P(fx.payout) + ') : il pourrait baisser');
      if (fx.divYears >= 5) pros.push('Dividende versé chaque année depuis 5 ans');
    } else { fund.push('Pas de dividende versé au titre du dernier exercice.'); cons.push('Pas de dividende sur le dernier exercice'); }
    if (fx.grNet != null) {
      fund.push('Bénéfice ' + (fx.grNet >= 0 ? 'en hausse' : 'en baisse') + ' de ' + P(Math.abs(fx.grNet)) + ' sur un an' + (fx.cagr != null ? ', soit ' + P(fx.cagr, true) + ' par an en moyenne sur ' + fx.cagrSpan + ' ans.' : '.'));
      if (fx.grNet > 0.1) pros.push('Bénéfice en forte progression (' + P(fx.grNet, true) + ')');
      if (fx.grNet < -0.1) cons.push('Bénéfice en recul (' + P(fx.grNet, true) + ')');
    }
    if (fx.margin != null) fund.push('Marge nette de ' + P(fx.margin) + (fu.bank ? ' du produit net bancaire' : ' du chiffre d’affaires') + (fx.grRev != null ? ', avec une activité ' + (fx.grRev >= 0 ? 'en croissance' : 'en recul') + ' de ' + P(Math.abs(fx.grRev)) + ' sur un an.' : '.'));
    if (fu.losses) cons.push(fu.losses + ' exercice' + (fu.losses > 1 ? 's' : '') + ' en perte sur les 5 derniers');
    if (fu.fair) fund.push('Juste valeur indicative (méthode des multiples du secteur) : environ ' + F(fu.fair) + ', soit ' + P(fu.upside, true) + ' par rapport au cours actuel.');
    if (fu.upside > 0.15) pros.push('Décote de ' + P(fu.upside) + ' par rapport à sa juste valeur indicative');
    if (fu.upside < -0.15) cons.push('Cours supérieur de ' + P(-fu.upside) + ' à sa juste valeur indicative');
    if (yr && yr < 2025) cons.push('Comptes ' + yr + ' : les résultats récents ne sont pas encore publiés');
    return { tech: tech, fund: fund, pros: pros.slice(0, 5), cons: cons.slice(0, 5) };
  }

  function gauge(score, tone) {
    var a = Math.PI * (1 - score / 100), x = 60 + 46 * Math.cos(a), y = 60 - 46 * Math.sin(a);
    return '<svg viewBox="0 0 120 70" class="dv-gauge" aria-hidden="true"><path d="M14 60a46 46 0 0 1 92 0" class="g-track"/>' +
      '<path d="M14 60a46 46 0 0 1 ' + (x - 14).toFixed(1) + ' ' + (y - 60).toFixed(1) + '" class="g-val ' + tone + '"/>' +
      '<text x="60" y="58" text-anchor="middle" class="g-num">' + score + '</text><text x="60" y="68" text-anchor="middle" class="g-lbl">/ 100</text></svg>';
  }
  var bar = function (label, v) { return '<div class="dv-bar"><span>' + label + '</span><i><b style="width:' + v + '%"></b></i><em>' + v + '</em></div>'; };

  // ───────── 5. Questions de l'investisseur ─────────
  var QUESTIONS = [
    ['why', 'Pourquoi ce verdict ?'], ['when', 'Quand acheter ?'], ['risk', 'Quels sont les risques ?'], ['size', 'Combien investir ?'],
    ['div', 'Et le dividende ?'], ['value', 'Quel est le juste prix ?'], ['sector', 'Face à son secteur ?'], ['sell', 'J’en ai déjà : je vends ?']
  ];
  var KEYWORDS = {
    why: /pourquoi|verdict|avis|conseil|achet|faut.il|bon investissement|int[ée]ressant/i, when: /quand|moment|entr(ée|er)|timing|niveau|prix d.achat/i,
    risk: /risqu|danger|stop|perte|baiss/i, size: /combien|montant|budget|part|portefeuille|somme/i,
    div: /divid|rendement|coupon|revenu/i, value: /juste|valeur|cher|prix|objectif|cible|potentiel/i,
    sector: /secteur|concurr|compar|autres/i, sell: /vend|sortir|garder|conserver|déjà/i, tech: /techni|tendance|rsi|macd|moyenne|graph/i
  };
  function answer(kind, A) {
    var t = A.t, fu = A.fu, fx = A.fx, d = A.d, p = A.p, b = A.b;
    switch (kind) {
      case 'why':
        return 'Mon score global est de <b>' + d.score + '/100</b> : ' + fu.score + '/100 pour les fondamentaux (60 % du poids) et ' + t.score + '/100 pour la technique (40 %). ' +
          (b.pros.length ? 'Ce qui pèse en faveur : ' + b.pros.slice(0, 3).map(esc).join(' ; ') + '. ' : '') +
          (b.cons.length ? 'Ce qui me retient : ' + b.cons.slice(0, 3).map(esc).join(' ; ') + '.' : '') +
          (d.caps.length ? ' J’ai plafonné l’avis en raison de : ' + d.caps.join(', ') + '.' : '');
      case 'when':
        if (p.watch) return 'Pas maintenant : mon avis est « ' + esc(d.label) + ' ». Attendez une clôture au-dessus de ' + F(p.reprise) + (fx.loss ? ' et le retour aux bénéfices' : '') + ' avant d’envisager un achat, puis entrez progressivement.';
        return (p.nearSup ? 'Le cours est proche de son support : la zone actuelle est intéressante. ' : 'Idéalement, attendez un repli vers la zone ' + F(p.entryLo) + ' – ' + F(p.entryHi) + '. ') +
          'Entrez en ' + p.steps + ' fois, espacées de quelques semaines, pour lisser votre prix d’achat. ' +
          (t.rsi > 70 ? 'Le RSI est en surachat : patience, un repli est probable. ' : '') +
          (t.macdTurn === 'up' ? 'Le MACD vient de donner un signal d’achat, ce qui conforte une entrée. ' : '') +
          'Si le cours clôture sous ' + F(p.stop) + ', le scénario est invalidé.';
      case 'risk':
        return 'Principaux risques : ' + (b.cons.length ? b.cons.map(esc).join(' ; ') : 'peu de signaux négatifs identifiés') + '. ' +
          'Sur un an, la plus forte baisse a été de ' + P(t.dd) + ' et la volatilité est de ' + P(t.vol) + ' par an. ' +
          'Pour limiter le risque, un seuil de sortie indicatif se situe vers ' + F(p.stop) + ' (' + P(p.stop / t.price - 1) + ').';
      case 'size':
        if (p.watch) return 'Pour l’instant, je ne conseille pas d’investir sur cette action. Si vous en détenez déjà, gardez-la sous ' + p.size + ' % de votre portefeuille et privilégiez des sociétés mieux notées.';
        return 'Je suggère de ne pas dépasser <b>' + p.size + ' %</b> de votre portefeuille sur cette action' + (t.liq === 'faible' ? ', car le titre est peu échangé' : t.vol > 0.35 ? ', car le titre est volatil' : '') + '. ' +
          'Par exemple, avec un portefeuille de 1 000 000 FCFA : environ ' + F(p.size * 10000) + ', soit ' + Math.max(1, Math.floor(p.size * 10000 / t.price)) + ' action(s) au cours actuel, achetées en ' + p.steps + ' fois. ' +
          'Gardez toujours une épargne de précaution hors bourse.';
      case 'div':
        return fx.yield != null
          ? 'Dividende net de ' + F(fx.div) + ' par action au titre de ' + fx.year + ', soit un rendement de <b>' + P(fx.yield) + '</b> au cours actuel' + (fu.mYield ? ' (secteur : ' + P(fu.mYield) + ')' : '') + '. ' +
            'La société distribue ' + P(fx.payout) + ' de son bénéfice' + (fx.payout > 1 ? ' : c’est plus qu’elle ne gagne, une baisse du dividende est possible.' : fx.payout > 0.85 ? ' : peu de marge de sécurité.' : ' : le dividende est bien couvert.') +
            ' Il a été versé ' + fx.divYears + ' années sur ' + fx.years + '.'
          : 'La société n’a pas versé de dividende au titre de son dernier exercice publié. Ce titre convient mieux à un objectif de plus-value qu’à un objectif de revenus.';
      case 'value':
        return fu.fair
          ? 'En appliquant à ' + esc(A.name) + ' les multiples médians de son secteur, j’estime une juste valeur indicative autour de <b>' + F(fu.fair) + '</b>, soit ' + P(fu.upside, true) + ' par rapport au cours actuel. ' +
            'Mes objectifs de cours : ' + p.targets.map(F).join(' puis ') + '. C’est une estimation, pas une certitude : elle suppose que les bénéfices se maintiennent.'
          : 'Je ne peux pas estimer de juste valeur fiable : la société n’a ni bénéfice ni dividende exploitables sur le dernier exercice.';
      case 'sector':
        return 'Face à la médiane du secteur « ' + esc(fx.sector) + ' » : PER de ' + (fx.loss ? 'n.s. (perte)' : X(fx.per)) + ' contre ' + X(fu.mPer) + ', rendement de ' + P(fx.yield) + ' contre ' + P(fu.mYield) + '. ' +
          (fx.per != null && fu.mPer ? (fx.per < fu.mPer ? 'L’action est moins chère que ses concurrentes. ' : 'L’action est plus chère que ses concurrentes, ce qui doit se justifier par une meilleure croissance. ') : '') +
          'Utilisez le filtre « secteur » du tableau pour comparer les sociétés une à une.';
      case 'sell':
        return d.score >= 50
          ? 'Si vous détenez déjà l’action, mon avis est de <b>conserver</b>' + (d.score >= 62 ? ', voire de renforcer progressivement' : '') + '. Envisagez d’alléger seulement si le cours clôture sous ' + F(p.stop) + ' ou si le prochain exercice montre une chute nette des bénéfices.'
          : 'Si vous détenez déjà l’action, je recommande la <b>vigilance</b> : n’en rachetez pas pour l’instant, et envisagez d’alléger si le cours clôture sous ' + F(p.stop) + '. Revoyez votre position après la publication des prochains résultats.';
      case 'tech':
        return b.tech.slice(0, 4).map(esc).join(' ');
      default:
        return 'Je peux vous répondre sur : le verdict, le bon moment pour acheter, les risques, le montant à investir, le dividende, le juste prix, la comparaison avec le secteur, ou la décision de vendre. Choisissez une question ci-dessous.';
    }
  }
  /** Une question peut en contenir plusieurs (« quand acheter et combien investir ? ») */
  var ORDER = ['when', 'size', 'risk', 'div', 'value', 'sector', 'sell', 'tech', 'why'];
  function intents(text) {
    var found = ORDER.filter(function (k) { return KEYWORDS[k].test(text); });
    return found.length ? found.slice(0, 3) : ['help'];
  }

  // ───────── 6. Interface ─────────
  var panel = null;
  function open(ctx) {
    var t = technical(ctx.chartData), fu = fundamental(ctx.fx, ctx.med), d = decide(t, fu, ctx.fx), p = plan(t, fu, ctx.fx, d), b = bullets(t, fu, ctx.fx);
    var A = { t: t, fu: fu, fx: ctx.fx, d: d, p: p, b: b, name: ctx.fx.fullName || ctx.fx.name };
    if (ctx.onLevels) ctx.onLevels(p.watch
      ? [{ p: p.reprise, color: '#F2B33D', title: 'Seuil de reprise' }].concat(t.sup[0] ? [{ p: t.sup[0].p, color: '#F0526B', title: 'Support à tenir' }] : [])
      : [{ p: p.entryLo, color: '#4C9BFF', title: 'Zone d’achat' }, { p: p.stop, color: '#F0526B', title: 'Stop indicatif' }]
        .concat(p.targets.map(function (v, i) { return { p: v, color: '#16C47F', title: 'Objectif ' + (i + 1) }; })));

    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.className = 'dv';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Analyse de ' + A.name + ' par David');
    panel.innerHTML =
      '<div class="dv-backdrop" data-close></div>' +
      '<aside class="dv-panel">' +
        '<header class="dv-head"><div class="dv-avatar" aria-hidden="true">D</div><div><strong>David</strong><span>Analyste virtuel BRVMexa · ' + esc(ctx.fx.sym) + '</span></div>' +
        '<button type="button" class="dv-x" data-close aria-label="Fermer">×</button></header>' +
        '<div class="dv-body" data-body></div>' +
        '<form class="dv-ask" data-ask><label class="screen-reader-text" for="dv-q">Votre question</label><input id="dv-q" type="text" maxlength="200" autocomplete="off" placeholder="Posez une question à David…"><button type="submit" aria-label="Envoyer">➤</button></form>' +
      '</aside>';
    document.body.appendChild(panel);
    document.documentElement.classList.add('dv-open');
    var body = panel.querySelector('[data-body]');
    var close = function () { panel.remove(); panel = null; document.documentElement.classList.remove('dv-open'); document.removeEventListener('keydown', onKey); if (ctx.returnFocus) ctx.returnFocus.focus(); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    panel.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });

    var msg = function (html, who) {
      var el = document.createElement('div');
      el.className = 'dv-msg ' + (who || 'bot');
      el.innerHTML = html;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return el;
    };
    var steps = ['Lecture de ' + t.sessions + ' séances de cotation…', 'Calcul des moyennes mobiles, du RSI et du MACD…', 'Recherche des supports et résistances…',
      'Analyse des comptes ' + (ctx.fx.f.years[0] || '') + '–' + (ctx.fx.year || '') + '…', 'Comparaison avec le secteur ' + ctx.fx.sector + '…'];
    var thinking = msg('<div class="dv-think"><span></span><span></span><span></span></div><p class="dv-step"></p>');
    var stepEl = thinking.querySelector('.dv-step');
    var i = 0;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tick = setInterval(function () {
      if (i < steps.length) { stepEl.textContent = steps[i++]; return; }
      clearInterval(tick); thinking.remove(); report();
    }, reduced ? 1 : 420);

    function report() {
      msg('<div class="dv-verdict ' + d.tone + '">' + gauge(d.score, d.tone) +
        '<div><small>Avis de David</small><strong>' + esc(d.label) + '</strong><p>' + esc(d.line) + '</p>' +
        '<span class="dv-conf">Confiance : ' + d.confidence + ' · Horizon : ' + esc(p.horizon) + '</span></div></div>' +
        '<div class="dv-bars">' + bar('Fondamentaux', fu.score) + bar('Technique', t.score) + bar('Valorisation', fu.valuation) + bar('Dividende', fu.dividend) + bar('Croissance', fu.growth) + bar('Tendance', t.trend) + '</div>');
      msg('<h4>En bref</h4><p>' + esc(A.name) + ' cote ' + F(t.price) + '. ' +
        (ctx.fx.loss ? 'La société a perdu de l’argent sur son dernier exercice. ' : ctx.fx.per != null ? 'Elle se paie ' + X(ctx.fx.per) + ' ses bénéfices' + (fu.mPer ? ' (secteur : ' + X(fu.mPer) + ')' : '') + '. ' : '') +
        (ctx.fx.yield != null ? 'Son dividende rapporte ' + P(ctx.fx.yield) + ' par an. ' : 'Elle ne verse pas de dividende actuellement. ') +
        'La tendance de fond est ' + (t.ma200 != null ? (t.price > t.ma200 ? 'haussière' : 'baissière') : 'difficile à établir') + ' et le titre a fait ' + P(t.p1y != null ? t.p1y : t.p6m, true) + (t.p1y != null ? ' sur un an.' : ' sur six mois.') + '</p>');
      var list = function (title, arr, cls) { return arr.length ? '<div class="dv-list ' + cls + '"><h4>' + title + '</h4><ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : ''; };
      msg('<div class="dv-pc">' + list('Points forts', b.pros, 'pro') + list('Points de vigilance', b.cons, 'con') + '</div>');
      msg('<h4>Analyse technique</h4><ul>' + b.tech.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>');
      msg('<h4>Analyse fondamentale</h4><ul>' + b.fund.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>');
      if (p.watch) msg('<h4>Mon plan d’action</h4><p>Je ne recommande pas d’acheter pour le moment. Je reconsidérerai le dossier si le cours clôture durablement au-dessus de <b>' + F(p.reprise) + '</b>' +
        (ctx.fx.loss ? ' et si la société renoue avec les bénéfices' : '') + (t.sup[0] ? ', tandis qu’une cassure du support à ' + F(t.sup[0].p) + ' affaiblirait encore le titre.' : '.') +
        ' Si vous détenez déjà l’action, ne la renforcez pas et limitez-la à ' + p.size + ' % de votre portefeuille.</p><p class="dv-note">Ces niveaux sont tracés sur le graphique.</p>');
      else msg('<h4>Mon plan d’action</h4><div class="dv-plan">' +
        '<div><small>Zone d’achat</small><b>' + F(p.entryLo) + ' – ' + F(p.entryHi) + '</b></div>' +
        '<div><small>Stop indicatif</small><b class="down">' + F(p.stop) + '</b></div>' +
        p.targets.map(function (v, k) { return '<div><small>Objectif ' + (k + 1) + '</small><b class="up">' + F(v) + ' <em>' + P(v / t.price - 1, true) + '</em></b></div>'; }).join('') +
        '<div><small>Gain / risque</small><b>' + (p.rr > 0 ? tidy(nf1.format(p.rr)) + ' pour 1' : '—') + '</b></div>' +
        '<div><small>Part du portefeuille</small><b>' + p.size + ' % max.</b></div></div>' +
        '<p class="dv-note">Ces niveaux sont tracés sur le graphique. Entrez en ' + p.steps + ' fois plutôt qu’en une seule.</p>');
      msg('<p>Avez-vous une question sur ' + esc(A.name) + ' ?</p><div class="dv-chips">' +
        QUESTIONS.map(function (q) { return '<button type="button" data-q="' + q[0] + '">' + esc(q[1]) + '</button>'; }).join('') + '</div>');
      msg('<p class="dv-legal">David est un outil pédagogique automatique. Son avis ne constitue pas un conseil en investissement personnalisé : il ne connaît ni votre situation, ni vos objectifs. Vérifiez les informations et, si besoin, consultez votre SGI avant toute décision.</p>');
      body.scrollTop = 0;
    }
    var ask = function (kinds, label) {
      msg(esc(label), 'me');
      var th = msg('<div class="dv-think"><span></span><span></span><span></span></div>');
      setTimeout(function () { th.remove(); msg(kinds.map(function (k) { return '<p>' + answer(k, A) + '</p>'; }).join('<br>')); }, reduced ? 1 : 550);
    };
    body.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]');
      if (q) ask([q.getAttribute('data-q')], q.textContent);
    });
    panel.querySelector('[data-ask]').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = panel.querySelector('#dv-q'), v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      ask(intents(v), v);
    });
    setTimeout(function () { var x = panel && panel.querySelector('.dv-x'); if (x) x.focus(); }, 30);
    return A;
  }

  window.BxDavid = { open: open, technical: technical, fundamental: fundamental, decide: decide, plan: plan, answer: answer, intents: intents };
})();
