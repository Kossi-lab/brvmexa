#!/usr/bin/env bash
# Signale à Sentry (projet « Robot de données ») l'échec d'un workflow, avec le lien vers ses journaux.
# Aucun secret : la clé publique Sentry (DSN) ne permet que d'envoyer des erreurs.
set -u
DSN_KEY=43be820fa893855dba2738b61e82816f
HOTE=o4512505521766401.ingest.de.sentry.io
PROJET=4512505529827408
ID=$(cat /proc/sys/kernel/random/uuid | tr -d -)
LIEN="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
MSG="Échec : ${GITHUB_WORKFLOW} (${GITHUB_JOB})"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EVT=$(python3 -c 'import json,sys;print(json.dumps({"event_id":sys.argv[1],"timestamp":sys.argv[2],"level":"error","platform":"other","logger":"github-actions","message":{"formatted":sys.argv[3]},"fingerprint":[sys.argv[4],sys.argv[5]],"tags":{"workflow":sys.argv[4],"job":sys.argv[5],"depot":sys.argv[7]},"extra":{"journaux":sys.argv[6]},"environment":"production"}))' "$ID" "$NOW" "$MSG" "$GITHUB_WORKFLOW" "$GITHUB_JOB" "$LIEN" "$GITHUB_REPOSITORY")
printf '{"event_id":"%s"}\n{"type":"event"}\n%s\n' "$ID" "$EVT" | curl -sS -m 15 --retry 2 -o /dev/null -w "Sentry : HTTP %{http_code}\n" \
  -H 'Content-Type: application/x-sentry-envelope' --data-binary @- \
  "https://${HOTE}/api/${PROJET}/envelope/?sentry_key=${DSN_KEY}&sentry_version=7" || true
