// Tests fonctionnels du site BRVMexa (Playwright + node:test).
// BASE_URL=https://www.brvmexa.com node --test tests-site/  (par défaut : le site en ligne)
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import tls from 'node:tls';

const BASE = (process.env.BASE_URL || 'https://www.brvmexa.com').replace(/\/$/, '');
const EN_LIGNE = !/localhost|127\.0\.0\.1/.test(BASE);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

// Ouvre une page et collecte erreurs JavaScript et violations de la politique de sécurité (CSP)
async function ouvrir(chemin) {
  const page = await browser.newPage();
  const erreurs = [], csp = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) csp.push(t);
  });
  const rep = await page.goto(BASE + chemin, { waitUntil: 'networkidle', timeout: 45000 });
  return { page, rep, erreurs, csp };
}

const PAGES = [
  ['/', /BRVMexa/],
  ['/marches/', /Cours BRVM/],
  ['/actions/sonatel-snts/', /Sonatel/],
  ['/fondamentaux/', /./],
  ['/actualites/', /./],
  ['/le-mag/', /Mag/],
  ['/apprendre/', /./],
  ['/lexique/', /./],
  ['/membre/', /Premium/],
  ['/application/', /./],
];

for (const [chemin, titre] of PAGES) {
  test(`page ${chemin} : s'ouvre sans erreur ni blocage de sécurité`, async () => {
    const { page, rep, erreurs, csp } = await ouvrir(chemin);
    try {
      assert.equal(rep.status(), 200, `code HTTP ${rep.status()}`);
      assert.match(await page.title(), titre);
      assert.deepEqual(erreurs, [], 'erreurs JavaScript');
      assert.deepEqual(csp, [], 'scripts bloqués par la politique de sécurité');
      assert.ok(await page.locator('meta[http-equiv="Content-Security-Policy"]').count(), 'politique de sécurité absente');
    } finally { await page.close(); }
  });
}

test('marchés : le tableau des cours est rempli', async () => {
  const { page } = await ouvrir('/marches/');
  try {
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length >= 40, null, { timeout: 20000 });
  } finally { await page.close(); }
});

test('données : le robot a publié des cours récents', async () => {
  const { page } = await ouvrir('/');
  try {
    const m = await page.evaluate(async () => (await fetch('/data/market.json', { cache: 'no-store' })).json());
    assert.ok(Array.isArray(m.gainers) && m.gainers.length > 0, 'palmarès vide');
    assert.ok(m.advancing + m.declining + m.unchanged >= 30, 'trop peu d’actions');
    if (EN_LIGNE) {
      const age = (Date.now() - Date.parse(m.updatedAt)) / 3.6e6;
      assert.ok(age < 80, `données vieilles de ${age.toFixed(0)} h (robot en panne ?)`); // 80 h couvre un week-end
    }
  } finally { await page.close(); }
});

test('page inconnue : renvoie la page 404 du site', async () => {
  const { page, rep } = await ouvrir('/cette-page-n-existe-pas/');
  try {
    assert.equal(rep.status(), 404);
    if (EN_LIGNE) assert.match(await page.content(), /BRVMexa/); // le petit serveur local n'a pas la page 404 du site
  } finally { await page.close(); }
});

test('fichiers sensibles : rien de privé n’est servi', async () => {
  const page = await browser.newPage();
  try {
    for (const f of ['/.env', '/.git/config', '/google-services.json', '/scraper/package.json', '/.github/workflows/update-data.yml']) {
      const r = await page.request.get(BASE + f);
      assert.notEqual(r.status(), 200, `${f} est accessible`);
    }
  } finally { await page.close(); }
});

test('en-têtes de sécurité (Cloudflare) présents', { skip: !EN_LIGNE }, async () => {
  const page = await browser.newPage();
  try {
    const h = (await page.request.get(BASE + '/')).headers();
    assert.match(h['server'] || '', /cloudflare/i, 'le site ne passe pas par Cloudflare');
    assert.match(h['strict-transport-security'] || '', /max-age=\d{7,}/);
    assert.equal(h['x-content-type-options'], 'nosniff');
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
    assert.match(h['content-security-policy'] || '', /frame-ancestors 'self'/);
    assert.ok(h['referrer-policy'] && h['permissions-policy'], 'Referrer-Policy / Permissions-Policy absents');
  } finally { await page.close(); }
});

// Remplace les alertes d'expiration (payantes chez Better Stack)
test('certificat HTTPS valide encore au moins 14 jours', { skip: !EN_LIGNE }, async () => {
  const fin = await new Promise((ok, ko) => {
    const s = tls.connect({ host: new URL(BASE).hostname, port: 443, servername: new URL(BASE).hostname }, () => { ok(new Date(s.getPeerCertificate().valid_to)); s.end(); });
    s.on('error', ko);
  });
  const jours = (fin - Date.now()) / 864e5;
  assert.ok(jours > 14, `le certificat expire dans ${jours.toFixed(0)} jours`);
});

test('nom de domaine renouvelé encore au moins 30 jours', { skip: !EN_LIGNE }, async () => {
  const r = await fetch('https://rdap.verisign.com/com/v1/domain/brvmexa.com');
  assert.equal(r.status, 200);
  const ev = (await r.json()).events.find((e) => e.eventAction === 'expiration');
  const jours = (Date.parse(ev.eventDate) - Date.now()) / 864e5;
  assert.ok(jours > 30, `brvmexa.com expire dans ${jours.toFixed(0)} jours : renouvelez-le chez Hostinger`);
});
