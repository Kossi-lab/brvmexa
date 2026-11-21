// Fiches publiques des actions de la BRVM : https://www.brvmexa.com/actions/<nom>-<symbole>/  et la liste /actions/.
// Pages statiques (lisibles par tous les moteurs, sans JavaScript), créées par le robot à partir des données publiques :
// cours (brvm.org), performances, historique, dividendes, nombre d'actions. Aucun chiffre n'est inventé : une donnée absente
// n'est pas affichée. Les ratios Premium (BPA, PER, rendement net, comptes sur 5 ans) restent sur la page Analyse.
// Mise à jour : au plus toutes les 6 heures, ou dès qu'une nouvelle séance est publiée (évite de réécrire 48 pages toutes les 15 min).
import fs from 'node:fs/promises';
import path from 'node:path';
import { esc } from './pages.mjs';

const SITE = 'https://www.brvmexa.com';
const REFRESH_MS = 6 * 3600 * 1000;
const ADJ = { CI: 'ivoirienne', SN: 'sénégalaise', BJ: 'béninoise', BF: 'burkinabè', ML: 'malienne', NE: 'nigérienne', TG: 'togolaise', GW: 'bissau-guinéenne' };

export const slugify = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’'`]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const stockSlug = (q) => `${slugify(q.shortName || q.name)}-${String(q.symbol).toLowerCase()}`;

const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sp = (s) => s.replace(/[\u202f\u00a0]/g, '\u202f');
const F = (v, d = 0) => (v == null || !isFinite(v) ? '—' : sp(nf(d).format(v)));
const P = (v, sign = true) => (v == null || !isFinite(v) ? '—' : (sign && v > 0 ? '+' : '') + sp(nf(2).format(v)) + ' %');
const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const bigF = (v) => {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1e9) return sp(nf(v >= 1e11 ? 0 : 1).format(v / 1e9)) + ' milliards FCFA';
  if (v >= 1e6) return sp(nf(1).format(v / 1e6)) + ' millions FCFA';
  return F(v) + ' FCFA';
};
function frDate(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  try { return new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('fr-FR', { ...opts, timeZone: 'Africa/Abidjan' }); } catch { return String(iso); }
}
async function readJson(f, fb) { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fb; } }
async function writeIfChanged(file, html) {
  const old = await fs.readFile(file, 'utf8').catch(() => null);
  if (old === html) return false;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
  return true;
}
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u })) });

/** Graphique du cours sur 1 an, en SVG statique (aucun script). */
function chartSvg(hist) {
  const pts = hist.filter((h) => h && isFinite(h.c) && h.c > 0);
  if (pts.length < 20) return '';
  const W = 720, H = 220, pad = 8;
  const cs = pts.map((p) => p.c), lo = Math.min(...cs), hi = Math.max(...cs), span = hi - lo || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (c) => pad + (1 - (c - lo) / span) * (H - 2 * pad);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.c).toFixed(1)}`).join(' ');
  const up = pts.at(-1).c >= pts[0].c;
  const col = up ? '#16C47F' : '#F0526B';
  const label = `Évolution du cours sur un an, du ${frDate(pts[0].d)} (${F(pts[0].c)} FCFA) au ${frDate(pts.at(-1).d)} (${F(pts.at(-1).c)} FCFA). Plus haut ${F(hi)} FCFA, plus bas ${F(lo)} FCFA.`;
  return `<figure class="st-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="none">
