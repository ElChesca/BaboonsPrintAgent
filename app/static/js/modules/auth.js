// app/static/js/modules/auth.js
import { fetchData } from '../api.js';

const jwt_decode = window.jwt_decode;

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export function getCurrentUser() {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        return null;
    }
    try {
        if (typeof jwt_decode === 'function') {
            return jwt_decode(token); 
        } else {
            console.error("La librería jwt-decode no está cargada correctamente.");
            logout();
            return null;
        }
    } catch (e) {
        console.error("Error al decodificar el token:", e);
        logout();
        return null;
    }
}

export function logout() {
    localStorage.removeItem('jwt_token');
    window.dispatchEvent(new Event('authChange'));
}

export function inicializarLogicaLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const errorMessageDiv = document.getElementById('login-error-message');

        if (!email || !password) {
            errorMessageDiv.textContent = 'Por favor, complete ambos campos.';
            errorMessageDiv.style.display = 'block';
            return;
        }
        
        // ✨ LA CORRECCIÓN ESTÁ AQUÍ:
        // El backend espera la clave 'nombre', aunque el contenido sea un email.
        const payload = { nombre: email, password: password };

        try {
            const data = await fetchData('/api/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            localStorage.setItem('jwt_token', data.token);
            window.dispatchEvent(new Event('authChange'));

        } catch (error) {
            errorMessageDiv.textContent = error.message || 'Error de conexión.';
            errorMessageDiv.style.display = 'block';
        }
    });
}