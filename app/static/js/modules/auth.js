// app/static/js/modules/auth.js

// NO importamos nada desde main.js para evitar el ciclo

export function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export function getCurrentUser() {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;
    try {
        return jwt_decode(token); 
    } catch (e) {
        // Si el token es inválido, forzamos el logout
        logout();
        return null;
    }
}

export function logout() {
    localStorage.removeItem('jwt_token');
    // Anunciamos globalmente que el estado de autenticación ha cambiado
    window.dispatchEvent(new Event('authChange'));
}

export function inicializarLogicaLogin() {
    const form = document.getElementById('form-login');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: form.email.value, password: form.password.value })
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('jwt_token', data.token);
            // Anunciamos globalmente que el estado de autenticación ha cambiado
            window.dispatchEvent(new Event('authChange'));
        } else {
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = 'Error: Usuario o contraseña incorrectos.';
            errorDiv.style.display = 'block';
        }
    });
}