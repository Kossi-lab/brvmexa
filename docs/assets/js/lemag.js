/* Le Mag BRVMexa : téléchargement réservé aux membres (inscription gratuite dans une petite fenêtre). */
(function () {
  'use strict';
  var root = document.querySelector('[data-lm]');
  if (!root || !window.BxMember) return;
  var sb = window.BxMember.client && window.BxMember.client();
  var base = root.getAttribute('data-lm-base') || '';
  var pdf = base + root.getAttribute('data-lm-pdf');
  var name = root.getAttribute('data-lm-pdf');
  var cover = root.getAttribute('data-lm-cover');
  var issue = root.getAttribute('data-lm-issue') || '';
  // Supabase n'accepte en retour que les adresses autorisées : on revient par l'Espace membre,
  // qui renvoie ensuite ici (voir membre.js, « retour Le Mag »).
  var back = location.origin + '/membre/';
  var mark = function () { try { localStorage.setItem('bx-mag', String(Date.now())); } catch (e) { /* stockage indisponible */ } };
  var modal = null, lastFocus = null, mode = 'signup';

  var GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var tr = function (m) {
    m = String(m || '');
    if (/invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/not confirmed/i.test(m)) return 'Confirmez d’abord votre adresse e-mail avec le lien reçu par e-mail.';
    if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connectez-vous.';
    if (/password.*(6|8|short|weak)/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres.';
    if (/rate|too many|security purposes/i.test(m)) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
    if (/fetch|network/i.test(m)) return 'Connexion impossible. Vérifiez votre accès à Internet.';
    return 'Une erreur est survenue. Réessayez dans quelques instants.';
  };

  function download() {
    var a = document.createElement('a');
    a.href = pdf; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function session() {
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (r) { return r.data && r.data.session; }).catch(function () { return null; });
  }

  function aside() {
    return '<div class="lmm-side">' +
      (cover ? '<img class="lmm-cover" src="' + esc(cover) + '" alt="" width="300" height="424">' : '') +
      '<p class="lmm-issue">' + esc(issue) + '</p>' +
      '<ul class="lmm-perks">' +
      '<li>' + CHECK + '<span><b>Le Mag, chaque mois</b> gratuit, en PDF</span></li>' +
      '<li>' + CHECK + '<span><b>Un seul compte</b> pour le site et l’application</span></li>' +
      '<li>' + CHECK + '<span><b>Alertes, simulateur</b> et cours de la BRVM</span></li>' +
      '</ul></div>';
  }

  function formView(msg) {
    var su = mode === 'signup';
    return aside() + '<div class="lmm-main">' +
      '<p class="lmm-kick">' + (su ? 'Inscription gratuite · 30 secondes' : 'Content de vous revoir') + '</p>' +
      '<h2 id="lmm-t">' + (su ? 'Recevez Le Mag BRVMexa' : 'Connectez-vous pour télécharger') + '</h2>' +
      '<p class="lmm-lead">' + (su ? 'Créez votre compte membre BRVMexa : le téléchargement démarre tout de suite après.' : 'Utilisez le compte de votre application ou de votre Espace membre.') + '</p>' +
      '<button type="button" class="lmm-google" data-lmm-google>' + GOOGLE + '<span>Continuer avec Google</span></button>' +
      '<div class="lmm-or"><span>ou avec votre e-mail</span></div>' +
      '<form class="lmm-form" novalidate data-lmm-form>' +
      (su ? '<label><span>Prénom et nom</span><input name="name" autocomplete="name" required maxlength="80" placeholder="Ex. Awa Koné"></label>' : '') +
      '<label><span>Adresse e-mail</span><input name="email" type="email" autocomplete="email" required placeholder="vous@exemple.com"></label>' +
      '<label><span>Mot de passe</span><input name="password" type="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '" required minlength="8" placeholder="8 caractères minimum"></label>' +
      (su ? '<label class="lmm-cgu"><input type="checkbox" name="cgu" required><span>J’accepte les <a href="../conditions/" target="_blank" rel="noopener">conditions d’utilisation</a> et la <a href="../confidentialite/" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>' : '') +
      '<p class="lmm-msg" data-lmm-msg role="alert">' + (msg ? esc(msg) : '') + '</p>' +
      '<button class="btn btn--primary lmm-submit" type="submit">' + (su ? 'Créer mon compte et télécharger' : 'Me connecter et télécharger') + '</button>' +
      '</form>' +
      '<p class="lmm-switch">' + (su ? 'Déjà membre ? <button type="button" data-lmm-mode="login">Se connecter</button>' : 'Pas encore de compte ? <button type="button" data-lmm-mode="signup">S’inscrire gratuitement</button>') + '</p>' +
      '</div>';
  }

  function doneView() {
    return aside() + '<div class="lmm-main lmm-done">' +
      '<span class="lmm-badge">' + CHECK + '</span>' +
      '<h2 id="lmm-t">Bonne lecture !</h2>' +
      '<p class="lmm-lead">Votre téléchargement a démarré. Vous êtes membre BRVMexa : retrouvez votre compte dans l’Espace membre et dans l’application.</p>' +
      '<a class="btn btn--primary lmm-submit" href="' + esc(pdf) + '" download="' + esc(name) + '">Le téléchargement ne démarre pas ? Cliquez ici</a>' +
      '<p class="lmm-switch"><a href="../membre/">Mon Espace membre</a> · <a href="../telecharger/">L’application</a></p></div>';
  }

  // L'adresse appartient déjà à un compte (Google, Apple ou e-mail) : message clair + bonne méthode
  function existsView(email, info) {
    var x = info ? window.BxMember.existing(info) : { kind: 'unknown', google: true, title: 'Vous avez déjà un compte',
      text: 'Un compte existe déjà avec cette adresse email. Connectez-vous avec votre mot de passe, ou avec l’option « Continuer avec Google » si vous vous êtes inscrit avec Google.' };
    var btns = (x.google ? '<button type="button" class="lmm-google" data-lmm-google data-email="' + esc(email) + '">' + GOOGLE + '<span>Continuer avec Google</span></button>' : '') +
      (x.kind === 'password' || x.kind === 'unknown' ? '<button type="button" class="btn btn--primary lmm-submit" data-lmm-mode="login" data-email="' + esc(email) + '">Me connecter avec mon mot de passe</button>' : '') +
      (x.kind === 'apple' ? '<a class="btn btn--primary lmm-submit" href="../membre/">Choisir un mot de passe</a>' : '');
    return aside() + '<div class="lmm-main lmm-exists">' +
      '<p class="lmm-kick">Content de vous revoir</p>' +
      '<h2 id="lmm-t">' + esc(x.title) + '</h2>' +
      '<p class="lmm-mail">' + esc(email) + '</p>' +
      '<p class="lmm-lead">' + esc(x.text) + '</p>' + btns +
      '<p class="lmm-msg" data-lmm-msg role="alert"></p>' +
      '<p class="lmm-switch"><button type="button" data-lmm-mode="signup">Utiliser une autre adresse</button></p></div>';
  }

  function mailView(email) {
    return aside() + '<div class="lmm-main lmm-done">' +
      '<span class="lmm-badge lmm-badge--mail">' + MAIL + '</span>' +
      '<h2 id="lmm-t">Dernière étape : confirmez votre e-mail</h2>' +
      '<p class="lmm-lead">Nous avons envoyé un lien à <b>' + esc(email) + '</b>. Cliquez dessus : vous reviendrez sur cette page et <b>Le Mag se téléchargera automatiquement</b>.</p>' +
      '<p class="lmm-note">Rien reçu après 2 minutes ? Regardez dans les courriers indésirables (spam).</p>' +
      '<button type="button" class="btn btn--ghost lmm-submit" data-lmm-close>J’ai compris</button></div>';
  }

  function open(html) {
    if (!modal) {
      lastFocus = document.activeElement;
      modal = document.createElement('div');
      modal.className = 'lmm';
      modal.innerHTML = '<div class="lmm-back" data-lmm-close></div><div class="lmm-dialog" role="dialog" aria-modal="true" aria-labelledby="lmm-t" tabindex="-1"><button type="button" class="lmm-x" data-lmm-close aria-label="Fermer">' + CLOSE + '</button><div class="lmm-body"></div></div>';
      document.body.appendChild(modal);
      document.body.classList.add('nx-open');
      requestAnimationFrame(function () { modal.classList.add('is-in'); });
    }
    modal.querySelector('.lmm-body').innerHTML = html;
    var f = modal.querySelector('input[name="name"], input[name="email"]');
    (f || modal.querySelector('.lmm-dialog')).focus();
  }
  function close() {
    if (!modal) return;
    modal.remove(); modal = null; document.body.classList.remove('nx-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setMsg(t) { var m = modal && modal.querySelector('[data-lmm-msg]'); if (m) m.textContent = t || ''; }
  function busy(on) { if (modal) modal.querySelectorAll('button, input').forEach(function (el) { el.disabled = on; }); }

  function success() {
    try { localStorage.removeItem('bx-mag'); localStorage.setItem('bx-mag-done', '1'); } catch (e) { /* stockage indisponible */ }
    download(); open(doneView());
  }

  function start() {
    session().then(function (s) {
      if (s) { download(); return; }
      mode = 'signup'; open(formView());
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lm-dl], [data-lmm-close], [data-lmm-mode], [data-lmm-google]');
    if (!t) return;
    if (t.hasAttribute('data-lm-dl')) {
      e.preventDefault();
      var f = t.getAttribute('data-lm-dl');
      if (f && /^[\w.-]+\.pdf$/.test(f)) { pdf = base + f; name = f; }
      start();
    }
    else if (t.hasAttribute('data-lmm-close')) close();
    else if (t.hasAttribute('data-lmm-mode')) {
      mode = t.getAttribute('data-lmm-mode'); open(formView());
      var pre = t.getAttribute('data-email'), fe = modal && modal.querySelector('input[name="email"]');
      if (pre && fe) { fe.value = pre; var fp = modal.querySelector('input[name="password"]'); if (fp) fp.focus(); }
    }
    else if (t.hasAttribute('data-lmm-google')) {
      if (!sb) return setMsg('Service momentanément indisponible. Réessayez plus tard.');
      busy(true); mark();
      window.BxMember.google(back, t.getAttribute('data-email') || '').then(function (r) { if (r && r.error) { busy(false); setMsg(tr(r.error.message)); } });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute('data-lmm-form')) return;
    e.preventDefault();
    if (!sb) return setMsg('Service momentanément indisponible. Réessayez plus tard.');
    var v = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
    var email = v('email'), pw = v('password');
    if (mode === 'signup' && v('name').length < 2) return setMsg('Indiquez votre prénom et votre nom.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg('Saisissez une adresse e-mail valide.');
    if (pw.length < 8) return setMsg('Le mot de passe doit contenir au moins 8 caractères.');
    if (mode === 'signup' && !form.elements.cgu.checked) return setMsg('Cochez la case pour accepter les conditions.');
    busy(true); setMsg('Patientez…'); mark();
    var M = window.BxMember, known = null;
    // Inscription : l'adresse appartient-elle déjà à un compte ? (Google, Apple ou e-mail)
    var pre = mode === 'signup' ? M.methods(email).then(function (info) { known = info; return M.taken(info); }) : Promise.resolve(false);
    var p = pre.then(function (isTaken) {
      if (isTaken) return { taken: true };
      return mode === 'login'
        ? sb.auth.signInWithPassword({ email: email, password: pw })
        : sb.auth.signUp({ email: email, password: pw, options: { data: { full_name: v('name'), source: 'le-mag' }, emailRedirectTo: back } });
    });
    p.then(function (r) {
      busy(false);
      if (r.taken || (mode === 'signup' && M.signupHitExisting(r))) return open(existsView(email, known));
      if (r.error) {
        if (/not confirmed/i.test(r.error.message)) return open(mailView(email));
        if (mode === 'login' && /invalid login/i.test(r.error.message)) {
          return M.methods(email).then(function (info) {
            if (info && info.exists && !info.password && (info.providers || []).indexOf('email') < 0) return open(existsView(email, info));
            if (info && !info.exists) return setMsg('Aucun compte n’existe avec cette adresse. Vérifiez-la, ou inscrivez-vous gratuitement.');
            setMsg(tr(r.error.message));
          });
        }
        return setMsg(tr(r.error.message));
      }
      if (r.data && r.data.session) { window.BxMember.refresh(); return success(); }
      open(mailView(email));
    }).catch(function (err) { busy(false); setMsg(tr(err && err.message)); });
  });

  // Retour depuis Google ou depuis le lien de confirmation : téléchargement automatique
  if (/[?&]telecharger=1/.test(location.search)) {
    var tries = 0;
    (function wait() {
      session().then(function (s) {
        if (s) {
          if (history.replaceState) history.replaceState(null, '', location.pathname);
          window.BxMember.refresh();
          success();
        } else if (++tries < 6) setTimeout(wait, 500);
      });
    })();
  }
})();
