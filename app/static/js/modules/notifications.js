// app/static/js/modules/notifications.js
const container = document.getElementById('notification-container');

export function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.5s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, duracion);
}