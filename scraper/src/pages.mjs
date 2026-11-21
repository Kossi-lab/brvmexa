// Pages d'article de brvmexa.com : une vraie page par article de la rédaction, pour le partage.
// Facebook, WhatsApp, LinkedIn et X lisent l'aperçu (titre, résumé, image) dans le <head> de la page partagée :
// chaque article a donc sa propre adresse, https://www.brvmexa.com/actualites/a/<id>/ , avec ses balises Open Graph.
// L'article « À la une » a la sienne : /actualites/une/<date>/.
// Le modèle de page (en-tête, menu, pied de page du site) est fabriqué par build.py : scraper/templates/article.html.
// Les pages déjà créées ne sont jamais supprimées : un lien partagé reste valable.
import fs from 'node:fs/promises';
import path from 'node:path';

export const SITE = 'https://www.brvmexa.com';
const OG = {
  actu: `${SITE}/assets/img/og/og-actu.jpg`,
  une: `${SITE}/assets/img/og/og-une.jpg`,
};
const SHARE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#16C47F"/><rect x="7" y="17" width="4" height="8" rx="1.5" fill="#0A0F1A"/><rect x="14" y="12" width="4" height="13" rx="1.5" fill="#0A0F1A"/><rect x="21" y="7" width="4" height="18" rx="1.5" fill="#0A0F1A"/><path d="M6 14 13 9l5 2 8-6" stroke="#0A0F1A" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const safeId = (id) => String(id ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

function longDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
  } catch { return ''; }
}
function readMinutes(paras) {
  const words = paras.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Corps HTML d'une page d'article (tout le texte est échappé). */
export function articleBody(a) {
  const shareAttrs = ` data-bx-share data-share-url="${esc(a.url)}" data-share-title="${esc(a.title)}" data-share-text="${esc(a.summary)}" data-share-kind="${esc(a.kind)}" data-share-slug="${esc(a.slug)}"`;
  const tags = (a.symbols ?? []).filter((s) => /^[A-Z0-9]{2,12}$/.test(s))
    .map((s) => `<a class="tag" href="../../../fondamentaux/#${encodeURIComponent(s)}">${esc(s)}</a>`).join('');
  const points = (a.points ?? []).length
    ? `<aside class="ar-points"><b>L’essentiel</b><ol>${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></aside>` : '';
  const content = (a.sections ?? []).length
    ? a.sections.map((x) => `<h2>${esc(x.h)}</h2>` + (x.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('')).join('')
    : (a.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('');
  // Le texte est signé par la rédaction de BRVMexa : la source d'origine n'est pas affichée
  return `<article class="ar">
<nav class="ar-crumbs" aria-label="Fil d’Ariane"><a href="../../">Actualités</a><span aria-hidden="true">›</span><span>${esc(a.kind)}</span></nav>
<header class="ar-head">
<p class="ar-kick"><span class="${a.une ? 'is-une' : ''}">${esc(a.kind)}</span>${esc(longDate(a.date))}</p>
<h1>${esc(a.title)}</h1>
${a.summary ? `<p class="ar-lead">${esc(a.summary)}</p>` : ''}
<div class="ar-meta"><span class="ar-author">${MARK}La Rédaction BRVMexa</span><span>${a.minutes} min de lecture</span>
<button type="button" class="ar-sharebtn"${shareAttrs}>${SHARE_ICON}<span>Partager</span></button></div>
</header>
${points}
<div class="ar-body">${content}</div>
${tags ? `<div class="ar-tags"><span>Sociétés citées</span><div class="tags">${tags}</div></div>` : ''}
${/^(actu|une):[a-z0-9-]{1,64}$/.test(a.social ?? '') ? `<div data-bx-social="${esc(a.social)}"></div>` : ''}
<aside class="ar-end">
<div><b>Cet article vous a été utile ?</b><span>Partagez-le avec vos proches qui investissent à la BRVM.</span></div>
<div class="ar-end-btns"><button type="button" class="btn btn--primary ar-sharebig"${shareAttrs}>${SHARE_ICON}<span>Partager l’article</span></button>
<a class="btn btn--ghost" href="../../">Toutes les actualités</a></div>
</aside>
<p class="fx-disclaimer">Article d’information. Il ne constitue pas un conseil en investissement.</p>
</article>`;
}

/** Page complète : le modèle du site + titre, résumé, adresse, image et données structurées de l'article. */
export function renderPage(tpl, a) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: clip(a.title, 110), description: clip(a.summary, 300),
    datePublished: a.date, dateModified: a.modified || a.date, inLanguage: 'fr', mainEntityOfPage: a.url, image: [a.image],
    author: { '@type': 'Organization', name: 'La Rédaction BRVMexa', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'BRVMexa', logo: { '@type': 'ImageObject', url: SITE + '/assets/img/icon-512.jpg' } },
  };
  const json = JSON.stringify(ld).replace(/</g, '\\u003c');
  return tpl
    .split('{{TITLE}}').join(esc(clip(a.title, 120)))
    .split('{{DESC}}').join(esc(clip(a.summary || a.title, 200)))
    .split('{{URL}}').join(esc(a.url))
    .split('{{IMAGE}}').join(esc(a.image))
    .split('{{DATE}}').join(esc(a.date))
    .split('{{JSONLD}}').join(`<script type="application/ld+json">${json}</script>`)
    .split('{{BODY}}').join(articleBody(a));
}

async function writeIfChanged(file, html) {
  const old = await fs.readFile(file, 'utf8').catch(() => null);
  if (old === html) return false;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
  return true;
}

/**
 * Crée ou met à jour les pages des articles de la rédaction (news.json) et de l'article « À la une » (une.json).
 * docsDir : dossier docs du site ; tplFile : modèle produit par build.py.
 */
export async function writeArticlePages({ dataDir, docsDir, tplFile, log = console.log }) {
  const tpl = await fs.readFile(tplFile, 'utf8').catch(() => null);
  if (!tpl || !tpl.includes('{{BODY}}')) { log('Pages d’article : modèle absent, rien à faire'); return { written: 0 }; }
  const news = JSON.parse(await fs.readFile(path.join(dataDir, 'news.json'), 'utf8').catch(() => '{"items":[]}'));
  const une = JSON.parse(await fs.readFile(path.join(dataDir, 'une.json'), 'utf8').catch(() => 'null'));
  const jobs = [];
  for (const n of news.items ?? []) {
    const id = safeId(n.id);
    if (!n.rewritten || n.pinned || !id || !n.title) continue;
    const paragraphs = Array.isArray(n.body) ? n.body.map(String) : [];
    jobs.push({
      file: path.join(docsDir, 'actualites', 'a', id, 'index.html'),
      a: {
        url: `${SITE}/actualites/a/${id}/`, slug: 'actu', kind: 'Actualité', social: `actu:${id}`, title: n.title, summary: n.summary,
        author: n.author, date: n.publishedAt, modified: n.writtenAt, symbols: n.symbols, origin: n.origin,
        paragraphs, minutes: readMinutes([n.summary ?? '', ...paragraphs]), image: OG.actu,
      },
    });
  }
  if (une && une.title && /^\d{4}-\d{2}-\d{2}$/.test(une.date ?? '') && Array.isArray(une.sections)) {
    jobs.push({
      file: path.join(docsDir, 'actualites', 'une', une.date, 'index.html'),
      a: {
        url: `${SITE}/actualites/une/${une.date}/`, slug: 'a-la-une', kind: 'À la une', une: true, social: `une:${une.date}`, title: une.title, summary: une.summary,
        author: une.author, date: `${une.date}T08:00:00Z`, modified: une.writtenAt, symbols: une.symbols, origin: une.origin,
        points: une.points, sections: une.sections, minutes: une.readMinutes || 2, image: OG.une,
      },
    });
  }
  let written = 0;
  for (const j of jobs) if (await writeIfChanged(j.file, renderPage(tpl, j.a))) written++;
  log(`Pages d’article : ${jobs.length} à jour${written ? `, ${written} créée(s) ou modifiée(s)` : ''}`);
  return { written, total: jobs.length };
}
