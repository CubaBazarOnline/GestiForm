const CACHE_NAME='productos-cache-v2';
const OFFLINE_URL='offline.html';
const ASSETS_TO_CACHE=[
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/bonus-modal.html'
];
self.addEventListener('install',(event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache)=>{
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});
self.addEventListener('activate',(event)=>{
  event.waitUntil(
    caches.keys().then((cacheNames)=>{
      return Promise.all(
        cacheNames.map((cacheName)=>{
          if(cacheName!==CACHE_NAME){
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
self.addEventListener('fetch',(event)=>{
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .catch(()=>{
          return caches.match(OFFLINE_URL);
        })
    );
  }else{
    event.respondWith(
      fetch(event.request)
        .catch(()=>{
          return caches.match(event.request);
        })
    );
  }
});
self.addEventListener('sync',(event)=>{
  if(event.tag==='sync-products'){
    console.log('Sincronización en segundo plano');
  }
});