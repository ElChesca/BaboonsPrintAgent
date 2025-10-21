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
export async function sendData(url, data, method = 'POST') {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify(data)
    };

    try {
        const response = await fetch(url, options);
        
        // ✨ --- NUEVA LÓGICA DE DEPURACIÓN --- ✨
        if (!response.ok) {
            // Intentamos leer el error del backend, si no, usamos el statusText
            let errorMsg = response.statusText;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                // No pudimos leer el JSON, nos quedamos con el statusText
            }
            // Lanzamos un error más detallado
            throw new Error(`Error ${response.status}: ${errorMsg}`);
        }

        // Si la respuesta es OK pero no tiene contenido (ej: DELETE exitoso)
        if (response.status === 204) {
            return null; 
        }

        // Si todo está bien, devolvemos el JSON
        return response.json();

    } catch (error) {
        console.error(`Error en sendData (${method} ${url}):`, error); // Logueamos el error detallado
        throw error; // Volvemos a lanzar el error para que el catch original lo maneje
    }
}