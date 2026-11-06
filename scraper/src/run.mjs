// Robot de collecte BRVMexa.
// Lancé automatiquement par GitHub Actions (voir .github/workflows/update-data.yml).
// Écrit des fichiers JSON dans /data, que l'application lit en ligne.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseQuotes, parseIndices, parseMarketActivity, parseLastUpdate, parseBonds,
  parseSikaNewsList, parseRss, tagSymbols,
} from './parse.mjs';
import { COMPANIES, COUNTRIES, SECTORS, countryFromSymbol } from './companies.mjs';
import { readHistory, writeHistory, ensureHistory } from './history.mjs';
import { updateDividends } from './dividends.mjs';
import { writePerformance } from './performance.mjs';
import { rewriteItem, extractArticle, writer, QuotaError, AUTHOR } from './rewrite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const BRVM = 'https://www.brvm.org/fr';
const NEWS_MAX = 150;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Mode test hors ligne : BRVMEXA_FIXTURES=dossier lit des pages enregistrées au lieu du réseau
const FIXTURES = process.env.BRVMEXA_FIXTURES;
const FIXTURE_MAP = [
  [/cours-actions\/0$/, 'cours-actions.html'],
  [/\/indices$/, 'indices.html'],
  [/actualites_bourse_brvm$/, 'sika-news.html'],
  [/news\.google\.com/, 'google-news.xml'],
];

export async function fetchText(url, { retries = 3, timeout = 30000 } = {}) {
  if (FIXTURES) {
    const hit = FIXTURE_MAP.find(([re]) => re.test(url));
    if (!hit) throw new Error(`${url} : pas de page de test`);
    return fs.readFile(path.join(FIXTURES, hit[1]), 'utf8');
  }
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BRVMexaBot/1.0; +https://github.com/)',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`${url} : ${lastErr?.message}`);
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 1) + '\n');
}

/** Ajoute ou remplace le point du jour dans l'historique d'un instrument */
async function appendHistory(id, date, point) {
  const file = path.join(DATA, 'history', `${id}.json`);
  const hist = await readHistory(file);
  const idx = hist.findIndex((p) => p.d === date);
  const row = { d: date, ...point };
  if (idx >= 0) hist[idx] = row; else hist.push(row);
  await writeHistory(file, hist);
}

