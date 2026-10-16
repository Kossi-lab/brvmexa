import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseNumber, parseFrenchDate, parseQuotes, parseIndices, parseMarketActivity,
  parseLastUpdate, parseSikaNewsList, parseRss, tagSymbols,
} from '../src/parse.mjs';
import { COMPANIES, countryFromSymbol, sikaTicker } from '../src/companies.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fx = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('nombres au format français', () => {
  assert.equal(parseNumber('21 044 668 387 602 FCFA'), 21044668387602);
  assert.equal(parseNumber('-1,33'), -1.33);
  assert.equal(parseNumber('3,85%'), 3.85);
  assert.equal(parseNumber('-'), null);
});

test('dates en français', () => {
  assert.deepEqual(parseFrenchDate('Mercredi, 14 octobre, 2026 - 20:30'), { date: '2026-10-14', time: '20:30' });
  assert.deepEqual(parseFrenchDate('1er août 2026'), { date: '2026-08-01', time: null });
});

test('cours des actions', () => {
  const html = fx('cours-actions.html');
  const q = parseQuotes(html);
  assert.equal(q.length, 48);
  const snts = q.find((x) => x.symbol === 'SNTS');
  assert.deepEqual(
    { ref: snts.refPrice, open: snts.open, close: snts.close, vol: snts.volume, ch: snts.change },
    { ref: 44295, open: 44900, close: 44700, vol: 22254, ch: -0.45 },
  );
  assert.equal(q.find((x) => x.symbol === 'SEMC').open, null);
  // Clôture précédente déduite de la variation officielle (cas réel du 15/10/2026 : 44 700 → 43 900, -1,79 %)
  const html2 = html.replace('<td>SNTS</td><td>SONATEL SENEGAL</td><td>22&nbsp;254</td><td>44&nbsp;295</td>', '<td>SNTS</td><td>SONATEL SENEGAL</td><td>37&nbsp;543</td><td>43&nbsp;850</td>')
    .replace('<td>44&nbsp;700</td><td><span class="text-bad">-0,45</span>', '<td>43&nbsp;900</td><td><span class="text-bad">-1,79</span>');
  const s2 = parseQuotes(html2).find((x) => x.symbol === 'SNTS');
  assert.deepEqual([s2.prevClose, s2.changeAbs, s2.refPrice], [44700, -800, 43850]);
  assert.deepEqual(parseLastUpdate(html), { date: '2026-10-14', time: '20:30' });
});

test('indices et groupes', () => {
  const ix = parseIndices(fx('indices.html'));
  assert.equal(ix.length, 12);
  const c = ix.find((i) => i.id === 'brvm-composite');
  assert.equal(c.close, 536.65);
  assert.equal(c.group, 'main');
  assert.equal(c.ytd, 1.7);
  assert.equal(ix.find((i) => i.id === 'brvm-30').name, 'BRVM 30');
  assert.equal(ix.filter((i) => i.group === 'sector').length, 7);
  assert.equal(ix.find((i) => i.id === 'brvm-composite-total-return').group, 'total_return');
});

test('activité du marché', () => {
  const a = parseMarketActivity(fx('indices.html'));
  assert.equal(a.capitalisationActions, 21044668387602);
  assert.equal(a.transactionsValue, 2753777970);
});

test('actualités sikafinance', () => {
  const n = parseSikaNewsList(fx('sika-news.html'));
  assert.equal(n.length, 3);
  assert.equal(n[0].id, 'sika-90001');
  assert.equal(n[0].publishedAt, '2026-10-14T18:08:00Z');
  assert.ok(n[0].summary.length <= 160);
  assert.ok(n[0].image.startsWith('https://www.sikafinance.com/'));
  assert.equal(n[1].premium, true);
  assert.deepEqual(tagSymbols(n[0], COMPANIES), ['SNTS']);
  assert.deepEqual(tagSymbols(n[2], COMPANIES).sort(), ['ORAC', 'SGBC']);
});

test('flux RSS', () => {
  const [a] = parseRss(fx('google-news.xml'), { idPrefix: 'gn' });
  assert.equal(a.title, 'La BRVM termine la semaine en hausse');
  assert.equal(a.source, 'Journal Test');
  assert.equal(a.summary, null);
});

test('pays et tickers', () => {
  assert.equal(countryFromSymbol('BOABF'), 'BF');
  assert.equal(countryFromSymbol('SNTS'), 'SN');
  assert.equal(countryFromSymbol('ETIT'), 'TG');
  assert.equal(sikaTicker('LNBB'), 'LNBB.bj');
});

test('alertes : conditions', async () => {
  const { isMet, describe } = await import('../src/alerts.mjs');
  assert.equal(isMet({ kind: 'above', value: '44000' }, 44100, 0), true);
  assert.equal(isMet({ kind: 'below', value: '44000' }, 44100, 0), false);
  assert.equal(isMet({ kind: 'change_up', value: '3' }, 1, 3.2), true);
  assert.equal(isMet({ kind: 'change_down', value: '3' }, 1, -2.9), false);
  assert.equal(describe({ kind: 'above', value: 45000, is_index: false }), 'Cours ≥ 45 000 FCFA');
});

