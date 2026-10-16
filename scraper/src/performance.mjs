// Performances de chaque valeur sur plusieurs périodes, calculées à partir de l'historique :
// 1 semaine, 1 mois, depuis le 1er janvier, 1 an, plus haut / plus bas sur 52 semaines.
// → data/performance.json (léger : l'application n'a pas besoin de télécharger les historiques pour ses listes).
import fs from 'node:fs/promises';
import path from 'node:path';
import { readHistory } from './history.mjs';

const DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

/** Dernière clôture connue à la date `d` ou avant (historique trié) */
function closeOnOrBefore(hist, d) {
  let lo = 0, hi = hist.length - 1, found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hist[mid].d <= d) { found = hist[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/**
 * @param hist historique trié [{ d, c }]
 * @param date séance du jour (AAAA-MM-JJ)
 * @param close cours du jour
 */
export function computePerf(hist, date, close) {
  const t = Date.parse(date);
  const pts = hist.filter((p) => p.d < date && p.c > 0);
  if (!pts.length || !(close > 0)) return null;
  const first = pts[0].d;
  const vs = (refDate) => {
    if (refDate < first) return null; // historique trop court pour cette période
    const p = closeOnOrBefore(pts, refDate);
    return p ? r2((close / p.c - 1) * 100) : null;
  };
  const yearStart = `${date.slice(0, 4)}-01-01`;
  const ytdRef = closeOnOrBefore(pts, iso(Date.parse(yearStart) - DAY));
  const window = pts.filter((p) => p.d >= iso(t - 365 * DAY));
  const closes = [...window.map((p) => p.c), close];
  const full = first <= iso(t - 360 * DAY);
  return {
    w1: vs(iso(t - 7 * DAY)),
    m1: vs(iso(t - 30 * DAY)),
    ytd: ytdRef ? r2((close / ytdRef.c - 1) * 100) : null,
    y1: vs(iso(t - 365 * DAY)),
    hi52: Math.max(...closes),
    lo52: Math.min(...closes),
    /** false si moins d'un an d'historique (plus haut / plus bas partiels) */
    full52: full,
  };
}

export async function writePerformance(dataDir, session, items, { log = console.log } = {}) {
  const out = {};
  for (const q of items) {
    const hist = await readHistory(path.join(dataDir, 'history', `${q.symbol ?? q.id}.json`));
    const perf = computePerf(hist, session.date, q.close);
    if (perf) out[q.symbol ?? q.id] = perf;
  }
  await fs.writeFile(path.join(dataDir, 'performance.json'), JSON.stringify({ updatedAt: new Date().toISOString(), sessionDate: session.date, items: out }) + '\n');
  log(`Performances : ${Object.keys(out).length} valeurs`);
}
