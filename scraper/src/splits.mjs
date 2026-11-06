// Fractionnements d'actions (« splits ») : une action ancienne devient `r` actions nouvelles.
// Les cours d'avant la date sont divisés par `r` (et les volumes multipliés par `r`) pour que les graphiques,
// les performances et les rendements restent comparables avec le cours d'aujourd'hui.
// Pour un nouveau fractionnement : ajouter une ligne ici, le robot ajuste l'historique au passage suivant.
import fs from 'node:fs/promises';
import path from 'node:path';

export const SPLITS = {
  ONTBF: [{ d: '2018-02-05', r: 2 }], // 2 actions nouvelles pour 1 ancienne
  PALC: [{ d: '2017-11-03', r: 2 }],  // 2 actions nouvelles pour 1 ancienne
  SNTS: [{ d: '2026-10-26', r: 10 }], // 1 action ancienne = 10 nouvelles (AGE du 08/10/2026)
};

const r4 = (v) => Math.round(v * 10000) / 10000;

/** Facteur cumulé à appliquer à un point daté `d` (1 si aucun fractionnement après cette date) */
export function splitFactor(sym, d) {
  return (SPLITS[sym] ?? []).filter((s) => d < s.d).reduce((f, s) => f * s.r, 1);
}

/** Ajuste un point de cours brut { d, o, c, v } */
export function adjustPoint(sym, p) {
  const f = splitFactor(sym, p.d);
  if (f === 1) return p;
  return {
    ...p,
    ...(p.o != null ? { o: r4(p.o / f) } : {}),
    ...(p.c != null ? { c: r4(p.c / f) } : {}),
    ...(p.v != null ? { v: Math.round(p.v * f) } : {}),
  };
}

/** Ajuste un dividende brut { d, a } (montant par action ancienne → par action actuelle) */
export function adjustDividend(sym, p) {
  const f = splitFactor(sym, p.d);
  return f === 1 ? p : { ...p, a: Math.round((p.a / f) * 100) / 100 };
}

/**
 * Ajuste une seule fois les fichiers d'historique déjà enregistrés.
 * Les fractionnements traités sont notés dans history/_splits.json : relancer le robot ne les applique pas deux fois.
 */
export async function applySplitsToHistory(dataDir, { log = console.log, readHistory, writeHistory }) {
  const markFile = path.join(dataDir, 'history', '_splits.json');
  let done = {};
  try { done = JSON.parse(await fs.readFile(markFile, 'utf8')); } catch {}
  let changed = false;
  for (const [sym, list] of Object.entries(SPLITS)) {
    for (const s of list) {
      const key = `${s.d}x${s.r}`;
      if ((done[sym] ?? []).includes(key)) continue;
      const file = path.join(dataDir, 'history', `${sym}.json`);
      const hist = await readHistory(file);
      if (hist.length) {
        const out = hist.map((p) => (p.d < s.d ? {
          ...p,
          ...(p.o != null ? { o: r4(p.o / s.r) } : {}),
          ...(p.c != null ? { c: r4(p.c / s.r) } : {}),
          ...(p.v != null ? { v: Math.round(p.v * s.r) } : {}),
        } : p));
        await writeHistory(file, out);
        log(`Fractionnement ${sym} du ${s.d} (×${s.r}) : historique ajusté`);
      }
      (done[sym] ??= []).push(key);
      changed = true;
    }
  }
  if (changed) await fs.writeFile(markFile, JSON.stringify(done) + '\n');
  return changed;
}
