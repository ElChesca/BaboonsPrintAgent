import { getAuthHeaders } from './auth.js';

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
    // ✨ 1. Obtenemos los headers de autenticación (el token).
    const authHeaders = getAuthHeaders();

    // 2. Fusionamos los headers de autenticación con cualquier otro header que venga en las opciones.
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
                // Intentamos leer el mensaje de error que envía el servidor (ej: {"message": "Token no encontrado"})
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // Si el servidor no envió un JSON (ej: un 502), nos quedamos con el error genérico.
            }
            throw new Error(errorMessage);
        }

        // 4. Si la respuesta es exitosa, devolvemos el JSON.
        return response.json();

    } catch (error) {
        // Si hay un error de red (ej: no hay conexión), lo relanzamos para que sea capturado.
        throw error;
    }
}