// Adresse où le robot GitHub Actions publie les données (dossier /data du dépôt).
// Dépôt GitHub : Kossi-lab/brvmexa. Si vous le renommez, changez aussi cette adresse et app/eas.json,
// ou définissez EXPO_PUBLIC_DATA_URL dans un fichier .env.
export const DATA_BASE_URL =
  process.env.EXPO_PUBLIC_DATA_URL ??
  'https://raw.githubusercontent.com/Kossi-lab/brvmexa/main/data';

/** Rafraîchissement automatique pendant que l'application est ouverte */
export const AUTO_REFRESH_MS = 5 * 60 * 1000;
