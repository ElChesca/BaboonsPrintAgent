import { fetchData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';

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
    
    // ✨ 1. Declara 'errorMessageDiv' aquí arriba, una sola vez.
    const errorMessageDiv = document.getElementById('login-error-message');
    if (!errorMessageDiv) {
        console.error("Error crítico: No se encontró el div 'login-error-message'");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();        
        // ✨ 2. MOSTRAR LOADER AL ENVIAR
        showGlobalLoader(); 
        errorMessageDiv.textContent = ''; // <-- Ahora esto funciona perfectamente
        errorMessageDiv.style.display = 'none'; // <-- Ocultarlo también

        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        

        if (!email || !password) {
            errorMessageDiv.textContent = 'Por favor, complete ambos campos.';
            errorMessageDiv.style.display = 'block';
            hideGlobalLoader(); // <-- No olvides ocultar el loader si hay error
            return;
        }
        
        const payload = { nombre: email, password: password };

        try {
            const data = await fetchData('/api/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            localStorage.setItem('jwt_token', data.token);
            
            window.dispatchEvent(new Event('authChange'));

            const homeLink = document.querySelector('a[onclick*="home.html"]');
            window.loadContent(null, 'static/home.html', homeLink);

        } catch (error) {
            errorMessageDiv.textContent = error.message || 'Error de conexión.';
            errorMessageDiv.style.display = 'block';
            hideGlobalLoader(); // <-- Ocultar el loader si la API falla
        }
    });
}