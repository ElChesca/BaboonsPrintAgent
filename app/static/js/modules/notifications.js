// app/static/js/modules/notifications.js

// 1. INYECCIÓN AUTOMÁTICA DE ESTILOS PREMIUM
const style = document.createElement('style');
style.innerHTML = `
    #notification-container {
        position: fixed;
        top: 25px;
        right: 25px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
        max-width: 380px;
        width: calc(100% - 50px);
    }

    .notif-toast {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 16px 20px;
        border-radius: 18px;
        box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 15px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-weight: 600;
        font-size: 0.9rem;
        border: 1px solid rgba(255, 255, 255, 0.5);
        pointer-events: auto;
        cursor: pointer;
        animation: baboons-toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        position: relative;
        overflow: hidden;
    }

    .notif-toast::before {
        content: '';
        position: absolute;
        bottom: 0; left: 0;
        height: 3px;
        width: 100%;
        background: currentColor;
        opacity: 0.3;
        transform: scaleX(1);
        transform-origin: left;
        animation: baboons-toast-progress 4s linear forwards;
    }

    .notif-toast.success { color: #059669; }
    .notif-toast.error { color: #dc2626; }
    .notif-toast.warning { color: #d97706; }
    .notif-toast.info { color: #2563eb; }

    .notif-toast .notif-icon {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
    }

    .notif-toast.success .notif-icon { background: rgba(16, 185, 129, 0.1); }
    .notif-toast.error .notif-icon { background: rgba(239, 68, 68, 0.1); }
    .notif-toast.warning .notif-icon { background: rgba(245, 158, 11, 0.1); }
    .notif-toast.info .notif-icon { background: rgba(59, 130, 246, 0.1); }

    @keyframes baboons-toast-in {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes baboons-toast-out {
        to { transform: translateX(100px); opacity: 0; }
    }
    @keyframes baboons-toast-progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
    }
`;
document.head.appendChild(style);


// 2. FUNCIÓN EXPORTABLE
export function mostrarNotificacion(mensaje, tipo = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    const iconoClass = iconos[tipo] || iconos.info;

    const toast = document.createElement('div');
    toast.className = `notif-toast ${tipo}`;
    toast.innerHTML = `
        <div class="notif-icon"><i class="fas ${iconoClass}"></i></div>
        <div style="flex-grow: 1;">${mensaje}</div>
    `;

    container.appendChild(toast);

    const removeToast = () => {
        toast.style.animation = 'baboons-toast-out 0.3s ease-in forwards';
        toast.addEventListener('animationend', () => toast.remove());
    };

    setTimeout(removeToast, 4000);
    toast.onclick = removeToast;
}