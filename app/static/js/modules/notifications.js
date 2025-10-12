// app/static/js/modules/notifications.js

export function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    // ✨ LA CORRECCIÓN CLAVE: Buscamos el contenedor DENTRO de la función.
    // Esto garantiza que el DOM siempre estará listo cuando se necesite.
    const container = document.getElementById('notification-container');

    // Si, por alguna razón, el contenedor no existe, no rompemos la aplicación.
    // Mostramos un error en la consola y un alert como último recurso.
    if (!container) {
        console.error("Error de notificación: No se encontró el elemento #notification-container en el DOM.");
        alert(`${tipo.toUpperCase()}: ${mensaje}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.textContent = mensaje;
    
    // Ahora 'container' nunca será null, por lo que appendChild funcionará.
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.5s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, duracion);
}