import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let html5QrCode = null;

export function inicializarTerminal() {
    const formCarga = document.getElementById('form-carga-puntos');
    if (!formCarga) return; 

    // Referencias DOM
    const btnStart = document.getElementById('btn-start-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const cameraContainer = document.getElementById('camera-container');
    const inputCliente = document.getElementById('cliente_identificador');
    const inputCantidad = document.getElementById('cantidad');
    const btnConfirmar = document.getElementById('btn-confirmar');
    
    // --- 1. RECUPERACIÓN INTELIGENTE DE LA TARJETA AZUL ---
    let divInfoCliente = document.getElementById('info-cliente-scan');
    
    // Si no existe en el HTML, LA CREAMOS NOSOTROS AHORA MISMO
    if (!divInfoCliente && inputCliente) {
        divInfoCliente = document.createElement('div');
        divInfoCliente.id = 'info-cliente-scan';
        divInfoCliente.className = 'd-none'; // Oculto por defecto
        
        // La insertamos justo después del grupo del input del cliente
        const contenedorInput = inputCliente.closest('.input-group') || inputCliente.parentNode;
        contenedorInput.parentNode.insertBefore(divInfoCliente, contenedorInput.nextSibling);
    }
    
    // --- LIMPIEZA INICIAL ---
    inputCliente.value = "";
    inputCantidad.value = "";
    divInfoCliente.classList.add('d-none');
    divInfoCliente.innerHTML = "";
    
    // --- 2. FUNCIÓN: VERIFICAR CLIENTE ---
    async function verificarCliente(tokenQr) {
        // Estado "Cargando..."
        divInfoCliente.className = 'alert alert-light mt-3 shadow-sm border text-center';
        divInfoCliente.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i> Buscando cliente...';
        divInfoCliente.classList.remove('d-none');

        try {
            const data = await fetchData(`/api/club/admin/cliente-info/${tokenQr}?negocio_id=${appState.negocioActivoId}`);
            
            if (data.encontrado) {
                // ¡AQUÍ ESTÁ LA TARJETA AZUL BONITA! 💎
                divInfoCliente.className = 'alert alert-primary mt-3 shadow-sm border-0 bg-primary bg-opacity-10 fade show';
                divInfoCliente.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 45px; height: 45px; min-width: 45px;">
                            <i class="fas fa-user fa-lg"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="fw-bold text-dark mb-0 text-uppercase">${data.nombre}</h6>
                            <div class="small text-primary fw-bold">
                                Saldo: <span class="fs-6">${data.puntos}</span> pts
                            </div>
                        </div>
                        <i class="fas fa-check-circle fs-2 text-success"></i>
                    </div>
                `;
                
                mostrarNotificacion(`Hola ${data.nombre}`, 'success');
                inputCantidad.focus(); // Foco automático para escribir rápido
            } else {
                throw new Error('Cliente no encontrado');
            }
        } catch (error) {
            console.error(error);
            divInfoCliente.classList.add('d-none');
            inputCliente.value = ""; // Limpiamos si falló
            mostrarNotificacion('QR no reconocido o de otro negocio', 'error');
        }
    }

    // --- 3. CÁMARA ---
    async function iniciarCamara() {
        if (typeof window.Html5Qrcode === 'undefined') {
            mostrarNotificacion('Librería de cámara no detectada', 'error');
            return;
        }

        // Limpieza UI
        divInfoCliente.classList.add('d-none');
        inputCliente.value = "";
        formCarga.reset();

        cameraContainer.style.display = 'block';
        if(btnStart) btnStart.style.display = 'none';

        if (!html5QrCode) {
            // Usa "reader" porque ese es el ID en la Terminal
            html5QrCode = new Html5Qrcode("reader"); 
        }

        try {
            const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
            await html5QrCode.start({ facingMode: "environment" }, config, 
                (decodedText) => {
                    // Sonido beep
                    const audio = document.getElementById('scan-sound');
                    if(audio) audio.play().catch(e => {});
                    
                    inputCliente.value = decodedText;
                    detenerCamara();
                    verificarCliente(decodedText);
                },
                (err) => {} 
            );
        } catch (err) {
            mostrarNotificacion('Error al iniciar cámara. Revise permisos.', 'error');
            detenerCamara();
        }
    }

    async function detenerCamara() {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop().catch(console.warn);
        }
        cameraContainer.style.display = 'none';
        if(btnStart) btnStart.style.display = 'inline-block';
    }

    if(btnStart) btnStart.onclick = iniciarCamara;
    if(btnStop) btnStop.onclick = detenerCamara;

    // --- 4. SUBMIT DEL FORMULARIO ---
    formCarga.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!inputCliente.value) {
            mostrarNotificacion('Debe escanear un QR primero', 'warning');
            return;
        }

        const txtOriginal = btnConfirmar.innerHTML;
        btnConfirmar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cargando...';
        btnConfirmar.disabled = true;

        try {
            const res = await fetchData('/api/club/admin/cargar-puntos', {
                method: 'POST',
                body: JSON.stringify({
                    cliente_identificador: inputCliente.value,
                    cantidad: inputCantidad.value,
                    motivo: "Carga Terminal Móvil",
                    negocio_id: appState.negocioActivoId 
                })
            });

            mostrarNotificacion(`✅ Carga Exitosa! Nuevo saldo: ${res.nuevo_saldo}`, 'success');
            
            // Reset Total
            formCarga.reset();
            divInfoCliente.classList.add('d-none'); // Ocultamos la tarjeta
            inputCliente.value = "";

        } catch (error) {
            mostrarNotificacion(error.message || 'Error al cargar puntos', 'error');
        } finally {
            btnConfirmar.innerHTML = txtOriginal;
            btnConfirmar.disabled = false;
        }
    });
}