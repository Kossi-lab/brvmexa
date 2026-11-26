// Cours en direct : un contrôle de la page des cours de la BRVM (lancé toutes les 30 s pendant la séance par live.sh).
// Si la BRVM a publié de nouveaux cours, ils sont écrits aussitôt dans /data (mode rapide de updateMarket).
// Code de sortie : 10 = nouveaux cours écrits, 0 = rien de nouveau, 1 = erreur (la boucle continue).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuotes, parseLastUpdate } from './parse.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.DATA_DIR ?? path.join(ROOT, 'data');

/** Empreinte de ce que voit un investisseur : heure de la BRVM et, pour chaque action, cours, variation et volume */
export function signature(session, quotes) {
  const rows = [...quotes].sort((a, b) => (a.symbol < b.symbol ? -1 : 1)).map((q) => `${q.symbol}:${q.close}:${q.change}:${q.volume}`);
  return `${session?.date ?? ''} ${session?.time ?? ''}|${rows.join(',')}`;
}

/** true si la page de la BRVM diffère de ce qui est publié (nouvelle séance, nouvelle heure ou nouveaux cours) */
export function isNew(published, session, quotes) {
  if (!published?.items?.length) return true;
  return signature({ date: published.sessionDate, time: published.sessionTime }, published.items) !== signature(session, quotes);
}

async function main() {
  const { fetchText, updateMarket } = await import('./run.mjs');
  const html = await fetchText('https://www.brvm.org/fr/cours-actions/0', { retries: 2, timeout: 20000 });
  const quotes = parseQuotes(html);
  if (quotes.length < 45) throw new Error(`Seulement ${quotes.length} actions lues sur 48`);
  const session = parseLastUpdate(html);
  if (!session) throw new Error('Heure de mise à jour de la BRVM introuvable');
  let published = null;
  try { published = JSON.parse(await fs.readFile(path.join(DATA, 'quotes.json'), 'utf8')); } catch { /* premier passage */ }
  if (!isNew(published, session, quotes)) return 0;
  await updateMarket({ quick: true, quotesHtml: html });
  console.log(`${new Date().toISOString().slice(11, 19)} Nouveaux cours de la BRVM (mise à jour de ${session.time ?? '?'}) publiés`);
  return 10;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((e) => { console.error('Direct :', e.message); process.exit(1); });
}
