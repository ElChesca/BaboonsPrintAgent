// app/static/js/modules/auth.js
import { mostrarNotificacion } from './notifications.js';

// La librería jwt-decode se carga globalmente desde index.html, la hacemos accesible.
const jwt_decode = window.jwt_decode;

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['x-access-token'] = token;
    }
    return headers;
}

export function getCurrentUser() {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        return null;
    }
    try {
        // Aseguramos que la función jwt_decode exista antes de llamarla
        if (typeof jwt_decode === 'function') {
            return jwt_decode(token); 
        } else {
            console.error("La librería jwt-decode no está cargada correctamente.");
            logout(); // Forzamos logout si la librería no está
            return null;
        }
    } catch (e) {
        console.error("Error al decodificar el token:", e);
        logout(); // Forzamos logout si el token es inválido
        return null;
    }
}

export function logout() {
    localStorage.removeItem('jwt_token');
    window.dispatchEvent(new Event('authChange'));
}

export function inicializarLogicaLogin() {
    const form = document.getElementById('form-login');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombreUsuario = document.getElementById('login-nombre')?.value;
        const passwordUsuario = document.getElementById('login-password')?.value;

        if (!nombreUsuario || !passwordUsuario) {
            mostrarNotificacion('Por favor, complete ambos campos.', 'error');
            return;
        }
        const payload = { nombre: nombreUsuario, password: passwordUsuario };

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('jwt_token', data.token);
                window.dispatchEvent(new Event('authChange'));
            } else {
                mostrarNotificacion(data.message || 'Error de autenticación', 'error');
            }
        } catch (error) {
            mostrarNotificacion('Error de conexión con el servidor.', 'error');
        }
    });
}