<defs><linearGradient id="stg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
<path d="${line} L${x(pts.length - 1).toFixed(1)} ${H} L${pad} ${H} Z" fill="url(#stg)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
<figcaption><span>${esc(frDate(pts[0].d, { month: 'short', year: 'numeric' }))}</span><span>Plus haut ${F(hi)} · plus bas ${F(lo)} FCFA</span><span>${esc(frDate(pts.at(-1).d, { day: 'numeric', month: 'short' }))}</span></figcaption></figure>`;
}

function stat(label, value, hint = '', cls = '') {
  return `<div class="st-stat"><small>${esc(label)}</small><b class="${cls}">${value}</b>${hint ? `<span>${hint}</span>` : ''}</div>`;
}

/** Corps de la fiche d'une action. */
export function stockBody(q, ctx) {
  const { session, perf, div, fund, hist, news, peers, slugs } = ctx;
  const sym = q.symbol, name = q.shortName || q.name;
  const cap = fund?.shares && q.close ? q.close * fund.shares : null;
  const adj = ADJ[q.country] ? ` ${ADJ[q.country]}` : '';
  const when = `${frDate(session.sessionDate)}${session.sessionTime ? ` (données publiées à ${session.sessionTime.replace(':', ' h ')} GMT)` : ''}`;
  const y1 = perf?.y1;
  const intro = [
    `<strong>${esc(name)}</strong> (symbole <strong>${esc(sym)}</strong>) est une société${esc(adj)} cotée à la Bourse Régionale des Valeurs Mobilières (BRVM), dans le secteur <strong>${esc(q.sector || '—')}</strong>. Sa dénomination officielle à la cote est « ${esc(q.name)} ».`,
    fund?.shares ? `Son capital est composé de ${F(fund.shares)} actions${fund.float != null ? `, dont ${sp(nf(fund.float % 1 ? 2 : 0).format(fund.float))} % sont disponibles à l’achat en bourse (flottant)` : ''}${fund.year ? `, selon les états financiers de l’exercice ${fund.year}` : ''}.` : '',
    cap ? `Au ${esc(frDate(session.sessionDate))}, sa capitalisation boursière atteint environ ${bigF(cap)}.` : '',
    y1 != null ? `Sur un an, son cours ${y1 >= 0 ? 'a progressé' : 'a reculé'} de ${sp(nf(2).format(Math.abs(y1)))} %.` : '',
  ].filter(Boolean).map((t) => `<p>${t}</p>`).join('');

  const dh = (div?.history ?? []).slice(-8).reverse();
  const lastDiv = div?.last;
  const grossYield = div?.annual && q.close ? (div.annual / q.close) * 100 : null;
  const divHtml = dh.length
    ? `<section class="st-sec" aria-labelledby="st-div"><h2 id="st-div">Dividendes de ${esc(name)}</h2>
