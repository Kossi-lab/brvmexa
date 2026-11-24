import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSoir, pickBreves, dateLongue, STORES } from '../src/soir.mjs';

const market = {
  sessionDate: '2026-11-24', updatedAt: '2026-11-24T17:30:00Z', source: 'brvm.org', transactionsValue: 2238217762,
  advancing: 15, declining: 27, unchanged: 6,
  gainers: [{ name: 'TotalEnergies Marketing CI', close: 2985, change: 6.42 }, { name: 'AGL CI', close: 2695, change: 5.69 }, { name: 'SETAO CI', close: 2300, change: 5.5 }],
  losers: [{ name: 'Erium CI', close: 1480, change: -7.5 }, { name: 'Sicable CI', close: 2515, change: -7.37 }, { name: 'Servair Abidjan', close: 2590, change: -7.33 }],
  mostActive: [{ name: 'Sonatel', close: 3890, change: -0.26, volume: 166495 }, { name: 'Bridge Bank Group CI', close: 7500, change: -6.25, volume: 20538 }],
};
const indices = { items: [
  { id: 'brvm-composite', name: 'BRVM Composite', close: 472.04, change: -0.94 },
  { id: 'brvm-30', name: 'BRVM 30', close: 228.62, change: -0.97 },
  { id: 'brvm-prestige', name: 'BRVM Prestige', close: 180.92, change: -0.75 },
  { id: 'brvm-industriels', name: 'BRVM Industriels', close: 197, change: 2.22 },
  { id: 'brvm-consommation-de-base', name: 'BRVM Consommation de Base', close: 239, change: -2.01 },
] };
const une = { date: '2026-11-24', title: 'Coris Bank Côte d’Ivoire prépare son entrée au compartiment Prestige', summary: 'Résumé.', sections: [{ h: 'x', p: ['Phrase une. Phrase deux. Phrase trois.'] }] };
const art = (id, title, h, extra = {}) => ({ id, title, summary: `Résumé ${id}.`, rewritten: true, category: 'Entreprises', symbols: [], publishedAt: `2026-11-24T${h}:00Z`, ...extra });

test('la date est écrite en toutes lettres', () => {
  assert.equal(dateLongue('2026-11-24'), 'mardi 24 novembre 2026');
  assert.equal(dateLongue('2027-01-01'), 'vendredi 1er janvier 2027');
});

test('les brèves écartent la séance, la une et sa société, les épinglés', () => {
  const items = [
    art('a', 'La BRVM se stabilise, TotalEnergies brille en séance', '17:12', { category: 'Marchés', symbols: ['A', 'B', 'C', 'D'] }),
    art('b', 'Coris Bank Bénin lance son ouverture de capital', '17:06'),
    art('c', 'Tullow Oil trouve un accord avec le Ghana', '17:22'),
    art('d', 'Le Mag est disponible', '16:00', { pinned: true }),
    art('e', 'Dangote obtient le feu vert', '16:01'),
  ];
  assert.deepEqual(pickBreves(items, une, '2026-11-24T17:30:00Z').map((x) => x.id), ['c', 'e']);
});

test('le script reprend les vrais chiffres, sans conseil, avec les stores et le site', () => {
  const s = buildSoir({ market, indices, news: { items: [] }, une, generatedAt: '2026-11-24T17:40:00Z' });
  const t = s.markdown;
  assert.match(t, /termine à 472 points, en baisse de 0,9 %/);
  assert.match(t, /15 actions ont progressé, 27 ont reculé et 6 sont restées stables/);
  assert.match(t, /2,2 milliards de francs CFA/);
  assert.match(t, /TotalEnergies Marketing CI gagne 6,4 % à 2 985 francs CFA/);
  assert.match(t, /Bridge Bank Group CI, très échangée, recule de 6,3 %/);
  assert.match(t, /meilleur score pour les Industriels/);
  assert.match(t, new RegExp(`${STORES.googlePlay} sur Google Play`));
  assert.match(t, /App Store/);
  assert.match(t, /www point brvmexa point com/);
  assert.match(t, /Pas un conseil en investissement/);
  assert.doesNotMatch(t, /\b(achetez|vendez|va monter|garanti)\b/i);
});

test('sans séance, rien n’est produit', () => {
  assert.throws(() => buildSoir({ market: {}, indices, news: {}, une }));
});
