/* Sécurité : empêche un autre site d'afficher BRVMexa dans un cadre caché (clickjacking). */
if (window.top !== window.self) { try { window.top.location.replace(window.location.href); } catch (e) { document.documentElement.style.display = 'none'; } }

/* BRVMexa — interactions du site : en-tête, menu mobile, apparitions au défilement. */
(function () {
  'use strict';

  var header = document.querySelector('[data-bx-header]');
  var onScroll = function () {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var toggle = document.querySelector('[data-bx-menu]');
  var nav = document.querySelector('[data-bx-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }


  // Visite guidée de l'accueil : le téléphone de droite affiche l'écran du chapitre lu
  var steps = document.querySelectorAll('[data-tour-step]');
  if (steps.length) {
    var shots = document.querySelectorAll('[data-tour-shot]');
    var links = document.querySelectorAll('[data-tour-link]');
    var count = document.querySelector('[data-tour-count]');
    var setActive = function (i) {
      steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-tour-step') === String(i)); });
      shots.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-tour-shot') === String(i)); });
      links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-tour-link') === String(i)); });
      if (count) count.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
    };
    setActive(0);
    if ('IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(Number(entry.target.getAttribute('data-tour-step')));
        });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      steps.forEach(function (s) { tio.observe(s); });
    }
  }

  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();

/* Détection des erreurs (Sentry, offre gratuite, données en Europe).
   Chargé après la page pour ne pas la ralentir. Aucune donnée personnelle : pas d'IP, pas de cookies,
   adresses nettoyées (ni paramètres, ni jetons de connexion). Uniquement sur le site en ligne. */
(function () {
  'use strict';
  if (!/^(www\.)?brvmexa\.com$/.test(location.hostname)) return;
  var DSN = 'https://87bdf823a169408f380f468add3d75ba@o4512505521766401.ingest.de.sentry.io/4512505529761872';
  var me = document.currentScript;
  var src = ((me && me.src) || '/assets/js/site.js').replace(/site\.js(\?.*)?$/, 'vendor/sentry.min.js');
  var attente = [];
  var garde = function (e) { attente.push((e && (e.error || e.reason)) || e); };
  window.addEventListener('error', garde);
  window.addEventListener('unhandledrejection', garde);
  var propre = function (u) { return typeof u === 'string' ? u.split(/[?#]/)[0] : u; };
  function charger() {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function () {
      var S = window.BrvSentry; if (!S) return;
      window.removeEventListener('error', garde);
      window.removeEventListener('unhandledrejection', garde);
      S.init({
        dsn: DSN,
        environment: 'production',
        tracesSampleRate: 0,
        sendDefaultPii: false,
        maxBreadcrumbs: 30,
        ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection', 'NetworkError', 'Failed to fetch', 'Load failed', 'AbortError', 'The operation was aborted'],
        denyUrls: [/extensions?\//i, /^(chrome|moz|safari)-?extension:/i, /googletagmanager/i, /gtag/i],
        beforeSend: function (ev) {
          if (ev.request) { ev.request.url = propre(ev.request.url); delete ev.request.query_string; delete ev.request.cookies; }
          if (ev.user) delete ev.user.ip_address;
          return ev;
        },
        beforeBreadcrumb: function (b) {
          if (b.data) ['url', 'from', 'to'].forEach(function (k) { if (b.data[k]) b.data[k] = propre(b.data[k]); });
          return b;
        }
      });
      attente.forEach(function (e) { try { S.captureException(e); } catch (x) { /* rien */ } });
      attente = [];
    };
    document.head.appendChild(s);
  }
  if (document.readyState === 'complete') setTimeout(charger, 1500);
  else window.addEventListener('load', function () { setTimeout(charger, 1500); });
})();
