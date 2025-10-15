// ✨ LA RUTA CLAVE: Desde /modules/, busca 'api.js' subiendo un nivel ('../')
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
    if (!token) return null;
    try {
        return jwt_decode(token); 
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

// ... (al principio de auth.js, los imports y otras funciones no cambian)

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
        
        const payload = { nombre: email, password: password };

        try {
            const data = await fetchData('/api/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            localStorage.setItem('jwt_token', data.token);
            
            // 1. "Toca el timbre" para que main.js actualice la UI (menú, etc.)
            window.dispatchEvent(new Event('authChange'));

            // ✨ 2. LA CORRECCIÓN CLAVE: El login ahora se encarga de la redirección.
            // Buscamos el enlace del home para pasarlo a loadContent y que lo marque como activo.
            const homeLink = document.querySelector('a[onclick*="home.html"]');
            window.loadContent(null, 'static/home.html', homeLink);

        } catch (error) {
            errorMessageDiv.textContent = error.message || 'Error de conexión.';
            errorMessageDiv.style.display = 'block';
        }
    });
}