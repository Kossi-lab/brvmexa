import test from 'node:test';
import assert from 'node:assert/strict';
import { score, choose } from '../src/une.mjs';

const now = Date.parse('2026-11-19T12:00:00Z');
const base = { rewritten: true, publishedAt: '2026-11-19T08:00:00Z', category: 'Marchés', body: ['x'.repeat(700)] };

test('un résultat de société passe devant le compte rendu de séance', () => {
  const recap = { ...base, id: 'a', title: 'La BRVM termine la séance dans le rouge', symbols: ['SNTS', 'ORAC', 'SGBC', 'BOAC', 'ETIT'] };
  const res = { ...base, id: 'b', title: 'Vivo Energy CI : bénéfice en hausse de 15 %', symbols: ['SHEC'] };
  assert.ok(score(res, now) > score(recap, now));
  assert.equal(choose([recap, res], [], now).id, 'b');
});

test('une actualité déjà mise à la une ou trop ancienne est écartée', () => {
  const old = { ...base, id: 'c', title: 'Ancienne nouvelle', publishedAt: '2026-11-10T08:00:00Z', symbols: ['SHEC'] };
  const seen = { ...base, id: 'd', title: 'Déjà à la une', symbols: ['SHEC'] };
  assert.equal(score(old, now), -1);
  assert.equal(choose([old, seen], [{ id: 'd' }], now), null);
});
