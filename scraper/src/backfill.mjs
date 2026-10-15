// Récupération ponctuelle de l'historique des cours (à lancer une seule fois, manuellement,
// depuis l'onglet Actions de GitHub → « Mise à jour des données » → Run workflow → backfill).
// Source : l'API publique utilisée par les graphiques de sikafinance.com.
// Cette API n'est pas documentée : si elle change, ce script échoue sans rien abîmer,
// et l'historique se construit quand même jour après jour avec la collecte quotidienne.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sikaTicker } from './companies.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const YEARS = Number(process.env.BACKFILL_YEARS ?? 3);

const INDEX_TICKERS = { 'brvm-composite': 'BRVMC', 'brvm-30': 'BRVM30', 'brvm-prestige': 'BRVMPR' };

const iso = (d) => d.toISOString().slice(0, 10);

async function getHistos(ticker, from, to) {
  const res = await fetch('https://www.sikafinance.com/api/general/GetHistos', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; BRVMexaBot/1.0)' },
    body: JSON.stringify({ ticker, datedeb: iso(from), datefin: iso(to), xperiod: '0' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.lst ?? []).map((r) => {
    const [dd, mm, yyyy] = String(r.Date).split('/');
    return { d: `${yyyy}-${mm}-${dd}`, o: Number(r.Open) || null, c: Number(r.Close ?? r.Value), v: Number(r.Volume) || 0 };
  }).filter((p) => p.d.length === 10 && Number.isFinite(p.c));
}

async function backfill(id, ticker, isIndex) {
  const file = path.join(DATA, 'history', `${id}.json`);
  let hist = [];
  try { hist = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  const byDate = new Map(hist.map((p) => [p.d, p]));
  const end = new Date();
  // L'API limite chaque requête à ~3 mois : on avance par tranches de 89 jours
  for (let start = new Date(Date.now() - YEARS * 365 * 864e5); start < end; ) {
    const stop = new Date(Math.min(start.getTime() + 89 * 864e5, end.getTime()));
    for (const p of await getHistos(ticker, start, stop)) {
      if (!byDate.has(p.d)) byDate.set(p.d, isIndex ? { d: p.d, c: p.c } : p);
    }
    start = new Date(stop.getTime() + 864e5);
    await new Promise((r) => setTimeout(r, 400));
  }
  const out = [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(out, null, 1) + '\n');
  return out.length;
}

const quotes = JSON.parse(await fs.readFile(path.join(DATA, 'quotes.json'), 'utf8')).items;
let failures = 0;
for (const q of quotes) {
  try { console.log(q.symbol, await backfill(q.symbol, sikaTicker(q.symbol), false), 'jours'); }
  catch (e) { failures++; console.warn(q.symbol, 'échec :', e.message); }
}
for (const [id, t] of Object.entries(INDEX_TICKERS)) {
  try { console.log(id, await backfill(id, t, true), 'jours'); }
  catch (e) { failures++; console.warn(id, 'échec :', e.message); }
}
if (failures === quotes.length + Object.keys(INDEX_TICKERS).length) process.exitCode = 1;
