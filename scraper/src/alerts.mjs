// Vérification des alertes de cours par le robot, juste après chaque collecte.
// Envoie une notification push aux utilisateurs dont l'alerte est atteinte, même application fermée.
// Nécessite deux secrets GitHub : SUPABASE_URL et SUPABASE_SECRET_KEY (clé « secret » sb_secret_…).
// Sans ces secrets, le script ne fait rien (les alertes restent vérifiées par l'application elle-même).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const URL_ = process.env.SUPABASE_URL;
// Clé secrète (sb_secret_…) ou ancienne clé service_role
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, isIndex) => (isIndex ? nf(2).format(v) : `${nf(0).format(v)} FCFA`).replace(/[  ]/g, ' ');

export function isMet(a, price, change) {
  const v = Number(a.value);
  switch (a.kind) {
    case 'above': return price >= v;
    case 'below': return price <= v;
    case 'change_up': return change >= v;
    case 'change_down': return change <= -v;
    default: return false;
  }
}

export function describe(a) {
  const v = Number(a.value);
  if (a.kind === 'change_up') return `Hausse du jour ≥ ${nf(2).format(v)} %`;
  if (a.kind === 'change_down') return `Baisse du jour ≥ ${nf(2).format(v)} %`;
  return `${a.kind === 'above' ? 'Cours ≥' : 'Cours ≤'} ${fmt(v, a.is_index)}`;
}

async function sb(pathname, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    ...init,
    headers: { apikey: KEY, ...(KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function main() {
  if (!URL_ || !KEY) {
    console.log('Alertes : secrets Supabase absents, vérification côté robot ignorée.');
    return;
  }
  const quotes = JSON.parse(await fs.readFile(path.join(DATA, 'quotes.json'), 'utf8')).items;
  const indices = JSON.parse(await fs.readFile(path.join(DATA, 'indices.json'), 'utf8')).items;
  const bySym = new Map(quotes.map((q) => [q.symbol, q]));
  const byIdx = new Map(indices.map((i) => [i.id, i]));

  const alerts = await sb('alerts?active=eq.true&select=*', { headers: { Prefer: '' } });
  const hits = [];
  for (const a of alerts ?? []) {
    const q = a.is_index ? byIdx.get(a.target) : bySym.get(a.target);
    if (q && isMet(a, q.close, q.change)) hits.push({ a, q });
  }
  console.log(`Alertes : ${alerts?.length ?? 0} actives, ${hits.length} atteintes`);
  const tokenCount = await sb('push_tokens?select=token', { headers: { Prefer: '' } });
  console.log(`Téléphones enregistrés pour les notifications : ${tokenCount?.length ?? 0}`);
  if (!hits.length) return;

  const userIds = [...new Set(hits.map((h) => h.a.user_id))];
  const tokens = await sb(`push_tokens?select=token,user_id&user_id=in.(${userIds.join(',')})`, { headers: { Prefer: '' } });
  const tokensByUser = new Map();
  for (const t of tokens ?? []) tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);

  const now = new Date().toISOString();
  const messages = [];
  for (const { a, q } of hits) {
    if (!tokensByUser.get(a.user_id)?.length) console.log(`  ${a.target} : aucun téléphone enregistré pour cet utilisateur`);
    for (const to of tokensByUser.get(a.user_id) ?? []) {
      messages.push({
        to,
        sound: 'default',
        channelId: 'alerts',
        title: `🔔 ${a.is_index ? a.target_name : a.target} : alerte atteinte`,
        body: `${describe(a)} — cours actuel ${fmt(q.close, a.is_index)}`,
        data: { target: a.target },
      });
    }
    await sb(`alerts?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ active: false, triggered_at: now, triggered_price: q.close }) });
  }
  // Service de notifications d'Expo, par paquets de 100
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    const json = await res.json().catch(() => null);
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const ok = tickets.filter((t) => t.status === 'ok').length;
    console.log(`Notifications : ${ok}/${Math.min(100, messages.length - i)} acceptées par Expo (HTTP ${res.status})`);
    for (const t of tickets) if (t.status !== 'ok') console.log(`  refusée : ${t.details?.error ?? ''} ${t.message ?? ''}`);
    if (json?.errors) console.log('  erreur Expo :', JSON.stringify(json.errors));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('Alertes :', e.message);
    process.exitCode = 1;
  });
}
