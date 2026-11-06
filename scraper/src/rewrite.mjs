// Rédaction BRVMexa : chaque actualité collectée est réécrite en français par l'IA
// (nouveau titre, chapeau et article), à partir des seuls faits de la source.
// La source d'origine reste citée en lien, par honnêteté et par respect du droit d'auteur.
import * as cheerio from 'cheerio';

export const AUTHOR = 'La Rédaction, BRVMexa';
const API = process.env.NEWS_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.NEWS_MODEL || 'claude-haiku-5-5';
// Option gratuite : Google Gemini (offre gratuite, sans carte bancaire), via son interface compatible OpenAI
const GEM_API = process.env.NEWS_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEM_MODELS = (process.env.NEWS_GEMINI_MODEL || 'gemini-flash-latest,gemini-2.5-flash').split(',');
export const PAUSE_MS = { gemini: 7000, anthropic: 500 }; // l'offre gratuite limite le nombre de demandes par minute

/** Moteur d'écriture disponible : Gemini (gratuit) sinon Anthropic (payant). */
export function writer() {
  if (process.env.GEMINI_API_KEY) return { kind: 'gemini', key: process.env.GEMINI_API_KEY };
  if (process.env.ANTHROPIC_API_KEY) return { kind: 'anthropic', key: process.env.ANTHROPIC_API_KEY };
  return null;
}
export class QuotaError extends Error {}

async function askGemini(source, key) {
  let last;
  for (const model of GEM_MODELS) {
    const res = await fetch(GEM_API, {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: source }],
      }),
    });
    const raw = await res.text();
    if (res.status === 429) throw new QuotaError(`quota gratuit Gemini atteint (${raw.slice(0, 160)})`);
    if (res.status === 401 || res.status === 403) throw new QuotaError(`clé Gemini refusée (HTTP ${res.status}) : ${raw.slice(0, 200)}`);
    if (!res.ok) { last = `${model} : HTTP ${res.status} ${raw.slice(0, 200)}`; continue; }
    try { return JSON.parse(raw).choices?.[0]?.message?.content ?? ''; } catch { last = `${model} : réponse illisible ${raw.slice(0, 200)}`; }
  }
  throw new QuotaError(`IA Gemini indisponible : ${last}`);
}

const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Texte principal d'une page d'article : le bloc qui contient le plus de paragraphes. */
export function extractArticle(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, header, footer, aside, form, iframe, svg, button').remove();
  let best = null, bestLen = 0;
  $('article, main, section, div').each((_, el) => {
    const ps = $(el).children('p');
    if (!ps.length) return;
    const len = ps.toArray().reduce((n, p) => n + clean($(p).text()).length, 0);
    if (len > bestLen) { bestLen = len; best = el; }
  });
  const paras = best
    ? $(best).children('p').toArray().map((p) => clean($(p).text())).filter((t) => t.length > 40)
    : [];
  return paras.join('\n\n').slice(0, 7000);
}

const PROMPT = `Tu es journaliste financier à la rédaction de BRVMexa, un site d'information sur la Bourse régionale des valeurs mobilières (BRVM) d'Afrique de l'Ouest.
À partir de la dépêche ci-dessous, écris un article ORIGINAL, en bon français, avec tes propres mots.

Règles impératives :
- Utilise uniquement les faits, chiffres, noms et dates présents dans la dépêche. N'invente rien, n'ajoute aucun chiffre.
- Ne recopie aucune phrase de la dépêche : reformule entièrement, avec une structure différente.
- Ton neutre et professionnel, phrases claires, accessibles à un investisseur débutant.
- Aucun conseil d'achat ou de vente.
- Ne mentionne pas le média d'origine dans le texte.
- Titre : 60 à 110 caractères, informatif, sans point final.
- Chapeau : 1 à 2 phrases (35 mots au plus) qui résument l'essentiel.
- Corps : 2 à 5 paragraphes courts. Si la dépêche est très courte, 2 paragraphes suffisent.
- Si la dépêche ne contient pas assez d'information pour écrire un article fiable, ou si elle n'a rien à voir avec l'économie, les entreprises ou les marchés, réponds {"skip": true}.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{"title": "...", "summary": "...", "body": ["paragraphe 1", "paragraphe 2"]}`;

/** Appelle l'IA et renvoie { title, summary, body[] } ou { skip: true }. */
export async function rewriteItem(item, text, w) {
  const source = [
    `Titre : ${item.title}`,
    item.publishedAt ? `Date : ${item.publishedAt}` : '',
    item.summary ? `Résumé : ${item.summary}` : '',
    text ? `Texte :\n${text}` : '',
  ].filter(Boolean).join('\n');
  const out = w.kind === 'gemini' ? await askGemini(`Dépêche :\n${source}`, w.key) : await askAnthropic(`Dépêche :\n${source}`, w.key);
  const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
  const r = JSON.parse(json);
  if (r.skip) return { skip: true };
  const body = (Array.isArray(r.body) ? r.body : [r.body]).map(clean).filter((p) => p.length > 20);
  const title = clean(r.title).replace(/\.$/, '');
  if (title.length < 20 || !body.length) throw new Error('IA : réponse incomplète');
  return { title, summary: clean(r.summary) || null, body };
}

async function askAnthropic(content, key) {
  const res = await fetch(API, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });
  if (res.status === 429) throw new QuotaError('quota atteint');
  if (!res.ok) throw new Error(`IA : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content ?? []).map((c) => c.text ?? '').join('');
}
