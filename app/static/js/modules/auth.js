// app/static/js/modules/auth.js
import { fetchData } from '../api.js';

// La librería jwt-decode se carga globalmente desde index.html.
const jwt_decode = window.jwt_decode;

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    // ✨ CORRECCIÓN: Unificamos el formato del token para que coincida con el backend.
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
    // ✨ CORRECCIÓN: Usamos el ID correcto del formulario que está en tu login.html.
    const form = document.getElementById('login-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // ✨ CORRECCIÓN: Usamos los IDs correctos de los campos de entrada.
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const errorMessageDiv = document.getElementById('login-error-message');

        if (!email || !password) {
            errorMessageDiv.textContent = 'Por favor, complete ambos campos.';
            errorMessageDiv.style.display = 'block';
            return;
        }
        
        // El payload que espera el backend es 'email', no 'nombre'.
        const payload = { email: email, password: password };

        try {
            // Usamos nuestra función fetchData para consistencia
            const data = await fetchData('/api/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Si llegamos aquí, la respuesta fue exitosa (fetchData maneja los errores)
            localStorage.setItem('jwt_token', data.token);
            window.dispatchEvent(new Event('authChange')); // ¡Tocamos el timbre!

        } catch (error) {
            // fetchData ya nos da el mensaje de error del servidor
            errorMessageDiv.textContent = error.message || 'Error de conexión.';
            errorMessageDiv.style.display = 'block';
        }
    });
}