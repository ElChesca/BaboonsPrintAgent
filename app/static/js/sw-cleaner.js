
// sw-cleaner.js - EXTERMINADOR DE CACHÉ
// Este script se asegura de que NO quede ningún Service Worker activo que interfiera con las actualizaciones.

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        if (registrations.length > 0) {
            console.log("🧹 [SW-CLEANER] Service Workers encontrados:", registrations.length);
            for (let registration of registrations) {
                console.log("🔥 [SW-CLEANER] Eliminando SW en:", registration.scope);
                registration.unregister();
            }
            // Forzar recarga si se eliminó algo importante
            if (!sessionStorage.getItem('sw_cleaned')) {
                sessionStorage.setItem('sw_cleaned', 'true');
                console.log("🔄 [SW-CLEANER] Recargando página para aplicar cambios...");
                window.location.reload();
            }
        } else {
            console.log("✅ [SW-CLEANER] No hay Service Workers activos.");
        }
    }).catch(function (err) {
        console.error('❌ [SW-CLEANER] Error al limpiar SW:', err);
    });
}

// Limpiar Cachés de Almacenamiento también
if ('caches' in window) {
    caches.keys().then(function (names) {
        for (let name of names) {
            console.log("🗑️ [SW-CLEANER] Borrando Caché:", name);
            caches.delete(name);
        }
    });
}
