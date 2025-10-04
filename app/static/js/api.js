// app/static/js/api.js
import { getAuthHeaders, logout } from './modules/auth.js';

/**
 * Función centralizada para hacer peticiones a la API.
 * Automáticamente añade el token de autenticación y maneja errores comunes.
 * @param {string} url - La URL del endpoint de la API (ej: '/api/dashboard/stats').
 * @param {object} options - Opciones adicionales para fetch (method, body, etc.).
 * @returns {Promise<any>} - La respuesta JSON de la API.
 */
export async function fetchData(url, options = {}) {
    // Combinamos las cabeceras por defecto con las que puedan venir en options
    const config = {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers,
        },
    };

    const response = await fetch(url, config);

    // Si el token es inválido o expiró (error 401), cerramos la sesión.
    if (response.status === 401) {
        logout();
        throw new Error('Sesión expirada. Por favor, inicie sesión de nuevo.');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `Error ${response.status}`);
    }

    // Si la respuesta no tiene contenido (ej: en un DELETE), devolvemos un objeto vacío.
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return {};
    }
}