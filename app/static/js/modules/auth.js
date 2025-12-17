// app > static > js > modules > auth.js
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
    // 1. Borrar Token y datos de sesión
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('tipo_negocio_activo');
    localStorage.removeItem('negocio_activo_id');
    localStorage.removeItem('negocioActivoId'); // Por si acaso quedó este también

    // 2. Limpiar el estado global en memoria (Importante para SPA)
    if (window.appState) {
        window.appState.userRol = null;
        window.appState.negocioActivoId = null;
        window.appState.negocioActivoTipo = null;
        window.appState.negociosCache = [];
    }

    // 3. Forzar cambio de URL a Login (Esto dispara el 'hashchange'/'popstate' en main.js)
    window.location.hash = '#login';

    // 4. Notificar a la app que el estado de auth cambió (para limpiar header, etc.)
    window.dispatchEvent(new Event('authChange'));
    
    // 5. Opcional: Recarga FUERTE solo si algo falla, pero idealmente no la necesitamos.
    // La comentamos para que sea una transición suave de SPA.
    // window.location.reload(); 
}


export function inicializarLogicaLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    
    // 1. Buscamos el div de error (seguridad para que no falle si falta el HTML)
    const errorMessageDiv = document.getElementById('login-error-message');
    if (!errorMessageDiv) {
        console.error("Error crítico: No se encontró el div 'login-error-message'");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 2. UI: Mostrar loader y limpiar errores previos
        showGlobalLoader(); 
        errorMessageDiv.textContent = ''; 
        errorMessageDiv.style.display = 'none'; 

        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;

        if (!email || !password) {
            errorMessageDiv.textContent = 'Por favor, complete ambos campos.';
            errorMessageDiv.style.display = 'block';
            hideGlobalLoader(); 
            return;
        }
        
        const payload = { nombre: email, password: password };

        try {
            const data = await fetchData('/api/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            localStorage.setItem('jwt_token', data.token);
    
            // ESTO ES VITAL: Guardar tipo e ID como strings
            if (data.negocio_tipo) localStorage.setItem('tipo_negocio_activo', data.negocio_tipo);
            if (data.negocio_id) localStorage.setItem('negocio_activo_id', data.negocio_id);

            // 2. Actualizamos la memoria RAM inmediatamente
            // (Asumimos que appState es global o importado)
            if (window.appState) {
                window.appState.negocioActivoTipo = data.negocio_tipo;
                window.appState.negocioActivoId = data.negocio_id;
            }

            window.dispatchEvent(new Event('authChange'));

            // --- CORRECCIÓN DEL ERROR "HOME NO EXISTE" ---
            // Decidimos qué home cargar según el tipo de negocio
            let paginaHome = 'static/home_retail.html'; // Default
            
            if (data.negocio_tipo === 'consorcio') {
                paginaHome = 'static/home_consorcio.html';
            } else if (data.negocio_tipo === 'retail') {
                paginaHome = 'static/home_retail.html';
            }

            // Buscamos el link activo para la UI
            const homeLink = document.querySelector(`a[onclick*="${paginaHome.replace('static/', '')}"]`) || document.querySelector('#link-home');

            // Redirigimos
            if (window.loadContent) {
                window.loadContent(null, paginaHome, homeLink);
            } else {
                window.location.reload(); // Fallback de seguridad
            }

            
        } catch (error) {
            console.error("Login error:", error);
            errorMessageDiv.textContent = error.message || 'Error de conexión o credenciales inválidas.';
            errorMessageDiv.style.display = 'block';
            hideGlobalLoader(); 
        }
    });
}