const nf = (min: number, max: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max });

const n0 = nf(0, 0);
const n2 = nf(2, 2);

/** Remplace l'espace insécable fine par une espace normale (rendu homogène Android/iOS) */
const tidy = (s: string) => s.replace(/[  ]/g, ' ');

export const fmtPrice = (v: number | null | undefined, decimals = 0) =>
  v == null ? '—' : tidy((decimals ? n2 : n0).format(v));

export const fmtIndex = (v: number | null | undefined) => (v == null ? '—' : tidy(n2.format(v)));

export const fmtPct = (v: number | null | undefined, sign = true) =>
  v == null ? '—' : `${sign && v > 0 ? '+' : ''}${tidy(n2.format(v))} %`;

export const fmtSigned = (v: number | null | undefined, decimals = 0) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${fmtPrice(v, decimals)}`;

/** 21 044 668 387 602 → « 21 044,7 Mds » */
export function fmtBig(v: number | null | undefined) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${tidy(nf(1, 1).format(v / 1e9))} Mds`;
  if (abs >= 1e6) return `${tidy(nf(1, 1).format(v / 1e6))} M`;
  if (abs >= 1e3) return `${tidy(nf(1, 1).format(v / 1e3))} k`;
  return fmtPrice(v);
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** "2026-10-14" → « mercredi 14 oct. 2026 » */
export function fmtSessionDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtShortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** Temps écoulé : « il y a 5 min », « hier », « 12 oct. » */
export function fmtAgo(iso?: string | null, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'hier';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const changeTone = (v: number | null | undefined) => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down');
