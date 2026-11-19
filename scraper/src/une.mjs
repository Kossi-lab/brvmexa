// « À la une » : chaque jour, la rédaction BRVMexa choisit l'actualité la plus importante pour les
// investisseurs de la BRVM et en tire un article détaillé (intertitres, points clés, enjeux).
// Une seule rédaction par jour, au premier passage du robot à partir de 9 h (heure de Lomé).
// Fichiers : data/une.json (l'article du jour) et data/une-history.json (les 30 derniers).
import fs from 'node:fs/promises';
import path from 'node:path';
import { askGemini, askAnthropic, extractArticle } from './rewrite.mjs';

const START_HOUR = 9; // UTC = heure de Lomé
const KEEP = 30;
const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();

const PROMPT = `Tu es rédacteur en chef de BRVMexa, un média consacré à la Bourse régionale des valeurs mobilières (BRVM) d'Afrique de l'Ouest.
On te donne l'actualité choisie pour être « À la une » aujourd'hui. Écris un article de fond, ORIGINAL, en bon français, pour des épargnants et des investisseurs de l'UEMOA, débutants comme confirmés.

Règles impératives :
- N'utilise QUE les faits, chiffres, noms et dates présents dans les éléments fournis. N'invente aucun chiffre, aucune citation, aucune date.
- Tu peux expliquer des notions générales (ce qu'est un dividende, un emprunt obligataire, une introduction en bourse, le rôle de la BCEAO…) pour aider le lecteur, sans chiffres inventés.
- Ne recopie aucune phrase de la source : reformule entièrement.
- Ton professionnel, clair et vivant. Aucun conseil d'achat ou de vente, aucune promesse de gain.
- Ne cite pas le média d'origine dans le texte.
- Titre : 60 à 110 caractères, accrocheur mais exact, sans point final.
- Chapeau : 2 phrases au plus (45 mots au plus).
- Corps : 3 à 4 parties, chacune avec un intertitre court (2 à 6 mots) et 1 à 3 paragraphes. La dernière partie explique ce que cela change ou ce qu'il faut surveiller pour un investisseur à la BRVM.
- « points » : 3 points clés à retenir, une phrase courte chacun.
- Si les éléments fournis sont trop pauvres pour un article fiable, réponds {"skip": true}.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{"title": "...", "summary": "...", "sections": [{"h": "Intertitre", "p": ["paragraphe", "paragraphe"]}], "points": ["...", "...", "..."]}`;

const KEYWORDS = /(résultat|bénéfice|chiffre d.affaires|dividende|introduction en bourse|cotation|emprunt obligataire|augmentation de capital|fraction|BRVM|BCEAO|taux directeur|inflation|AMF-UMOA|SGI|notation|FMI|Moody|S&P|Fitch)/i;

/** Note d'importance d'une actualité pour un investisseur de la BRVM */
export function score(n, now = Date.now()) {
  const ageH = (now - Date.parse(n.publishedAt || n.writtenAt || 0)) / 3600000;
  if (!(ageH >= 0 && ageH < 48)) return -1;
  const text = `${n.title} ${n.summary ?? ''} ${(n.body ?? []).join(' ')}`;
  let s = 0;
  const k = (n.symbols ?? []).length;
  s += k >= 1 && k <= 3 ? 6 : k > 3 ? 2 : 0;                  // une ou quelques sociétés cotées : vrai sujet d'entreprise
  if (/(séance|clôture|termine la journée|indices boursiers|point de marché)/i.test(n.title)) s -= 8; // compte rendu de séance quotidien
  s += KEYWORDS.test(text) ? 4 : 0;                            // sujet de marché
  s += n.category === 'Communiqués' ? 2 : n.category === 'Marchés' ? 1 : 0;
  s += Math.min(3, Math.floor(text.length / 600));             // matière disponible
  s += ageH < 24 ? 3 : 0;                                      // fraîcheur
  return s;
}

