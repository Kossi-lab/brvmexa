import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropCopiedSessions } from '../src/history.mjs';

test('un jour férié recopié (même cours, même volume) est retiré', () => {
  const rows = [
    { d: '2024-12-24', c: 2400, v: 16810 },
    { d: '2024-12-25', c: 2400, v: 16810 },
    { d: '2024-12-26', c: 2390, v: 19750 },
  ];
  assert.deepEqual(dropCopiedSessions(rows).map((p) => p.d), ['2024-12-24', '2024-12-26']);
});

test('une séance sans échange (volume nul) est gardée', () => {
  const rows = [{ d: '2026-11-24', c: 1495, v: 0 }, { d: '2026-11-25', c: 1495, v: 0 }];
  assert.equal(dropCopiedSessions(rows).length, 2);
});

test('même cours mais volume différent : vraie séance, gardée', () => {
  const rows = [{ d: '2026-11-24', c: 3750, v: 100 }, { d: '2026-11-25', c: 3750, v: 120 }];
  assert.equal(dropCopiedSessions(rows).length, 2);
});
