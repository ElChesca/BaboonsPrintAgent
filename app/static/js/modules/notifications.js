// app/static/js/modules/notifications.js

// 1. INYECCIÓN AUTOMÁTICA DE ESTILOS (Para evitar Errores 404 de CSS)
const style = document.createElement('style');
style.innerHTML = `
    #notification-container {
        position: fixed;
        top: 90px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    }

    .notif-toast {
        background: white;
        min-width: 300px;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'Segoe UI', sans-serif;
        font-weight: 600;
        font-size: 0.95rem;
        border-left: 6px solid #333;
        pointer-events: auto;
        cursor: pointer;
        animation: slideInRight 0.3s ease-out forwards;
    }

    .notif-toast.success { border-left-color: #2ecc71; color: #212529; }
    .notif-toast.error { border-left-color: #e74c3c; color: #c0392b; }
    .notif-toast.warning { border-left-color: #f1c40f; color: #d35400; }

    .notif-toast i { font-size: 1.2rem; }
    .notif-toast.success i { color: #2ecc71; }
    .notif-toast.error i { color: #e74c3c; }
    .notif-toast.warning i { color: #f1c40f; }

    @keyframes slideInRight {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        to { transform: translateX(120%); opacity: 0; }
    }
`;
document.head.appendChild(style);


// 2. FUNCIÓN EXPORTABLE
export function mostrarNotificacion(mensaje, tipo = 'info') {
    // Buscar o Crear el Contenedor (Si no existe en el HTML)
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const iconoClass = iconos[tipo] || iconos.info;

    const toast = document.createElement('div');
    toast.className = `notif-toast ${tipo}`;
    toast.innerHTML = `<i class="fas ${iconoClass}"></i> <span>${mensaje}</span>`;

    container.appendChild(toast);

    const removeToast = () => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        toast.addEventListener('animationend', () => toast.remove());
    };

    setTimeout(removeToast, 4000);
    toast.onclick = removeToast;
}