export function choose(items, history, now = Date.now()) {
  const used = new Set((history ?? []).map((h) => h.id));
  return items
    .filter((n) => n.rewritten && !used.has(n.id))
    .map((n) => ({ n, s: score(n, now) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || (b.n.publishedAt ?? '').localeCompare(a.n.publishedAt ?? ''))[0]?.n ?? null;
}

async function readJson(f, d) { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return d; } }

export async function updateUne({ dataDir, w, fetchText, log = console.log, now = Date.now(), force = false }) {
  const today = new Date(now).toISOString().slice(0, 10);
  const uneFile = path.join(dataDir, 'une.json');
  const histFile = path.join(dataDir, 'une-history.json');
  const current = await readJson(uneFile, null);
  if (!force && current?.date === today) return { skip: 'déjà rédigée' };
  if (!force && new Date(now).getUTCHours() < START_HOUR) return { skip: 'avant 9 h' };
  if (!w) { log('À la une : aucune IA disponible'); return { skip: 'pas d’IA' }; }

  const news = (await readJson(path.join(dataDir, 'news.json'), { items: [] })).items ?? [];
  const history = (await readJson(histFile, { items: [] })).items ?? [];
  const n = choose(news, history, now);
  if (!n) { log('À la une : aucune actualité récente à mettre en avant'); return { skip: 'rien' }; }

  let text = '';
  if (n.origin?.url && /sikafinance\.com/.test(n.origin.url)) {
    try { text = extractArticle(await fetchText(n.origin.url, { retries: 2 })); } catch (e) { log('À la une : source illisible :', e.message); }
  }
  const quotes = (await readJson(path.join(dataDir, 'quotes.json'), { items: [] })).items ?? [];
  const cited = (n.symbols ?? []).map((s) => quotes.find((q) => q.symbol === s)).filter(Boolean);
  const source = [
    `Titre : ${n.origin?.title || n.title}`,
    `Date : ${n.publishedAt}`,
    `Article déjà publié par la rédaction : ${n.title}. ${n.summary ?? ''} ${(n.body ?? []).join(' ')}`,
    text ? `Texte complet de la source :\n${text}` : '',
    cited.length ? `Sociétés cotées concernées (cours de la dernière séance) : ${cited.map((q) => `${q.shortName || q.name} (${q.symbol}) ${q.close} FCFA, ${q.change > 0 ? '+' : ''}${q.change} %`).join(' ; ')}` : '',
  ].filter(Boolean).join('\n\n');

  const out = w.kind === 'gemini' ? await askGemini(source, w.key, PROMPT) : await askAnthropic(source, w.key, PROMPT, 3000);
  const r = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
  if (r.skip) { log(`À la une : « ${n.title.slice(0, 60)} » jugée trop pauvre`); history.unshift({ id: n.id, date: today, skipped: true }); await fs.writeFile(histFile, JSON.stringify({ items: history.slice(0, KEEP) }, null, 1) + '\n'); return { skip: 'pauvre' }; }
  const sections = (r.sections ?? []).map((x) => ({ h: clean(x.h), p: (Array.isArray(x.p) ? x.p : [x.p]).map(clean).filter((p) => p.length > 30) })).filter((x) => x.h && x.p.length);
  const title = clean(r.title).replace(/\.$/, '');
  if (title.length < 20 || sections.length < 2) throw new Error('À la une : réponse incomplète');
  const words = [r.summary, ...sections.flatMap((x) => x.p)].join(' ').split(/\s+/).length;
  const une = {
    date: today,
    id: n.id,
    title,
    summary: clean(r.summary) || n.summary,
    sections,
    points: (r.points ?? []).map(clean).filter(Boolean).slice(0, 3),
    symbols: n.symbols ?? [],
    category: n.category,
    author: 'La Rédaction, BRVMexa',
    publishedAt: n.publishedAt,
    writtenAt: new Date(now).toISOString(),
    readMinutes: Math.max(2, Math.round(words / 200)),
    origin: n.origin ?? null,
  };
  await fs.writeFile(uneFile, JSON.stringify(une, null, 1) + '\n');
  history.unshift({ id: n.id, date: today, title: une.title, summary: une.summary });
  await fs.writeFile(histFile, JSON.stringify({ items: history.slice(0, KEEP) }, null, 1) + '\n');
  log(`À la une : « ${une.title} » (${words} mots)`);
  return { une };
}
