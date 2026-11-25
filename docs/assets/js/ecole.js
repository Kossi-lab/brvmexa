/* BRVMexa — École de la Bourse : progression des leçons (sur cet appareil) et recherche du lexique. */
(function () {
  'use strict';
  var KEY = 'bx-ecole-lus';
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
  var save = function (a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* stockage indisponible */ } };
  var lus = read();

  var paint = function () {
    document.querySelectorAll('.ec-prog i[data-s]').forEach(function (i) {
      i.classList.toggle('is-read', lus.indexOf(i.getAttribute('data-s')) > -1);
    });
    var items = document.querySelectorAll('[data-ec-item]');
    if (!items.length) return;
    var next = null;
    items.forEach(function (a) {
      var ok = lus.indexOf(a.getAttribute('data-ec-item')) > -1;
      a.classList.toggle('is-read', ok);
      if (!ok && !next) next = a;
    });
    var box = document.querySelector('[data-ec-progress]');
    var n = 0;
    items.forEach(function (a) { if (a.classList.contains('is-read')) n++; });
    if (box && n > 0) {
      box.hidden = false;
      var c = box.querySelector('[data-ec-count]'); if (c) c.textContent = n;
      var b = box.querySelector('[data-ec-bar]'); if (b) b.style.width = Math.round(n / items.length * 100) + '%';
      var r = box.querySelector('[data-ec-resume]');
      if (r) {
        if (next) { r.href = next.getAttribute('href'); r.textContent = 'Reprendre : ' + next.querySelector('b').textContent; }
        else { r.href = '/lexique/'; r.textContent = 'Réviser avec le lexique'; }
      }
    }
  };

  // Une leçon est « lue » quand le lecteur arrive aux liens de fin de leçon.
  var lesson = document.querySelector('[data-ec-lesson]');
  var end = document.querySelector('.ec-pn');
  if (lesson && end && 'IntersectionObserver' in window) {
    var slug = lesson.getAttribute('data-ec-lesson');
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (e) { return e.isIntersecting; })) {
        if (lus.indexOf(slug) < 0) { lus.push(slug); save(lus); paint(); }
        io.disconnect();
      }
    });
    io.observe(end);
  }
  paint();

  // Lexique : filtre instantané, insensible aux accents
  var input = document.querySelector('[data-lx-search]');
  if (input) {
    var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var terms = Array.prototype.map.call(document.querySelectorAll('.lx-term'), function (t) { return { el: t, txt: norm(t.textContent) }; });
    var groups = document.querySelectorAll('[data-lx-group]');
    var empty = document.querySelector('[data-lx-empty]');
    input.addEventListener('input', function () {
      var q = norm(input.value.trim());
      var shown = 0;
      terms.forEach(function (t) { var ok = !q || t.txt.indexOf(q) > -1; t.el.hidden = !ok; if (ok) shown++; });
      groups.forEach(function (g) { g.hidden = !g.querySelector('.lx-term:not([hidden])'); });
      if (empty) empty.hidden = shown > 0;
    });
  }
})();
