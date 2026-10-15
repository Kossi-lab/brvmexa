# BRVMexa

Application mobile (Android et iOS) de suivi de la Bourse Régionale des Valeurs Mobilières : cours des 48 actions, indices, palmarès, actualités et liste de suivi. Tout est automatisé : un robot collecte les données sur le web et l'application les affiche sans intervention.

## Comment ça marche

```
brvm.org  ─┐                         ┌─────────────────┐
sikafinance├─► Robot (GitHub Actions) ─► dossier /data   ├─► Application BRVMexa
Google News┘   toutes les heures       │ fichiers JSON   │   (lit les JSON en ligne,
                                        └─────────────────┘    toutes les 5 min)
```

| Élément | Rôle |
| --- | --- |
| `scraper/` | Robot Node.js : lit les cours, indices, obligations et l'activité du marché sur brvm.org, les actualités sur Sika Finance et Google Actualités |
| `.github/workflows/update-data.yml` | Lance le robot toutes les heures de 8h à 22h GMT en semaine (actualités toutes les 4 h le week-end) et publie les données |
| `data/` | Données publiées : `quotes.json`, `indices.json`, `market.json`, `news.json`, `history/<SYMBOLE>.json` |
| `app/` | Application Expo (React Native) |

Chaque séance est ajoutée à l'historique : les graphiques s'enrichissent automatiquement jour après jour.

## Mise en route (une seule fois)

### 1. Publier le projet sur GitHub

1. Créez un dépôt **public** sur github.com (par exemple `brvmexa`).
2. Envoyez-y ce dossier :
   ```bash
   git remote add origin https://github.com/Kossi-lab/brvmexa.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Actions → General → Workflow permissions** → cochez **Read and write permissions** → Save.

Le robot démarre alors tout seul à la prochaine heure. Pour le lancer tout de suite : onglet **Actions → Mise à jour des données → Run workflow**.

### 2. Récupérer l'historique des cours (facultatif)

Onglet **Actions → Mise à jour des données → Run workflow**, choisissez `backfill`. Le robot télécharge jusqu'à 3 ans d'historique pour remplir les graphiques. À faire une seule fois.

### 3. Brancher l'application sur vos données

Dans `app/src/lib/config.ts` **et** `app/eas.json`, remplacez `Kossi-lab/brvmexa` par votre compte et le nom du dépôt.

### 4. Tester sur votre téléphone

```bash
cd app
npm install
npx expo start
```
Installez **Expo Go** sur votre téléphone et scannez le QR code.

### 5. Créer l'application installable

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile apk          # fichier .apk à installer directement
npx eas-cli@latest build -p android --profile production   # pour le Google Play Store
npx eas-cli@latest build -p ios --profile production       # pour l'App Store (compte Apple requis)
```

## Fonctionnalités

- **Marchés** : BRVM Composite, BRVM 30, Prestige, Principal ; hausses/baisses du jour, valeur échangée, capitalisation ; palmarès (hausses, baisses, plus actives) ; indices sectoriels.
- **Actions** : les 48 valeurs, recherche, filtres par secteur et par pays, tri par variation, volume ou valeur échangée.
- **Fiche valeur** : cours, variation, graphique interactif (1 semaine à tout l'historique), ouverture, clôture veille, volume, actualités de la société.
- **Actualités** : collectées automatiquement et reliées aux sociétés citées ; filtre « Ma liste ». Chaque article s'ouvre sur le site de son éditeur.
- **Ma liste** : valeurs et indices suivis, réorganisables, enregistrés sur le téléphone.
- **Hors ligne** : la dernière version téléchargée reste affichée.
- Thème sombre ou clair selon le réglage du téléphone.

## Entretien

- **Si un site change sa présentation**, la collecte échoue proprement : les anciennes données restent affichées et GitHub vous envoie un e-mail. Les fonctions de lecture sont dans `scraper/src/parse.mjs` et testées par `npm test`.
- **Nouvelle société cotée** : elle est collectée automatiquement. Ajoutez-la dans `scraper/src/companies.mjs` pour lui donner un nom court et la relier aux actualités.
- **Fréquence** : modifiez les lignes `cron` du fichier `.github/workflows/update-data.yml`.

## Tester le robot

```bash
cd scraper
npm install
npm test                 # tests hors ligne sur des pages enregistrées
npm run update           # collecte réelle (nécessite internet)
```

## Avertissement

BRVMexa est une application d'information indépendante, sans lien avec la BRVM, Investing.com ou les médias cités. Les cours affichés sont ceux publiés par la BRVM et ne constituent pas un conseil en investissement. Vérifiez les conditions d'utilisation des sites sources avant une diffusion commerciale ; pour un usage professionnel, la BRVM propose des flux de données sous licence.
