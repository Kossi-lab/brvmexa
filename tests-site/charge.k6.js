// Test de charge léger du site (k6). Lancement manuel uniquement.
// Simule jusqu'à 30 visiteurs simultanés pendant ~2 min sur les pages et données les plus consultées.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://www.brvmexa.com').replace(/\/$/, '');
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],        // moins de 1 % d'erreurs
    http_req_duration: ['p(95)<2000'],     // 95 % des réponses en moins de 2 s
  },
};
const CHEMINS = ['/', '/marches/', '/actions/sonatel-snts/', '/data/quotes.json', '/data/market.json', '/actualites/'];

export default function () {
  for (const c of CHEMINS) {
    const r = http.get(BASE + c, { tags: { page: c } });
    check(r, { 'réponse 200': (x) => x.status === 200 });
    sleep(1 + Math.random() * 2);
  }
}
