import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problems } from '../src/freshness.mjs';

const now = new Date('2026-11-25T12:41:00Z'); // mercredi, pendant la séance
test('données fraîches : aucun problème', () => {
  assert.deepEqual(problems({ lastRun: '2026-11-25T12:32:00Z', ok: true }, { sessionDate: '2026-11-25' }, now), []);
});
test('robot arrêté depuis 2 heures : alerte', () => {
  assert.equal(problems({ lastRun: '2026-11-25T10:30:00Z', ok: true }, { sessionDate: '2026-11-25' }, now).length, 1);
});
test('séance du jour absente : alerte', () => {
  assert.match(problems({ lastRun: '2026-11-25T12:32:00Z', ok: true }, { sessionDate: '2026-11-24' }, now)[0], /pas publiés/);
});
test('le week-end, pas d’alerte de séance', () => {
  assert.deepEqual(problems({ lastRun: '2026-11-28T12:30:00Z', ok: true }, { sessionDate: '2026-11-27' }, new Date('2026-11-28T12:41:00Z')), []);
});
