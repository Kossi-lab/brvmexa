#!/usr/bin/env bash
# Cours en direct pendant la séance de la BRVM (lancé par .github/workflows/direct.yml).
# Toutes les 30 secondes : lit la page des cours de la BRVM ; si elle a changé, publie aussitôt les nouveaux cours,
# met le site en ligne et envoie les alertes de cours. S'arrête à 15 h 35 GMT (fin de séance) ; une tâche GitHub
# étant limitée à 6 heures, il se relance lui-même avant cette limite si la séance n'est pas finie.
set -u
cd "$(dirname "$0")/.."
FIN=$(date -u -d 'today 15:35' +%s)
LIMITE=$(( $(date +%s) + 5*3600 + 40*60 ))
if [ "$(date -u +%u)" -ge 6 ] || [ "$(date +%s)" -ge "$FIN" ]; then echo "Pas de séance en ce moment."; exit 0; fi

git config user.name "brvmexa-bot"
git config user.email "brvmexa-bot@users.noreply.github.com"
publications=0

while [ "$(date +%s)" -lt "$FIN" ] && [ "$(date +%s)" -lt "$LIMITE" ]; do
  debut=$(date +%s)
  # Toujours partir de la dernière version publiée (le robot des 15 minutes publie aussi)
  git pull -q --rebase -X theirs --autostash 2>/dev/null || git rebase --abort 2>/dev/null || true

  (cd scraper && node src/live.mjs); code=$?
  if [ "$code" = 10 ]; then
    git add data
    if ! git diff --cached --quiet; then
      git commit -q -m "Cours en direct $(date -u +'%Y-%m-%d %H:%M:%S') UTC"
      ok=0
      for i in 1 2 3; do
        if git pull -q --rebase -X theirs --autostash && git push -q; then ok=1; break; fi
        git rebase --abort 2>/dev/null || true; sleep 3
      done
      if [ "$ok" = 1 ]; then
        publications=$((publications + 1))
        gh workflow run pages.yml --ref main || echo "Mise en ligne du site : relance impossible"
        # Alertes de cours : la clé secrète n'est jamais donnée à un paquet npm (paquets mis de côté)
        if [ -n "${SUPABASE_SECRET_KEY:-}" ]; then
          mv scraper/node_modules "$RUNNER_TEMP/nm" && { (cd scraper && node src/alerts.mjs) || echo "Alertes : échec (nouvel essai au prochain changement)"; mv "$RUNNER_TEMP/nm" scraper/node_modules; }
        fi
      else
        echo "Publication impossible pour l'instant (nouvel essai dans 30 s)"
        git reset -q --soft HEAD~1 2>/dev/null || true
      fi
    fi
  fi

  reste=$(( 30 - ($(date +%s) - debut) ))
  [ "$reste" -gt 0 ] && sleep "$reste"
done

echo "Fin du direct : $publications publication(s)."
if [ "$(date +%s)" -lt "$FIN" ]; then
  echo "Séance en cours : relance du direct (limite de 6 heures par tâche GitHub)."
  gh workflow run direct.yml --ref main
fi
