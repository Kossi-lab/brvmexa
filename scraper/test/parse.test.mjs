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
