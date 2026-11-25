import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownNumbers } from '../src/numbers.mjs';

const source = 'Coris Bank Bénin lance une levée de 19,19 milliards de FCFA. Le titre CBIBF cote 24 900 FCFA, -2,14 %. Date : 2026-11-24';

test('les chiffres repris de la source sont acceptés', () => {
  assert.deepEqual(unknownNumbers('Une opération de 19,19 milliards ; le titre vaut 24 900 FCFA (-2,14 %) en 2026.', source), []);
});
test('un arrondi d’un chiffre de la source est accepté', () => {
  assert.deepEqual(unknownNumbers('Le titre recule de 2,1 % et vaut près de 24 900 F.', source), []);
});
test('les petits nombres qui comptent sont acceptés', () => {
  assert.deepEqual(unknownNumbers('Trois points à retenir, en 4 parties.', source), []);
});
test('un chiffre inventé est détecté', () => {
  assert.deepEqual(unknownNumbers('La levée représente 25 % du capital et 62,74 milliards au total.', source), ['25', '62.74']);
});
