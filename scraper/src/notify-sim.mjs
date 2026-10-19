// Notifications du simulateur envoyées par le robot, même application fermée :
// - ordre à cours limité dont la limite est atteinte (l'ordre est inscrit au portefeuille à la prochaine ouverture,
//   au même cours) ;
// - ordre à cours limité arrivé à expiration ;
// - dividende versé sur des actions détenues dans le simulateur.
// Chaque notification n'est envoyée qu'une fois (table notif_sent).
import fs from 'node:fs/promises';
import path from 'node:path';

const DAY = 864e5;
const FEE_RATE = 0.012;
const MIN_FEE = 1000;
const fees = (amount) => (amount > 0 ? Math.max(MIN_FEE, Math.round(amount * FEE_RATE)) : 0);
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const F = (v) => `${nf.format(v).replace(/[\u00a0\u202f]/g, ' ')} F`;
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Titres détenus juste avant la date d (mêmes règles que l'application) */
export function qtyBefore(orders, symbol, d) {
  return (orders ?? []).reduce((q, o) => (o.symbol === symbol && o.date.slice(0, 10) < d ? q + (o.side === 'buy' ? o.qty : -o.qty) : q), 0);
}

/**
 * Événements à notifier pour un portefeuille.
 * market = { bySym: Map(symbol → quote), sessionDate, updatedAt }, dividends = { SYMB: { history: [{d, a}] } }
 */
export function simEvents(userId, state, market, dividends, now = new Date()) {
  const out = [];
  if (!state) return out;
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);

  for (const p of state.pending ?? []) {
    const what = `${p.side === 'buy' ? 'achat' : 'vente'} ${p.symbol}`;
    const q = market.bySym.get(p.symbol);
    const day = p.createdAt.slice(0, 10);
    const live = q && market.sessionDate >= day && market.updatedAt > p.createdAt && market.updatedAt <= p.expiresAt;
    const hit = live && (p.side === 'buy' ? q.close <= p.limit : q.close >= p.limit);
    if (hit) {
      const okBuy = p.side === 'buy' && q.close * p.qty + fees(q.close * p.qty) <= state.cash;
      const okSell = p.side === 'sell' && (state.positions?.[p.symbol]?.qty ?? 0) >= p.qty;
      if (okBuy || okSell) {
        out.push({
          key: `fill:${p.id}`,
          title: `✅ Ordre exécuté : ${what}`,
          body: `${plural(p.qty, 'titre')} à ${F(q.close)} (limite ${F(p.limit)}). Ouvrez BRVMexa pour voir votre portefeuille.`,
          data: { target: p.symbol, url: '/simulator' },
        });
        continue;
      }
    }
    const exp = Date.parse(p.expiresAt);
    if (nowIso > p.expiresAt && now.getTime() - exp < 3 * DAY) {
      out.push({
        key: `exp:${p.id}`,
        title: `⌛ Ordre expiré : ${what}`,
        body: `Votre ordre à ${F(p.limit)} n’a pas été exécuté avant sa date limite. Vous pouvez en passer un nouveau.`,
        data: { target: p.symbol, url: '/simulator' },
      });
    }
  }

  // Dividendes détachés ces 3 derniers jours sur des actions détenues
  const created = (state.createdAt ?? '').slice(0, 10);
  const symbols = new Set([...Object.keys(state.positions ?? {}), ...(state.orders ?? []).map((o) => o.symbol)]);
  for (const sym of symbols) {
    for (const dv of dividends[sym]?.history ?? []) {
      if (dv.d > today || Date.parse(today) - Date.parse(dv.d) > 3 * DAY || dv.d <= created) continue;
      const qty = qtyBefore(state.orders, sym, dv.d);
      if (qty <= 0) continue;
      out.push({
        key: `div:${userId}:${sym}:${dv.d}`,
        title: `💰 Dividende reçu : ${sym}`,
        body: `${F(dv.a)} × ${plural(qty, 'action')} = ${F(Math.round(dv.a * qty))} versés dans votre simulateur (montant brut).`,
        data: { target: sym, url: '/simulator' },
      });
    }
  }
  return out;
}

export async function simNotifications({ sb, sendPush, dataDir, now = new Date() }) {
  const quotes = JSON.parse(await fs.readFile(path.join(dataDir, 'quotes.json'), 'utf8'));
  let dividends = {};
  try { dividends = JSON.parse(await fs.readFile(path.join(dataDir, 'dividends.json'), 'utf8')).items ?? {}; } catch {}
  const market = { bySym: new Map(quotes.items.map((q) => [q.symbol, q])), sessionDate: quotes.sessionDate, updatedAt: quotes.updatedAt };

  const rows = await sb('sim_portfolios?select=user_id,state', { headers: { Prefer: '' } });
  const events = [];
  for (const r of rows ?? []) for (const e of simEvents(r.user_id, r.state, market, dividends, now)) events.push({ ...e, user: r.user_id });
  console.log(`Simulateur : ${rows?.length ?? 0} portefeuilles, ${events.length} événement(s) à signaler`);
  if (!events.length) return;

  // Déjà envoyées ?
  const keys = events.map((e) => e.key);
  const sent = new Set();
  for (let i = 0; i < keys.length; i += 50) {
    const list = keys.slice(i, i + 50).map((k) => `"${k}"`).join(',');
    for (const r of (await sb(`notif_sent?select=key&key=in.(${encodeURIComponent(list)})`, { headers: { Prefer: '' } })) ?? []) sent.add(r.key);
  }
  const todo = events.filter((e) => !sent.has(e.key));
  if (!todo.length) { console.log('Simulateur : rien de nouveau à envoyer'); return; }

  const users = [...new Set(todo.map((e) => e.user))];
  const tokens = await sb(`push_tokens?select=token,user_id&user_id=in.(${users.join(',')})`, { headers: { Prefer: '' } });
  const byUser = new Map();
  for (const t of tokens ?? []) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

  const messages = [];
  for (const e of todo) {
    const to = byUser.get(e.user) ?? [];
    if (!to.length) console.log(`  ${e.key} : aucun téléphone enregistré`);
    for (const t of to) messages.push({ to: t, sound: 'default', channelId: 'alerts', title: e.title, body: e.body, data: e.data });
  }
  if (messages.length) await sendPush(messages);
  // Marquées comme envoyées (même sans téléphone : inutile de réessayer indéfiniment)
  await sb('notif_sent', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(todo.map((e) => ({ key: e.key }))),
  });
}
