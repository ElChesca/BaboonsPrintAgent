// app > static > js > modules > auth.js
import { fetchData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';
import { mostrarNotificacion } from './notifications.js';

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
        const decoded = jwt_decode(token);

        // ✨ VALIDACIÓN DE EXPIRACIÓN (Seguridad Proactiva)
        const now = Date.now() / 1000;
        if (decoded.exp && decoded.exp < now) {
            console.warn("Token de sesión expirado.");
            logout();
            return null;
        }

        return decoded;
    } catch (e) {
        console.error("Error al decodificar el token:", e);
        logout();
        return null;
    }
}

let inactivityTimeout;
const DEFAULT_INACTIVITY_TIME = 20 * 60 * 1000; // 20 minutos (Equilibrado)

export function setupInactivityTimer() {
    // Si no hay token, no hay timer
    if (!localStorage.getItem('jwt_token')) return;

    const resetTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            console.warn("Cierre de sesión automático por inactividad.");
            logout("Sesión cerrada por inactividad.");
        }, DEFAULT_INACTIVITY_TIME);
    };

    // Escuchadores de eventos para detectar actividad
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(name => {
        window.addEventListener(name, resetTimer, { passive: true });
    });

    // Primer disparo
    resetTimer();

    // Guardar referencia para poder limpiar si fuera necesario
    window._authInactivityCleanup = () => {
        events.forEach(name => window.removeEventListener(name, resetTimer));
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
    };
}

export function logout(mensaje = null) {
    if (mensaje) mostrarNotificacion(mensaje, "warning");

    // 1. Borrar Token y datos de sesión
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('negocioActivoTipo');
    localStorage.removeItem('negocioActivoId');

    // 2. Limpiar el estado global en memoria (Importante para SPA)
    if (window.appState) {
        window.appState.userRol = null;
        window.appState.negocioActivoId = null;
        window.appState.negocioActivoTipo = null;
        window.appState.negociosCache = [];
    }

    // 3. Limpiar Timers de inactividad
    if (window._authInactivityCleanup) {
        window._authInactivityCleanup();
    }
    if (inactivityTimeout) clearTimeout(inactivityTimeout);

    // 4. Forzar cambio de URL a Login (Esto dispara el 'hashchange'/'popstate' en main.js)
    window.location.hash = '#login';

    // 5. Notificar a la app que el estado de auth cambió (para limpiar header, etc.)
    window.dispatchEvent(new Event('authChange'));

    // 5. Opcional: Recarga FUERTE solo si algo falla, pero idealmente no la necesitamos.
    // La comentamos para que sea una transición suave de SPA.
    // window.location.reload(); 
}


export function inicializarLogicaLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const errorMessageDiv = document.getElementById('login-error-message');
    
    // --- 1. Lógica Toggle Password (UI) ---
    const toggleBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    if (!errorMessageDiv) {
        console.warn("No se encontró el div 'login-error-message'. Los errores se mostrarán por consola.");
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
            if (data.negocio_tipo) localStorage.setItem('negocioActivoTipo', data.negocio_tipo);
            if (data.negocio_id) localStorage.setItem('negocioActivoId', String(data.negocio_id));

            // 2. Actualizamos la memoria RAM inmediatamente
            if (window.appState) {
                window.appState.negocioActivoTipo = data.negocio_tipo;
                window.appState.negocioActivoId = data.negocio_id;
            }

            // ✨ MANEJO DE REDIRECCIÓN EXTERNA (Para seller.html y otros)
            // Intentamos leer de query params normales (?returnUrl=...)
            let returnUrl = new URLSearchParams(window.location.search).get('returnUrl');

            // Si no está, intentamos leer del Hash (#login?returnUrl=...)
            if (!returnUrl && window.location.hash.includes('?')) {
                const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
                returnUrl = hashParams.get('returnUrl');
            }

            if (returnUrl) {
                console.log("Redirigiendo a:", returnUrl);
                window.location.href = returnUrl;
                return; // Detenemos aquí
            }

            window.dispatchEvent(new Event('authChange'));

        } catch (error) {
            console.error("Login error:", error);
            errorMessageDiv.textContent = error.message || 'Error de conexión o credenciales inválidas.';
            errorMessageDiv.style.display = 'block';
            hideGlobalLoader();
        }
    });
}