// app/static/js/modules/auth.js

// ✨ 1. AÑADIMOS LAS IMPORTACIONES QUE FALTABAN
import { mostrarNotificacion } from './notifications.js';
// La librería jwt-decode se carga desde el index.html, pero la declaramos para claridad.
const jwt_decode = window.jwt_decode;

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        // ✨ 2. USAMOS EL NOMBRE DE HEADER CORRECTO QUE ESPERA EL BACKEND
        headers['x-access-token'] = token;
    }
    return headers;
}

export function getCurrentUser() {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;
    try {
        // ✨ 3. Nos aseguramos de que jwt_decode esté disponible
        if (typeof jwt_decode === 'function') {
            return jwt_decode(token); 
        }
        return null;
    } catch (e) {
        logout();
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
        
        // ✨ Leemos desde los IDs correctos y definitivos ✨
        const nombreUsuario = document.getElementById('login-nombre').value;
        const passwordUsuario = document.getElementById('login-password').value;

        if (!nombreUsuario || !passwordUsuario) {
            mostrarNotificacion('Por favor, complete ambos campos.', 'error');
            return;
        }

        // Creamos el payload con la clave "nombre" que el backend espera
        const payload = {
            nombre: nombreUsuario,
            password: passwordUsuario
        };

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