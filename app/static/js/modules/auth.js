import { mostrarNotificacion } from './notifications.js';
const jwt_decode = window.jwt_decode;

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-access-token'] = token;
    return headers;
}

export function getCurrentUser() {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;
    try {
        if (typeof jwt_decode === 'function') return jwt_decode(token);
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
        const nombreUsuario = document.getElementById('login-nombre')?.value;
        const passwordUsuario = document.getElementById('login-password')?.value;
        if (!nombreUsuario || !passwordUsuario) {
            return mostrarNotificacion('Por favor, complete ambos campos.', 'error');
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
                mostrarNotificacion(data.message || 'Error', 'error');
            }
        } catch (error) {
            mostrarNotificacion('Error de conexión.', 'error');
        }
    });
}