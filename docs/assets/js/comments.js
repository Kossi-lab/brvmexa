/* BRVMexa — réactions (emoji) et commentaires sous les articles et Le Mag.
   Lecture ouverte à tous ; réagir et commenter : membres connectés (adresse e-mail confirmée).
   Toutes les règles sont vérifiées par le serveur (Supabase : get_reactions, get_comments, set_reaction, add_comment, delete_comment).
   Emplacement : <div data-bx-social="actu:<id>"></div> (ou une:<date>, mag:n1). */
(function () {
  'use strict';
  var roots = document.querySelectorAll('[data-bx-social]');
  if (!roots.length || !window.BxMember) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMOJIS = [
    ['like', '👍', 'J’aime'], ['insight', '💡', 'Instructif'], ['fire', '🔥', 'Top'],
    ['up', '📈', 'Haussier'], ['down', '📉', 'Baissier']
  ];
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-3.5-6.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m12 13.5 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  var ago = function (iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'à l’instant';
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'hier';
    if (s < 604800) return 'il y a ' + Math.floor(s / 86400) + ' jours';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  var initials = function (n) {
    var p = String(n || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  };
  var hue = function (n) { var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; };
  var plural = function (n, one, many) { return n + ' ' + (n > 1 ? many : one); };
  var errMsg = function (e) {
    var m = (e && e.message) || '';
    if (/JWT|token|auth/i.test(m) && !/Connectez|Confirmez/.test(m)) return 'Votre session a expiré : reconnectez-vous.';
    return m && m.length < 160 ? m : 'Une erreur est survenue. Réessayez dans un instant.';
  };

  roots.forEach(function (root) {
    var target = root.getAttribute('data-bx-social');
    if (!/^(actu|une|mag):[a-z0-9-]{1,64}$/.test(target)) return;
    var sb = window.BxMember.client();
    if (!sb) return;
    var state = { user: null, premium: false, counts: {}, mine: null, comments: [], busy: false };
    var back = location.pathname + '#commentaires';

    root.classList.add('so');
    root.id = root.id || 'commentaires';
    root.innerHTML =
      '<div class="so-react">' +
        '<div class="so-react-head"><h2 class="so-q">Qu’en pensez-vous&nbsp;?</h2><p class="so-total" data-so-total></p></div>' +
        '<div class="so-emojis" role="group" aria-label="Réagir à cet article">' + EMOJIS.map(function (e) {
          return '<button type="button" class="so-emo" data-emo="' + e[0] + '" aria-pressed="false">' +
            '<span class="so-e" aria-hidden="true">' + e[1] + '</span><span class="so-l">' + esc(e[2]) + '</span><span class="so-n" data-n>0</span></button>';
        }).join('') + '</div>' +
        '<p class="so-hint" data-so-hint hidden></p>' +
      '</div>' +
      '<div class="so-com">' +
        '<h2 class="so-h">Commentaires <span data-so-count></span></h2>' +
        '<div data-so-form></div>' +
        '<ol class="so-list" data-so-list aria-live="polite"><li class="so-loading"><span></span><span></span></li></ol>' +
      '</div>';

    var $ = function (s) { return root.querySelector(s); };

    function drawReactions() {
      var total = 0;
      EMOJIS.forEach(function (e) {
        var n = Number(state.counts[e[0]] || 0); total += n;
        var b = root.querySelector('[data-emo="' + e[0] + '"]');
        b.querySelector('[data-n]').textContent = n;
        b.classList.toggle('has-n', n > 0);
        b.classList.toggle('is-on', state.mine === e[0]);
        b.setAttribute('aria-pressed', state.mine === e[0] ? 'true' : 'false');
        b.setAttribute('aria-label', e[2] + ' : ' + plural(n, 'réaction', 'réactions'));
      });
      $('[data-so-total]').textContent = total ? plural(total, 'réaction', 'réactions') : 'Soyez le premier à réagir';
    }

    function drawComments() {
      var list = $('[data-so-list]');
      $('[data-so-count]').textContent = state.comments.length ? '(' + state.comments.length + ')' : '';
      if (!state.comments.length) {
        list.innerHTML = '<li class="so-empty"><span aria-hidden="true">💬</span><b>Aucun commentaire pour le moment</b><small>Lancez la discussion : votre avis intéresse les autres investisseurs.</small></li>';
        return;
      }
      list.innerHTML = state.comments.map(function (c) {
        var name = c.name || 'Membre';
        return '<li class="so-c' + (c.mine ? ' is-mine' : '') + '" data-id="' + esc(c.id) + '">' +
          '<span class="so-av" style="--h:' + hue(name) + '" aria-hidden="true">' + esc(initials(name)) + '</span>' +
          '<div class="so-cb"><p class="so-who"><b>' + esc(name) + '</b>' +
            (c.premium ? '<span class="so-prem" title="Membre Premium">' + STAR + 'Premium</span>' : '') +
            '<time datetime="' + esc(c.created_at) + '">' + esc(ago(c.created_at)) + '</time></p>' +
            '<p class="so-txt">' + esc(c.body) + '</p>' +
            (c.mine ? '<button type="button" class="so-del" data-del="' + esc(c.id) + '">Supprimer</button>' : '') +
          '</div></li>';
      }).join('');
    }

    function drawForm() {
      var box = $('[data-so-form]');
      if (!state.user) {
        box.innerHTML = '<div class="so-gate"><span class="so-gate-ico">' + LOCK + '</span>' +
          '<div><b>Rejoignez la discussion</b><span>Connectez-vous pour réagir et commenter. C’est gratuit et prend 30 secondes.</span></div>' +
          '<a class="btn btn--primary" href="' + esc(window.BxMember.url(back)) + '">Se connecter</a></div>';
        return;
      }
      var meta = state.user.user_metadata || {};
      var name = String(meta.full_name || meta.name || '').trim();
      box.innerHTML = '<form class="so-form" novalidate>' +
        '<div class="so-me"><span class="so-av" style="--h:' + hue(name || 'M') + '" aria-hidden="true">' + esc(initials(name || 'M')) + '</span>' +
          (name ? '<span>Vous commentez en tant que <b>' + esc(name) + '</b>' + (state.premium ? '<span class="so-prem">' + STAR + 'Premium</span>' : '') + '</span>'
                : '<label class="so-name"><span>Votre nom (affiché avec vos commentaires)</span><input type="text" name="name" maxlength="40" autocomplete="name" required></label>') +
        '</div>' +
        '<label class="screen-reader-text" for="so-t-' + esc(target) + '">Votre commentaire</label>' +
        '<textarea id="so-t-' + esc(target) + '" name="body" rows="3" maxlength="1000" placeholder="Partagez votre avis, une question, une analyse…" required></textarea>' +
        '<div class="so-foot"><span class="so-rules">Restez courtois. Pas de conseil d’achat ou de vente.</span><span class="so-left" data-left>1000</span>' +
        '<button type="submit" class="btn btn--primary so-send">' + SEND + '<span>Publier</span></button></div>' +
        '<p class="so-err" role="alert" data-so-err></p></form>';
      var f = box.querySelector('form'), t = f.querySelector('textarea'), nameIn = f.querySelector('input[name="name"]');
      t.addEventListener('input', function () {
        $('[data-left]').textContent = 1000 - t.value.length;
        t.style.height = 'auto'; t.style.height = Math.min(320, t.scrollHeight + 2) + 'px';
      });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (state.busy) return;
        var body = t.value.trim(), nm = nameIn ? nameIn.value.trim() : '';
        var err = $('[data-so-err]');
        if (nameIn && nm.length < 2) { err.textContent = 'Indiquez votre nom (2 caractères minimum).'; nameIn.focus(); return; }
        if (body.length < 2) { err.textContent = 'Écrivez votre commentaire.'; t.focus(); return; }
        state.busy = true; f.classList.add('is-busy'); err.textContent = '';
        sb.rpc('add_comment', { p_target: target, p_body: body, p_name: nm || null }).then(function (r) {
          state.busy = false; f.classList.remove('is-busy');
          if (r.error) { err.textContent = errMsg(r.error); return; }
          state.comments = r.data || [];
          t.value = ''; t.style.height = ''; $('[data-left]').textContent = 1000;
          drawComments();
          var first = $('[data-so-list] .so-c');
          if (first) { first.classList.add('is-new'); }
        });
      });
    }

    function hint(html) { var h = $('[data-so-hint]'); h.innerHTML = html; h.hidden = !html; }
    function burst(btn, emoji) {
      if (reduce) return;
      for (var i = 0; i < 5; i++) {
        var s = document.createElement('span');
        s.className = 'so-fly'; s.textContent = emoji;
        s.style.setProperty('--x', (Math.random() * 60 - 30).toFixed(0) + 'px');
        s.style.setProperty('--d', (i * 60) + 'ms');
        btn.appendChild(s);
        setTimeout(function (el) { el.remove(); }.bind(null, s), 1100);
      }
    }

    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-emo]');
      if (b) {
        if (!state.user) {
          hint('<a href="' + esc(window.BxMember.url(back)) + '">Connectez-vous</a> pour réagir à cet article.');
          return;
        }
        if (state.busy) return;
        var emo = b.getAttribute('data-emo'), prev = state.mine, next = prev === emo ? null : emo;
        // Affichage immédiat, confirmé (ou corrigé) par la réponse du serveur
        if (prev) state.counts[prev] = Math.max(0, (state.counts[prev] || 1) - 1);
        if (next) { state.counts[next] = (state.counts[next] || 0) + 1; burst(b, b.querySelector('.so-e').textContent); }
        state.mine = next; drawReactions(); hint('');
        state.busy = true;
        sb.rpc('set_reaction', { p_target: target, p_emoji: next }).then(function (r) {
          state.busy = false;
          if (r.error) { hint(esc(errMsg(r.error))); return load(); }
          state.counts = (r.data && r.data.counts) || {}; state.mine = r.data ? r.data.mine : null; drawReactions();
        });
        return;
      }
      var d = ev.target.closest('[data-del]');
      if (d && !state.busy) {
        var li = d.closest('.so-c');
        if (d.getAttribute('data-confirm') !== '1') { d.setAttribute('data-confirm', '1'); d.textContent = 'Confirmer la suppression'; return; }
        state.busy = true; li.classList.add('is-going');
        sb.rpc('delete_comment', { p_id: d.getAttribute('data-del') }).then(function (r) {
          state.busy = false;
          if (r.error) { li.classList.remove('is-going'); return; }
          state.comments = state.comments.filter(function (c) { return c.id !== d.getAttribute('data-del'); });
          setTimeout(drawComments, reduce ? 0 : 250);
        });
      }
    });

    function load() {
      return Promise.all([
        sb.rpc('get_reactions', { p_target: target }),
        sb.rpc('get_comments', { p_target: target })
      ]).then(function (res) {
        if (!res[0].error && res[0].data) { state.counts = res[0].data.counts || {}; state.mine = res[0].data.mine || null; }
        if (!res[1].error) state.comments = res[1].data || [];
        drawReactions(); drawComments();
        if (res[1].error) $('[data-so-list]').innerHTML = '<li class="so-empty"><b>Les commentaires sont momentanément indisponibles.</b></li>';
      });
    }

    // Chargement seulement quand la section approche de l'écran (économise les requêtes)
    var started = false;
    function start() {
      if (started) return; started = true;
      window.BxMember.ready().then(function (st) {
        state.user = st && st.user; state.premium = !!(st && st.premium);
        drawForm();
        return load();
      }).then(function () { if (location.hash === '#commentaires') root.scrollIntoView({ block: 'start' }); });
    }
    drawReactions();
    if ('IntersectionObserver' in window && location.hash !== '#commentaires') {
      var io = new IntersectionObserver(function (en) { if (en.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); } }, { rootMargin: '600px 0px' });
      io.observe(root);
    } else start();
  });
})();