test('historique : archive CSV', async () => {
  const { parseArchiveCsv, fillFromArchive } = await import('../src/history.mjs');
  const csv = 'date,ticker,ouverture,haut,bas,cloture,volume_titres,volume_fcfa\n'
    + '2026-10-14,SNTS,44000.0,,,44700.0,22254.0,1\n2026-10-15,SNTS,,,,43900.0,37543.0,1\n2026-10-15,XXXX,1,,,1,1,1\n2026-10-15,ORAC,1,,,,1,1\n';
  const r = parseArchiveCsv(csv, new Set(['SNTS', 'ORAC']));
  assert.deepEqual(r.SNTS, [{ d: '2026-10-14', o: 44000, c: 44700, v: 22254 }, { d: '2026-10-15', o: null, c: 43900, v: 37543 }]);
  assert.equal(r.ORAC, undefined);
  // Fusion : nos propres points ne sont jamais écrasés
  const os = await import('node:os'); const fs = await import('node:fs/promises'); const path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bx-'));
  await fs.mkdir(path.join(dir, 'history'));
  await fs.writeFile(path.join(dir, 'history', 'SNTS.json'), JSON.stringify([{ d: '2026-10-15', o: 44705, c: 43900, v: 37543 }]));
  const fetchImpl = async () => ({ ok: true, text: async () => csv });
  assert.equal(await fillFromArchive(dir, ['SNTS'], { log: () => {}, fetchImpl }), 1);
  const h = JSON.parse(await fs.readFile(path.join(dir, 'history', 'SNTS.json'), 'utf8'));
  assert.deepEqual(h.map((p) => [p.d, p.o]), [['2026-10-14', 44000], ['2026-10-15', 44705]]);
  assert.equal(await fillFromArchive(dir, ['SNTS'], { log: () => {}, fetchImpl }), 0);
});

test('dividendes : nettoyage et synthèse', async () => {
  const { parseDividendsCsv, cleanDividends, summarize } = await import('../src/dividends.mjs');
  const csv = 'ticker,date_detachement,montant,exercice\n'
    + 'ECOC,2024-05-28,594.0,2023.0\nECOC,2025-05-31,804.0,2024.0\nECOC,2026-05-22,888.0,2025.0\nECOC,2026-06-29,0.9,2025.0\n'
    + 'TTLS,2024-06-26,207.58,2023.0\nTTLS,2024-06-27,207.58,2023.0\nTTLS,2025-07-09,222.4,2024.0\n'
    + 'UNXC,2022-07-27,60.75,2021.0\n';
  const raw = parseDividendsCsv(csv);
  const ecoc = cleanDividends(raw.ECOC);
  assert.deepEqual(ecoc.map((p) => p.a), [594, 804, 888]);
  assert.equal(summarize(ecoc, '2026-10-16').annual, 888);
  const ttls = cleanDividends(raw.TTLS);
  assert.equal(ttls.length, 2);
  // Dernier versement de plus de 12 mois mais moins de 18 : on le garde
  assert.equal(summarize(ttls, '2026-10-16').annual, 222.4);
  // Plus rien depuis 2022 : rendement nul
  assert.equal(summarize(cleanDividends(raw.UNXC), '2026-10-16').annual, 0);
});

test('dividendes : versement exceptionnel', async () => {
  const { summarize } = await import('../src/dividends.mjs');
  const l = [['2020-07-04', 125], ['2021-07-28', 235], ['2024-09-26', 143.1], ['2025-02-01', 110], ['2025-09-26', 1320]].map(([d, a]) => ({ d, a, ex: null }));
  const s = summarize(l, '2026-01-10');
  assert.equal(s.exceptional, true);
  assert.equal(s.usual, 143.1);
  assert.equal(summarize(l.slice(0, 4), '2025-06-01').exceptional, false);
});

test('performances sur plusieurs périodes', async () => {
  const { computePerf } = await import('../src/performance.mjs');
  const hist = [
    { d: '2025-10-10', c: 80 }, { d: '2025-12-31', c: 100 }, { d: '2026-05-04', c: 150 },
    { d: '2026-09-15', c: 110 }, { d: '2026-10-08', c: 125 }, { d: '2026-10-15', c: 119 },
  ];
  const p = computePerf(hist, '2026-10-16', 120);
  assert.equal(p.w1, -4);          // vs 125 (8 oct.)
  assert.equal(p.m1, 9.09);        // vs 110 (15 sept.)
  assert.equal(p.ytd, 20);         // vs 100 (31 déc.)
  assert.equal(p.y1, 50);          // vs 80 (10 oct. 2025)
  assert.deepEqual([p.hi52, p.lo52, p.full52], [150, 100, true]); // 80 date de plus d'un an
  // Historique trop court : pas de chiffre inventé
  const short = computePerf([{ d: '2026-10-01', c: 100 }], '2026-10-16', 110);
  assert.deepEqual([short.w1, short.m1, short.y1, short.ytd, short.full52], [10, null, null, null, false]);
});
