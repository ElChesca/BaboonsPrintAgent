// app/static/js/api.js

// ✨ 1. NUEVAS IMPORTACIONES
import { getAuthHeaders, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';

/**
 * ✨ 2. FUNCIÓN INTERCEPTORA CENTRAL
 */
async function handleApiResponse(response) {
    if (response.status === 401 && !response.url.endsWith('/login')) {
        console.error("API Interceptor: Error 401 (Unauthorized). Deslogueando...");
        mostrarNotificacion("Tu sesión ha expirado. Ingresa de nuevo.", "error");
        logout();
        throw new Error('Sesión expirada (401)');
    }

    if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        let errorData = null;
        try {
            errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) { /* Ignorar si no hay JSON */ }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        throw error;
    }

    if (response.status === 204) {
        return null; 
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }

    return {};
}

/**
 * ✨ 3. 'fetchData'
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
        return handleApiResponse(response);
    } catch (error) {
        if (error.message !== 'Sesión expirada (401)' && !options.silent) {
            console.error(`Error en fetchData para ${url}:`, error);
        }
        throw error; 
    }
}

/**
 * ✨ 4. 'sendData'
 */
export async function sendData(url, data, method = 'POST') {
    const authHeaders = getAuthHeaders();
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders
        },
        body: JSON.stringify(data)
    };

    try {
        const response = await fetch(url, options);
        return handleApiResponse(response);
    } catch (error) {
        // ✨ LOG DETALLADO PARA DIAGNÓSTICO (Error 0)
        console.error(`🔴 Error de RED en sendData (${method} ${url}):`, {
            message: error.message,
            stack: error.stack,
            url: url,
            payload: data
        });

        if (error.message !== 'Sesión expirada (401)' && !data?.silent) {
            mostrarNotificacion(`Error de conexión (0): No se pudo llegar al servidor. Reintente en un momento.`, "error");
        }
        throw error;
    }
}