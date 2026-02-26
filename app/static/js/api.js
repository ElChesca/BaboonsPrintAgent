// app/static/js/api.js

// ✨ 1. NUEVAS IMPORTACIONES
// Necesitamos 'getAuthHeaders' (que ya tenías)
// Necesitamos 'logout' (para cerrar la sesión)
// Necesitamos 'mostrarNotificacion' (para avisar al usuario)
import { getAuthHeaders, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';

/**
 * ✨ 2. FUNCIÓN INTERCEPTORA CENTRAL
 * Esta función manejará TODAS las respuestas de la API,
 * permitiéndonos centralizar la lógica.
 */
async function handleApiResponse(response) {

    //
    // 🕵️‍♂️ --- INICIO DEL INTERCEPTOR DE SESIÓN ZOMBIE --- 🕵️‍♂️
    //
    // ✨ FIX: No interceptar si es el endpoint de login (porque allí el 401 es "Credenciales inválidas", no "Sesión expirada")
    if (response.status === 401 && !response.url.endsWith('/login')) {
        console.error("API Interceptor: Error 401 (Unauthorized). Deslogueando...");

        mostrarNotificacion("Tu sesión ha expirado. Ingresa de nuevo.", "error");

        // Llamamos a tu función de logout() de auth.js
        // Esta función debe borrar el token y disparar el evento 'authChange'
        logout();

        // Lanzamos un error para detener cualquier otra ejecución
        throw new Error('Sesión expirada (401)');
    }
    // 🕵️‍♂️ --- FIN DEL INTERCEPTOR --- 🕵️‍♂️
    //

    // Si no fue 401, continuamos con tu lógica de errores original
    if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) { /* Ignorar si no hay JSON */ }

        // Lanzamos el error para que el 'catch' de la llamada original lo tome
        throw new Error(errorMessage);
    }

    // Manejo de respuestas exitosas (tu lógica original)
    if (response.status === 204) {
        return null; // Ej. para un DELETE exitoso
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }

    // Si no es JSON (como en tu 'fetchData' original)
    return {};
}


/**
 * ✨ 3. 'fetchData' REFACTORIZADO
 * Ahora solo se encarga de configurar y llamar.
 */
export async function fetchData(url, options = {}) {
    const authHeaders = getAuthHeaders();

    const config = {
        ...options,
        headers: {
            ...authHeaders,
            ...options.headers,
        }
    };

    try {
        const response = await fetch(url, config);

        // Pasamos la respuesta por nuestro interceptor central
        return handleApiResponse(response);

    } catch (error) {
        // Si el error no es un 401 (que ya redirige), lo logueamos (a menos que sea modo silent).
        if (error.message !== 'Sesión expirada (401)' && !options.silent) {
            console.error(`Error en fetchData para ${url}:`, error);
        }
        throw error; // Relanzamos para que el 'catch' original lo tome
    }
}

/**
 * ✨ 4. 'sendData' REFACTORIZADO Y CORREGIDO
 * Unificamos cómo se obtiene el token para que use 'getAuthHeaders'.
 */
export async function sendData(url, data, method = 'POST') {

    // ✨ CORRECCIÓN: Usamos tu función central 'getAuthHeaders'
    // en lugar de 'localStorage.getItem' para ser consistentes.
    const authHeaders = getAuthHeaders();

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders // ✨ Así usamos el token correcto
        },
        body: JSON.stringify(data)
    };

    try {
        const response = await fetch(url, options);

        // Pasamos la respuesta por nuestro interceptor central
        return handleApiResponse(response);

    } catch (error) {
        // Si el error no es un 401 (que ya redirige), lo logueamos (a menos que sea modo silent).
        if (error.message !== 'Sesión expirada (401)' && !data?.silent) {
            console.error(`Error en sendData (${method} ${url}):`, error);
        }
        throw error; // Relanzamos para que el 'catch' original lo tome
    }
}