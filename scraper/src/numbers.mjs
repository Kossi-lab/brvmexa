// Garde-fou des chiffres : un article réécrit par l'IA ne doit contenir AUCUN nombre absent de sa source.
// L'IA a pour consigne de ne rien inventer ; ce contrôle le vérifie automatiquement avant publication.

/** Normalise un texte : espaces fines et insécables retirées entre les chiffres (19 190 → 19190), virgule décimale → point. */
function normalize(text) {
  return String(text ?? '')
    .replace(/(\d)[\s   .](?=\d{3}(?!\d))/g, '$1') // séparateurs de milliers
    .replace(/(\d),(\d)/g, '$1.$2');
}

/** Tous les nombres d'un texte, sous forme de chaînes normalisées (« 19.19 », « 2026 », « 5 »). */
export function numbersIn(text) {
  return normalize(text).match(/\d+(?:\.\d+)?/g) ?? [];
}

const decimals = (s) => (s.includes('.') ? s.split('.')[1].length : 0);

/**
 * Nombres du texte produit qui n'apparaissent pas dans la source.
 * Acceptés : les nombres de la source, leurs arrondis (5,64 % écrit 5,6 %), et les petits entiers (0 à 12),
 * qui servent à compter (« deux banques », « 3 étapes ») sans porter d'information financière.
 */
export function unknownNumbers(output, source) {
  const src = numbersIn(source).map(Number);
  const known = new Set(numbersIn(source));
  const bad = [];
  for (const s of numbersIn(output)) {
    const x = Number(s);
    if (known.has(s) || (Number.isInteger(x) && x <= 12)) continue;
    const d = decimals(s);
    const f = 10 ** d;
    if (src.some((y) => Math.round(y * f) / f === x)) continue;
    if (!bad.includes(s)) bad.push(s);
  }
  return bad;
}
