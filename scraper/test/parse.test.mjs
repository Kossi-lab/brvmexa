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
    { prev: snts.prevClose, open: snts.open, close: snts.close, vol: snts.volume, ch: snts.change },
    { prev: 44295, open: 44900, close: 44700, vol: 22254, ch: -0.45 },
  );
  assert.equal(q.find((x) => x.symbol === 'SEMC').open, null);
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
