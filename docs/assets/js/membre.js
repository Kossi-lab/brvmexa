/* BRVMexa — Espace membre et abonnement Premium.
   Connexion (Google ou e-mail) avec le même compte que l'application, paiement GeniusPay
   via la fonction sécurisée « geniuspay » de Supabase, et fenêtre « Devenez Premium ». */
(function () {
  'use strict';

  var cfg = window.BRVMEXA || {};
  var PLANS = {
    m1: { label: '1 mois', price: 2500 },
    m3: { label: '3 mois', price: 7000 },
    m6: { label: '6 mois', price: 14000 },
    m12: { label: '1 an', price: 20000 }
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (v) { return new Intl.NumberFormat('fr-FR').format(v).replace(/[  ]/g, ' ') + ' FCFA'; };
  var day = function (iso) {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; }
  };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
  };
  // Adresse de retour : uniquement une page du site (jamais un autre domaine)
  var safeBack = function (u) { return typeof u === 'string' && /^\/(?!\/)[\w\-\/.#%?=&]*$/.test(u) ? u : null; };
  var memberUrl = function (back) {
    var root = (document.querySelector('.brand') || {}).getAttribute ? document.querySelector('.brand').getAttribute('href') : '/';
    var u = (root || '/').replace(/\/?$/, '/') + 'membre/';
    return back ? u + '?retour=' + encodeURIComponent(back) : u;
  };

  // ───────── Fenêtre « Devenez membre Premium » (utilisable sur toutes les pages) ─────────
  var REASONS = [
    ['Comptes détaillés sur 5 ans', 'chiffre d’affaires, résultat net, BPA et dividendes de chaque société cotée.'],
    ['Tous les ratios clés', 'PER et rendement comparés au secteur, taux de distribution, marge, croissance.'],
    ['David, votre analyste', 'un avis argumenté sur chaque action, qui croise graphique et fondamentaux, avec un plan d’action.'],
    ['Du temps gagné', 'l’essentiel de 48 rapports annuels, lisible en quelques secondes.']
  ];
  var CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var modal = null, lastFocus = null;
  function closeModal() {
    if (!modal) return;
    modal.remove(); modal = null; document.body.classList.remove('nx-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function paywall(kind) {
    closeModal();
    lastFocus = document.activeElement;
    var back = location.pathname + location.hash;
    var title = kind === 'david' ? 'David est réservé aux membres Premium'
      : kind === 'ratios' ? 'Débloquez les ratios de toutes les sociétés' : 'Devenez membre Premium';
    var lead = kind === 'david'
      ? 'L’analyse complète de l’action par David (verdict, arguments, plan d’action) fait partie de l’abonnement Premium.'
      : kind === 'ratios'
        ? 'BPA, PER, rendement, taux de distribution, marge nette, croissance, filtres et tris sont réservés aux membres Premium. Le cours et la capitalisation restent gratuits.'
        : 'Débloquez l’analyse fondamentale complète de chaque société de la BRVM.';
    modal = document.createElement('div');
    modal.className = 'nx-reader pw';
    modal.innerHTML = '<div class="nx-dialog pw-dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title" tabindex="-1">' +
      '<button type="button" class="nx-close" aria-label="Fermer">×</button>' +
      '<div class="pw-ico">' + LOCK + '</div>' +
      '<p class="nx-cat">BRVMexa Premium</p>' +
      '<h2 id="pw-title">' + esc(title) + '</h2>' +
      '<p class="pw-lead">' + esc(lead) + '</p>' +
      '<ul class="pw-list">' + REASONS.map(function (r) { return '<li>' + CHECK + '<span><b>' + esc(r[0]) + '</b> : ' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="pw-price">À partir de <b>2 500 FCFA</b> par mois, ou <b>20 000 FCFA</b> pour un an. Paiement par Mobile Money ou carte.</p>' +
      '<div class="pw-actions"><a class="btn btn--primary" href="' + esc(memberUrl(back)) + '#offres">Devenir membre Premium</a>' +
      '<a class="btn btn--ghost" href="' + esc(memberUrl(back)) + '">Déjà membre ? Se connecter</a></div>' +
      '<p class="pw-note">Le graphique et ses outils restent gratuits.</p></div>';
    document.body.appendChild(modal);
    document.body.classList.add('nx-open');
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('.nx-close')) closeModal(); });
    modal.querySelector('.pw-dialog').focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ───────── Connexion Supabase ─────────
  var sb = window.supabase && cfg.supabaseUrl && cfg.supabaseKey
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
  var FN = (cfg.supabaseUrl || '') + '/functions/v1/geniuspay';
  var none = { user: null, premium: false };

  // Adresse e-mail confirmée ? Inscription par e-mail : confirmée par Supabase.
  // Connexion Google : confirmée une fois par un lien reçu par e-mail (marque posée par le serveur).
  function verified(u) {
    if (!u || !u.email_confirmed_at) return false;
    var am = u.app_metadata || {};
    if (am.site_verified === true) return true;
    var prov = am.providers || [am.provider];
    return prov.indexOf('email') >= 0;
  }
  // Méthodes de connexion de la session (ex. « otp » quand on arrive par un lien reçu par e-mail)
  function amr(session) {
    try {
      var p = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return (JSON.parse(atob(p)).amr || []).map(function (a) { return a.method; });
    } catch (e) { return []; }
  }

  function load() {
    if (!sb) return Promise.resolve(none);
    return sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session && r.data.session.user;
      if (!u) return none;
      if (!verified(u)) return { user: u, premium: false, unverified: true, session: r.data.session };
      return sb.from('subscriptions').select('expires_at, plan').eq('user_id', u.id).maybeSingle().then(function (x) {
        var e = x.data && x.data.expires_at;
        return { user: u, premium: !!e && new Date(e) > new Date(), expiresAt: e || null, plan: x.data && x.data.plan };
      });
    }).catch(function () { return none; });
  }
  var ready = load();

  function call(body) {
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) throw new Error('Connectez-vous pour continuer.');
      return fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: cfg.supabaseKey },
        body: JSON.stringify(body)
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(j.error || 'Le service de paiement ne répond pas. Réessayez dans un instant.');
        return j;
      });
    });
  }

  window.BxMember = {
    ready: function () { return ready; },
    refresh: function () { ready = load(); return ready; },
    paywall: paywall,
    url: memberUrl,
    // Données réservées aux membres Premium (protégées côté serveur : refusées aux autres comptes)
    data: function (key) {
      if (!sb) return Promise.reject(new Error('indisponible'));
      return sb.from('premium_data').select('data').eq('key', key).maybeSingle().then(function (r) {
        if (r.error || !r.data) throw new Error('accès refusé');
        return r.data.data;
      });
    }
  };

  // En-tête : « Mon espace » quand on est connecté
  ready.then(function (st) {
    var b = document.querySelector('[data-bx-member] span');
    if (b && st.user) b.textContent = st.premium ? 'Premium' : 'Mon espace';
    var a = document.querySelector('[data-bx-member]');
    if (a && st.premium) a.classList.add('is-premium');
  });

  // ───────── Page « Espace membre » ─────────
  var page = document.querySelector('[data-member]');
  if (!page) return;
  var box = page.querySelector('[data-mb-account]');
  var params = new URLSearchParams(location.search);
  var back = safeBack(params.get('retour'));
  if (back) store.set('bx-back', back); else back = safeBack(store.get('bx-back'));
  var GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var mode = 'login', notice = '', recovering = /type=recovery/.test(location.hash);

  var tr = function (m) {
    m = String(m || '');
    if (/invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/not confirmed/i.test(m)) return 'Confirmez d’abord votre adresse e-mail avec le lien reçu par e-mail.';
    if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connectez-vous.';
    if (/password.*(6|8|short|weak)/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres.';
    if (/rate|too many|security purposes/i.test(m)) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
    if (/fetch|network/i.test(m)) return 'Connexion impossible. Vérifiez votre accès à Internet.';
    return m || 'Une erreur est survenue. Réessayez.';
  };
  var busy = function (form, on) { form.querySelectorAll('button, input').forEach(function (el) { el.disabled = on; }); };
  var setMsg = function (txt, kind) { var m = box.querySelector('[data-mb-msg]'); if (m) { m.textContent = txt || ''; m.className = 'mb-msg ' + (kind || ''); } };

  function loginView() {
    var title = { login: 'Connexion', signup: 'Créer un compte', forgot: 'Mot de passe oublié' }[mode];
    var pending = store.get('bx-plan');
    var fields = mode === 'signup'
      ? '<label>Nom complet<input name="name" autocomplete="name" required maxlength="80"></label>' : '';
    fields += '<label>Adresse e-mail<input name="email" type="email" autocomplete="email" required></label>';
    if (mode !== 'forgot') fields += '<label>Mot de passe<input name="password" type="password" minlength="8" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" required></label>';
    var submit = { login: 'Se connecter', signup: 'Créer mon compte', forgot: 'Recevoir le lien' }[mode];
    var links = mode === 'login'
      ? '<button type="button" class="mb-link" data-mode="forgot">Mot de passe oublié ?</button><button type="button" class="mb-link" data-mode="signup">Créer un compte</button>'
      : '<button type="button" class="mb-link" data-mode="login">J’ai déjà un compte : me connecter</button>';
    box.innerHTML = '<div class="mb-card mb-login">' +
      '<h2>' + title + '</h2>' +
      (pending && PLANS[pending] ? '<p class="mb-pending">Offre choisie : <b>' + esc(PLANS[pending].label) + ' – ' + money(PLANS[pending].price) + '</b>. Connectez-vous pour passer au paiement.</p>' : '') +
      '<p class="muted">Utilisez le même compte que dans l’application BRVMexa.</p>' +
      (mode !== 'forgot' ? '<button type="button" class="mb-google" data-mb-google>' + GOOGLE + '<span>Continuer avec Google</span></button><div class="mb-or"><span>ou avec votre e-mail</span></div>' : '') +
      '<form data-mb-form novalidate>' + fields + '<button class="btn btn--primary mb-submit" type="submit">' + submit + '</button></form>' +
      '<p class="mb-msg" data-mb-msg role="status" aria-live="polite">' + esc(notice) + '</p>' +
      '<div class="mb-links">' + links + '</div></div>';
    notice = '';
  }

  function recoveryView() {
    box.innerHTML = '<div class="mb-card mb-login"><h2>Nouveau mot de passe</h2><p class="muted">Choisissez votre nouveau mot de passe (8 caractères minimum).</p>' +
      '<form data-mb-recover novalidate><label>Nouveau mot de passe<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<button class="btn btn--primary mb-submit" type="submit">Enregistrer</button></form><p class="mb-msg" data-mb-msg role="status" aria-live="polite"></p></div>';
  }

  function accountView(st) {
    var u = st.user, meta = u.user_metadata || {};
    var name = meta.full_name || meta.name || (u.email || '').split('@')[0];
    var pending = store.get('bx-plan');
    var status = st.premium
      ? '<p class="mb-status is-premium"><span class="mb-badge">Premium</span> Abonnement actif jusqu’au <b>' + esc(day(st.expiresAt)) + '</b></p>'
      : '<p class="mb-status"><span class="mb-badge is-free">Gratuit</span>' + (st.expiresAt ? ' Votre abonnement a pris fin le ' + esc(day(st.expiresAt)) + '.' : ' Vous n’avez pas encore d’abonnement Premium.') + '</p>';
    var go = st.premium
      ? '<a class="btn btn--primary" href="' + esc(back || '../fondamentaux/') + '">Accéder aux analyses</a>'
      : (pending && PLANS[pending]
        ? '<button type="button" class="btn btn--primary" data-plan="' + esc(pending) + '">Payer l’offre ' + esc(PLANS[pending].label) + ' – ' + money(PLANS[pending].price) + '</button>'
        : '<a class="btn btn--primary" href="#offres">Choisir une offre</a>');
    box.innerHTML = '<div class="mb-card mb-account">' +
      '<div class="mb-hello"><div class="mb-avatar" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</div><div><h2>Bonjour ' + esc(name) + '</h2><p class="muted">' + esc(u.email || '') + '</p></div></div>' +
      status + '<p class="mb-msg" data-mb-msg role="status" aria-live="polite">' + esc(notice) + '</p>' +
      '<div class="mb-actions">' + go + '<button type="button" class="btn btn--ghost" data-mb-logout>Se déconnecter</button></div>' +
      (st.premium ? '<p class="muted mb-small">Vous pouvez prolonger votre abonnement à tout moment : la durée choisie s’ajoute à la date de fin actuelle.</p>' : '') +
      '</div>';
    notice = '';
    page.classList.toggle('is-premium', !!st.premium);
  }

  function verifyView(st, sent) {
    var email = st.user.email || '';
    box.innerHTML = '<div class="mb-card mb-verify">' +
      '<div class="pw-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7.5l8 5.5 8-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></div>' +
      '<h2>Confirmez votre adresse e-mail</h2>' +
      '<p>' + (sent ? 'Nous venons d’envoyer un lien de confirmation à ' : 'Pour accéder à votre espace membre, confirmez l’adresse ') + '<b>' + esc(email) + '</b>.</p>' +
      '<p class="muted">Ouvrez l’e-mail « BRVMexa » et cliquez sur <b>Confirmer mon adresse</b>. Pensez à regarder dans les spams ou l’onglet Promotions.</p>' +
      '<p class="mb-msg" data-mb-msg role="status" aria-live="polite">' + esc(notice) + '</p>' +
      '<div class="mb-actions"><button type="button" class="btn btn--primary" data-mb-check>J’ai confirmé mon adresse</button>' +
      '<button type="button" class="btn btn--ghost" data-mb-resend>Renvoyer l’e-mail</button>' +
      '<button type="button" class="mb-link" data-mb-logout>Se déconnecter</button></div></div>';
    notice = '';
  }
  // Inscription par e-mail : même fenêtre « Confirmez votre adresse », en attendant le clic sur le lien
  function pendingEmailView(email, sent) {
    box.innerHTML = '<div class="mb-card mb-verify">' + '<div class="pw-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7.5l8 5.5 8-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></div>' +
      '<h2>Confirmez votre adresse e-mail</h2>' +
      '<p>' + (sent ? 'Nous venons d’envoyer un lien de confirmation à ' : 'Votre adresse n’est pas encore confirmée : ') + '<b>' + esc(email) + '</b>.</p>' +
      '<p class="muted">Ouvrez l’e-mail « BRVMexa » et cliquez sur <b>Confirmer mon adresse</b>. Pensez à regarder dans les spams ou l’onglet Promotions.</p>' +
      '<p class="mb-msg" data-mb-msg role="status" aria-live="polite">' + esc(notice) + '</p>' +
      '<div class="mb-actions"><button type="button" class="btn btn--primary" data-mb-check-email>J’ai confirmé mon adresse</button>' +
      '<button type="button" class="btn btn--ghost" data-mb-resignup="' + esc(email) + '">Renvoyer l’e-mail</button>' +
      '<button type="button" class="mb-link" data-mb-change>Changer d’adresse</button></div></div>';
    notice = '';
  }

  function sendVerify(email) {
    return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } })
      .then(function (r) { if (r.error) throw r.error; });
  }
  // Arrivée par le lien de confirmation : le serveur vérifie la session et marque l’adresse comme confirmée
  function confirmFromLink(st) {
    return call({ action: 'confirm-email' }).then(function () { return sb.auth.refreshSession(); }).then(function () {
      notice = 'Adresse e-mail confirmée. Bienvenue dans votre espace membre !';
      return render();
    });
  }

  function render() {
    if (!sb) { box.innerHTML = '<div class="mb-card"><p>L’espace membre est momentanément indisponible. Réessayez plus tard.</p></div>'; return Promise.resolve(); }
    if (recovering) { recoveryView(); return Promise.resolve(); }
    return window.BxMember.refresh().then(function (st) {
      if (st.user) store.set('bx-pending-email', null);
      if (!st.user && store.get('bx-pending-email')) return pendingEmailView(store.get('bx-pending-email'), false);
      if (!st.user) return loginView();
      if (!st.unverified) return accountView(st);
      if (amr(st.session).some(function (m) { return m === 'otp' || m === 'magiclink'; })) {
        box.innerHTML = '<div class="mb-card mb-paycheck"><div class="mb-spin" aria-hidden="true"></div><h2>Confirmation de votre adresse…</h2></div>';
        return confirmFromLink(st).catch(function () { notice = 'La confirmation a échoué. Renvoyez l’e-mail et réessayez.'; verifyView(st, false); });
      }
      var key = 'bx-verif-' + st.user.id;
      if (store.get(key)) return verifyView(st, false);
      store.set(key, '1');
      return sendVerify(st.user.email).then(function () { verifyView(st, true); })
        .catch(function (e) { notice = tr(e.message); verifyView(st, false); });
    });
  }

  // Retour de la page de paiement GeniusPay : ?commande=…
  function afterPayment(order, failed) {
    box.innerHTML = '<div class="mb-card mb-paycheck"><div class="mb-spin" aria-hidden="true"></div><h2>Vérification de votre paiement…</h2><p class="muted">Ne fermez pas cette page, cela prend quelques secondes.</p></div>';
    var tries = 0;
    var done = function (txt, ok) {
      notice = txt;
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      render().then(function () { setMsg(txt, ok ? 'ok' : 'err'); });
    };
    var tick = function () {
      tries += 1;
      call({ action: 'verify', order: order }).then(function (r) {
        if (r.status === 'paid') { store.set('bx-plan', null); return done('Paiement confirmé ! Votre abonnement Premium est actif jusqu’au ' + day(r.expiresAt) + '.', true); }
        if (/failed|cancel|expired/.test(r.status) || (failed && tries >= 2)) return done('Le paiement n’a pas abouti. Aucun montant n’a été validé : vous pouvez réessayer.', false);
        if (tries >= 20) return done('Votre paiement est en cours de confirmation par l’opérateur. L’accès Premium s’activera automatiquement : actualisez cette page dans quelques minutes.', false);
        setTimeout(tick, 3000);
      }).catch(function (e) {
        if (tries >= 4) return done(e.message, false);
        setTimeout(tick, 3000);
      });
    };
    tick();
  }

  function checkout(plan, btn) {
    if (!PLANS[plan]) return;
    store.set('bx-plan', plan);
    window.BxMember.ready().then(function (st) {
      if (!st.user) {
        mode = 'login';
        notice = '';
        loginView();
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (st.unverified) { render(); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Ouverture du paiement…'; }
      call({ action: 'checkout', plan: plan }).then(function (r) {
        location.href = r.url; // page de paiement sécurisée GeniusPay (Mobile Money, carte)
      }).catch(function (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Réessayer'; }
        alertBox(e.message);
      });
    });
  }
  function alertBox(t) {
    var m = box.querySelector('[data-mb-msg]');
    if (m) { m.textContent = t; m.className = 'mb-msg err'; box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  page.addEventListener('click', function (e) {
    var t = e.target.closest('[data-plan], [data-mode], [data-mb-google], [data-mb-logout], [data-mb-check], [data-mb-resend], [data-mb-resignup], [data-mb-check-email], [data-mb-change]');
    if (!t) return;
    if (t.hasAttribute('data-plan')) { e.preventDefault(); checkout(t.getAttribute('data-plan'), t); }
    else if (t.hasAttribute('data-mode')) { mode = t.getAttribute('data-mode'); loginView(); var f = box.querySelector('input'); if (f) f.focus(); }
    else if (t.hasAttribute('data-mb-google')) {
      t.disabled = true;
      sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
        .then(function (r) { if (r.error) { t.disabled = false; setMsg(tr(r.error.message), 'err'); } });
    } else if (t.hasAttribute('data-mb-check')) {
      t.disabled = true;
      sb.auth.refreshSession().then(function () { return window.BxMember.refresh(); }).then(function (st) {
        t.disabled = false;
        if (st.user && !st.unverified) { notice = 'Adresse e-mail confirmée. Bienvenue !'; render(); }
        else setMsg('Pas encore confirmée : cliquez sur le lien reçu par e-mail, puis revenez ici.', 'err');
      });
    } else if (t.hasAttribute('data-mb-resend')) {
      t.disabled = true;
      window.BxMember.ready().then(function (st) { return sendVerify(st.user.email); })
        .then(function () { setMsg('E-mail renvoyé. Vérifiez votre boîte de réception.', 'ok'); })
        .catch(function (err) { setMsg(tr(err.message), 'err'); })
        .then(function () { setTimeout(function () { t.disabled = false; }, 60000); });
    } else if (t.hasAttribute('data-mb-check-email')) {
      // Lien ouvert dans ce navigateur : la session est déjà là. Sinon, on se connecte avec le mot de passe.
      window.BxMember.refresh().then(function (st) {
        if (st.user) { notice = 'Adresse e-mail confirmée. Bienvenue dans votre espace membre !'; return render(); }
        var em = store.get('bx-pending-email');
        store.set('bx-pending-email', null); mode = 'login';
        notice = 'Si vous avez cliqué sur le lien, votre adresse est confirmée : connectez-vous avec votre e-mail et votre mot de passe.';
        loginView();
        var f = box.querySelector('input[name=email]'); if (f && em) { f.value = em; var pw = box.querySelector('input[name=password]'); if (pw) pw.focus(); }
      });
    } else if (t.hasAttribute('data-mb-change')) {
      store.set('bx-pending-email', null); mode = 'signup'; loginView();
    } else if (t.hasAttribute('data-mb-resignup')) {
      var em = t.getAttribute('data-mb-resignup');
      t.disabled = true;
      sb.auth.resend({ type: 'signup', email: em, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        setMsg(r.error ? tr(r.error.message) : 'Nouvel e-mail de confirmation envoyé à ' + em + '.', r.error ? 'err' : 'ok');
      });
    } else if (t.hasAttribute('data-mb-logout')) {
      sb.auth.signOut().then(function () { store.set('bx-plan', null); mode = 'login'; render(); });
    }
  });

  page.addEventListener('submit', function (e) {
    var form = e.target;
    e.preventDefault();
    var v = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
    if (form.hasAttribute('data-mb-recover')) {
      if (v('password').length < 8) return setMsg('8 caractères minimum.', 'err');
      busy(form, true);
      sb.auth.updateUser({ password: v('password') }).then(function (r) {
        busy(form, false);
        if (r.error) return setMsg(tr(r.error.message), 'err');
        recovering = false; notice = 'Mot de passe modifié. Vous êtes connecté.';
        if (history.replaceState) history.replaceState(null, '', location.pathname);
        render();
      });
      return;
    }
    if (!form.hasAttribute('data-mb-form')) return;
    var email = v('email'), pw = v('password');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg('Saisissez une adresse e-mail valide.', 'err');
    if (mode !== 'forgot' && pw.length < 8) return setMsg('Le mot de passe doit contenir au moins 8 caractères.', 'err');
    busy(form, true); setMsg('Patientez…');
    var here = location.origin + location.pathname;
    var p = mode === 'login' ? sb.auth.signInWithPassword({ email: email, password: pw })
      : mode === 'signup' ? sb.auth.signUp({ email: email, password: pw, options: { data: { full_name: v('name') }, emailRedirectTo: here } })
        : sb.auth.resetPasswordForEmail(email, { redirectTo: here });
    p.then(function (r) {
      busy(form, false);
      if (r.error) {
        if (/not confirmed/i.test(r.error.message)) { store.set('bx-pending-email', email); return pendingEmailView(email, false); }
        setMsg(tr(r.error.message), 'err');
        return;
      }
      if (mode === 'signup' && !(r.data && r.data.session)) { mode = 'login'; store.set('bx-pending-email', email); return pendingEmailView(email, true); }
      if (mode === 'forgot') { mode = 'login'; notice = 'Si un compte existe avec cette adresse, un lien pour changer le mot de passe vient de vous être envoyé.'; return render(); }
      render();
    }).catch(function (err) { busy(form, false); setMsg(tr(err && err.message), 'err'); });
  });

  if (sb) sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; recoveryView(); }
    else if (ev === 'SIGNED_IN' && !recovering && !box.querySelector('.mb-paycheck')) setTimeout(render, 0);
  });

  var linkErr = /error_code=([^&]+)/.exec(location.hash + '&' + location.search);
  if (linkErr) {
    notice = /expired/.test(linkErr[1]) ? 'Ce lien a expiré ou a déjà été utilisé. Connectez-vous, ou demandez un nouvel e-mail.' : 'Ce lien n’est pas valable. Connectez-vous, ou demandez un nouvel e-mail.';
    if (history.replaceState) history.replaceState(null, '', location.pathname);
  }

  var order = params.get('commande');
  if (order && sb && /^[0-9a-f-]{36}$/i.test(order)) {
    window.BxMember.ready().then(function (st) { if (st.user) afterPayment(order, params.has('echec')); else render(); });
  } else render();
})();
