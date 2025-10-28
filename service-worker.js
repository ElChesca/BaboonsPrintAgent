// El nombre de nuestra "caja" de caché.
// ¡IMPORTANTE! Si alguna vez actualizás tus archivos (ej: global.css?v=2.1),
// tenés que cambiar este nombre (ej: 'baboons-cache-v2') para forzar la actualización.
const CACHE_NAME = 'baboons-cache-v1';

// ¡Tu global.css DEBE coincidir con la versión del index.html!
const urlsToCache = [
  '/', // La página principal
  '/index.html',
  '/static/css/global.css?v=2.4', // tiene que se coincidente con index!
  '/static/js/main.js',
  '/static/js/api.js',
  '/static/js/modules/auth.js',
  '/static/js/modules/notifications.js',
  '/static/home.html', // El módulo principal
  '/static/login.html', // El módulo de login
  '/static/img/logo.png',
  '/static/img/logo-192.png', // Los íconos de la PWA
  '/static/img/logo-512.png',
  'https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.min.js' // La librería JWT
];

// Evento 'install': Se dispara cuando el navegador instala el Service Worker.
// Aquí es donde guardamos nuestros archivos esenciales en la caché.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Abriendo caché y guardando archivos esenciales');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.skipWaiting(); // Forza al SW a activarse inmediatamente
      })
  );
});

// Evento 'activate': Se dispara cuando el Service Worker se activa.
// Aquí limpiamos cachés viejas si hemos actualizado la versión (CACHE_NAME).
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Toma control de todas las pestañas abiertas
});

// Evento 'fetch': ¡El más importante! Se dispara CADA VEZ que tu app pide un recurso.
self.addEventListener('fetch', (event) => {
  // Solo nos interesan las peticiones GET (no POST a la API)
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia: "Cache first, falling back to network" (Primero caché, si falla, red)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 1. Si encontramos el recurso en la CACHÉ, lo devolvemos al instante.
        if (response) {
          // console.log('[Service Worker] Recurso encontrado en caché:', event.request.url);
          return response;
        }

        // 2. Si NO está en la caché, lo pedimos a INTERNET.
        // console.log('[Service Worker] Recurso no encontrado, pidiendo a la red:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // 3. ¡Y lo guardamos en la caché para la próxima vez!
            // Clonamos la respuesta porque solo se puede "leer" una vez.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            // 4. Devolvemos la respuesta de internet a la app.
            return networkResponse;
          })
          .catch(() => {
            // 5. Si internet también falla (¡estamos offline de verdad!),
            // podríamos devolver una página de "fallback"
            // Por ahora, simplemente fallará (lo cual está bien para empezar).
            console.log('[Service Worker] Fallo al buscar en red y caché.');
            // (Opcional: podrías devolver un /offline.html)
          });
      })
  );
});
