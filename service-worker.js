// app/static/service-worker.js

// ✨ ========================================================================
// ✨ 1. CONFIGURACIÓN CENTRAL DE VERSIÓN
// ✨ ¡IMPORTANTE! Esta versión DEBE ser IDÉNTICA a la de tu main.js
// ✨ Es el único paso "manual" que debes hacer.
// ✨ ========================================================================
const APP_VERSION = "1.0.6"; 
// ==========================================================================

const v = `?v=${APP_VERSION}`;
// El nombre de la caché AHORA depende de la versión de la app.
// Cuando cambies a "1.0.1", se creará una caché nueva: 'baboons-cache-v1.0.1'
const CACHE_NAME = `baboons-cache-v${APP_VERSION}`;

// ✨ Lista de archivos del "App Shell" (Lo mínimo para arrancar)
// ✨ Ahora todos usan la variable 'v' para coincidir con lo que
// ✨ pedirán tu index.html y tu main.js
const urlsToCache = [
  '/',
  `/index.html`, // Generalmente no se versiona el index.html
  `/static/css/global.css${v}`, // ¡Debe coincidir con tu index.html!
  `/static/js/main.js${v}`,
  `/static/js/api.js${v}`,
  `/static/js/uiHelpers.js${v}`,
  `/static/js/modules/auth.js${v}`,
  `/static/js/modules/notifications.js${v}`,
  `/static/home.html${v}`, // Los HTML que carga fetch SÍ se versionan
  `/static/login.html${v}`,
  '/static/img/logo.png', // Los logos no suelen cambiar
  '/static/img/logo-192.png',
  '/static/img/logo-512.png',
  'https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.min.js'
];

// --- Evento 'install': Guarda el "App Shell" en la caché ---
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Instalando v${APP_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precargando App Shell en caché.');
        // Usamos addAll. Si UN SOLO archivo falla (ej. 404), la instalación falla.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.skipWaiting(); // Forza al SW a activarse
      })
      .catch((error) => {
          console.error('[Service Worker] Falló la instalación (addAll):', error);
          // Si falla aquí, el SW no se instalará. Revisa que todas las rutas en urlsToCache sean correctas.
      })
  );
});

// --- Evento 'activate': Limpia las cachés antiguas ---
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activando v${APP_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ✨ ¡Magia! Borra CUALQUIER caché que no sea la actual.
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- Evento 'fetch': Intercepta todas las peticiones ---
self.addEventListener('fetch', (event) => {
  // No nos interesan peticiones que no sean GET (ej. POST a la API)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // No cacheamos las peticiones a la API (o cualquier ruta que incluya '/api/')
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Estrategia: "Cache first, falling back to network"
  // (Primero caché, si falla, red)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 1. Si está en la CACHÉ, lo devolvemos al instante.
        //    (Esto funcionará para 'login.css?v=1.0.0' en la 2da carga)
        if (response) {
          // console.log('[Service Worker] Sirviendo desde caché:', event.request.url);
          return response;
        }

        // 2. Si NO está en la caché, lo pedimos a INTERNET.
        //    (Esto pasará con 'login.css?v=1.0.0' la 1ra vez)
        // console.log('[Service Worker] Pidiendo a la red:', event.request.url);
        
        return fetch(event.request)
          .then((networkResponse) => {
            
            // 3. ¡Lo guardamos en la caché para la próxima vez!
            //    Clonamos la respuesta porque solo se puede leer una vez.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Guardamos la petición con su 'v=' como clave.
                cache.put(event.request, responseToCache);
              });
            
            // 4. Devolvemos la respuesta de internet a la app.
            return networkResponse;
          })
          .catch(() => {
            // ✨ ¡AQUÍ ESTÁ EL ARREGLO DEL 502! ✨
            // 5. Si internet también falla (¡estamos offline de verdad!),
            //    ya no devolvemos "nada". Devolvemos una respuesta de error.
            console.warn(`[Service Worker] Fallo al buscar en red: ${event.request.url}`);
            
            // Devolvemos una respuesta de error estándar.
            // Esto evita el 502 y le permite al 'fetch' de tu app
            // caer en su propio '.catch()' correctamente.
            return new Response(
              JSON.stringify({ error: 'Fallo al conectar con la red.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
      })
  );
});