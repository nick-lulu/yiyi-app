const CACHE='yiyi-pwa-0.5.0';
const CORE=['./','index.html','style.css','realism.css','trial.css','mobile.css','trial-core.js','daily-engine.js','app.js','realism.js','trial.js','pwa.js','personal-avatar.js','personal-avatar.css','manifest.webmanifest','assets/wardrobe-photography.png','assets/icon-192.png','assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(CORE.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('yiyi-pwa-')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.pathname.includes('/api/'))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok&&response.type==='basic')await cache.put(event.request,response.clone());return response}catch{const saved=await cache.match(event.request);if(saved)return saved;if(event.request.mode==='navigate'){const index=await cache.match(new URL('index.html',scope));if(index)return index}return new Response('暂时离线。请联网打开一次一衣后重试。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})}})());
});