// ───────────────────────────── Cours ─────────────────────────────
async function updateMarket() {
  const now = new Date().toISOString();
  const quotesHtml = await fetchText(`${BRVM}/cours-actions/0`);
  const quotes = parseQuotes(quotesHtml);
  if (quotes.length < 20) throw new Error(`Seulement ${quotes.length} actions lues : structure du site modifiée ?`);
  const session = parseLastUpdate(quotesHtml) ?? { date: now.slice(0, 10), time: null };

  // Secteurs officiels
  const sectorOf = {};
  for (const [id, label] of Object.entries(SECTORS)) {
    try {
      for (const q of parseQuotes(await fetchText(`${BRVM}/cours-actions/${id}`))) sectorOf[q.symbol] = label;
    } catch (e) { log('secteur', id, 'ignoré :', e.message); }
  }

  const items = quotes.map((q) => {
    const ref = COMPANIES[q.symbol] ?? {};
    const country = countryFromSymbol(q.symbol);
    return {
      ...q,
      shortName: ref.shortName ?? titleCase(q.name),
      sector: sectorOf[q.symbol] ?? ref.sector ?? 'Autres',
      country,
      countryName: COUNTRIES[country],
    };
  });

  // Clôture précise de la veille : dernière séance de l'historique, si elle concorde avec la variation officielle
  for (const q of items) {
    const hist = await readHistory(path.join(DATA, 'history', `${q.symbol}.json`));
    const prev = hist.filter((p) => p.d < session.date).at(-1)?.c;
    if (prev > 0 && q.close != null && Math.abs(((q.close / prev) - 1) * 100 - q.change) < 0.006) {
      q.prevClose = prev;
      q.changeAbs = q.close - prev;
    }
  }

  const indicesHtml = await fetchText(`${BRVM}/indices`);
  const indices = parseIndices(indicesHtml);
  if (indices.length < 3) throw new Error(`Seulement ${indices.length} indices lus`);
  const activity = parseMarketActivity(indicesHtml);

  let bonds = [];
  try { bonds = parseBonds(await fetchText(`${BRVM}/cours-obligations/0`)); }
  catch (e) { log('obligations ignorées :', e.message); }

  const traded = items.filter((q) => q.volume > 0);
  const byChange = [...traded].sort((a, b) => b.change - a.change);
  const pick = (q) => ({ symbol: q.symbol, shortName: q.shortName, close: q.close, change: q.change, volume: q.volume });

  const meta = { updatedAt: now, sessionDate: session.date, sessionTime: session.time, source: 'brvm.org' };
  await writeJson(path.join(DATA, 'quotes.json'), { ...meta, items });
  await writeJson(path.join(DATA, 'indices.json'), { ...meta, items: indices });
  if (bonds.length) await writeJson(path.join(DATA, 'bonds.json'), { ...meta, items: bonds });
  await writeJson(path.join(DATA, 'market.json'), {
    ...meta,
    ...activity,
    advancing: items.filter((q) => q.change > 0).length,
    declining: items.filter((q) => q.change < 0).length,
    unchanged: items.filter((q) => q.change === 0).length,
    totalVolume: items.reduce((s, q) => s + (q.volume || 0), 0),
    gainers: byChange.filter((q) => q.change > 0).slice(0, 5).map(pick),
    losers: byChange.filter((q) => q.change < 0).reverse().slice(0, 5).map(pick),
    mostActive: [...traded].sort((a, b) => b.volume * b.close - a.volume * a.close).slice(0, 5).map(pick),
  });

  for (const q of items) await appendHistory(q.symbol, session.date, { o: q.open, c: q.close, v: q.volume });
  for (const ix of indices) await appendHistory(ix.id, session.date, { c: ix.close });
  // Séances passées (graphiques) : comblées automatiquement depuis l'archive publique
  if (!FIXTURES) {
    try { await ensureHistory(DATA, items.map((q) => q.symbol), { log }); }
    catch (e) { log('Historique : archive indisponible pour le moment :', e.message); }
    try { await updateDividends(DATA, items.map((q) => q.symbol), { log }); }
    catch (e) { log('Dividendes : source indisponible pour le moment :', e.message); }
  }
  try { await writePerformance(DATA, session, [...items, ...indices], { log }); }
  catch (e) { log('Performances ignorées :', e.message); }

  log(`Cours : ${items.length} actions, ${indices.length} indices, ${bonds.length} obligations (séance du ${session.date})`);
  return items;
}

