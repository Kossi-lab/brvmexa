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
