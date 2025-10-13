// ✨ LA RUTA CLAVE: Desde /js/, busca 'auth.js' dentro de la carpeta /modules/
import { getAuthHeaders } from './modules/auth.js';

/**
 * Función centralizada para realizar todas las llamadas a la API.
 */
export async function fetchData(url, options = {}) {
    // 1. Obtiene los headers de autenticación (el token) ANTES de hacer nada más.
    const authHeaders = getAuthHeaders();

    // 2. Fusiona los headers de autenticación con cualquier otro.
    const config = {
        ...options,
        headers: {
            ...authHeaders,
            ...options.headers,
        }
    };

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            let errorMessage = `Error ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) { /* Ignorar si no hay JSON */ }
            throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return {};
        }

    } catch (error) {
        console.error(`Error en fetchData para ${url}:`, error);
        throw error;
    }
}