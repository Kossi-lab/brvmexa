// Sitemap complet de brvmexa.com et signalement des nouvelles pages aux moteurs (IndexNow : Bing, Yandex, Seznam, Naver…).
// Pages fixes : scraper/templates/sitemap-static.json (produit par build.py). Pages du robot : articles, À la une, fiches des actions.
// Google n'utilise pas IndexNow : il lit le sitemap (déclaré dans robots.txt et dans Search Console).
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://www.brvmexa.com';
export const INDEXNOW_KEY = 'b7e3c1f04a9d4e6f8a2b5c7d9e1f3a60';
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (iso) => String(iso ?? '').slice(0, 10);

async function dirs(p) { try { return (await fs.readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } }
async function readJson(f, fb) { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fb; } }

export async function writeSitemap({ dataDir, docsDir, tplDir, log = console.log, today = new Date().toISOString().slice(0, 10) }) {
  const file = path.join(docsDir, 'sitemap.xml');
  const old = await fs.readFile(file, 'utf8').catch(() => '');
  const prev = new Map([...old.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
  const urls = new Map();
  for (const u of await readJson(path.join(tplDir, 'sitemap-static.json'), [])) urls.set(u.loc, u.lastmod);
  // Articles de la rédaction (date de rédaction connue tant que l'article est dans news.json)
  const news = new Map(((await readJson(path.join(dataDir, 'news.json'), {})).items ?? []).map((n) => [String(n.id).toLowerCase().replace(/[^a-z0-9-]/g, ''), n]));
  for (const id of await dirs(path.join(docsDir, 'actualites', 'a'))) {
    const loc = `${SITE}/actualites/a/${id}/`, n = news.get(id);
    urls.set(loc, day(n?.writtenAt || n?.publishedAt) || prev.get(loc) || today);
  }
  for (const d of await dirs(path.join(docsDir, 'actualites', 'une'))) urls.set(`${SITE}/actualites/une/${d}/`, /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today);
  const session = (await readJson(path.join(dataDir, 'quotes.json'), {})).sessionDate || today;
  if (await fs.stat(path.join(docsDir, 'actions', 'index.html')).catch(() => null)) urls.set(`${SITE}/actions/`, session);
  for (const s of await dirs(path.join(docsDir, 'actions'))) urls.set(`${SITE}/actions/${s}/`, session);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].map(([loc, lm]) => `  <url><loc>${xmlEsc(loc)}</loc><lastmod>${lm}</lastmod></url>\n`).join('') + '</urlset>\n';
  if (xml !== old) { await fs.writeFile(file, xml); log(`Sitemap : ${urls.size} adresses`); }
  return { count: urls.size, added: [...urls.keys()].filter((u) => !prev.has(u)) };
}

/** Signale des adresses nouvelles ou modifiées aux moteurs compatibles IndexNow (sans effet bloquant). */
export async function pingIndexNow(urls, { log = console.log } = {}) {
  const list = [...new Set(urls)].filter((u) => u.startsWith(SITE + '/')).slice(0, 1000);
  if (!list.length || process.env.INDEXNOW === '0') return;
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ host: 'www.brvmexa.com', key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: list }),
    });
    log(`IndexNow : ${list.length} adresse(s) signalée(s) (réponse ${r.status})`);
  } catch (e) { log('IndexNow : envoi reporté :', e.message); }
}
