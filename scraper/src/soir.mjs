// BRVMexa Soir : script du journal télévisé de la séance, rédigé automatiquement chaque soir.
// Entrées : data/market.json, indices.json, news.json, une.json (déjà produits par le robot).
// Sorties : data/soir/latest.json, data/soir/latest.md, data/soir/AAAA-MM-JJ.md
// Le texte est construit uniquement à partir des données publiées (aucune IA, aucun chiffre inventé).
// Il doit être relu avant l'enregistrement. Ton éducatif : aucun conseil, aucune prédiction.
import fs from 'node:fs/promises';
import path from 'node:path';

// À modifier ici le jour où l'application iPhone est publiée.
export const STORES = {
  googlePlay: 'disponible',      // 'disponible' ou 'bientôt disponible'
  appStore: 'bientôt disponible',
  site: 'www.brvmexa.com',
};

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SECTEURS = {
  'brvm-industriels': 'les Industriels', 'brvm-energie': 'l’Énergie', 'brvm-consommation-de-base': 'la Consommation de base',
  'brvm-consommation-discretionnaire': 'la Consommation discrétionnaire', 'brvm-services-financiers': 'les Services financiers',
  'brvm-services-publics': 'les Services publics', 'brvm-telecommunications': 'les Télécommunications',
};
const MAIN = ['brvm-30', 'brvm-composite', 'brvm-prestige', 'brvm-principal', 'brvm-composite-total-return'];

// Le mot de la fin : une notion différente chaque jour (définitions éducatives, sans conseil)
export const MOTS = [
  ['dividende', 'C’est la part du bénéfice qu’une société verse à ses actionnaires, en général une fois par an. Elle n’est jamais garantie : elle dépend des résultats et de la décision de l’assemblée générale.'],
  ['indice boursier', 'C’est un thermomètre du marché : il suit l’évolution d’un groupe d’actions. Le BRVM Composite, par exemple, regroupe toutes les actions cotées à la BRVM.'],
  ['SGI', 'La société de gestion et d’intermédiation est l’intermédiaire agréé qui ouvre votre compte titres et passe vos ordres en bourse. On ne peut pas acheter d’actions à la BRVM sans passer par une SGI.'],
  ['capitalisation boursière', 'C’est la valeur d’une société en bourse : le cours de l’action multiplié par le nombre d’actions. Elle change chaque jour avec le cours.'],
  ['PER', 'Le PER compare le prix d’une action au bénéfice qu’elle rapporte. Un PER de 10 signifie que l’on paie l’action dix fois le bénéfice annuel par action. Il se compare surtout entre sociétés d’un même secteur.'],
  ['rendement du dividende', 'C’est le dividende annuel divisé par le cours de l’action. Il indique ce que le dividende représente par rapport au prix payé, mais un rendement élevé peut aussi signaler un risque.'],
  ['diversification', 'C’est le fait de répartir son épargne entre plusieurs sociétés et secteurs, pour ne pas dépendre d’un seul titre. Elle réduit le risque, sans le supprimer.'],
  ['volume', 'C’est le nombre de titres échangés pendant la séance. Un volume faible signifie qu’il peut être difficile d’acheter ou de vendre rapidement une action.'],
  ['ordre à cours limité', 'C’est un ordre d’achat ou de vente avec un prix maximum ou minimum fixé à l’avance. Il protège du prix, mais il peut ne pas être exécuté. Vous pouvez vous entraîner gratuitement dans le simulateur BRVMexa.'],
  ['introduction en bourse', 'C’est le moment où une société met pour la première fois ses actions en vente au public, avant leur cotation. C’est une occasion de devenir actionnaire, mais le cours peut ensuite monter comme baisser.'],
  ['obligation', 'C’est un prêt que vous accordez à un État ou à une entreprise, en échange d’intérêts. Le risque et le rendement sont en général plus faibles que ceux d’une action, mais pas nuls.'],
  ['date de détachement', 'C’est la date à partir de laquelle l’action se négocie sans le droit au prochain dividende. Pour toucher le dividende, il faut détenir l’action avant cette date.'],
  ['fractionnement d’action', 'C’est la division d’une action en plusieurs actions de valeur plus faible. La valeur totale ne change pas : on a simplement plus de titres, chacun moins cher, comme Sonatel en octobre 2026.'],
  ['horizon de placement', 'C’est la durée pendant laquelle vous comptez garder votre argent investi. En bourse, plus l’horizon est long, plus on peut traverser les baisses passagères ; l’argent dont on a besoin à court terme ne devrait pas y être placé.'],
  ['épargne régulière', 'C’est investir un petit montant à intervalles réguliers plutôt qu’une grosse somme d’un coup. Cela lisse le prix d’achat dans le temps. L’outil d’épargne de l’application BRVMexa permet de le simuler.'],
  ['compte titres', 'C’est le compte ouvert auprès d’une SGI qui enregistre les actions et obligations que vous détenez. Il est différent de votre compte bancaire.'],
  ['arnaque à l’investissement', 'Méfiez-vous de toute personne qui promet des gains rapides et garantis. En bourse, aucun gain n’est garanti, et les ordres passent toujours par une SGI agréée, jamais par un numéro personnel.'],
];

