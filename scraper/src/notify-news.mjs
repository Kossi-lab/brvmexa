// Notification « nouvelle actualité » envoyée aux téléphones, après chaque passage du robot.
// Règles, pour informer sans déranger :
// - seuls les articles rédigés par La Rédaction BRVMexa, publiés depuis moins de 36 heures ;
// - jamais la nuit (21h-7h, heure de Lomé) : les articles attendent le matin ;
// - au plus une notification toutes les 90 minutes : plusieurs articles sont regroupés en une seule ;
// - au tout premier passage, les articles déjà en ligne sont simplement mémorisés (aucun envoi).
// L'état est gardé dans data/news-push.json (publié avec les autres données).
import fs from 'node:fs/promises';
import path from 'node:path';

const FRESH_MS = 36 * 3600 * 1000;
const GAP_MS = 90 * 60 * 1000;
const QUIET = { from: 21, to: 7 }; // heures UTC (= heure de Lomé)
const KEEP = 400;

const cut = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};
const mask = (s) => String(s ?? '').replace(/Expo(nent)?PushToken\[[^\]]*\]/g, 'ExpoPushToken[masqué]');

/** Message affiché sur le téléphone */
export function buildMessage(items) {
  if (items.length === 1) {
    const it = items[0];
    return {
      title: `📰 ${cut(it.title, 70)}`,
      body: cut(it.summary || 'Nouvel article de La Rédaction BRVMexa.', 150),
      data: { url: '/news', article: it.url, id: it.id },
    };
  }
  const [a, b] = items;
  return {
    title: `📰 ${items.length} nouvelles actualités de la BRVM`,
    body: cut(`${a.title} · ${b.title}${items.length > 2 ? ` · et ${items.length - 2} autre${items.length > 3 ? 's' : ''}` : ''}`, 160),
    data: { url: '/news' },
  };
}

export function pick(news, state, now = Date.now()) {
  const sent = new Set(state.sent ?? []);
  return news
    .filter((n) => n.rewritten && n.id && !sent.has(n.id))
    .filter((n) => now - new Date(n.publishedAt || n.writtenAt || 0).getTime() < FRESH_MS)
    .sort((x, y) => new Date(y.publishedAt) - new Date(x.publishedAt));
}

async function allTokens(sb) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`push_tokens?select=token&order=token&limit=1000&offset=${from}`, { headers: { Prefer: '' } });
    out.push(...(page ?? []).map((r) => r.token));
    if (!page || page.length < 1000) break;
  }
  return [...new Set(out)];
}

/** Envoi par paquets de 100 ; les téléphones désinstallés sont retirés de la liste */
async function send(sb, tokens, msg) {
  let ok = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch.map((to) => ({ to, sound: 'default', channelId: 'news', priority: 'default', ...msg }))),
    });
    const json = await res.json().catch(() => null);
    const tickets = Array.isArray(json?.data) ? json.data : [];
    tickets.forEach((t, k) => {
      if (t.status === 'ok') ok += 1;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[k]);
      else console.log(`  refusée : ${t.details?.error ?? ''} ${mask(t.message)}`);
    });
    if (json?.errors) console.log('  erreur Expo :', mask(JSON.stringify(json.errors)));
  }
  for (const t of dead) await sb(`push_tokens?token=eq.${encodeURIComponent(t)}`, { method: 'DELETE' }).catch(() => {});
  console.log(`Actualités : ${ok}/${tokens.length} notifications acceptées par Expo${dead.length ? `, ${dead.length} téléphone(s) désinstallé(s) retiré(s)` : ''}`);
  return ok;
}

export async function newsNotifications({ sb, dataDir, now = Date.now(), dryRun = false }) {
  const file = path.join(dataDir, 'news-push.json');
  const news = JSON.parse(await fs.readFile(path.join(dataDir, 'news.json'), 'utf8')).items ?? [];
  let state = null;
  try { state = JSON.parse(await fs.readFile(file, 'utf8')); } catch { /* premier passage */ }
  const save = async (s) => { if (!dryRun) await fs.writeFile(file, JSON.stringify(s, null, 1) + '\n'); };

  if (!state) {
    await save({ lastPushAt: null, sent: news.map((n) => n.id).slice(0, KEEP) });
    console.log(`Actualités : premier passage, ${news.length} articles mémorisés sans notification`);
    return { sent: 0, reason: 'init' };
  }
  const fresh = pick(news, state, now);
  if (!fresh.length) { console.log('Actualités : rien de nouveau à notifier'); return { sent: 0, reason: 'none' }; }
  const h = new Date(now).getUTCHours();
  if (h >= QUIET.from || h < QUIET.to) { console.log(`Actualités : ${fresh.length} en attente (heures calmes, envoi après 7h)`); return { sent: 0, reason: 'quiet' }; }
  if (state.lastPushAt && now - new Date(state.lastPushAt).getTime() < GAP_MS) {
    console.log(`Actualités : ${fresh.length} en attente (dernière notification il y a moins de 90 minutes)`);
    return { sent: 0, reason: 'gap' };
  }
  const msg = buildMessage(fresh);
  if (dryRun) return { sent: 0, reason: 'dry', msg };
  const tokens = await allTokens(sb);
  console.log(`Actualités : ${fresh.length} nouvelle(s), envoi à ${tokens.length} téléphone(s)`);
  if (tokens.length) await send(sb, tokens, msg);
  const sent = [...fresh.map((n) => n.id), ...(state.sent ?? [])].slice(0, KEEP);
  await save({ lastPushAt: new Date(now).toISOString(), sent });
  return { sent: fresh.length, msg };
}
