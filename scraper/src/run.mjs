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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const BRVM = 'https://www.brvm.org/fr';
const NEWS_MAX = 150;
const HISTORY_MAX_DAYS = 3000;

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
  const hist = await readJson(file, []);
  const idx = hist.findIndex((p) => p.d === date);
  const row = { d: date, ...point };
  if (idx >= 0) hist[idx] = row; else hist.push(row);
  hist.sort((a, b) => a.d.localeCompare(b.d));
  await writeJson(file, hist.slice(-HISTORY_MAX_DAYS));
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
  const file = path.join(DATA, 'news.json');
  // Les articles d'exemple livrés avec le projet disparaissent dès la première vraie collecte
  const old = (await readJson(file, { items: [] })).items.filter((n) => !fresh.length || !n.id.startsWith('seed-'));
  const merged = new Map();
  for (const n of [...fresh, ...old]) {
    const key = n.title.toLowerCase().replace(/\W+/g, '').slice(0, 80);
    if (!merged.has(key)) merged.set(key, { ...n, symbols: tagSymbols(n, COMPANIES) });
  }
  const items = [...merged.values()]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, NEWS_MAX);
  if (!fresh.length && !old.length) throw new Error('Aucune actualité récupérée');
  await writeJson(file, { updatedAt: new Date().toISOString(), items });
  log(`Actualités : ${items.length} articles enregistrés`);
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
