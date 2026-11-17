/* Vuelo Privado · service worker: funciona sin conexión */
const SHELL = 'vp-shell-v19';
const CDN = 'vp-cdn-v1';
const TILES = 'vp-tiles-v1';
const SHELL_FILES = ['./', './index.html', './data.js', './data_world.js', './runways.js', './navaids.js', './routes.js', './app.js', './manifest.json', './icon.svg'];
const MAX_TILES = 800;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, CDN, TILES].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max){
  const c = await caches.open(cacheName); const keys = await c.keys();
  for(let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // App: primero red (para recibir actualizaciones), si no hay conexión, caché
  if(url.origin === location.origin){
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch:true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Librerías y fuentes: primero caché
  if(/unpkg\.com|jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CDN).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  // Teselas del mapa: caché con límite
  if(/arcgisonline\.com/.test(url.host)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(TILES).then(c => c.put(req, copy)).then(() => trim(TILES, MAX_TILES)); return res;
    }).catch(() => new Response('', { status:504 }))));
  }
});
