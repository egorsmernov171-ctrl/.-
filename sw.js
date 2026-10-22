// Service Worker: офлайн-кэш DRIFT ARENA (игра работает без интернета)
const CACHE = 'drift-arena-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/physics.js',
  './js/carbuilder.js',
  './js/world.js',
  './js/env.js',
  './js/effects.js',
  './js/textures.js',
  './js/input.js',
  './js/audio.js',
  './js/ui.js',
  './js/showroom.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  '../node_modules/three/build/three.module.js',
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(req).then(hit=>{
      if(hit) return hit;
      return fetch(req).then(res=>{
        if(res && res.ok && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
