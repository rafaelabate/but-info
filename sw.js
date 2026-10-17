// Service worker : l'app s'ouvre même sans réseau.
// Réseau d'abord pour tout (données toujours fraîches), cache en secours hors ligne.
// Clé de cache = adresse sans paramètres (?t=… et ?v=… servent seulement à contourner le CDN).

const VERSION = '2026-09-29.1';
const PREFIXE = 'but-info-';
const CACHE = PREFIXE + VERSION;
const SCOPE = self.registration.scope;

// Coque : de quoi redémarrer hors ligne dès l'installation. Un fichier absent est ignoré.
const COQUE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/vues/aujourdhui.css',
  'css/vues/planning.css',
  'css/vues/afaire.css',
  'css/vues/cours.css',
  'css/vues/reviser.css',
  'css/vues/reglages.css',
  'js/app.js',
  'js/ui.js',
  'js/html.js',
  'js/donnees.js',
  'js/verrou.js',
  'js/stockage.js',
  'js/temps.js',
  'js/seal.js',
  'js/cours.js',
  'js/ics.js',
  'js/vues/aujourdhui.js',
  'js/vues/planning.js',
  'js/vues/afaire.js',
  'js/vues/cours.js',
  'js/vues/reviser.js',
  'js/vues/reglages.js',
  'vendor/fonts/inter.woff2',
  'icons/favicon.svg',
  'icons/apple-touch-icon.png',
];

// État de la synchro : toujours demandé au réseau, le cache ne sert que hors ligne.
const ETAT = new URL('data/etat.json', SCOPE).pathname;

const cle = (adresse) => { const u = new URL(adresse, SCOPE); return u.origin + u.pathname; };
const gardable = (r) => r.status === 200 && r.type === 'basic' && !r.redirected;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE).catch(() => null);
    if (cache) await Promise.allSettled(COQUE.map(async (chemin) => {
      const r = await fetch(new Request(new URL(chemin, SCOPE), { cache: 'reload' }));
      if (gardable(r)) await cache.put(cle(chemin), r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n.startsWith(PREFIXE) && n !== CACHE).map((n) => caches.delete(n)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  e.respondWith(reseauDabord(e, req, url));
});

async function reseauDabord(e, req, url) {
  const k = url.origin + url.pathname;
  const cache = await caches.open(CACHE).catch(() => null);
  try {
    let r = req.mode === 'navigate' ? await e.preloadResponse : null;
    // no-cache : revalidation (304 si rien n'a changé), pour ne pas mélanger ancien et nouveau code après une publication.
    // Les navigations gardent leur requête d'origine (redirection « manual » exigée par le navigateur).
    if (!r) r = req.mode === 'navigate' ? await fetch(req) : await fetch(req, { cache: url.pathname === ETAT ? 'no-store' : 'no-cache' });
    if (cache && gardable(r)) e.waitUntil(cache.put(k, r.clone()).catch(() => {}));
    return r;
  } catch (err) {
    // Réseau injoignable : dernière version connue.
    const copie = cache && (await cache.match(k) || (req.mode === 'navigate' && (await cache.match(cle('./')) || await cache.match(cle('index.html')))));
    if (copie) return copie;
    throw err;
  }
}