const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
const pct = (v) => {
  const a = Math.abs(v);
  return `${fr(a, a >= 0.1 ? 1 : 2)} %`;
};
const move = (v) => (v > 0 ? `en hausse de ${pct(v)}` : v < 0 ? `en baisse de ${pct(v)}` : 'stable');
const verb = (v) => (v > 0 ? `gagne ${pct(v)}` : v < 0 ? `cède ${pct(v)}` : 'reste stable');
const money = (v) => (v >= 1e9 ? `${fr(v / 1e9, 1)} milliards de francs CFA` : `${fr(v / 1e6, 0)} millions de francs CFA`);
const pts = (v) => fr(Math.round(v), 0);
const name = (q) => q?.name || q?.shortName || q?.symbol || '';

export function dateLongue(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function firstSentences(text, n = 2) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || [];
  return parts.slice(0, n).join(' ').trim();
}

/** Choisit 2 brèves : articles de la Rédaction des dernières 24 h, hors compte rendu de séance, hors « À la une » */
export function pickBreves(items, une, refIso, n = 2) {
  const ref = Date.parse(refIso);
  const STOP = new Set(['bourse', 'brvm', 'marché', 'ivoire', 'côte', 'capital', 'actions', 'grand', 'public', 'prépare', 'lance', 'entrée', 'historique', 'compartiment', 'prestige']);
  const sig = (t) => String(t || '').toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  const uneWords = new Set(sig(une?.title));
  return (items || [])
    .filter((x) => !x.pinned && x.rewritten && x.summary)
    .filter((x) => ref - Date.parse(x.publishedAt) < 30 * 3600e3 && Date.parse(x.publishedAt) <= ref + 3600e3)
    .filter((x) => !(x.category === 'Marchés' && (x.symbols || []).length >= 4)) // compte rendu de séance
    .filter((x) => !/\bBRVM\b.*(séance|clôture|termine|recul|hausse|baisse)/i.test(x.title))
    .filter((x) => {
      return !sig(x.title).some((t) => uneWords.has(t)); // pas le même sujet (ni la même société) que la une
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, n);
}

export function buildSoir({ market, indices, news, une, generatedAt = new Date().toISOString() }) {
  if (!market?.sessionDate) throw new Error('Pas de séance disponible');
  const date = market.sessionDate;
  const ix = Object.fromEntries((indices?.items || []).map((i) => [i.id, i]));
  const comp = ix['brvm-composite'], b30 = ix['brvm-30'], prest = ix['brvm-prestige'];
  const sectors = (indices?.items || []).filter((i) => !MAIN.includes(i.id) && typeof i.change === 'number')
    .sort((a, b) => b.change - a.change);
  const g = market.gainers || [], l = market.losers || [], act = market.mostActive || [];
  const up = market.advancing ?? 0, down = market.declining ?? 0, flat = market.unchanged ?? 0;
  const mood = comp ? (comp.change > 0.3 ? 'une BRVM en hausse' : comp.change < -0.3 ? 'une BRVM en repli' : 'une BRVM quasiment stable') : 'la séance de la BRVM';
  const breadth = down > up * 1.5 ? ', avec nettement plus de baisses que de hausses'
    : up > down * 1.5 ? ', avec nettement plus de hausses que de baisses' : '';
  const useUne = une?.date === date && une?.title;
  const breves = pickBreves(news?.items, useUne ? une : null, market.updatedAt || generatedAt);
  const mot = MOTS[(Math.floor(Date.parse(`${date}T00:00:00Z`) / 864e5)) % MOTS.length];

  const S = [];
  S.push({ h: 'Générique', t: '0:00', lines: ['[GÉNÉRIQUE — 10 s] Voix : « La bourse de l’UEMOA, expliquée chaque soir. Voici BRVMexa Soir. »'] });

  const titres = [`Bonsoir et bienvenue dans BRVMexa Soir, nous sommes le ${dateLongue(date)}.`,
    `Au programme ce soir : ${mood}${breadth}.`];
  if (g[0]) titres.push(`${name(g[0])} signe la meilleure performance du jour.`);
  if (useUne) titres.push(`Et à la une : ${une.title.replace(/\.$/, '')}.`);
  else if (breves[0]) titres.push(`Et dans l’actualité : ${breves[0].title.replace(/\.$/, '')}.`);
  S.push({ h: 'Les titres', t: '0:10', lines: titres });

  const seance = ['Commençons par le marché.'];
  if (comp) seance.push(`L’indice BRVM Composite, qui regroupe toutes les actions, termine à ${pts(comp.close)} points, ${move(comp.change)}.`);
  if (b30 && prest) seance.push(`Le BRVM 30, l’indice des trente valeurs les plus actives, est ${move(b30.change)}, et le BRVM Prestige ${move(prest.change)}.`);
  seance.push(`Sur l’ensemble de la séance, ${up} actions ont progressé, ${down} ont reculé et ${flat} sont restées stables.`);
  if (market.transactionsValue) seance.push(`Côté activité, environ ${money(market.transactionsValue)} ont été échangés aujourd’hui.`);
  if (sectors.length >= 2) {
    const best = sectors[0], worst = sectors[sectors.length - 1];
    const L = (x) => SECTEURS[x.id] || x.name.replace(/^BRVM\s+/, '');
    if (best.change > 0 && worst.change < 0) seance.push(`Du côté des secteurs, meilleur score pour ${L(best)}, ${move(best.change)}, tandis que ${L(worst)} ferme la marche, ${move(worst.change)}.`);
    else if (best.change > 0) seance.push(`Du côté des secteurs, meilleur score pour ${L(best)}, ${move(best.change)}.`);
    else if (worst.change < 0) seance.push(`Du côté des secteurs, ${L(worst)} recule le plus, ${move(worst.change)}.`);
  }
  S.push({ h: 'La séance', t: '0:30', lines: seance });

  const pal = [];
  if (g.length) {
    pal.push(`Dans le haut du tableau, ${name(g[0])} ${verb(g[0].change)} à ${fr(g[0].close)} francs CFA.`);
    if (g[1] && g[2]) pal.push(`Suivent ${name(g[1])}, ${move(g[1].change)}, et ${name(g[2])}, ${move(g[2].change)}.`);
  }
  if (l.length) {
    pal.push(`En bas du tableau, ${name(l[0])} ${verb(l[0].change)}${l[1] ? `, ${name(l[1])} ${pct(l[1].change)}` : ''}${l[2] ? ` et ${name(l[2])} ${pct(l[2].change)}` : ''}.`);
  }
  if (act[0]) {
    const a = act[0];
    pal.push(`La valeur la plus échangée du jour est ${name(a)}, avec ${fr(a.volume)} titres, à ${fr(a.close)} francs CFA, ${move(a.change)}.`);
    const big = act.slice(1).find((x) => Math.abs(x.change) >= 5);
    if (big) pal.push(`À noter aussi : ${name(big)}, très échangée, ${big.change > 0 ? 'progresse' : 'recule'} de ${pct(big.change)}.`);
  }
  S.push({ h: 'Le palmarès', t: '1:15', lines: pal });

  const actu = [];
  if (useUne) {
    actu.push(`Notre sujet principal ce soir : ${une.title.replace(/\.$/, '')}.`);
    if (une.summary) actu.push(une.summary);
    const p = une.sections?.[0]?.p?.[1] || une.sections?.[0]?.p?.[0];
    if (p) actu.push(firstSentences(p, 2));
    actu.push('Retrouvez l’article complet dans la rubrique À la une de BRVMexa.');
  }
  if (breves.length) {
    actu.push(useUne ? 'En bref :' : 'Dans l’actualité du jour :');
    for (const b of breves) actu.push(`${b.title.replace(/\.$/, '')}. ${firstSentences(b.summary, 1)}`);
  }
  if (actu.length) S.push({ h: 'L’actualité du jour', t: '2:00', lines: actu.map((x) => x.replace(/\s+/g, ' ').trim()) });

  S.push({ h: 'Le mot de la fin', t: '3:15', lines: [`Le mot du jour : « ${mot[0]} ». ${mot[1]}`] });

  S.push({ h: 'BRVMexa, partout avec vous', t: '3:35', lines: [
    'Pour suivre la BRVM au quotidien, BRVMexa vous accompagne partout.',
    `Sur votre téléphone : l’application BRVMexa est ${STORES.googlePlay} sur Google Play${STORES.appStore ? `, et ${STORES.appStore} sur l’App Store pour iPhone` : ''}. Cours, actualités, alertes, leçons et un simulateur pour vous entraîner sans risque.`,
    `Et sur le web : ${STORES.site.replace('www.', 'www point ').replace('.com', ' point com')}, avec les fiches de toutes les sociétés cotées, leurs dividendes et nos analyses.`,
  ] });

  S.push({ h: 'Fin', t: '3:50', lines: [
    'C’était BRVMexa Soir. Merci de nous avoir suivis, et rendez-vous demain soir, après la clôture. Bonne soirée !',
    `[GÉNÉRIQUE DE FIN — à l’écran] Données BRVM différées, à titre d’information. Pas un conseil en investissement. Investir comporte des risques. ${STORES.site}`,
  ] });

  const spoken = S.flatMap((s) => s.lines).filter((x) => !x.startsWith('[')).join(' ');
  const words = spoken.split(/\s+/).length;
  const md = [
    `# BRVMexa Soir — ${dateLongue(date)}`,
    '',
    `> Script généré automatiquement le ${generatedAt.slice(0, 16).replace('T', ' à ')} GMT à partir des données publiées (source des cours : ${market.source || 'brvm.org'}, données différées).`,
    `> **À relire et à vérifier avant l’enregistrement.** Durée de lecture estimée : ${fr(words / 150, 1)} minutes (${words} mots).`,
    '',
    ...S.flatMap((s) => [`## ${s.t} · ${s.h}`, '', ...s.lines.map((x) => `${x}`), '']),
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  return { v: 1, date, generatedAt, words, sections: S, markdown: md };
}

export async function writeSoir(dataDir, { log = console.log } = {}) {
  const read = async (f, fb = null) => { try { return JSON.parse(await fs.readFile(path.join(dataDir, f), 'utf8')); } catch { return fb; } };
  const [market, indices, news, une] = await Promise.all([read('market.json'), read('indices.json'), read('news.json'), read('une.json')]);
  const s = buildSoir({ market, indices, news, une });
  const dir = path.join(dataDir, 'soir');
  await fs.mkdir(dir, { recursive: true });
  const { markdown, ...json } = s;
  await fs.writeFile(path.join(dir, 'latest.json'), JSON.stringify(json, null, 1) + '\n');
  await fs.writeFile(path.join(dir, 'latest.md'), markdown + '\n');
  await fs.writeFile(path.join(dir, `${s.date}.md`), markdown + '\n');
  log(`BRVMexa Soir : script du ${s.date} (${s.words} mots)`);
  return s;
}
