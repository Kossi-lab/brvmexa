// Historique des cours (graphiques de l'application).
// - Chaque passage du robot ajoute le point de la séance du jour (run.mjs).
// - Les séances passées viennent d'une archive publique et gratuite (licence MIT) :
//   github.com/blakro/brvm → data/cours.csv, tenue à jour chaque jour ouvré depuis 2015.
//   Le robot y comble automatiquement les jours manquants. Nos propres points ne sont jamais écrasés.
import fs from 'node:fs/promises';
import path from 'node:path';

export const ARCHIVE_URL = process.env.BRVMEXA_ARCHIVE_URL ?? 'https://raw.githubusercontent.com/blakro/brvm/main/data/cours.csv';
export const HISTORY_MAX_DAYS = 3000;
/** En dessous de ce nombre de séances, l'historique est considéré comme incomplet */
export const MIN_POINTS = 30;

export async function readHistory(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; }
}

/** Écriture compacte (une séance par ligne) : fichiers légers à télécharger sur mobile */
export async function writeHistory(file, rows) {
  const out = [...rows].sort((a, b) => a.d.localeCompare(b.d)).slice(-HISTORY_MAX_DAYS);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '[\n' + out.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n');
  return out.length;
}

const num = (s) => {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Lit le CSV de l'archive : { SYMBOLE: [{ d, o, c, v }, …] } */
export function parseArchiveCsv(text, wanted) {
  const lines = text.split(/\r?\n/);
  const head = lines.shift().split(',');
  const col = (name) => head.indexOf(name);
  const iD = col('date'), iT = col('ticker'), iO = col('ouverture'), iC = col('cloture'), iV = col('volume_titres');
  if ([iD, iT, iC].some((i) => i < 0)) throw new Error('format de l’archive inattendu');
  const out = {};
  for (const line of lines) {
    if (!line) continue;
    const f = line.split(',');
    const sym = f[iT];
    if (wanted && !wanted.has(sym)) continue;
    const c = num(f[iC]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f[iD]) || c == null || c <= 0) continue;
    const o = num(f[iO]);
    (out[sym] ??= []).push({ d: f[iD], o: o && o > 0 ? o : null, c, v: Math.round(num(f[iV]) ?? 0) });
  }
  return out;
}

/** Comble les séances manquantes de chaque action à partir de l'archive. Renvoie le nombre de points ajoutés. */
export async function fillFromArchive(dataDir, symbols, { log = console.log, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(ARCHIVE_URL, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`archive : HTTP ${res.status}`);
  const bySym = parseArchiveCsv(await res.text(), new Set(symbols));
  let added = 0;
  for (const sym of symbols) {
    const rows = bySym[sym];
    if (!rows?.length) { log(`Historique : ${sym} absent de l’archive`); continue; }
    const file = path.join(dataDir, 'history', `${sym}.json`);
    const hist = await readHistory(file);
    const have = new Set(hist.map((p) => p.d));
    const missing = rows.slice(-HISTORY_MAX_DAYS).filter((p) => !have.has(p.d));
    if (!missing.length) continue;
    // Seules comptent les séances qui restent dans la fenêtre conservée (évite de réécrire les mêmes fichiers chaque jour)
    const kept = [...hist, ...missing].map((p) => p.d).sort().slice(-HISTORY_MAX_DAYS);
    const fresh = missing.filter((p) => p.d >= kept[0]);
    if (!fresh.length) continue;
    added += fresh.length;
    await writeHistory(file, [...hist, ...fresh]);
  }
  log(`Historique : ${added} séances ajoutées depuis l’archive`);
  return added;
}

/**
 * Appelé à chaque passage : comble l'historique si une action en manque (nouvelle cotation, premier lancement),
 * et une fois par jour après la séance pour rattraper un éventuel jour manqué.
 */
export async function ensureHistory(dataDir, symbols, { log = console.log, now = new Date(), fetchImpl = fetch } = {}) {
  const metaFile = path.join(dataDir, 'history', '_archive.json');
  let meta = {};
  try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch {}
  const today = now.toISOString().slice(0, 10);
  let thin = false;
  for (const s of symbols) {
    if ((await readHistory(path.join(dataDir, 'history', `${s}.json`))).length < MIN_POINTS) { thin = true; break; }
  }
  const daily = meta.syncedOn !== today && now.getUTCHours() >= 16;
  // Évite de retélécharger l'archive à chaque passage si une action reste courte (ex. nouvelle cotation)
  const retryThin = thin && meta.checkedAt !== today;
  if (!daily && !retryThin) return 0;
  const added = await fillFromArchive(dataDir, symbols, { log, fetchImpl });
  await fs.writeFile(metaFile, JSON.stringify({ source: ARCHIVE_URL, checkedAt: today, syncedOn: daily ? today : meta.syncedOn ?? null }) + '\n');
  return added;
}
