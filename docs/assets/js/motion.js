/* BRVMexa — animations des pages intérieures : titre mot par mot, apparition au défilement,
   compteurs, halo sous la souris, barre de lecture et démonstration animée de David.
   Tout est désactivé si le visiteur a demandé à réduire les animations. */
(function () {
  'use strict';
  var doc = document.documentElement;
  // Membres Premium : on masque les encarts de vente (simple confort d'affichage)
  try { if (localStorage.getItem('bx-premium') === '1') doc.classList.add('pm-hide-premium'); } catch (e) { /* stockage indisponible */ }
  if (document.body.classList.contains('is-home')) return;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('fr-FR');
  var fmt = function (v) { return nf.format(v).replace(/[  ]/g, ' '); };

  // Titre : apparition mot par mot
  document.querySelectorAll('[data-mx-split]').forEach(function (h) {
    if (calm || h.children.length) return;
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w, i) {
      return '<span class="mx-w" aria-hidden="true" style="--i:' + i + '">' + w.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span>';
    }).join(' ');
  });

  // Compteurs
  function count(el) {
    var end = Number(el.getAttribute('data-mx-count'));
    if (!isFinite(end) || calm) { el.textContent = fmt(end); return; }
    var t0 = null, dur = Math.min(1600, 700 + end / 40);
    var step = function (t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(end * e));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  var SEL = [
    '.entry > *:not(script):not(style):not(.mb):not(.fx)', '.content .container > *:not(.entry):not(script)',
    '.fx-stats', '.fx-learn-card', '.feature', '.post-card', '.mb-faq details', '.pm-top > *', '.pm > section', '.pm-stats',
    '.pm-plan', '.pm-feat', '.pm-offers-head', '.pm-band', '.pm-cmp-t tbody tr', '.notfound .container > *'
  ].join(',');

  if (!calm && 'IntersectionObserver' in window) {
    var targets = Array.prototype.filter.call(document.querySelectorAll(SEL), function (el) {
      // Jamais sur le graphique, les tableaux de cours ni les blocs qui contiennent une autre cible
      if (el.closest('[data-fx], .cx, .chart-wrap, .stock-table')) return false;
      if (el.querySelector('canvas, [data-fx], .cx')) return false;
      if (el.closest('.pm-plan, .pm-feat') && !el.matches('.pm-plan, .pm-feat')) return false;
      return true;
    });
    // Évite les doubles animations (parent et enfant)
    targets = targets.filter(function (el) {
      return !targets.some(function (o) { return o !== el && o.contains(el) && !o.matches('.pm-top > *, .pm > section, .pm-offers, .pm-cmp, .pm-plans-sec, .pm-feats-sec'); });
    });
    targets.forEach(function (el) {
      el.classList.add('mx-r');
      if (el.querySelector('table, iframe') || el.offsetHeight > 700) el.classList.add('mx-f');
    });
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.setProperty('--d', Math.min(k++ * 70, 420) + 'ms');
        el.classList.add('mx-in');
        io.unobserve(el);
        setTimeout(function () { el.style.removeProperty('--d'); }, 1400);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });
    // Sécurité : tout afficher si l'observateur ne s'est pas déclenché (impression, capture…)
    window.addEventListener('beforeprint', function () { targets.forEach(function (el) { el.classList.add('mx-in'); }); });
  }

  // Compteurs déclenchés à l'affichage
  var counters = document.querySelectorAll('[data-mx-count]');
  if ('IntersectionObserver' in window && !calm) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { count(en.target); co.unobserve(en.target); } });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  // Halo sous la souris
  if (!calm && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.mx-spot');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // Barre de lecture
  if (!calm) {
    var bar = document.createElement('div');
    bar.className = 'mx-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    var upd = function () {
      ticking = false;
      var h = doc.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    };
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  // Démonstration de David (Espace membre) : plusieurs exemples qui défilent
  var show = document.querySelector('[data-pm-show]');
  if (show) {
    var card = show.querySelector('.pm-dv');
    var ex = show.getAttribute('data-pm-show').split('|').map(function (s) {
      var p = s.split(';');
      return { sym: p[0], name: p[1], verdict: p[2], tone: p[3], score: +p[4], subs: p[5].split(',').map(Number), zone: p[6], tgt: p[7], stop: p[8] };
    });
    var q = function (s) { return card.querySelector(s); };
    var idx = 0, timer = null;
    var animScore = function (to) {
      var el = q('[data-pm-score]');
      if (calm) { el.textContent = to; return; }
      var t0 = null;
      var step = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1300); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    var apply = function (e) {
      card.classList.toggle('is-warn', e.tone === 'warn');
      card.classList.add('is-anim');
      q('[data-pm-name]').textContent = e.name;
      var v = q('[data-pm-verdict]'); v.textContent = e.verdict; v.className = 'pm-verdict is-' + e.tone;
      q('[data-pm-zone]').textContent = e.zone; q('[data-pm-tgt]').textContent = e.tgt; q('[data-pm-stop]').textContent = e.stop;
      q('.g-v').style.setProperty('--s', e.score);
      card.querySelectorAll('.pm-bar').forEach(function (b, i) {
        b.querySelector('em').style.setProperty('--v', e.subs[i] + '%');
        b.querySelector('b').textContent = e.subs[i];
      });
      ['.pm-dv-q', '.pm-verdict', '.pm-dv-plan'].forEach(function (s) { var n = q(s); n.classList.remove('pm-swap'); void n.offsetWidth; n.classList.add('pm-swap'); });
      void card.offsetWidth;
      requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.remove('is-anim'); }); });
      animScore(e.score);
    };
    var start = function () {
      apply(ex[0]);
      if (calm || ex.length < 2) return;
      timer = setInterval(function () { if (document.hidden) return; idx = (idx + 1) % ex.length; apply(ex[idx]); }, 6500);
    };
    if ('IntersectionObserver' in window) {
      var so = new IntersectionObserver(function (en) { if (en[0].isIntersecting && !timer) { start(); so.disconnect(); } }, { threshold: 0.3 });
      so.observe(card);
    } else start();
  }
})();
