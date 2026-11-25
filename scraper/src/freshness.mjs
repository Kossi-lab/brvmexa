// Contrôle de fraîcheur des données (lancé par .github/workflows/surveillance.yml).
// Aucune dépendance npm : seulement Node. Ouvre ou referme le ticket « Alerte données ».
import fs from 'node:fs';

const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Liste des problèmes constatés (vide = tout va bien). Exportée pour les tests. */
export function problems(status, market, now = new Date()) {
  const out = [];
  const minutes = status?.lastRun ? (now - new Date(status.lastRun)) / 60000 : Infinity;
  if (minutes > 60) out.push(`Le robot n'a rien publié depuis ${Number.isFinite(minutes) ? Math.round(minutes) + ' minutes' : 'longtemps'} (dernier passage : ${status?.lastRun ?? 'inconnu'}).`);
  if (status && status.ok === false) out.push(`Le dernier passage du robot a signalé des erreurs : ${(status.errors ?? []).join(' ; ').slice(0, 500)}`);
  const today = now.toISOString().slice(0, 10);
  const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  if (weekday && now.getUTCHours() >= 11 && market?.sessionDate !== today) {
    out.push(`Les cours de la séance du ${today} ne sont pas publiés (dernière séance enregistrée : ${market?.sessionDate ?? 'inconnue'}). Jour férié à la BRVM, ou panne de la collecte ?`);
  }
  return out;
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = problems(read('data/status.json'), read('data/market.json'));
  const open = (await gh('/issues?state=open&labels=alerte-donnees&per_page=5')) ?? [];
  if (list.length) {
    const body = `Contrôle automatique du ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC :\n\n${list.map((p) => `- ${p}`).join('\n')}\n\nCe ticket se refermera tout seul quand les données seront de nouveau à jour.`;
    console.log(body);
    if (open.length) await gh(`/issues/${open[0].number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    else await gh('/issues', { method: 'POST', body: JSON.stringify({ title: 'Alerte données : cours BRVM non mis à jour', body, labels: ['alerte-donnees'] }) });
    process.exitCode = 1;
  } else {
    console.log('Données à jour.');
    for (const i of open) {
      await gh(`/issues/${i.number}/comments`, { method: 'POST', body: JSON.stringify({ body: 'Les données sont de nouveau à jour : ticket refermé automatiquement.' }) });
      await gh(`/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    }
  }
}
