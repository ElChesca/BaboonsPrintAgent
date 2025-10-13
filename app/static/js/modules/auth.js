import { getAuthHeaders } from './modules/auth.js';

/**
 * Función centralizada para realizar todas las llamadas a la API.
 * Automáticamente adjunta los headers de autenticación.
 * Maneja errores de red y del servidor de forma robusta.
 * @param {string} url - La URL del endpoint de la API.
 * @param {object} options - Opciones para la llamada fetch (method, body, etc.).
 * @returns {Promise<any>} - La respuesta JSON del servidor.
 * @throws {Error} - Lanza un error con el mensaje del servidor si la petición falla.
 */
export async function fetchData(url, options = {}) {
    // 1. Obtenemos los headers de autenticación (que ya incluyen el 'Content-Type').
    const authHeaders = getAuthHeaders();

    // 2. Fusionamos los headers de autenticación con cualquier otro que venga en las opciones.
    const config = {
        ...options,
        headers: {
            ...authHeaders,
            ...options.headers,
        }
    };

    try {
        const response = await fetch(url, config);

        // 3. Si la respuesta NO es exitosa (ej: 401, 404, 500), procesamos el error.
        if (!response.ok) {
            let errorMessage = `Error ${response.status}: ${response.statusText}`;
            try {
                // Intentamos leer el mensaje de error que envía el servidor.
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // Si el servidor no envió un JSON (ej: un 502), nos quedamos con el error genérico.
            }
            throw new Error(errorMessage);
        }

        // 4. Si la respuesta es exitosa y no tiene contenido (ej: un 204 No Content), devolvemos un objeto vacío.
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return {};
        }

    } catch (error) {
        // Si hay un error de red (ej: no hay conexión), lo relanzamos para que sea capturado.
        console.error(`Error en fetchData para ${url}:`, error);
        throw error;
    }
}