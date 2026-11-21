/* BRVMexa — mesure d'audience Google Analytics 4, UNIQUEMENT après accord du visiteur.
   Sans accord : aucun script Google chargé, aucun cookie de mesure. Le choix est gardé dans ce navigateur
   et peut être changé à tout moment (lien « Gérer les cookies » en pied de page). */
(function () {
  'use strict';
  var cfg = window.BRVMEXA || {};
  var ID = cfg.ga4;
  if (!ID || !/^G-[A-Z0-9]{4,16}$/.test(ID)) return;
  var KEY = 'bx-consent-mesure';
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* navigation privée */ } };
  var loaded = false;

  function start() {
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
  }
  // Conversions suivies : clics vers Google Play, inscriptions / connexions, téléchargement du Mag, offre Premium, partages
  function track(name, params) { if (loaded && window.gtag) window.gtag('event', name, params || {}); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/play\.google\.com\/store/.test(href)) track('clic_google_play', { page: location.pathname });
    else if (/\.pdf($|\?)/i.test(href)) track('telechargement_mag', { fichier: href.split('/').pop() });
    else if (/membre\/#offres|#offres$/.test(href)) track('clic_premium', { page: location.pathname });
    else if (/\/membre\/(\?|$)/.test(href)) track('clic_espace_membre', { page: location.pathname });
    else if (a.hasAttribute('data-net')) track('partage', { reseau: a.getAttribute('data-net') });
  }, true);
  window.BxTrack = track;

  function banner() {
    if (document.querySelector('.ck')) return;
    var b = document.createElement('div');
    b.className = 'ck'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Mesure d’audience');
    b.innerHTML = '<p><b>Nous aider à améliorer BRVMexa ?</b> Nous aimerions compter les visites avec Google Analytics (statistiques anonymes, sans publicité). ' +
      '<a href="/confidentialite/#cookies">En savoir plus</a></p>' +
      '<div class="ck-btns"><button type="button" class="btn btn--ghost" data-ck="denied">Refuser</button><button type="button" class="btn btn--primary" data-ck="granted">Accepter</button></div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('is-on'); });
    b.addEventListener('click', function (e) {
      var v = e.target.closest('[data-ck]'); if (!v) return;
      var choice = v.getAttribute('data-ck'); set(choice);
      b.classList.remove('is-on'); setTimeout(function () { b.remove(); }, 300);
      if (choice === 'granted') start();
    });
  }
  // Lien « Gérer les cookies »
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-ck-manage]')) return;
    e.preventDefault();
    if (get() === 'granted') { set('denied'); location.reload(); } else banner();
  });

  // Le bandeau attend que la visite guidée d'Alice soit fermée (jamais deux fenêtres à la fois)
  var tourOn = function () { return document.body.classList.contains('gt-on') || !!document.querySelector('.gt'); };
  function whenFree() {
    var t = setInterval(function () {
      if (get()) return clearInterval(t);
      var b = document.querySelector('.ck');
      if (tourOn()) { if (b) b.classList.remove('is-on'); return; }
      if (!b) banner(); else b.classList.add('is-on');
    }, 700);
  }
  var c = get();
  if (c === 'granted') start();
  else if (c !== 'denied') setTimeout(whenFree, 3500);
})();
