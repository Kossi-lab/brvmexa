import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNew } from '../src/live.mjs';

const q = (symbol, close, change, volume) => ({ symbol, close, change, volume });
const published = { sessionDate: '2026-11-26', sessionTime: '10:02', items: [q('SNTS', 25000, 0.5, 120), q('ORAC', 15000, 0, 0)] };

test('Direct : rien de nouveau si heure et cours identiques (ordre indifférent)', () => {
  assert.equal(isNew(published, { date: '2026-11-26', time: '10:02' }, [q('ORAC', 15000, 0, 0), q('SNTS', 25000, 0.5, 120)]), false);
});
test('Direct : un cours, une variation ou un volume qui bouge est publié', () => {
  const s = { date: '2026-11-26', time: '10:02' };
  assert.equal(isNew(published, s, [q('SNTS', 25100, 0.9, 120), q('ORAC', 15000, 0, 0)]), true);
  assert.equal(isNew(published, s, [q('SNTS', 25000, 0.5, 180), q('ORAC', 15000, 0, 0)]), true);
});
test('Direct : nouvelle heure de mise à jour ou nouvelle séance = publication', () => {
  const same = [q('SNTS', 25000, 0.5, 120), q('ORAC', 15000, 0, 0)];
  assert.equal(isNew(published, { date: '2026-11-26', time: '10:15' }, same), true);
  assert.equal(isNew(published, { date: '2026-11-27', time: '09:02' }, same), true);
  assert.equal(isNew(null, { date: '2026-11-26', time: '10:02' }, same), true);
});
