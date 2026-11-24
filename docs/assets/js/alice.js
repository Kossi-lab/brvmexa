/* BRVMexa — Alice, l'assistante du site (bouton en bas à gauche, sur toutes les pages).
   Réponses instantanées à des questions préparées pour les débutants, recherche par mots-clés,
   et bouton « Me montrer » : Alice ouvre la bonne page et met en lumière l'endroit exact. */
(function () {
  'use strict';
  if (window.BxAlice) return;
  var ALICE = '👩🏾‍💼';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' '); };

  // ───────── Questions et réponses ─────────
  // go : [page, élément à montrer, phrase d'Alice sur place]
  var CATS = [
    { id: 'start', icon: '🚀', label: 'Débuter' },
    { id: 'cours', icon: '📈', label: 'Cours et marchés' },
    { id: 'analyse', icon: '🔍', label: 'Analyser une action' },
    { id: 'info', icon: '📰', label: 'Actualités et Mag' },
    { id: 'compte', icon: '👤', label: 'Compte et Premium' },
    { id: 'app', icon: '📲', label: 'Application' },
    { id: 'bourse', icon: '🎓', label: 'La Bourse, simplement' }
  ];
  var QA = [
    // Débuter
    { c: 'start', q: 'Par où commencer sur BRVMexa ?', k: 'commencer debut debutant premiere fois guide visite',
      a: 'Je vous conseille trois étapes : regardez les <b>cours du jour</b> dans Marchés, lisez la fiche d’une société dans <b>Analyse</b>, puis créez votre <b>compte gratuit</b> pour recevoir Le Mag. Et pour un tour complet en 1 minute, lancez la visite guidée.',
      go: ['/?visite=1', null, null], btn: 'Lancer la visite guidée' },
    { c: 'start', q: 'Le site est-il gratuit ?', k: 'gratuit prix payant cout abonnement',
      a: 'Oui : les cours, les indices, les actualités, Le Mag et le graphique technique sont <b>gratuits</b>. L’offre <b>Premium</b> ajoute les ratios complets des 48 sociétés et l’avis de David, notre analyste, dès 3 000 FCFA par mois.',
      go: ['/membre/', '#pm-cmp-t', 'Ici, la comparaison Gratuit / Premium.'] },
    { c: 'start', q: 'Qui est David ?', k: 'david analyste ia avis conseil',
      a: '<b>David</b> est l’analyste virtuel de BRVMexa. Sur la fiche d’une société, le bouton « Analyser l’action » lui demande son avis : il croise le graphique et les comptes, puis dit s’il faut <b>acheter, attendre ou rester prudent</b>, avec un plan chiffré. Réservé aux membres Premium.',
      go: ['/fondamentaux/', '.fx-detail .cx-ai', 'Voici le bouton pour demander son avis à David.'] },
    { c: 'start', q: 'Comment vous contacter ?', k: 'contact ecrire question aide support email probleme',
      a: 'Écrivez-nous avec le formulaire de contact : nous répondons par e-mail.',
      go: ['/contact/', '#contact', 'Le formulaire est ici.'] },

    // Cours et marchés
    { c: 'cours', q: 'Où voir le cours d’une action ?', k: 'cours prix action cotation valeur combien coute',
      a: 'Dans <b>Marchés</b> : le tableau des 48 sociétés cotées, avec le dernier cours et la variation du jour. Tapez le nom ou le symbole dans la recherche.',
      go: ['/marches/', '#bx-search', 'Tapez ici le nom ou le symbole de la société.'] },
    { c: 'cours', q: 'Où voir les indices BRVM Composite et BRVM 30 ?', k: 'indice indices composite brvm 30 prestige marche monte baisse',
      a: 'Les indices sont en haut de la page Marchés : <b>BRVM Composite</b> (toute la cote), <b>BRVM 30</b> (les 30 plus échangées) et <b>BRVM Prestige</b>.',
      go: ['/marches/', '[data-bx-indices]', 'Les indices du jour.'] },
    { c: 'cours', q: 'Quelles actions montent le plus aujourd’hui ?', k: 'hausse monte gagnant meilleures performance top jour',
      a: 'Les plus fortes hausses et baisses de la séance sont affichées dans Marchés, juste sous les indices.',
      go: ['/marches/', '[data-bx-gainers]', 'Les plus fortes hausses du jour.'] },
    { c: 'cours', q: 'Comment trier les sociétés par secteur ou par pays ?', k: 'secteur pays filtrer trier banque telecom cote ivoire senegal',
      a: 'Dans Marchés, utilisez les menus <b>Secteur</b> et <b>Pays</b> au-dessus du tableau. Cliquez sur le titre d’une colonne pour trier.',
      go: ['/marches/', '#bx-sector', 'Choisissez ici le secteur ou le pays.'] },
    { c: 'cours', q: 'Les cours sont-ils en temps réel ?', k: 'temps reel direct mise a jour actualise retard',
      a: 'Les cours sont mis à jour <b>automatiquement pendant la séance</b>, à partir des publications officielles de la BRVM. L’heure de la dernière mise à jour est indiquée sous le tableau.',
      go: ['/marches/', '[data-bx-updated]', 'L’heure de la dernière mise à jour.'] },

    // Analyser une action
    { c: 'analyse', q: 'Comment analyser une société ?', k: 'analyser analyse fondamentale fiche societe entreprise',
      a: 'Ouvrez <b>Analyse</b> : chaque société a sa fiche avec ses bénéfices, ses dividendes et ses ratios sur 5 ans, plus un graphique technique. Je vous ai préparé une <b>visite guidée de 2 minutes</b> sur cette page.',
      go: ['/fondamentaux/?visite=1', null, null], btn: 'Visite guidée de l’Analyse' },
    { c: 'analyse', q: 'Où trouver le PER et le rendement d’une action ?', k: 'per rendement ratio bpa marge distribution',
      a: 'Dans le tableau de la page Analyse : colonnes <b>BPA</b>, <b>PER</b>, <b>Rendement</b>, <b>Distribution</b> et <b>Marge nette</b>. Cliquez sur un titre de colonne pour trier.',
      go: ['/fondamentaux/', '[data-fx-head]', 'Les ratios clés de chaque société.'] },
    { c: 'analyse', q: 'Quelles actions versent les meilleurs dividendes ?', k: 'dividende meilleurs rendement eleve verse paie',
      a: 'Dans Analyse, le <b>filtre rapide</b> propose « Rendement de 6 % ou plus » et « Dividende régulier et couvert ». Ces filtres sont réservés aux membres Premium.',
      go: ['/fondamentaux/', '[data-fx-quick]', 'Les filtres d’investisseur sont ici.'] },
    { c: 'analyse', q: 'Quand sera versé le prochain dividende ?', k: 'prochain dividende date quand paiement detachement',
      a: 'La fiche Premium de chaque société affiche la <b>date estimée du prochain dividende</b>, d’après le calendrier des années précédentes. Seule l’annonce officielle de la société fait foi.',
      go: ['/fondamentaux/', '.fx-detail', 'La fiche de la société, avec le prochain dividende (Premium).'] },
    { c: 'analyse', q: 'Comment utiliser le graphique technique ?', k: 'graphique technique bougies indicateur rsi macd moyenne tracer dessin',
      a: 'Sur la fiche d’une société : choisissez la période, l’affichage en <b>bougies</b>, ajoutez des <b>indicateurs</b> (RSI, MACD, moyennes mobiles…) et tracez vos lignes. Vos tracés sont <b>enregistrés dans votre compte</b>.',
      go: ['/fondamentaux/', '.fx-detail .cx-bar', 'Les réglages du graphique.'] },
    { c: 'analyse', q: 'Mes tracés sur le graphique sont-ils sauvegardés ?', k: 'sauvegarde tracés dessin enregistre perdu retrouver',
      a: 'Oui. Connecté, vos tracés sont enregistrés <b>dans votre compte</b> : vous les retrouvez à chaque connexion, sur n’importe quel ordinateur. Sans compte, ils restent sur cet appareil.',
      go: ['/fondamentaux/', '.fx-detail .cx-side', 'Vos outils de dessin.'] },

    // Actualités et Mag
    { c: 'info', q: 'Où lire les actualités de la BRVM ?', k: 'actualite actualites news nouvelles information article',
      a: 'Dans <b>Actualités</b> : les nouvelles de la BRVM rédigées chaque jour par BRVMexa, et un article <b>« À la une »</b> détaillé.',
      go: ['/actualites/', '[data-bx-news-list]', 'Les derniers articles.'] },
    { c: 'info', q: 'Comment télécharger Le Mag BRVMexa ?', k: 'mag magazine telecharger pdf mensuel gratuit',
      a: 'Le Mag est <b>gratuit</b>, en PDF. Cliquez sur « Télécharger », créez votre compte membre en 30 secondes, et le téléchargement démarre tout seul.',
      go: ['/le-mag/', '[data-lm-dl]', 'Cliquez ici pour le télécharger.'] },
    { c: 'info', q: 'Où acheter le livre « Investir à la BRVM grâce à l’IA » ?', k: 'livre ebook acheter amazon chariow broche pdf',
      a: 'Deux versions : le <b>PDF</b> sur Chariow et le <b>livre broché</b> sur Amazon. Tout est sur la page Le livre.',
      go: ['/livre/', 'h2', 'Le livre et ses deux versions.'] },

    // Compte et Premium
    { c: 'compte', q: 'Comment créer mon compte gratuit ?', k: 'creer compte inscription inscrire membre gratuit',
      a: 'Dans l’<b>Espace membre</b> : « Continuer avec Google », ou votre e-mail et un mot de passe. Le même compte fonctionne <b>sur le site et dans l’application</b>.',
      go: ['/membre/', '#compte', 'Créez votre compte ici.'] },
    { c: 'compte', q: 'Combien coûte Premium ?', k: 'premium prix tarif cout abonnement offre combien',
      a: 'Premium commence à <b>3 000 FCFA pour 1 mois</b>, sans engagement. Les formules 3 mois, 6 mois et 1 an reviennent moins cher par mois.',
      go: ['/membre/', '#offres', 'Les formules Premium.'] },
    { c: 'compte', q: 'Comment payer Premium ?', k: 'payer paiement mobile money orange moov carte',
      a: 'Le paiement se fait sur une page sécurisée, par <b>Mobile Money</b> ou par <b>carte</b>. Votre Premium s’active automatiquement, sur le site et dans l’application.',
      go: ['/membre/', '#offres', 'Choisissez votre formule ici.'] },
    { c: 'compte', q: 'J’ai oublié mon mot de passe', k: 'mot de passe oublie perdu reinitialiser connexion impossible',
      a: 'Dans l’Espace membre, cliquez sur <b>« Mot de passe oublié ? »</b> : vous recevez un lien par e-mail pour en choisir un nouveau. Si vous vous êtes inscrit avec Google, utilisez simplement « Continuer avec Google ».',
      go: ['/membre/', '#compte', 'Le lien « Mot de passe oublié » est ici.'] },
    { c: 'compte', q: 'Puis-je utiliser le même compte dans l’application ?', k: 'meme compte application telephone synchroniser site',
      a: 'Oui : <b>un seul compte</b> pour le site et l’application, avec la même méthode de connexion (Google ou e-mail). Votre Premium vous suit partout.',
      go: ['/membre/', '#pm-sync-t', 'Votre Premium vous suit sur votre téléphone.'] },
    { c: 'compte', q: 'Comment supprimer mon compte ?', k: 'supprimer compte effacer donnees desinscrire',
      a: 'La page « Suppression des données » explique comment supprimer votre compte et toutes vos données.',
      go: ['/suppression-donnees/', 'h1', 'Toutes les explications sont ici.'] },

    // Application
    { c: 'app', q: 'Où télécharger l’application ?', k: 'telecharger application app android iphone google play app store',
      a: 'L’application BRVMexa arrive sur <b>Google Play</b> et l’<b>App Store</b>. Toutes les informations sont sur la page Application.',
      go: ['/application/', '#telecharger', 'Ici, pour télécharger l’application.'] },
    { c: 'app', q: 'C’est quoi le simulateur de bourse ?', k: 'simulateur virtuel entrainer sans risque portefeuille 10 millions',
      a: 'Dans l’application, vous recevez <b>10 millions FCFA virtuels</b> pour acheter et vendre des actions de la BRVM aux vrais cours, <b>sans risquer un franc</b>.',
      go: ['/application/', '#simulateur', 'Le simulateur, expliqué ici.'] },
    { c: 'app', q: 'Comment recevoir une alerte de prix ?', k: 'alerte prix notification seuil prevenir',
      a: 'Dans l’application, créez une <b>alerte</b> sur une action : vous êtes prévenu dès qu’elle atteint votre prix.',
      go: ['/application/', '#fonctionnalites', 'Toutes les fonctionnalités de l’application.'] },
    { c: 'app', q: 'Voir la vidéo de présentation', k: 'video presentation demo',
      a: 'BRVMexa en un peu plus d’une minute, en vidéo.', go: ['/application/', '#video', 'La vidéo de présentation.'] },

    // La Bourse, simplement
    { c: 'bourse', q: 'C’est quoi la BRVM ?', k: 'brvm bourse regionale c est quoi definition uemoa',
      a: 'La <b>Bourse Régionale des Valeurs Mobilières</b>, à Abidjan, est la bourse commune des <b>8 pays de l’UEMOA</b> : Bénin, Burkina Faso, Côte d’Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo. Environ <b>48 sociétés</b> y sont cotées.',
      go: ['/marches/', '[data-bx-table]', 'Les sociétés cotées à la BRVM.'] },
    { c: 'bourse', q: 'C’est quoi une action ?', k: 'action definition part entreprise proprietaire',
      a: 'Une action est une <b>petite part d’une entreprise</b>. En l’achetant, vous devenez copropriétaire : vous pouvez recevoir une part des bénéfices (le dividende) et profiter de la hausse du cours.',
      go: ['/marches/', '[data-bx-table]', 'Toutes les actions de la BRVM.'] },
    { c: 'bourse', q: 'C’est quoi un dividende ?', k: 'dividende definition part benefice actionnaire',
      a: 'Le <b>dividende</b> est la part des bénéfices qu’une entreprise reverse chaque année à ses actionnaires. Le <b>rendement</b> le compare au cours de l’action.',
      go: ['/fondamentaux/', '.fx-stats', 'Le rendement médian de la cote est ici.'] },
    { c: 'bourse', q: 'Que veut dire PER ?', k: 'per definition price earning ratio cher',
      a: 'Le <b>PER</b> (cours ÷ bénéfice par action) indique combien d’années de bénéfices vous payez. Plus il est bas, moins l’action est chère, à comparer toujours avec son secteur.',
      go: ['/fondamentaux/', '.fx-stats', 'Le PER médian de la cote.'] },
    { c: 'bourse', q: 'Comment acheter une action de la BRVM ?', k: 'acheter action comment investir sgi compte titres ordre',
      a: 'En 3 étapes : choisissez une <b>SGI agréée</b> par l’AMF-UMOA, ouvrez un <b>compte-titres</b>, puis passez un <b>ordre d’achat</b>. BRVMexa ne vend pas d’actions : nous vous aidons à choisir.',
      go: ['/fondamentaux/', '[data-fx-search]', 'Avant d’acheter, analysez la société ici.'] },
    { c: 'bourse', q: 'C’est quoi une SGI ?', k: 'sgi societe gestion intermediation courtier banque',
      a: 'Une <b>SGI</b> (Société de Gestion et d’Intermédiation) est l’intermédiaire agréé qui achète et vend des actions pour vous. Méfiez-vous de quiconque propose d’investir « à la BRVM » sans être une SGI agréée.',
      go: null },
    { c: 'bourse', q: 'Est-ce risqué d’investir en bourse ?', k: 'risque perdre argent securite danger',
      a: 'Oui, le cours d’une action peut <b>baisser</b>. On investit sur le long terme, en diversifiant, et jamais l’argent dont on a besoin à court terme. Pour s’entraîner sans risque : le <b>simulateur</b> de l’application.',
      go: ['/application/', '#simulateur', 'Entraînez-vous sans risque.'] }
  ];
  QA.forEach(function (x, n) { x.id = 'q' + n; x.n = norm(x.q + ' ' + x.k); });

  // ───────── Interface ─────────
  var root, panel, log, input, opened = false;
  function mount() {
    root = document.createElement('div');
    root.className = 'al';
    root.innerHTML =
      '<div class="al-nudge" hidden role="status"><button type="button" class="al-nudge-x" aria-label="Masquer">×</button>' +
        '<b>Une question ?</b> Je vous montre où trouver chaque information du site.</div>' +
      '<button type="button" class="al-launch" aria-haspopup="dialog" aria-expanded="false" aria-label="Ouvrir Alice, l’assistante BRVMexa">' +
        '<span class="al-face" aria-hidden="true">' + ALICE + '</span><span class="al-dot" aria-hidden="true"></span><span class="al-lbl">Alice</span></button>';
    document.body.appendChild(root);
    root.querySelector('.al-launch').addEventListener('click', toggle);
    root.querySelector('.al-nudge-x').addEventListener('click', function () { nudge(false); ss('al-nudge', '1'); });
    root.querySelector('.al-nudge').addEventListener('click', function (e) { if (!e.target.closest('.al-nudge-x')) openPanel(); });
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'al-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Alice, l’assistante BRVMexa');
    panel.innerHTML =
      '<div class="al-head"><span class="al-av" aria-hidden="true">' + ALICE + '</span>' +
        '<div class="al-id"><b>Alice</b><small><i></i>Votre assistante BRVMexa</small></div>' +
        '<button type="button" class="al-home" data-al-home title="Revenir aux thèmes" aria-label="Revenir aux thèmes">⌂</button>' +
        '<button type="button" class="al-close" data-al-close aria-label="Fermer">×</button></div>' +
      '<div class="al-log" aria-live="polite"></div>' +
      '<form class="al-ask" novalidate><input type="text" maxlength="120" placeholder="Posez votre question… (ex. dividende, PER, Mag)" aria-label="Posez votre question" autocomplete="off">' +
        '<button type="submit" aria-label="Envoyer"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/></svg></button></form>';
    root.appendChild(panel);
    log = panel.querySelector('.al-log');
    input = panel.querySelector('input');
    panel.addEventListener('click', onPanelClick);
    panel.querySelector('.al-ask').addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('input', suggest);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
    welcome();
  }

  function bubble(html, who, cls) {
    var d = document.createElement('div');
    d.className = 'al-msg al-' + who + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  // Alice « écrit » un instant avant de répondre
  function say(html, after) {
    var t = bubble('<span class="al-typing"><i></i><i></i><i></i></span>', 'bot');
    setTimeout(function () { t.innerHTML = html; t.classList.add('al-in'); log.scrollTop = log.scrollHeight; if (after) after(t); }, reduce ? 0 : 650);
  }

  function welcome() {
    log.innerHTML = '';
    var h = new Date().getHours();
    say((h < 18 && h >= 5 ? 'Bonjour' : 'Bonsoir') + ' ! Je suis <b>Alice</b> 👋 Je réponds à vos questions sur le site et sur la Bourse, et je vous <b>conduis à l’endroit exact</b>. Choisissez un thème :', function () {
      bubble('<div class="al-cats">' + CATS.map(function (c) { return '<button type="button" data-al-cat="' + c.id + '"><span>' + c.icon + '</span>' + esc(c.label) + '</button>'; }).join('') + '</div>', 'bot', 'al-plain');
    });
  }

  function showCat(id) {
    var c = CATS.filter(function (x) { return x.id === id; })[0];
    bubble(esc(c.icon + ' ' + c.label), 'me');
    say('Voici les questions les plus posées :', function () {
      bubble('<div class="al-qs">' + QA.filter(function (x) { return x.c === id; }).map(qBtn).join('') + '</div>', 'bot', 'al-plain');
    });
  }
  var qBtn = function (x) { return '<button type="button" data-al-q="' + x.id + '">' + esc(x.q) + '<span aria-hidden="true">›</span></button>'; };

  function answer(id, silent) {
    var x = QA.filter(function (y) { return y.id === id; })[0];
    if (!x) return;
    if (!silent) bubble(esc(x.q), 'me');
    var acts = '';
    if (x.go) acts += '<button type="button" class="al-go" data-al-go="' + x.id + '">' + esc(x.btn || 'Me montrer') + ' <span aria-hidden="true">→</span></button>';
    acts += '<button type="button" class="al-more" data-al-cat="' + x.c + '">Autres questions</button>';
    say('<p>' + x.a + '</p><div class="al-acts">' + acts + '</div>');
  }

  // Recherche par mots-clés (sans accents, tolérante)
  function rank(text) {
    var w = norm(text).split(/\s+/).filter(function (t) { return t.length > 1 && !/^(le|la|les|de|des|du|un|une|et|ou|a|en|je|on|est|ce|que|qui|quoi|comment|ou|pour|mon|ma|mes|sur)$/.test(t); });
    if (!w.length) return [];
    return QA.map(function (x) {
      var s = 0, words = x.n.split(/\s+/), title = norm(x.q).split(/\s+/);
      w.forEach(function (t) {
        if (words.indexOf(t) >= 0) s += title.indexOf(t) >= 0 ? 4 : 3;              // mot exact (plus fort dans la question)
        else if (t.length >= 3 && words.some(function (m) { return m.indexOf(t) === 0 || (t.length > 4 && t.indexOf(m) === 0 && m.length > 3); })) s += 1; // début de mot
      });
      return { x: x, s: s };
    }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).filter(function (r, k, all) { return r.s >= all[0].s / 2; }).slice(0, 4).map(function (r) { return r.x; });
  }
  function ask(text) {
    text = (text || '').trim();
    if (!text) return;
    input.value = ''; clearSuggest();
    bubble(esc(text), 'me');
    var r = rank(text);
    if (r.length === 1) return answer(r[0].id, true);
    if (r.length) {
      say('Voici ce que j’ai trouvé :', function () { bubble('<div class="al-qs">' + r.map(qBtn).join('') + '</div>', 'bot', 'al-plain'); });
    } else {
      say('Je n’ai pas encore la réponse à cette question. Essayez avec un mot-clé (<b>dividende</b>, <b>PER</b>, <b>Mag</b>, <b>Premium</b>…), choisissez un thème, ou écrivez-nous.', function () {
        bubble('<div class="al-acts"><button type="button" class="al-more" data-al-home>Voir les thèmes</button><a class="al-go" href="/contact/">Nous écrire →</a></div>', 'bot', 'al-plain');
      });
    }
  }
  function suggest() {
    clearSuggest();
    var r = input.value.trim().length >= 3 ? rank(input.value) : [];
    if (!r.length) return;
    var s = document.createElement('div');
    s.className = 'al-sug';
    s.innerHTML = r.slice(0, 3).map(function (x) { return '<button type="button" data-al-q="' + x.id + '" data-al-sug>' + esc(x.q) + '</button>'; }).join('');
    panel.querySelector('.al-ask').before(s);
  }
  function clearSuggest() { var s = panel && panel.querySelector('.al-sug'); if (s) s.remove(); }

  function onPanelClick(e) {
    var t = e.target.closest('button, a');
    if (!t) return;
    if (t.hasAttribute('data-al-close')) closePanel();
    else if (t.hasAttribute('data-al-home')) { bubble('Revenir aux thèmes', 'me'); setTimeout(welcome, 50); }
    else if (t.hasAttribute('data-al-cat')) showCat(t.getAttribute('data-al-cat'));
    else if (t.hasAttribute('data-al-q')) { if (t.hasAttribute('data-al-sug')) { input.value = ''; clearSuggest(); } answer(t.getAttribute('data-al-q')); }
    else if (t.hasAttribute('data-al-go')) go(t.getAttribute('data-al-go'));
  }

  // ───────── « Me montrer » : bonne page, bon endroit, mis en lumière ─────────
  function samePage(path) { var a = document.createElement('a'); a.href = path; return a.pathname === location.pathname && !/visite=1/.test(path); }
  function go(id) {
    var x = QA.filter(function (y) { return y.id === id; })[0];
    if (!x || !x.go) return;
    var page = x.go[0];
    if (/visite=1/.test(page)) {
      closePanel();
      var here = page.split('?')[0] === location.pathname;
      if (here && window.BxTour) { window.BxTour.open(); return; }
      location.href = page; return;
    }
    if (samePage(page)) { closePanel(); show(x); return; }
    ss('al-go', id);
    location.href = page;
  }
  function show(x) {
    var sel = x.go[1], msg = x.go[2];
    if (!sel) return;
    var tries = 0;
    (function wait() {
      var el = document.querySelector(sel);
      if ((!el || !el.getBoundingClientRect().height) && tries++ < 40) {
        // Page Analyse : la fiche de Sonatel s'ouvre d'abord
        if (/fx-detail/.test(sel) && tries === 3) { var b = document.querySelector('[data-fx-body] tr[data-sym="SNTS"] .fx-open'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }
        return setTimeout(wait, 150);
      }
      if (!el) return;
      var r = el.getBoundingClientRect();
      var y = scrollY + r.top - Math.max(100, (innerHeight - Math.min(r.height, innerHeight * 0.6)) / 2 - 40);
      scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(function () { spot(el, msg); }, reduce ? 50 : 650);
    })();
  }
  var spotEl = null, spotT = 0;
  function spot(el, msg) {
    clearSpot();
    var ring = document.createElement('div');
    ring.className = 'al-ring';
    ring.innerHTML = '<div class="al-tip"><span aria-hidden="true">' + ALICE + '</span><p>' + esc(msg || 'C’est ici !') + '</p><button type="button" aria-label="Fermer">×</button></div>';
    document.body.appendChild(ring);
    spotEl = { ring: ring, el: el };
    var place = function () {
      if (!spotEl) return;
      var r = el.getBoundingClientRect(), p = 8;
      ring.style.top = (r.top - p) + 'px'; ring.style.left = (r.left - p) + 'px';
      ring.style.width = (r.width + p * 2) + 'px'; ring.style.height = (r.height + p * 2) + 'px';
      ring.classList.toggle('al-tip-up', r.bottom + 120 > innerHeight);
    };
    place();
    spotEl.place = place;
    addEventListener('scroll', place, { passive: true }); addEventListener('resize', place);
    ring.querySelector('button').addEventListener('click', clearSpot);
    spotT = setTimeout(clearSpot, 7000);
    var f = el.matches && el.matches('input, select') ? el : null;
    if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 300);
  }
  function clearSpot() {
    clearTimeout(spotT);
    if (!spotEl) return;
    removeEventListener('scroll', spotEl.place); removeEventListener('resize', spotEl.place);
    var r = spotEl.ring; spotEl = null;
    r.classList.add('al-out'); setTimeout(function () { r.remove(); }, 250);
  }

  // ───────── Ouverture / fermeture ─────────
  function openPanel() {
    nudge(false); ss('al-nudge', '1');
    if (!panel) buildPanel();
    opened = true;
    root.classList.add('is-open');
    root.querySelector('.al-launch').setAttribute('aria-expanded', 'true');
    setTimeout(function () { if (matchMedia('(min-width: 600px)').matches) input.focus({ preventScroll: true }); }, 250);
  }
  function closePanel() {
    opened = false;
    root.classList.remove('is-open');
    root.querySelector('.al-launch').setAttribute('aria-expanded', 'false');
  }
  function toggle() { if (opened) closePanel(); else openPanel(); }
  function nudge(on) { var n = root.querySelector('.al-nudge'); if (n) n.hidden = !on; }

  mount();
  window.BxAlice = { open: openPanel, close: closePanel };

  // Arrivée depuis « Me montrer » sur une autre page
  var pending = ss('al-go');
  if (pending) {
    try { sessionStorage.removeItem('al-go'); } catch (e) { /* stockage indisponible */ }
    var x = QA.filter(function (y) { return y.id === pending; })[0];
    if (x) setTimeout(function () { show(x); }, 700);
  }
  // Petit message d'accueil, une fois par visite, quand aucune visite guidée n'est ouverte
  if (!ss('al-nudge') && !pending) setTimeout(function () {
    if (!opened && !document.body.classList.contains('gt-on') && !ss('al-nudge')) { nudge(true); setTimeout(function () { nudge(false); }, 9000); }
  }, 9000);
})();
