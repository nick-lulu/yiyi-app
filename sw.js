const VERSION = '0.9.2';
const CACHE = 'yiyi-pwa-' + VERSION;
const INDEX = 'index.html';
const CORE = [
  INDEX, `mvp-${VERSION}.css`, `mvp-${VERSION}.js`, 'manifest.webmanifest',
  'assets/wardrobe-preview.jpg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon.svg'
];
const SCOPE = new URL(self.registration.scope);
const FILES = new Map(CORE.map(file => [new URL(file, SCOPE).pathname, new URL(file, SCOPE).href]));
const SHELL = FILES.get(new URL(INDEX, SCOPE).pathname);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...FILES.values()].map(url => new Request(url, {
      cache:url === SHELL ? 'reload' : 'default'
    })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('yiyi-pwa-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return;
  const file = FILES.get(url.pathname);
  if (request.mode === 'navigate' && (url.pathname === SCOPE.pathname || file === SHELL)) {
    const existing = caches.open(CACHE).then(cache => cache.match(SHELL));
    // Keep each cached document paired with the bundles from its own release.
    const network = fetch(request).catch(() => null);
    event.respondWith((async () => {
      const cached = await existing;
      if (!cached) {
        const fresh = await network;
        return fresh || new Response('暂时离线，请联网打开一衣后再试。', {status:503});
      }
      let timer;
      try {
        const result = await Promise.race([network, new Promise(resolve => { timer = setTimeout(resolve, 1500); })]);
        return result?.ok ? result : cached;
      } finally {
        clearTimeout(timer);
      }
    })());
    return;
  }
  if (file && file !== SHELL) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(file)) || fetch(request))());
  }
});