// ─────────────────────────── Actualités ───────────────────────────
async function updateNews() {
  const sources = [
    { url: 'https://www.sikafinance.com/marches/actualites_bourse_brvm', parse: (h) => parseSikaNewsList(h, { category: 'Marchés' }) },
    { url: 'https://www.sikafinance.com/marches/communiques_brvm', parse: (h) => parseSikaNewsList(h, { category: 'Communiqués' }) },
    { url: 'https://news.google.com/rss/search?q=BRVM+bourse&hl=fr&gl=CI&ceid=CI:fr', parse: (x) => parseRss(x, { category: 'Presse', idPrefix: 'gn' }) },
  ];
  const fresh = [];
  for (const s of sources) {
    try {
      const got = s.parse(await fetchText(s.url));
      log(`Actualités : ${got.length} depuis ${new URL(s.url).host}`);
      fresh.push(...got);
    } catch (e) { log('source ignorée :', e.message); }
  }
  // 1. Stock des dépêches collectées (avec leur état de rédaction)
  const srcFile = path.join(DATA, 'news-source.json');
  const pubFile = path.join(DATA, 'news.json');
  const published = (await readJson(pubFile, { items: [] })).items;
  let stock = (await readJson(srcFile, null))?.items;
  if (!stock) stock = published.filter((n) => !n.rewritten && !n.id.startsWith('seed-')); // première fois : reprise de l'existant
  const byKey = new Map();
  const seenIds = new Set();
  const prev = new Map(stock.map((n) => [n.id, n]));
  for (const n of [...fresh, ...stock]) {
    const key = n.title.toLowerCase().replace(/\W+/g, '').slice(0, 80);
    if (byKey.has(key) || seenIds.has(n.id)) continue;
    seenIds.add(n.id);
    const old = prev.get(n.id);
    byKey.set(key, { ...n, symbols: tagSymbols(n, COMPANIES), status: old?.status ?? n.status ?? 'new', tries: old?.tries ?? n.tries ?? 0 });
  }
  stock = [...byKey.values()].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, 300);
  if (!fresh.length && !stock.length) throw new Error('Aucune actualité récupérée');

  // 2. Rédaction : chaque nouvelle dépêche est réécrite par l'IA (GitHub Models gratuit, ou clé ANTHROPIC_API_KEY)
  const key = writer();
  const mine = new Map(published.filter((n) => n.rewritten).map((n) => [n.id, n]));
  // Au démarrage, on rattrape plus vite pour que la page ne paraisse pas vide
  const limit = Number(process.env.NEWS_REWRITE_MAX || (mine.size < 30 ? 30 : 10));
  const recent = Date.now() - 7 * 86400000;
  const todo = stock.filter((n) => n.status === 'new' && n.tries < 3 && !mine.has(n.id) && (!n.publishedAt || Date.parse(n.publishedAt) > recent)).slice(0, limit);
  if (!key) log('Actualités : aucune IA disponible, réécriture désactivée');
  else log(`Actualités : réécriture avec ${key.kind === 'github' ? 'GitHub Models (gratuit)' : 'Anthropic'}, ${todo.length} à rédiger`);
  for (const n of key ? todo : []) {
    n.tries += 1;
    try {
      let text = '';
      if (/sikafinance\.com/.test(n.url) && !n.premium) {
        try { text = extractArticle(await fetchText(n.url, { retries: 2 })); } catch (e) { log('article illisible :', e.message); }
      }
      const r = await rewriteItem(n, text, key);
      if (r.skip) { n.status = 'skip'; log(`Actualités : écartée « ${n.title.slice(0, 60)} »`); continue; }
      n.status = 'done';
      mine.set(n.id, {
        id: n.id,
        title: r.title,
        summary: r.summary,
        body: r.body,
        author: AUTHOR,
        source: AUTHOR,
        url: `https://www.brvmexa.com/actualites/#${n.id}`,
        image: null,
        category: n.category,
        premium: false,
        publishedAt: n.publishedAt ?? new Date().toISOString(),
        writtenAt: new Date().toISOString(),
        symbols: tagSymbols({ ...n, title: `${n.title} ${r.title}`, summary: r.body.join(' ') }, COMPANIES),
        origin: { name: n.source, url: n.url, title: n.title },
        rewritten: true,
      });
      log(`Actualités : rédigée « ${r.title.slice(0, 70)} » (${text.length} car. de source)`);
    } catch (e) {
      if (e instanceof QuotaError) { n.tries -= 1; log('Actualités :', e.message, '— reprise au prochain passage'); break; }
      log('réécriture impossible :', e.message);
    }
  }
  await writeJson(srcFile, { updatedAt: new Date().toISOString(), items: stock });

  // 3. Publication : dès qu'il existe des articles de la rédaction, seuls ceux-ci sont publiés
  // (tant qu'il y en a moins de 12, la liste est complétée par des dépêches pas encore rédigées)
  const raw = stock.filter((n) => n.status === 'new' && !mine.has(n.id)).map(({ status, tries, ...n }) => n);
  const items = [...mine.values(), ...raw.slice(0, mine.size ? Math.max(0, 12 - mine.size) : NEWS_MAX)]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, NEWS_MAX);
  await writeJson(pubFile, { updatedAt: new Date().toISOString(), items });
  log(`Actualités : ${items.length} articles publiés (${mine.size} rédigés par BRVMexa)`);
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

async function main() {
  const only = process.argv[2]; // "market" | "news" | rien = tout
  const errors = [];
  if (only !== 'news') await updateMarket().catch((e) => errors.push(`Cours : ${e.message}`));
  if (only !== 'market') await updateNews().catch((e) => errors.push(`Actualités : ${e.message}`));
  await writeJson(path.join(DATA, 'status.json'), {
    lastRun: new Date().toISOString(),
    ok: errors.length === 0,
    errors,
  });
  if (errors.length) {
    console.error('Erreurs :\n - ' + errors.join('\n - '));
    process.exitCode = 1; // GitHub signale l'échec par e-mail ; les anciennes données restent en place
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
