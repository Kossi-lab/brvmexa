/* BRVMexa — visites guidées avec Alice, la guide du site.
   • Accueil : tour des rubriques.   • Analyse : comment lire et analyser une action, pas à pas.
   S'ouvre à chaque nouvelle visite (une fois par session de navigation), sauf si le visiteur coche
   « Ne plus afficher ». Toujours disponible avec le lien « Visite guidée du site » (?visite=1).
   Projecteur animé, bulle d'Alice, texte animé, clavier (← → Échap), accessible. */
(function () {
  'use strict';
  var HOME = !!document.querySelector('.hx');
  var ANALYSE = !!document.querySelector('[data-fx]');
  if (!HOME && !ANALYSE) return;
  var ID = HOME ? 'accueil' : 'analyse';
  var ALICE = '👩🏾‍💼';

  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  var OFF = 'bx-visite-off-' + ID, SEEN = 'bx-visite-vue-' + ID;
  var forced = /[?&]visite=1/.test(location.search);
  var bot = /bot|crawl|spider|lighthouse|headless/i.test(navigator.userAgent);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var q = function (s) { return document.querySelector(s); };
  var visible = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  var mobile = function () { return visible(q('[data-bx-menu]')); };
  var navLink = function (href) { return q('.main-nav a[href$="' + href + '"]'); };
  var desk = function (fn) { return function () { return mobile() ? null : fn(); }; };

  // ─────────────── Les visites ───────────────
  var TOURS = {
    accueil: [
      { kind: 'intro', title: 'Bonjour, je suis Alice',
        text: 'Je suis votre guide sur BRVMexa. En une minute, je vous montre où trouver les cours de la BRVM, les analyses, l’actualité et le magazine.' },
      { sel: function () { return mobile() ? q('[data-bx-menu]') : q('.main-nav ul'); }, title: 'Le menu',
        text: function () { return mobile() ? 'Touchez ce bouton pour ouvrir le menu : <b>Marchés</b>, <b>Analyse</b>, <b>Application</b>, <b>Actualités</b>, <b>Le Mag</b> et <b>Le livre</b>.' : 'Toutes les rubriques sont ici. Je vous présente les plus utiles.'; } },
      { sel: desk(function () { return navLink('marches/'); }), title: 'Marchés', icon: '📈',
        text: 'Les cours de la BRVM en direct : les <b>48 sociétés cotées</b>, les indices <b>BRVM Composite</b>, <b>BRVM 30</b> et <b>Prestige</b>, les plus fortes hausses et baisses de la séance.' },
      { sel: desk(function () { return navLink('fondamentaux/'); }), title: 'Analyse', icon: '🔍',
        text: 'La fiche de chaque société : bénéfices, dividendes, ratios sur 5 ans, graphique technique et l’avis de <b>David</b>, notre analyste. Je vous y ferai aussi une visite détaillée.' },
      { sel: desk(function () { return navLink('actualites/'); }), title: 'Actualités', icon: '📰',
        text: 'Chaque jour, les nouvelles de la BRVM rédigées par BRVMexa, et un article <b>« À la une »</b> détaillé.' },
      { sel: desk(function () { return navLink('le-mag/'); }), title: 'Le Mag', icon: '📖',
        text: 'Le magazine mensuel BRVMexa : le bilan du mois et la valeur à suivre. <b>Gratuit</b>, en PDF.' },
      { sel: function () { return q('#marche [data-bx-indices]') || q('#marche .market'); }, title: 'La BRVM, en ce moment', icon: '⚡',
        text: 'Ici même, sur l’accueil : les indices et les valeurs du jour, mis à jour automatiquement pendant la séance.' },
      { sel: function () { return q('#premium h2') || q('#premium'); }, title: 'Premium : demandez à David', icon: '⭐',
        text: 'Avec Premium, David analyse n’importe quelle action et vous dit <b>quoi acheter, à quel prix et quand</b>. Sur le site comme dans l’application.' },
      { sel: function () { return q('[data-bx-member]'); }, title: 'Votre Espace membre', icon: '👤',
        text: 'Un seul compte gratuit pour le site et l’application, avec Google ou avec votre e-mail. Vos alertes et votre abonnement vous suivent partout.' },
      { sel: function () { return q('.header-cta a[href$="#telecharger"]'); }, title: 'L’application mobile', icon: '📲',
        text: 'La BRVM dans votre poche : alertes de prix, simulateur avec <b>10 millions FCFA virtuels</b> et cours en direct.' },
      { kind: 'end', title: 'Vous êtes prêt ! 🎉',
        text: 'Commencez par les cours du jour, ou créez votre compte gratuit pour recevoir Le Mag et vos alertes.',
        actions: [['Voir les cours du jour', 'marches/', 'primary'], ['Créer mon compte gratuit', 'membre/', 'ghost']] }
    ],

    analyse: [
      { kind: 'intro', title: 'Bonjour, je suis Alice',
        text: 'Bienvenue dans l’Analyse fondamentale. En 2 minutes, je vous apprends à lire les chiffres d’une société et à repérer une action intéressante, étape par étape.' },
      { sel: function () { return q('.mx-hero h1'); }, title: 'L’analyse fondamentale', icon: '🧭',
        text: 'Une seule question : <b>l’entreprise vaut-elle son prix ?</b> On ne regarde pas seulement le cours, mais ce que la société gagne, ce qu’elle reverse à ses actionnaires et sa santé sur plusieurs années.' },
      { sel: function () { return q('.fx-stats'); }, title: 'Les 4 repères de la cote', icon: '🎯',
        text: '<b>PER médian</b> : combien d’années de bénéfices vous payez. <b>Rendement</b> : le dividende rapporté au cours. Puis la part des sociétés qui versent un dividende et de celles dont le bénéfice progresse. Touchez ⓘ pour chaque définition.' },
      { sel: function () { return q('[data-fx-search]'); }, title: 'Trouver une société', icon: '🔎',
        text: 'Tapez un symbole (<b>SNTS</b>) ou un nom (<b>Sonatel</b>) : le tableau se filtre instantanément.' },
      { sel: function () { var a = q('[data-fx-sector]'); return a && a.parentNode.querySelector('[data-fx-country]') ? group([a, q('[data-fx-country]')]) : a; }, title: 'Comparer ce qui est comparable', icon: '🏦',
        text: 'Filtrez par <b>secteur</b> et par <b>pays</b>. Un PER de banque ne se lit pas comme celui d’un industriel : comparez toujours une société à son secteur.' },
      { sel: function () { return q('[data-fx-quick]'); }, title: 'Les filtres d’investisseur', icon: '⚡',
        text: 'Des sélections prêtes à l’emploi : <b>dividende régulier et couvert</b>, <b>rendement de 6 % ou plus</b>, <b>PER inférieur à 12</b>, <b>bénéfice en hausse</b>. Les filtres marqués 🔒 sont réservés aux membres Premium.' },
      { sel: function () { return q('[data-fx-head]'); }, title: 'Lire le tableau', icon: '📊',
        text: '<b>BPA</b> : bénéfice par action. <b>PER</b> : cours ÷ BPA, plus il est bas, moins l’action est chère. <b>Rendement</b> : dividende ÷ cours. <b>Distribution</b> : part du bénéfice reversée. Cliquez sur un titre de colonne pour trier.' },
      { sel: function () { return firstRow(); }, title: 'Ouvrir une fiche', icon: '👆',
        text: 'Chaque ligne s’ouvre en fiche complète. Touchez <b>Suivant</b> : j’ouvre pour vous la fiche de <b>Sonatel</b>.',
        leave: function () { openFiche(); } },
      { sel: function () { return q('.fx-detail-head'); }, wait: '.fx-detail-head', title: 'La carte d’identité', icon: '🪪',
        text: 'Le nom, le secteur, le pays, l’année des derniers comptes publiés et le <b>dernier cours de clôture</b>.' },
      { sel: function () { return q('.fx-detail .cx-ai'); }, wait: '.fx-detail .cx-ai', title: 'Demandez son avis à David', icon: '✨',
        text: 'Le bouton <b>« Analyser l’action »</b> : David, notre analyste virtuel, croise l’analyse technique et les fondamentaux et rend un avis clair (<b>acheter, attendre ou rester prudent</b>) avec un plan chiffré.' },
      { sel: function () { return q('.fx-detail .cx-bar'); }, title: 'Le graphique technique', icon: '📈',
        text: 'Choisissez la période (1 mois à Max), l’affichage en aire, ligne ou <b>bougies</b>, ajoutez des <b>indicateurs</b> (moyennes mobiles, RSI, MACD, Bollinger, supports et résistances) ou comparez avec une autre action.' },
      { sel: function () { return visible(q('.fx-detail .cx-side')) ? q('.fx-detail .cx-side') : null; }, title: 'Les outils de dessin', icon: '✏️',
        text: 'Tracez des tendances et des niveaux directement sur le graphique, zoomez, annulez : les outils d’une plateforme professionnelle.' },
      { sel: function () { return q('.fx-detail .fx-locked') || q('.fx-detail .fx-chips') || q('.fx-detail .fx-cards'); }, title: function () { return q('.fx-detail .fx-locked') ? 'L’analyse complète (Premium)' : 'L’analyse complète'; }, icon: '💎',
        text: 'La lecture rapide (points forts et alertes), les <b>ratios comparés au secteur</b>, les comptes sur 5 ans en graphiques et la <b>date estimée du prochain dividende</b>.' },
      { sel: function () { return q('#premium .pm-grid') || q('#premium'); }, title: 'Les formules Premium', icon: '⭐',
        text: 'Toute l’analyse et l’avis de David sur les 48 actions, sur le site et dans l’application. <b>Dès 3 000 FCFA par mois</b>, sans engagement.' },
      { kind: 'end', title: 'À vous de jouer ! 🎉',
        text: 'Mes 3 réflexes avant d’acheter : <b>comparer au secteur</b>, vérifier que le <b>dividende est régulier</b>, regarder la <b>tendance du bénéfice sur 5 ans</b>.',
        actions: [['Explorer le tableau', '#fx-search', 'primary'], ['Découvrir Premium', '#premium', 'ghost']] }
    ]
  };

  // Rectangle englobant plusieurs éléments (ex. les deux filtres)
  function group(els) {
    els = els.filter(Boolean);
    return { getBoundingClientRect: function () {
      var r = els.map(function (e) { return e.getBoundingClientRect(); });
      var t = Math.min.apply(0, r.map(function (x) { return x.top; })), l = Math.min.apply(0, r.map(function (x) { return x.left; }));
      var b = Math.max.apply(0, r.map(function (x) { return x.bottom; })), rr = Math.max.apply(0, r.map(function (x) { return x.right; }));
      return { top: t, left: l, bottom: b, right: rr, width: rr - l, height: b - t };
    }, closest: function () { return null; }, isGroup: true, els: els };
  }
  function firstRow() { return q('[data-fx-body] tr[data-sym="SNTS"] .fx-open') || q('[data-fx-body] tr[data-sym] .fx-open'); }
  function openFiche() {
    var btn = firstRow();
    if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
  }

  var steps = TOURS[ID], i = 0, ui = null, target = null, lastFocus = null, raf = 0, token = 0;
  var total = steps.filter(function (s) { return !s.kind; }).length;
  var val = function (v) { return typeof v === 'function' ? v() : v; };

  function build() {
    ui = document.createElement('div');
    ui.className = 'gt';
    ui.innerHTML = '<div class="gt-shade"></div><div class="gt-mask" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="gt-spot" aria-hidden="true"></div>' +
      '<div class="gt-pop" role="dialog" aria-modal="true" aria-labelledby="gt-t" aria-describedby="gt-d" tabindex="-1">' +
      '<button type="button" class="gt-x" data-gt-close aria-label="Fermer la visite">×</button>' +
      '<div class="gt-body"></div></div>';
    document.body.appendChild(ui);
    document.body.classList.add('gt-on');
    ui.addEventListener('click', onClick);
    ui.addEventListener('change', function (e) { if (e.target.matches('[data-gt-off]')) ls(OFF, e.target.checked ? '1' : null); });
  }

  // Texte animé mot par mot (balises <b> conservées)
  function words(html) {
    if (reduce) return html;
    var n = 0;
    return html.split(/(<[^>]+>)/).map(function (part) {
      if (part.charAt(0) === '<') return part;
      return part.replace(/(\S+)/g, function (w) { return '<span class="gt-w" style="animation-delay:' + Math.min(n++ * 22, 1100) + 'ms">' + w + '</span>'; });
    }).join('');
  }

  function offBox() {
    return '<label class="gt-off"><input type="checkbox" data-gt-off' + (ls(OFF) ? ' checked' : '') + '><span>Ne plus afficher cette visite</span></label>';
  }

  function render() {
    var s = steps[i];
    var el = s.sel ? s.sel() : null;
    target = el && (el.isGroup || visible(el)) ? el : null;
    var pos = steps.slice(0, i + 1).filter(function (x) { return !x.kind; }).length;
    var body = ui.querySelector('.gt-body');
    var head = '<div class="gt-head"><span class="gt-alice" aria-hidden="true"><span class="gt-face">' + ALICE + '</span>' + (s.kind === 'intro' ? '<span class="gt-wave">👋</span>' : '') + '</span>' +
      '<span class="gt-who"><b>Alice</b><small>Votre guide BRVMexa</small></span>' + (s.icon ? '<span class="gt-ico" aria-hidden="true">' + s.icon + '</span>' : '') + '</div>';
    var nav;
    if (s.kind === 'intro') {
      nav = '<div class="gt-actions"><button type="button" class="btn btn--primary gt-go" data-gt-next>Commencer la visite</button>' +
        '<div class="gt-row"><button type="button" class="gt-link" data-gt-close>Plus tard</button><span aria-hidden="true">·</span><button type="button" class="gt-link" data-gt-never>Ne plus afficher</button></div></div>';
    } else if (s.kind === 'end') {
      nav = '<div class="gt-actions">' + s.actions.map(function (a) { return '<a class="btn btn--' + a[2] + ' gt-go" href="' + a[1] + '" data-gt-done>' + a[0] + '</a>'; }).join('') + '</div>' +
        '<div class="gt-endfoot">' + offBox() + '<span class="gt-note">Pour revoir la visite : « Visite guidée du site », en bas de chaque page.</span></div>';
    } else {
      nav = '<div class="gt-progress" aria-hidden="true"><i style="width:' + Math.round(pos / total * 100) + '%"></i></div>' +
        '<div class="gt-foot"><span class="gt-count">Étape ' + pos + ' sur ' + total + '</span>' +
        '<span class="gt-btns"><button type="button" class="gt-prev" data-gt-prev aria-label="Étape précédente"' + (pos === 1 ? ' disabled' : '') + '>‹</button>' +
        '<button type="button" class="btn btn--primary gt-next" data-gt-next>' + (pos === total ? 'Terminer' : 'Suivant') + ' <span aria-hidden="true">›</span></button></span></div>' + offBox();
    }
    body.innerHTML = head + '<h2 id="gt-t" class="gt-title">' + val(s.title) + '</h2><p id="gt-d" class="gt-text">' + words(val(s.text)) + '</p>' + nav;
    ui.classList.toggle('is-center', !target);
    ui.classList.toggle('is-final', !!s.kind);
    var pop = ui.querySelector('.gt-pop');
    pop.classList.remove('gt-anim'); void pop.offsetWidth; pop.classList.add('gt-anim');
    var go = function () { ui.classList.remove('is-moving'); place(); var f = ui.querySelector('[data-gt-next], .gt-go'); (f || pop).focus({ preventScroll: true }); };
    if (target && !target.isGroup && target.closest && target.closest('[data-bx-header]')) return go();
    if (target) {
      var r = target.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 40 || r.top > innerHeight * 0.55) {
        var y = scrollY + r.top - (r.height > innerHeight * 0.5 ? 90 : Math.max(90, Math.min(innerHeight * 0.28, (innerHeight - r.height) / 2 - 80)));
        var far = reduce || Math.abs(y - scrollY) > innerHeight * 1.5;
        ui.classList.add('is-moving');
        scrollTo({ top: Math.max(0, y), behavior: far ? 'instant' : 'smooth' });
        settle(go);
        return;
      }
    }
    go();
  }
  // Attend la fin du défilement
  function settle(cb) {
    var last = -1, still = 0, t0 = Date.now(), my = token;
    (function wait() {
      if (!ui || my !== token) return;
      if (scrollY === last) still++; else { still = 0; last = scrollY; }
      if (still >= 3 || Date.now() - t0 > 1600) cb(); else setTimeout(wait, 50);
    })();
  }

  // Projecteur (4 bandes sombres + contour lumineux) et position de la bulle
  function place() {
    if (!ui) return;
    var spot = ui.querySelector('.gt-spot'), pop = ui.querySelector('.gt-pop'), m = ui.querySelectorAll('.gt-mask i');
    if (!target) { spot.style.opacity = 0; pop.style.top = pop.style.left = pop.style.width = ''; for (var j = 0; j < 4; j++) m[j].style.display = 'none'; return; }
    var r = target.getBoundingClientRect(), pad = 8;
    var x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad), x2 = Math.min(innerWidth, r.right + pad), y2 = Math.min(innerHeight, r.bottom + pad);
    var set = function (el, t, l, w, h) { el.style.display = 'block'; el.style.top = t + 'px'; el.style.left = l + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; };
    set(spot, y1, x1, x2 - x1, y2 - y1); spot.style.opacity = 1;
    set(m[0], 0, 0, innerWidth, y1);
    set(m[1], y2, 0, innerWidth, Math.max(0, innerHeight - y2));
    set(m[2], y1, 0, x1, y2 - y1);
    set(m[3], y1, x2, Math.max(0, innerWidth - x2), y2 - y1);
    var pw = Math.min(400, innerWidth - 24), ph = pop.offsetHeight || 260, gap = 14;
    var top = y2 + gap, below = top + ph < innerHeight - 8;
    if (!below) top = y1 - gap - ph;
    if (top < 8) top = Math.max(8, innerHeight - ph - 8);
    var left = Math.min(Math.max(12, (x1 + x2) / 2 - pw / 2), innerWidth - pw - 12);
    pop.style.top = top + 'px'; pop.style.left = left + 'px'; pop.style.width = pw + 'px';
    pop.classList.toggle('is-above', !below);
  }
  function onMove() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }

  // Navigation : saute les étapes dont l'élément n'existe pas (ex. graphique indisponible)
  function goTo(n, dir) {
    var my = ++token;
    var cur = steps[i];
    if (dir > 0 && cur && cur.leave) cur.leave();
    var tries = 0;
    (function step(k) {
      if (!ui || my !== token) return;
      if (k < 0 || k >= steps.length) { if (k >= steps.length) close(true); return; }
      var s = steps[k];
      if (s.wait && !q(s.wait) && tries < 40) { tries++; ui.classList.add('is-moving'); return setTimeout(function () { step(k); }, 100); }
      tries = 0;
      if (!s.kind && !s.sel()) return step(k + (dir || 1));
      i = k; render();
    })(n);
  }
  function next() { goTo(i + 1, 1); }
  function prev() { var k = i - 1; while (k > 0 && !steps[k].kind && !steps[k].sel()) k--; if (k >= 1) goTo(k, -1); }

  function onClick(e) {
    var t = e.target.closest('[data-gt-next], [data-gt-prev], [data-gt-close], [data-gt-done], [data-gt-never]');
    if (!t) return;
    if (t.hasAttribute('data-gt-next')) next();
    else if (t.hasAttribute('data-gt-prev')) prev();
    else if (t.hasAttribute('data-gt-never')) { ls(OFF, '1'); close(); }
    else if (t.hasAttribute('data-gt-done')) {
      var h = t.getAttribute('href');
      close(true);
      if (h.charAt(0) === '#') { e.preventDefault(); var d = q(h); if (d) { d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); if (d.focus) setTimeout(function () { d.focus({ preventScroll: true }); }, 400); } }
    }
    else close();
  }
  function onKey(e) {
    if (!ui) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' && !steps[i].kind) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !steps[i].kind) { e.preventDefault(); prev(); }
    else if (e.key === 'Tab') {
      var f = [].slice.call(ui.querySelectorAll('.gt-pop button:not([disabled]), .gt-pop a, .gt-pop input'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }

  function open() {
    if (ui) return;
    i = 0; token++; lastFocus = document.activeElement;
    build();
    // Ancienne feuille de style encore en cache : on n'affiche rien
    if (getComputedStyle(ui).position !== 'fixed') { ui.remove(); ui = null; document.body.classList.remove('gt-on'); return; }
    ss(SEEN, '1');
    render();
    addEventListener('resize', onMove); addEventListener('scroll', onMove, { passive: true });
    document.addEventListener('keydown', onKey);
  }
  function close() {
    if (!ui) return;
    token++;
    removeEventListener('resize', onMove); removeEventListener('scroll', onMove);
    document.removeEventListener('keydown', onKey);
    var u = ui; ui = null;
    u.classList.add('is-out');
    setTimeout(function () { u.remove(); }, reduce ? 0 : 220);
    document.body.classList.remove('gt-on');
    if (forced && history.replaceState) { forced = false; history.replaceState(null, '', location.pathname + location.hash); }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  window.BxTour = { open: function () { ls(OFF, null); open(); } };
  // Page Analyse : bouton « Visite guidée avec Alice » sous le titre
  if (ANALYSE) {
    var lead = q('.mx-hero .mx-lead') || q('.mx-hero h1');
    if (lead) lead.insertAdjacentHTML('afterend', '<button type="button" class="gt-launch" data-gt-launch><span aria-hidden="true">' + ALICE + '</span>Visite guidée avec Alice · 2 min</button>');
    document.addEventListener('click', function (e) { if (e.target.closest('[data-gt-launch]')) window.BxTour.open(); });
  }
  // Lien « Visite guidée du site » : sur cette page, on ouvre directement la visite
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href$="?visite=1"]');
    if (a && HOME) { e.preventDefault(); window.BxTour.open(); }
  });

  // À chaque nouvelle visite (une fois par session), sauf « Ne plus afficher »
  if (forced || (!ls(OFF) && !ss(SEEN) && !bot && !location.hash)) {
    if (forced) ls(OFF, null);
    var wait = function (n) {
      // Page Analyse : on attend que le tableau soit chargé
      if (ANALYSE && !q('[data-fx-body] tr[data-sym]') && n < 50) return setTimeout(function () { wait(n + 1); }, 200);
      open();
    };
    setTimeout(function () { wait(0); }, forced ? 400 : 1600);
  }
})();
