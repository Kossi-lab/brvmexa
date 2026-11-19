// Notification ponctuelle envoyée à tous les téléphones (ex. sortie du Mag BRVMexa).
// Lancée à la main depuis GitHub : Actions → « Notification à tous » → Run workflow.
// Paramètres (variables d'environnement) : TITLE, BODY, LINK (page brvmexa.com ouverte au toucher), MODE = test | envoi.
// En mode « test », rien n'est envoyé : le script compte seulement les téléphones inscrits.
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const { TITLE = '', BODY = '', LINK = '', MODE = 'test' } = process.env;
const mask = (s) => String(s ?? '').replace(/Expo(nent)?PushToken\[[^\]]*\]/g, 'ExpoPushToken[masqué]');

async function sb(pathname, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    ...init,
    headers: { apikey: KEY, ...(KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function main() {
  if (!URL_ || !KEY) throw new Error('Secrets Supabase absents (SUPABASE_URL, SUPABASE_SECRET_KEY).');
  if (!TITLE.trim() || !BODY.trim()) throw new Error('Titre et texte obligatoires.');
  if (LINK && !LINK.startsWith('https://www.brvmexa.com/')) throw new Error('Le lien doit commencer par https://www.brvmexa.com/');
  const tokens = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`push_tokens?select=token&order=token&limit=1000&offset=${from}`, { headers: { Prefer: '' } });
    tokens.push(...(page ?? []).map((r) => r.token));
    if (!page || page.length < 1000) break;
  }
  const list = [...new Set(tokens)];
  console.log(`Message : « ${TITLE} » — ${BODY}`);
  console.log(`Téléphones inscrits aux notifications : ${list.length}`);
  if (MODE !== 'envoi') { console.log('Mode test : aucune notification envoyée.'); return; }
  const msg = { title: TITLE.trim(), body: BODY.trim(), sound: 'default', channelId: 'news', priority: 'default', data: LINK ? { url: '/news', article: LINK } : { url: '/news' } };
  let ok = 0;
  const dead = [];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(batch.map((to) => ({ to, ...msg }))),
    });
    const json = await res.json().catch(() => null);
    (Array.isArray(json?.data) ? json.data : []).forEach((t, k) => {
      if (t.status === 'ok') ok += 1;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[k]);
      else console.log(`  refusée : ${t.details?.error ?? ''} ${mask(t.message)}`);
    });
    if (json?.errors) console.log('  erreur Expo :', mask(JSON.stringify(json.errors)));
  }
  for (const t of dead) await sb(`push_tokens?token=eq.${encodeURIComponent(t)}`, { method: 'DELETE' }).catch(() => {});
  console.log(`Envoi terminé : ${ok}/${list.length} notifications acceptées par Expo${dead.length ? `, ${dead.length} téléphone(s) désinstallé(s) retiré(s)` : ''}.`);
}

main().catch((e) => { console.error('Erreur :', mask(e.message)); process.exit(1); });
