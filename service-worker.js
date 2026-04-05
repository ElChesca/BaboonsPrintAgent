// service-worker.js (¡Archivo en la raíz del proyecto!)

// ✨ ========================================================================
// ✨ 1. CONFIGURACIÓN CENTRAL DE VERSIÓN
// ✨ ¡DEBE SER IDÉNTICA a la de tu main.js!
// ✨ ========================================================================
const APP_VERSION = "1.6.6";
// HISTORIAL DE VERSIONES:
// 1.6.6: Fix Resto pre-bill formatting and auto-start guide.
// 1.6.5: Final contrast fixes on header buttons.
// 1.6.4: Fix Navbar dropdown hover gap.
// 1.6.3: High contrast buttons and Config Guide.
// 1.6.2: Fix printing module and agent status.
// 1.6.0: Fix fetchData global and SW auto-update
// 1.5.9: Fix login_secure cache and centering
// 1.5.8: Force Refresh Historial Ajustes
// 1.4.4: Reportes Premium y Paginación Historial
// ==========================================================================

const v = `?v=${APP_VERSION}`;
const CACHE_NAME = `baboons-cache-v${APP_VERSION}`;

// ✨ Lista de archivos del "App Shell" (Lo mínimo para arrancar)
// ✨ ¡ACTUALIZADA!
const urlsToCache = [
    '/', // La raíz (index.html)
    '/index.html',

    // --- Archivos Principales (versionados) ---
    `/static/css/global.css${v}`,
    `/static/css/app_types.css${v}`,
    `/static/css/login_secure.css${v}`,
    `/static/css/pedidos.css${v}`,
    `/static/js/main.js${v}`,
    `/static/js/api.js${v}`,
    `/static/js/uiHelpers.js${v}`,
    `/static/js/modules/auth.js${v}`,
    `/static/js/modules/notifications.js${v}`,
    `/static/js/modules/pedidos.js${v}`,
    `/static/js/modules/hoja_ruta.js${v}`,

    // --- Páginas HTML (versionadas) ---
    `/static/login_secure.html${v}`,
    `/static/home_retail.html${v}`,
    `/static/home_consorcio.html${v}`,
    `/static/home_distribuidora.html${v}`,
    `/static/pedidos.html${v}`,
    `/static/hoja_ruta.html${v}`,
    `/static/historial_ajustes.html${v}`,
    `/static/js/modules/historial_ajustes.js${v}`,

    // --- Recursos estáticos (no cambian) ---
    '/static/img/logo.png',
    '/static/img/logo-192.png',
    '/static/img/logo-512.png',
    'https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.min.js'
];

// --- Evento 'install': Guarda el "App Shell" en la caché ---
self.addEventListener('install', (event) => {
    console.log(`[Service Worker] Instalando v${APP_VERSION}...`);
    
    // Forza al SW a activarse inmediatamente
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Precargando App Shell en caché.');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                self.skipWaiting(); // Forza al SW a activarse
            })
            .catch((error) => {
                console.error('[Service Worker] Falló la instalación (addAll):', error);
                // Si falla aquí, revisa que todas las rutas en urlsToCache sean correctas.
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
                    // Borra CUALQUIER caché que no sea la actual.
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
    // No cachear POSTs ni llamadas a la API
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // ✨ FIX CORS: No cachear recursos externos que no estén en urlsToCache
    // para evitar errores de respuestas "opaque" en elementos que requieren CORS (como Leaflet)
    const isExternal = !event.request.url.startsWith(self.location.origin);
    const isPrecached = urlsToCache.some(url => event.request.url.endsWith(url));

    if (isExternal && !isPrecached) {
        return; // Dejar que el navegador maneje la petición normalmente sin pasar por el SW
    }

    // Estrategia: "Cache first, falling back to network"
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 1. Si está en la CACHÉ, lo devolvemos al instante.
                if (response) {
                    return response;
                }

                // 2. Si NO está en la caché, lo pedimos a INTERNET.
                return fetch(event.request)
                    .then((networkResponse) => {

                        // 3. ¡Lo guardamos en la caché para la próxima vez!
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        // 4. Devolvemos la respuesta de internet a la app.
                        return networkResponse;
                    })
                    .catch(() => {
                        // 5. Si internet falla (offline), devolvemos un error JSON
                        console.warn(`[Service Worker] Fallo al buscar en red: ${event.request.url}`);
                        return new Response(
                            JSON.stringify({ error: 'Fallo al conectar con la red.' }),
                            { status: 503, headers: { 'Content-Type': 'application/json' } }
                        );
                    });
            })
    );
});