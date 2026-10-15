// Fonctions d'analyse HTML, sans accès réseau (testables hors ligne).
import * as cheerio from 'cheerio';

const MONTHS = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "21 044 668 387 602" → 21044668387602 ; "-1,33" → -1.33 ; "-" → null */
export function parseNumber(raw) {
  const s = clean(raw).replace(/fcfa|%/gi, '').replace(/\s/g, '').replace(',', '.');
  if (!s || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "Mercredi, 14 octobre, 2026 - 20:30" → { date: "2026-10-14", time: "20:30" } */
export function parseFrenchDate(text) {
  const m = norm(text).match(/(\d{1,2})\s*(?:er)?\s+([a-z]+),?\s+(\d{4})(?:\s*-\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  const date = `${m[3]}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const time = m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : null;
  return { date, time };
}

/** Lit chaque <table> en { headers, rows } */
function readTables($) {
  return $('table').toArray().map((t) => {
    const $t = $(t);
    let headers = $t.find('thead th, thead td').toArray().map((c) => clean($(c).text()));
    let rowEls = $t.find('tbody tr').toArray();
    if (!headers.length) {
      const all = $t.find('tr').toArray();
      if (!all.length) return { headers: [], rows: [], el: t };
      headers = $(all[0]).find('th, td').toArray().map((c) => clean($(c).text()));
      rowEls = all.slice(1);
    }
    const rows = rowEls
      .map((r) => $(r).find('td, th').toArray().map((c) => clean($(c).text())))
      .filter((r) => r.length && r.some(Boolean));
    return { headers, rows, el: t };
  });
}

const findCol = (headers, ...keys) => headers.findIndex((h) => keys.some((k) => norm(h).includes(k)));

/** Date « Dernière mise à jour : … » présente sur les pages brvm.org */
export function parseLastUpdate(html) {
  const text = clean(cheerio.load(html)('body').text());
  const m = text.match(/Derni[eè]re mise [àa] jour\s*:?\s*([^|]{10,60}?\d{4}\s*-\s*\d{1,2}:\d{2})/i);
  return m ? parseFrenchDate(m[1]) : null;
}

/** Page brvm.org/fr/cours-actions/{secteur} → liste des actions */
export function parseQuotes(html) {
  const $ = cheerio.load(html);
  const table = readTables($).find(
    (t) => findCol(t.headers, 'symbole') >= 0 && findCol(t.headers, 'cloture') >= 0,
  );
  if (!table) return [];
  const h = table.headers;
  const col = {
    symbol: findCol(h, 'symbole'),
    name: findCol(h, 'nom'),
    volume: findCol(h, 'volume'),
    prev: findCol(h, 'veille'),
    open: findCol(h, 'ouverture'),
    close: findCol(h, 'cloture'),
    change: findCol(h, 'variation'),
  };
  return table.rows
    .map((r) => {
      const prevClose = parseNumber(r[col.prev]);
      const close = parseNumber(r[col.close]);
      const open = parseNumber(r[col.open]);
      return {
        symbol: clean(r[col.symbol]).toUpperCase(),
        name: clean(r[col.name]),
        volume: parseNumber(r[col.volume]) ?? 0,
        prevClose,
        open: open || null, // 0 = pas d'échange dans la séance
        close,
        change: parseNumber(r[col.change]) ?? 0,
        changeAbs: close != null && prevClose != null ? close - prevClose : null,
      };
    })
    .filter((q) => /^[A-Z]{3,6}$/.test(q.symbol) && q.close != null);
}

/** Page brvm.org/fr/indices → indices principaux, sectoriels, total return */
export function parseIndices(html) {
  const $ = cheerio.load(html);
  const out = [];
  for (const t of readTables($)) {
    const h = t.headers;
    const iName = findCol(h, 'nom');
    const iPrev = findCol(h, 'precedente');
    const iClose = h.findIndex((x) => norm(x) === 'fermeture');
    const iChange = h.findIndex((x) => norm(x).startsWith('variation') && !norm(x).includes('decembre'));
    const iYtd = findCol(h, 'decembre');
    if (iName < 0 || iClose < 0) continue;
    // Le titre de section (h2) qui précède la table donne le groupe
    const heading = norm($(t.el).prevAll('h2, h3').first().text());
    const group = heading.includes('sectoriel') ? 'sector' : heading.includes('total return') ? 'total_return' : 'main';
    for (const r of t.rows) {
      const name = clean(r[iName]).replace(/\s*[–-]\s*/g, ' - ').replace(/\s+/g, ' ');
      if (!name.toUpperCase().startsWith('BRVM')) continue;
      out.push({
        id: indexId(name),
        name: prettyIndexName(name),
        group: name.toUpperCase().includes('TOTAL RETURN') ? 'total_return' : group,
        prevClose: parseNumber(r[iPrev]),
        close: parseNumber(r[iClose]),
        change: parseNumber(r[iChange]) ?? 0,
        ytd: iYtd >= 0 ? parseNumber(r[iYtd]) : null,
      });
    }
  }
  return out;
}

export function indexId(name) {
  return norm(name)
    .replace(/^brvm\s*-?\s*/, 'brvm-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
}

function prettyIndexName(name) {
  const rest = clean(name).replace(/^BRVM\s*-?\s*/i, '');
  if (/^\d+$/.test(rest)) return `BRVM ${rest}`;
  const title = rest.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toUpperCase());
  return `BRVM ${title.replace(/ De /g, ' de ').replace('Discretionnaire', 'Discrétionnaire').replace('Energie', 'Énergie').replace('Telecommunications', 'Télécommunications')}`;
}

/** Bloc « Activités du marché » commun aux pages brvm.org */
export function parseMarketActivity(html) {
  const $ = cheerio.load(html);
  const res = { transactionsValue: null, capitalisationActions: null, capitalisationBonds: null };
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td, th').toArray().map((c) => clean($(c).text()));
    if (cells.length < 2) return;
    const label = norm(cells[0]);
    if (label.includes('valeur des transactions')) res.transactionsValue = parseNumber(cells[1]);
    else if (label.includes('capitalisation actions')) res.capitalisationActions = parseNumber(cells[1]);
    else if (label.includes('capitalisation des obligations')) res.capitalisationBonds = parseNumber(cells[1]);
  });
  return res;
}

/** Page brvm.org/fr/cours-obligations/0 → obligations cotées */
export function parseBonds(html) {
  const $ = cheerio.load(html);
  const table = readTables($).find((t) => findCol(t.headers, 'symbole') >= 0 && findCol(t.headers, 'cours') >= 0);
  if (!table) return [];
  const h = table.headers;
  const iSym = findCol(h, 'symbole');
  const iName = findCol(h, 'nom');
  const iVol = findCol(h, 'volume');
  const iPrev = findCol(h, 'veille');
  const iClose = h.findIndex((x) => norm(x).includes('cloture') || norm(x).includes('jour'));
  const iCoupon = findCol(h, 'coupon');
  const iMaturity = findCol(h, 'echeance');
  return table.rows
    .map((r) => ({
      symbol: clean(r[iSym]).toUpperCase(),
      name: clean(r[iName]),
      volume: parseNumber(r[iVol]) ?? 0,
      prevClose: parseNumber(r[iPrev]),
      close: parseNumber(r[iClose]),
      coupon: iCoupon >= 0 ? clean(r[iCoupon]) : null,
      maturity: iMaturity >= 0 ? clean(r[iMaturity]) : null,
    }))
    .filter((b) => b.symbol && b.name);
}

/** "14/10/2026 18:08" → ISO avec fuseau GMT (UEMOA = UTC+0) */
function parseSikaDate(s) {
  const m = clean(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00Z`;
}

/**
 * Listes d'articles sikafinance (actualités ou communiqués).
 * On ne garde que le titre, une accroche courte, l'image et le lien :
 * l'article complet s'ouvre sur le site de l'éditeur.
 */
export function parseSikaNewsList(html, { category = 'Marchés', baseUrl = 'https://www.sikafinance.com' } = {}) {
  const $ = cheerio.load(html);
  const items = new Map();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const title = clean($(a).text());
    if (!/_(\d+)(?:$|[?#])/.test(href) || title.length < 15) return;
    const url = new URL(href, baseUrl).toString();
    const id = 'sika-' + href.match(/_(\d+)(?:$|[?#])/)[1];
    if (items.has(id)) return;
    // Conteneur de l'article : premier parent qui contient une date jj/mm/aaaa
    let box = $(a).parent();
    for (let i = 0; i < 4 && box.length && !/\d{2}\/\d{2}\/\d{4}/.test(box.text()); i++) box = box.parent();
    const boxText = clean(box.text());
    const dateMatch = boxText.match(/\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?/);
    let summary = clean(boxText.replace(title, '').replace(dateMatch?.[0] ?? '', '').replace(/\(P\)/g, ''));
    if (summary.length > 160) summary = summary.slice(0, 157).replace(/\s+\S*$/, '') + '…';
    const img = box.find('img').first().attr('src');
    items.set(id, {
      id,
      title,
      summary: summary || null,
      url,
      image: img ? new URL(img, baseUrl).toString() : null,
      source: 'Sika Finance',
      category,
      premium: /\(P\)/.test(boxText),
      publishedAt: dateMatch ? parseSikaDate(dateMatch[0]) : null,
    });
  });
  return [...items.values()];
}

/** Flux RSS générique (Google Actualités, brvm.org…) */
export function parseRss(xml, { source, category = 'Marchés', idPrefix = 'rss' } = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('item')
    .toArray()
    .map((it) => {
      const $it = $(it);
      let title = clean($it.find('title').first().text());
      let src = source ?? clean($it.find('source').first().text());
      // Google Actualités suffixe le titre par « - Nom du média »
      if (!source && src && title.endsWith(` - ${src}`)) title = title.slice(0, -(src.length + 3));
      const url = clean($it.find('link').first().text());
      const pub = clean($it.find('pubDate').first().text());
      const descHtml = $it.find('description').first().text();
      let summary = clean(cheerio.load(descHtml || '')('body').text());
      if (summary === title || summary.startsWith(title)) summary = '';
      if (summary.length > 160) summary = summary.slice(0, 157).replace(/\s+\S*$/, '') + '…';
      const d = pub ? new Date(pub) : null;
      return {
        id: `${idPrefix}-${hash(url || title)}`,
        title,
        summary: summary || null,
        url,
        image: null,
        source: src || 'Web',
        category,
        premium: false,
        publishedAt: d && !isNaN(d) ? d.toISOString() : null,
      };
    })
    .filter((n) => n.title && n.url);
}

export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

/** Associe une actualité aux symboles des sociétés citées dans le titre ou l'accroche */
export function tagSymbols(item, companies) {
  const hay = ' ' + norm(`${item.title} ${item.summary ?? ''}`) + ' ';
  const found = [];
  for (const [symbol, c] of Object.entries(companies)) {
    const keys = [...(c.aliases ?? []), symbol.toLowerCase()];
    if (keys.some((k) => new RegExp(`[^a-z0-9]${escapeRe(norm(k).trim())}[^a-z0-9]`).test(hay))) found.push(symbol);
  }
  return found;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
