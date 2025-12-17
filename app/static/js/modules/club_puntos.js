import { fetchData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';
import { mostrarNotificacion } from './notifications.js';
import { inicializarTerminal } from './club_terminal.js';


let html5QrcodeScanner = null;

async function cargarLibreriaQR() {
    if (window.Html5Qrcode) return; // Ya cargada
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}


export function inicializarRegistroClub() {
    // 1. GUARDIA DE SEGURIDAD (Estilo Caja)
    const formRegistro = document.getElementById('form-registro-cliente');
    if (!formRegistro) {
        return; // No estamos en la vista correcta
    }

    const modalQr = document.getElementById('modal-qr-generado');
    const qrContainer = document.getElementById('qr-display-container');
    const closeBtn = modalQr.querySelector('.close-button');
    const btnCerrarAbajo = document.getElementById('btn-cerrar-modal-qr');

    // 2. MANEJO DEL SUBMIT
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validamos que haya un negocio seleccionado (Critico para el backend)
        if (!appState.negocioActivoId) {
            mostrarNotificacion('Error: No hay un negocio activo seleccionado.', 'error');
            return;
        }

        const formData = {
            dni: document.getElementById('reg-dni').value,
            nombre: document.getElementById('reg-nombre').value,
            password: document.getElementById('reg-password').value,
            negocio_id: appState.negocioActivoId, // ✨ CRÍTICO: Usamos el estado global
            email: document.getElementById('reg-email').value,
            telefono: document.getElementById('reg-telefono').value,
            fecha_nacimiento: document.getElementById('reg-fecha-nac').value,
            genero: document.getElementById('reg-genero').value
        };

        try {
            // Asumo que registraste el blueprint con prefix '/club' o similar. 
            // Ajusta la URL si tu blueprint tiene otro prefijo en __init__.py
            const response = await fetchData('/club/register', { 
                method: 'POST', 
                body: JSON.stringify(formData) 
            });

            mostrarNotificacion('Cliente registrado exitosamente.', 'success');
            formRegistro.reset();

            // 3. MOSTRAR EL QR GENERADO (Extra UX)
            if (response.token_qr && modalQr) {
                mostrarModalQR(response.token_qr, formData.nombre);
            }

        } catch (error) {
            mostrarNotificacion(error.message || 'Error al registrar cliente', 'error');
        }
    });

    // Helper para el Modal (similar a tu lógica de resumen de caja)
    function mostrarModalQR(token, nombreCliente) {
        qrContainer.innerHTML = ""; // Limpiar anterior
        document.getElementById('qr-info-cliente').textContent = nombreCliente;
        
        // Generar QR usando la librería (asumiendo que window.QRCode existe)
        new QRCode(qrContainer, {
            text: token,
            width: 200,
            height: 200
        });

        modalQr.style.display = 'flex';
    }

    // Cerrar Modal
    if (closeBtn) closeBtn.onclick = () => modalQr.style.display = 'none';
    if (btnCerrarAbajo) btnCerrarAbajo.onclick = () => modalQr.style.display = 'none';
    
    window.onclick = (event) => {
        if (event.target == modalQr) {
            modalQr.style.display = 'none';
        }
    }
}

// 2. Definimos y exportamos la función MAESTRA que main.js está buscando
export function inicializarLogicaClubPuntos() {
    console.log("💎 Inicializando Módulo Club de Puntos...");

    // Intentamos iniciar la Terminal (dentro tiene sus propios chequeos de seguridad)
    inicializarTerminal();

    // Intentamos iniciar el Registro (si existe esa función)
    // if (typeof inicializarRegistroClub === 'function') {
    //    inicializarRegistroClub();
    // }
}