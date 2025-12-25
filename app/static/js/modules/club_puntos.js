import { fetchData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';
import { mostrarNotificacion } from './notifications.js';
import { inicializarTerminal } from './club_terminal.js';

let html5QrcodeScanner = null;

async function cargarLibreriaQR() {
    if (window.Html5Qrcode) return; 
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// --- HELPER: MOSTRAR MODAL QR ---
function mostrarModalQR(token, nombreCliente, modalQr, qrContainer) {
    if (!qrContainer) return;
    qrContainer.innerHTML = ""; 
    
    const infoCliente = document.getElementById('qr-info-cliente');
    if (infoCliente) infoCliente.textContent = nombreCliente;
    
    // Generar QR (Requiere qrcode.js cargado en el HTML)
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
            text: token,
            width: 200,
            height: 200
        });
    }

    modalQr.style.display = 'flex';

    // Configurar cierres
    const closeBtn = modalQr.querySelector('.close-button');
    const btnCerrarAbajo = document.getElementById('btn-cerrar-modal-qr');

    const cerrarYLogin = () => {
        modalQr.style.display = 'none';
        if (typeof toggleAuth === 'function') toggleAuth('login');
    };

    if (closeBtn) closeBtn.onclick = cerrarYLogin;
    if (btnCerrarAbajo) btnCerrarAbajo.onclick = cerrarYLogin;
}

// --- INICIALIZADOR MAESTRO ---
export function inicializarLogicaClubPuntos() {
    console.log("💎 Módulo Club de Puntos Inicializado");
    inicializarTerminal();
    inicializarRegistroClub();
}