<div class="st-stats st-stats--3">${stat('Dernier dividende brut', `${F(lastDiv?.a, lastDiv?.a % 1 ? 2 : 0)} F`, lastDiv ? `payé le ${esc(frDate(lastDiv.d))}${lastDiv.ex ? ` · exercice ${lastDiv.ex}` : ''}` : '')}
${grossYield != null ? stat('Rendement brut', P(grossYield, false), 'dividende annuel brut ÷ cours actuel') : ''}
${stat('Versements', `${dh.length >= 8 ? '8+' : dh.length}`, 'dans l’historique ci-dessous')}</div>
<div class="st-table-wrap"><table class="st-table"><caption>Historique des dividendes bruts par action (FCFA)</caption><thead><tr><th scope="col">Date de paiement</th><th scope="col">Montant brut</th><th scope="col">Exercice</th></tr></thead><tbody>
${dh.map((h) => `<tr><td>${esc(frDate(h.d))}</td><td class="r">${F(h.a, h.a % 1 ? 2 : 0)} F</td><td class="r">${h.ex ?? '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="st-note">Montants bruts, avant l’impôt retenu à la source (son taux dépend du pays de la société), ajustés des éventuels fractionnements d’actions. Seule l’annonce officielle de la société fait foi. <a href="/apprendre/dividendes-brvm/">Comprendre les dividendes</a>.</p></section>`
    : `<section class="st-sec"><h2>Dividendes de ${esc(name)}</h2><p>Aucun versement de dividende n’est enregistré dans notre historique pour cette société.</p></section>`;

  const newsHtml = news.length
    ? `<section class="st-sec" aria-labelledby="st-news"><h2 id="st-news">Actualités de ${esc(name)}</h2><ul class="st-news">${news.map((n) =>
      `<li><a href="/actualites/a/${esc(n.id)}/"><b>${esc(n.title)}</b><small>${esc(frDate(n.publishedAt))}</small></a></li>`).join('')}</ul></section>` : '';

  const peersHtml = peers.length
    ? `<section class="st-sec" aria-labelledby="st-peers"><h2 id="st-peers">Autres actions du secteur ${esc(q.sector)}</h2><ul class="st-peers">${peers.map((p) =>
      `<li><a href="/actions/${slugs[p.symbol]}/"><b>${esc(p.shortName || p.name)}</b><span>${esc(p.symbol)} · ${F(p.close)} F</span><em class="${tone(p.change)}">${P(p.change)}</em></a></li>`).join('')}</ul></section>` : '';

  return `<div class="st-page" data-st="${esc(sym)}" data-session="${esc(session.sessionDate)}" data-gen="${new Date().toISOString()}">
<div class="container st-wrap">
<nav class="ar-crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">›</span><a href="/actions/">Actions BRVM</a><span aria-hidden="true">›</span><span>${esc(name)}</span></nav>
<header class="st-head">
<p class="st-kick"><span>${esc(sym)}</span>${esc(q.sector || '')}${q.countryName ? ` · ${esc(q.countryName)}` : ''}</p>
<h1>${esc(name)} (${esc(sym)}) : cours de l’action à la BRVM</h1>
<div class="st-price"><b data-live="close">${F(q.close)} <small>FCFA</small></b><span class="st-chg ${tone(q.change)}" data-live="change">${P(q.change)}</span></div>
<p class="st-when">Cours de clôture de la séance du <time datetime="${esc(session.sessionDate)}" data-live="when">${esc(when)}</time> · source : <a href="https://www.brvm.org" target="_blank" rel="noopener">BRVM</a></p>
</header>
<div class="st-stats">
${stat('Cours de la veille', `${F(q.prevClose)} F`)}${stat('Ouverture', `${F(q.open)} F`)}${stat('Volume échangé', F(q.volume), 'titres')}
${stat('Capitalisation', bigF(cap), fund?.shares ? `${F(fund.shares)} actions` : '')}
${perf?.hi52 ? stat('Plus haut 52 semaines', `${F(perf.hi52)} F`, perf.full52 === false ? 'historique incomplet' : '') : ''}${perf?.lo52 ? stat('Plus bas 52 semaines', `${F(perf.lo52)} F`) : ''}
</div>
${chartSvg(hist)}
<div class="st-perf" role="list" aria-label="Performances">${[['1 semaine', perf?.w1], ['1 mois', perf?.m1], ['Depuis le 1er janvier', perf?.ytd], ['1 an', perf?.y1]]
  .map(([l, v]) => `<div role="listitem"><small>${l}</small><b class="${tone(v)}">${P(v)}</b></div>`).join('')}</div>
<section class="st-sec" aria-labelledby="st-pres"><h2 id="st-pres">Présentation de ${esc(name)}</h2>${intro}</section>
${divHtml}
<aside class="st-prem"><div><b>BPA, PER, rendement net, comptes sur 5 ans et avis de David</b><span>Les ratios de ${esc(name)} comparés à la médiane de son secteur, la juste valeur indicative et un plan d’action chiffré.</span></div>
<a class="btn btn--primary" href="/fondamentaux/#${encodeURIComponent(sym)}">Voir l’analyse de ${esc(sym)}</a></aside>
${newsHtml}${peersHtml}
<section class="st-sec st-src"><h2>Sources et mise à jour</h2><ul>
<li>Cours, variation et volume : Bourse Régionale des Valeurs Mobilières (brvm.org), séance du ${esc(frDate(session.sessionDate))}. La page est mise à jour automatiquement plusieurs fois par jour.</li>
<li>Historique et performances : cours de clôture publiés par la BRVM.</li>
${fund?.shares ? `<li>Nombre d’actions et flottant : états financiers de la société (exercice ${fund.year ?? '—'}).</li>` : ''}
${dh.length ? '<li>Dividendes : historique public des versements, ajusté des fractionnements.</li>' : ''}
<li>Méthodes de calcul : <a href="/sources-et-methodes/">Sources et méthodes</a>.</li></ul></section>
<p class="fx-disclaimer">Informations fournies à titre pédagogique : elles ne constituent ni un conseil en investissement, ni une recommandation d’achat ou de vente de ${esc(name)}. Investir en bourse comporte un risque de perte en capital. <a href="/avertissement-risques/">En savoir plus</a>.</p>
</div></div>`;
}

/** Liste des 48 actions, par secteur. */
function indexBody(quotes, session, slugs) {
  const by = {};
  for (const q of quotes) (by[q.sector || 'Autres'] ??= []).push(q);
  const sectors = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  const tables = sectors.map((s) => `<section class="st-sec"><h2>${esc(s)} <small>(${by[s].length})</small></h2><div class="st-table-wrap"><table class="st-table st-table--list"><thead><tr>
<th scope="col">Société</th><th scope="col">Symbole</th><th scope="col">Pays</th><th scope="col" class="r">Cours</th><th scope="col" class="r">Variation</th></tr></thead><tbody>
${by[s].sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name, 'fr')).map((q) => `<tr><td><a href="/actions/${slugs[q.symbol]}/">${esc(q.shortName || q.name)}</a></td><td>${esc(q.symbol)}</td><td>${esc(q.countryName || '')}</td><td class="r">${F(q.close)} F</td><td class="r ${tone(q.change)}">${P(q.change)}</td></tr>`).join('')}
</tbody></table></div></section>`).join('');
  return `<div class="st-page" data-session="${esc(session.sessionDate)}" data-gen="${new Date().toISOString()}"><div class="container st-wrap">
<nav class="ar-crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">›</span><span>Actions BRVM</span></nav>
<header class="st-head"><p class="st-kick"><span>BRVM</span>${quotes.length} sociétés cotées</p><h1>Les ${quotes.length} actions cotées à la BRVM</h1>
<p class="ar-lead">La liste complète des sociétés cotées à la Bourse Régionale des Valeurs Mobilières, classées par secteur, avec leur dernier cours de clôture. Cliquez sur une société pour voir sa fiche : historique du cours, capitalisation, dividendes et actualités.</p>
<p class="st-when">Cours de la séance du ${esc(frDate(session.sessionDate))} · source : <a href="https://www.brvm.org" target="_blank" rel="noopener">BRVM</a> · <a href="/marches/">cours et indices en direct</a></p></header>
${tables}
<p>Nouveau sur la BRVM ? Lisez <a href="/apprendre/comment-fonctionne-la-brvm/">Comment fonctionne la BRVM</a> et <a href="/apprendre/comment-acheter-des-actions-brvm/">Comment acheter des actions à la BRVM</a>.</p>
<p class="fx-disclaimer">Informations pédagogiques, sans valeur de conseil en investissement.</p></div></div>`;
}

function fill(tpl, { title, desc, url, image, jsonld, body }) {
  return tpl.split('{{TITLE}}').join(esc(title)).split('{{DESC}}').join(esc(desc)).split('{{URL}}').join(esc(url))
    .split('{{IMAGE}}').join(esc(image)).split('{{JSONLD}}').join(jsonld).split('{{BODY}}').join(body);
}

/** Faut-il réécrire cette page ? (absente, nouvelle séance, ou plus de 6 heures) */
async function stale(file, sessionDate, now) {
  const old = await fs.readFile(file, 'utf8').catch(() => null);
  if (!old) return true;
  const s = /data-session="([^"]*)"/.exec(old)?.[1], g = /data-gen="([^"]*)"/.exec(old)?.[1];
  return s !== sessionDate || !g || now - Date.parse(g) > REFRESH_MS;
}

export async function writeStockPages({ dataDir, docsDir, tplDir, log = console.log, now = Date.now(), force = false }) {
  const tpl = await fs.readFile(path.join(tplDir, 'action.html'), 'utf8').catch(() => null);
  const tplIndex = await fs.readFile(path.join(tplDir, 'actions.html'), 'utf8').catch(() => null);
  if (!tpl || !tplIndex) { log('Fiches actions : modèle absent'); return { written: [], slugs: {} }; }
  const quotes = await readJson(path.join(dataDir, 'quotes.json'), null);
  if (!quotes?.items?.length || !quotes.sessionDate) { log('Fiches actions : cours indisponibles'); return { written: [], slugs: {} }; }
  const perf = (await readJson(path.join(dataDir, 'performance.json'), {})).items ?? {};
  const divs = (await readJson(path.join(dataDir, 'dividends.json'), {})).items ?? {};
  const fund = (await readJson(path.join(docsDir, 'assets', 'data', 'fondamentaux.json'), {})).items ?? {};
  const news = ((await readJson(path.join(dataDir, 'news.json'), {})).items ?? []).filter((n) => n.rewritten && !n.pinned);
  const items = quotes.items.filter((q) => /^[A-Z0-9]{2,12}$/.test(q.symbol));
  const slugs = Object.fromEntries(items.map((q) => [q.symbol, stockSlug(q)]));
  const session = { sessionDate: quotes.sessionDate, sessionTime: quotes.sessionTime };
  const written = [];

  for (const q of items) {
    const file = path.join(docsDir, 'actions', slugs[q.symbol], 'index.html');
    if (!force && !(await stale(file, session.sessionDate, now))) continue;
    const histAll = await readJson(path.join(dataDir, 'history', `${q.symbol}.json`), []);
    const since = new Date(now - 366 * 864e5).toISOString().slice(0, 10);
    const hist = (Array.isArray(histAll) ? histAll : histAll.items ?? []).filter((h) => h.d >= since);
    const name = q.shortName || q.name;
    const url = `${SITE}/actions/${slugs[q.symbol]}/`;
    const ctx = {
      session, perf: perf[q.symbol], div: divs[q.symbol], fund: fund[q.symbol], hist, slugs,
      news: news.filter((n) => (n.symbols ?? []).includes(q.symbol)).slice(0, 5).map((n) => ({ ...n, id: String(n.id).toLowerCase().replace(/[^a-z0-9-]/g, '') })),
      peers: items.filter((p) => p.sector === q.sector && p.symbol !== q.symbol).slice(0, 8),
    };
    const desc = `Cours de l’action ${name} (${q.symbol}) à la BRVM : ${F(q.close)} FCFA (${P(q.change)}) le ${frDate(session.sessionDate)}. Historique, plus haut et plus bas sur 52 semaines, capitalisation, dividendes et actualités.`;
    const jsonld = ld(crumbs([['Accueil', SITE + '/'], ['Actions BRVM', SITE + '/actions/'], [name, url]]))
      + ld({ '@context': 'https://schema.org', '@type': 'WebPage', name: `${name} (${q.symbol}) : cours de l’action à la BRVM`, url, inLanguage: 'fr',
        dateModified: new Date(now).toISOString(), description: desc, isPartOf: { '@type': 'WebSite', name: 'BRVMexa', url: SITE + '/' },
        about: { '@type': 'Corporation', name: q.name, alternateName: name, tickerSymbol: `BRVM:${q.symbol}`, ...(q.countryName ? { address: { '@type': 'PostalAddress', addressCountry: q.countryName } } : {}) } });
    const html = fill(tpl, { title: `${name} (${q.symbol}) : cours de l’action, dividendes, historique`, desc, url, image: `${SITE}/assets/img/og/og-site.jpg`, jsonld, body: stockBody(q, ctx) });
    if (await writeIfChanged(file, html)) written.push(url);
  }

  const idxFile = path.join(docsDir, 'actions', 'index.html');
  if (force || written.length || (await stale(idxFile, session.sessionDate, now))) {
    const url = `${SITE}/actions/`;
    const jsonld = ld(crumbs([['Accueil', SITE + '/'], ['Actions BRVM', url]]))
      + ld({ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Actions cotées à la BRVM', numberOfItems: items.length,
        itemListElement: items.map((q, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/actions/${slugs[q.symbol]}/`, name: q.shortName || q.name })) });
    const html = fill(tplIndex, { title: `Les ${items.length} actions cotées à la BRVM : cours et fiches`, url, image: `${SITE}/assets/img/og/og-site.jpg`, jsonld,
      desc: `Liste des ${items.length} actions cotées à la BRVM par secteur, avec leur dernier cours : banques, télécoms, agro-industrie, énergie… Une fiche par société avec historique et dividendes.`,
      body: indexBody(items, session, slugs) });
    if (await writeIfChanged(idxFile, html)) written.push(url);
  }
  log(`Fiches actions : ${items.length} sociétés${written.length ? `, ${written.length} page(s) mise(s) à jour` : ', à jour'}`);
  return { written, slugs };
}
