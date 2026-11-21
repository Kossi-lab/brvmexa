/* BRVMexa — visite guidée de la page d'accueil.
   S'ouvre une seule fois, à la première visite (ou avec ?visite=1, lien « Visite guidée » du pied de page).
   Projecteur sur l'élément présenté, bulle explicative, clavier (← → Échap) et accessibilité. */
(function () {
  'use strict';
  if (!document.querySelector('.hx')) return; // page d'accueil seulement
  var KEY = 'bx-visite-v1';
  var store = {
    get: function () { try { return localStorage.getItem(KEY); } catch (e) { return '1'; } },
    set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* stockage indisponible */ } }
  };
  var forced = /[?&]visite=1/.test(location.search);
  var bot = /bot|crawl|spider|lighthouse|headless/i.test(navigator.userAgent);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var visible = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  var q = function (s) { return document.querySelector(s); };
  var navLink = function (href) { return q('.main-nav a[href="' + href + '"]'); };
  // Petit écran : le menu est replié derrière le bouton ☰
  var mobile = function () { return visible(q('[data-bx-menu]')); };

  // Étapes : sel = élément à mettre en lumière (absent = fenêtre centrée)
  var ALL = [
    { kind: 'intro', icon: '👋', title: 'Bienvenue sur BRVMexa',
      text: 'La Bourse régionale (BRVM) expliquée simplement : cours, analyses, actualités et magazine. Faisons le tour du site en 1 minute.' },
    { sel: function () { return mobile() ? q('[data-bx-menu]') : q('.main-nav ul'); }, title: 'Le menu',
      text: function () { return mobile()
        ? 'Touchez ce bouton pour ouvrir le menu : Marchés, Analyse, Application, Actualités, Le Mag et Le livre.'
        : 'Toutes les rubriques sont ici. Voyons les plus utiles.'; } },
    { sel: function () { return mobile() ? null : navLink('marches/'); }, title: 'Marchés', icon: '📈',
      text: 'Les cours de la BRVM en direct : les 48 sociétés cotées, les indices BRVM Composite, BRVM 30 et Prestige, les plus fortes hausses et baisses.' },
    { sel: function () { return mobile() ? null : navLink('fondamentaux/'); }, title: 'Analyse', icon: '🔍',
      text: 'La fiche complète de chaque société : bénéfices, dividendes, ratios sur 5 ans, et l’avis de David, notre analyste, pour les membres Premium.' },
    { sel: function () { return mobile() ? null : navLink('actualites/'); }, title: 'Actualités', icon: '📰',
      text: 'Chaque jour, les nouvelles de la BRVM rédigées par BRVMexa, et un article « À la une » détaillé.' },
    { sel: function () { return mobile() ? null : navLink('le-mag/'); }, title: 'Le Mag', icon: '📖',
      text: 'Le magazine mensuel BRVMexa : le bilan du mois et la valeur à suivre. Gratuit, à télécharger en PDF.' },
    { sel: function () { return q('#marche [data-bx-indices]') || q('#marche .market') || q('#marche'); }, title: 'La BRVM, en ce moment', icon: '⚡',
      text: 'Ici, sur l’accueil : les indices et les valeurs du jour, mis à jour automatiquement pendant la séance.' },
    { sel: function () { return q('#premium .section-head, #premium h2') || q('#premium'); }, title: 'Premium : demandez à David', icon: '⭐',
      text: 'Avec Premium, David analyse n’importe quelle action et vous dit quoi acheter, à quel prix et quand. Sur le site comme dans l’application.' },
    { sel: function () { return q('[data-bx-member]'); }, title: 'Votre Espace membre', icon: '👤',
      text: 'Un seul compte gratuit pour le site et l’application : avec Google ou avec votre e-mail. Vos alertes et votre abonnement vous suivent partout.' },
    { sel: function () { return q('.header-cta a[href$="#telecharger"]'); }, title: 'L’application mobile', icon: '📲',
      text: 'Gardez la BRVM dans votre poche : alertes de prix, simulateur avec 10 millions FCFA virtuels et cours en direct.' },
    { kind: 'end', icon: '🎉', title: 'Vous êtes prêt !',
      text: 'Commencez par les cours du jour, ou créez votre compte gratuit pour recevoir Le Mag et vos alertes.' }
  ];

  var steps = [], i = 0, ui = null, target = null, lastFocus = null, raf = 0;

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
  }

  function render() {
    var s = steps[i];
    var el = s.sel ? s.sel() : null;
    target = el && visible(el) ? el : null;
    var n = steps.length, mid = steps.filter(function (x) { return !x.kind; }).length, pos = steps.slice(0, i + 1).filter(function (x) { return !x.kind; }).length;
    var text = typeof s.text === 'function' ? s.text() : s.text;
    var body = ui.querySelector('.gt-body');
    var nav;
    if (s.kind === 'intro') {
      nav = '<div class="gt-actions"><button type="button" class="btn btn--primary gt-go" data-gt-next>Commencer la visite</button><button type="button" class="gt-link" data-gt-close>Plus tard</button></div>';
    } else if (s.kind === 'end') {
      nav = '<div class="gt-actions"><a class="btn btn--primary gt-go" href="marches/" data-gt-done>Voir les cours du jour</a><a class="btn btn--ghost gt-go" href="membre/" data-gt-done>Créer mon compte gratuit</a></div>' +
        '<p class="gt-note">Pour revoir la visite : lien « Visite guidée du site » en bas de chaque page.</p>';
    } else {
      var dots = '';
      for (var k = 1; k <= mid; k++) dots += '<i class="' + (k === pos ? 'on' : k < pos ? 'done' : '') + '"></i>';
      nav = '<div class="gt-foot"><span class="gt-count" aria-label="Étape ' + pos + ' sur ' + mid + '">' + pos + ' / ' + mid + '</span><span class="gt-dots" aria-hidden="true">' + dots + '</span>' +
        '<span class="gt-btns"><button type="button" class="gt-prev" data-gt-prev aria-label="Étape précédente">‹</button>' +
        '<button type="button" class="btn btn--primary gt-next" data-gt-next>' + (i === n - 2 ? 'Terminer' : 'Suivant') + '</button></span></div>';
    }
    body.innerHTML = (s.icon ? '<div class="gt-ico" aria-hidden="true">' + s.icon + '</div>' : '') +
      '<h2 id="gt-t" class="gt-title">' + s.title + '</h2><p id="gt-d" class="gt-text">' + text + '</p>' + nav;
    ui.classList.toggle('is-center', !target);
    ui.classList.toggle('is-final', !!s.kind);
    var go = function () { place(); var f = ui.querySelector('[data-gt-next], .gt-go'); (f || ui.querySelector('.gt-pop')).focus({ preventScroll: true }); };
    if (target) {
      var r = target.getBoundingClientRect();
      var inHeader = !!target.closest('[data-bx-header]');
      if (!inHeader && (r.top < 90 || r.bottom > innerHeight - 40)) {
        // On place l'élément sous l'en-tête, en laissant la place à la bulle
        var y = scrollY + r.top - (r.height > innerHeight * 0.5 ? 90 : Math.max(90, (innerHeight - r.height) / 2 - 80));
        var far = reduce || Math.abs(y - scrollY) > innerHeight * 1.5; // long trajet : saut direct, sans défilement interminable
        ui.classList.add('is-moving');
        scrollTo({ top: y, behavior: far ? 'instant' : 'smooth' });
        // On attend la fin du défilement avant d'afficher la bulle
        var last = -1, still = 0, t0 = Date.now();
        (function wait() {
          if (!ui) return;
          if (scrollY === last) still++; else { still = 0; last = scrollY; }
          if (still >= 3 || Date.now() - t0 > 1600) { ui.classList.remove('is-moving'); go(); }
          else setTimeout(wait, 50);
        })();
        return;
      }
    }
    go();
  }

  // Projecteur + bulle, recalculés au défilement et au redimensionnement
  function place() {
    if (!ui) return;
    var spot = ui.querySelector('.gt-spot'), pop = ui.querySelector('.gt-pop');
    var m = ui.querySelectorAll('.gt-mask i');
    if (!target) { spot.style.cssText = 'opacity:0'; pop.style.cssText = ''; for (var j = 0; j < 4; j++) m[j].style.cssText = 'display:none'; return; }
    var r = target.getBoundingClientRect(), pad = 8;
    var x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad), x2 = Math.min(innerWidth, r.right + pad), y2 = Math.min(innerHeight, r.bottom + pad);
    spot.style.cssText = 'opacity:1;top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
    // Voile sombre autour de l'élément (4 bandes)
    m[0].style.cssText = 'top:0;left:0;right:0;height:' + y1 + 'px';
    m[1].style.cssText = 'top:' + y2 + 'px;left:0;right:0;bottom:0';
    m[2].style.cssText = 'top:' + y1 + 'px;left:0;width:' + x1 + 'px;height:' + (y2 - y1) + 'px';
    m[3].style.cssText = 'top:' + y1 + 'px;left:' + x2 + 'px;right:0;height:' + (y2 - y1) + 'px';
    var pw = Math.min(380, innerWidth - 24), ph = pop.offsetHeight || 220, gap = 16;
    var top = r.bottom + pad + gap;
    var below = top + ph < innerHeight - 8;
    if (!below) top = r.top - pad - gap - ph;
    if (top < 8) top = Math.max(8, innerHeight - ph - 8); // élément trop grand : bulle en bas de l'écran
    var left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12);
    pop.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + pw + 'px';
    pop.classList.toggle('is-above', !below);
  }
  function onMove() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }

  function onClick(e) {
    var t = e.target.closest('[data-gt-next], [data-gt-prev], [data-gt-close], [data-gt-done]');
    if (!t) return;
    if (t.hasAttribute('data-gt-next')) next();
    else if (t.hasAttribute('data-gt-prev')) prev();
    else if (t.hasAttribute('data-gt-done')) close(true);
    else close(i > 0);
  }
  function next() { if (i < steps.length - 1) { i++; render(); } else close(true); }
  function prev() { if (i > 1) { i--; render(); } }
  function onKey(e) {
    if (!ui) return;
    if (e.key === 'Escape') { e.preventDefault(); close(i > 0); }
    else if (e.key === 'ArrowRight' && !steps[i].kind) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !steps[i].kind) { e.preventDefault(); prev(); }
    else if (e.key === 'Tab') { // la touche Tab reste dans la bulle
      var f = [].slice.call(ui.querySelectorAll('.gt-pop button, .gt-pop a'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }

  function open() {
    if (ui) return;
    store.set('vue'); // une seule fois par visiteur (la visite reste disponible depuis le pied de page)
    // Sur mobile, le menu remplace les rubriques une par une
    steps = ALL.filter(function (s) { return s.kind || !!s.sel(); });
    i = 0; lastFocus = document.activeElement;
    build(); render();
    addEventListener('resize', onMove); addEventListener('scroll', onMove, { passive: true });
    document.addEventListener('keydown', onKey);
  }
  function close(seen) {
    if (!ui) return;
    store.set(seen ? 'vue' : 'plus-tard');
    removeEventListener('resize', onMove); removeEventListener('scroll', onMove);
    document.removeEventListener('keydown', onKey);
    ui.remove(); ui = null; document.body.classList.remove('gt-on');
    if (forced && history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  window.BxTour = { open: open };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href$="?visite=1"]');
    if (a && document.querySelector('.hx')) { e.preventDefault(); open(); }
  });

  // Première visite : après le chargement, sans gêner un visiteur qui arrive sur une ancre (#…)
  if (forced || (!store.get() && !bot && !location.hash)) {
    setTimeout(open, forced ? 300 : 1800);
  }
})();
