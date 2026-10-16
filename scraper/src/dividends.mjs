// Dividendes des sociétés cotées (montants bruts par action, en FCFA).
// Source : archive publique github.com/blakro/brvm → data/dividendes.csv (licence MIT), tenue à jour chaque jour ouvré.
// Mis à jour une fois par jour par le robot → data/dividends.json. Le rendement est calculé dans l'application
// avec le cours du moment.
import fs from 'node:fs/promises';
import path from 'node:path';

export const DIVIDENDS_URL = process.env.BRVMEXA_DIVIDENDS_URL ?? 'https://raw.githubusercontent.com/blakro/brvm/main/data/dividendes.csv';
const DAY = 864e5;

/** CSV → { SYMBOLE: [{ d, a, ex }] } (non nettoyé) */
export function parseDividendsCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',');
  const iT = head.indexOf('ticker'), iD = head.indexOf('date_detachement'), iA = head.indexOf('montant'), iE = head.indexOf('exercice');
  if ([iT, iD, iA].some((i) => i < 0)) throw new Error('format des dividendes inattendu');
  const out = {};
  for (const line of lines) {
    const f = line.split(',');
    const a = Number(f[iA]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f[iD]) || !(a > 0)) continue;
    const ex = Number(f[iE]);
    (out[f[iT]] ??= []).push({ d: f[iD], a: Math.round(a * 100) / 100, ex: Number.isFinite(ex) && ex > 1990 ? ex : null });
  }
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Nettoyage : écarte les montants aberrants (ex. 0,9 F au lieu de 888 F) et les doublons
 * (même montant enregistré deux fois à quelques semaines d'écart).
 */
export function cleanDividends(list) {
  const sorted = [...list].sort((a, b) => a.d.localeCompare(b.d));
  const med = median(sorted.map((p) => p.a));
  const kept = [];
  for (const p of sorted) {
    if (sorted.length >= 3 && p.a < med * 0.05) continue;
    const dup = kept.find((k) => Math.abs(k.a - p.a) <= k.a * 0.01 && Math.abs(Date.parse(p.d) - Date.parse(k.d)) <= 75 * DAY);
    if (dup) { dup.ex ??= p.ex; continue; }
    kept.push({ ...p });
  }
  return kept;
}

/** Fiche dividendes d'une société, à la date `today` (AAAA-MM-JJ) */
export function summarize(list, today) {
  if (!list.length) return null;
  const t = Date.parse(today);
  const last = list.at(-1);
  // Montant annuel : somme des 12 derniers mois (sociétés qui versent en plusieurs fois),
  // sinon dernier versement s'il date de moins de 18 mois (versement annuel un peu tardif)
  const ttm = list.filter((p) => t - Date.parse(p.d) <= 365 * DAY && Date.parse(p.d) <= t + 60 * DAY).reduce((s, p) => s + p.a, 0);
  const recent = t - Date.parse(last.d) <= 548 * DAY;
  const annual = ttm > 0 ? ttm : recent ? last.a : 0;
  // Dividende exceptionnel (ex. distribution de réserves) : plus de 3 fois le versement habituel.
  // On garde alors aussi le montant « habituel » pour ne pas fausser le classement des rendements.
  const prev = list.slice(-5, -1).map((p) => p.a);
  const usual = prev.length >= 3 ? median(prev) : null;
  const exceptional = usual != null && annual > 3 * usual;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { last, annual: r2(annual), exceptional, usual: exceptional ? r2(usual) : null, history: list.slice(-10) };
}

export async function updateDividends(dataDir, symbols, { log = console.log, now = new Date(), fetchImpl = fetch, force = false } = {}) {
  const file = path.join(dataDir, 'dividends.json');
  const today = now.toISOString().slice(0, 10);
  let current = null;
  try { current = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  if (!force && current?.checkedOn === today) return false;
  const res = await fetchImpl(DIVIDENDS_URL, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`dividendes : HTTP ${res.status}`);
  const raw = parseDividendsCsv(await res.text());
  const items = {};
  for (const s of symbols) {
    const sum = summarize(cleanDividends(raw[s] ?? []), today);
    if (sum) items[s] = sum;
  }
  await fs.writeFile(file, JSON.stringify({ updatedAt: now.toISOString(), checkedOn: today, source: DIVIDENDS_URL, currency: 'XOF', gross: true, items }) + '\n');
  log(`Dividendes : ${Object.keys(items).length} sociétés`);
  return true;
}
