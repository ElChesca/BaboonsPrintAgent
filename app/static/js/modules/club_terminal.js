import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let html5QrCode = null;
let nombreClienteActual = "Cliente"; // Variable para guardar el nombre temporalmente

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
    
    // --- 1. PREPARAR EL CONTENEDOR DE RESULTADO (WHATSAPP) ---
    // Lo creamos dinámicamente si no existe, igual que la tarjeta azul
    let divResultadoCarga = document.getElementById('resultado-carga-container');
    
    if (!divResultadoCarga) {
        divResultadoCarga = document.createElement('div');
        divResultadoCarga.id = 'resultado-carga-container';
        divResultadoCarga.className = 'd-none text-center py-4';
        // Lo insertamos después del formulario
        formCarga.parentNode.insertBefore(divResultadoCarga, formCarga.nextSibling);
    }

    // --- 2. RECUPERACIÓN INTELIGENTE DE LA TARJETA AZUL ---
    let divInfoCliente = document.getElementById('info-cliente-scan');
    if (!divInfoCliente && inputCliente) {
        divInfoCliente = document.createElement('div');
        divInfoCliente.id = 'info-cliente-scan';
        divInfoCliente.className = 'd-none'; 
        const contenedorInput = inputCliente.closest('.input-group') || inputCliente.parentNode;
        contenedorInput.parentNode.insertBefore(divInfoCliente, contenedorInput.nextSibling);
    }
    
    // --- LIMPIEZA INICIAL ---
    const resetearInterfaz = () => {
        inputCliente.value = "";
        inputCantidad.value = "";
        divInfoCliente.classList.add('d-none');
        divInfoCliente.innerHTML = "";
        
        // Mostrar Formulario, Ocultar Resultado
        formCarga.style.display = 'block';
        divResultadoCarga.classList.add('d-none');
        divResultadoCarga.innerHTML = ""; // Limpiar botones viejos
        nombreClienteActual = "Cliente";
        
        if(btnStart) btnStart.style.display = 'inline-block';
    };

    resetearInterfaz(); // Ejecutar al inicio
    
    // --- 3. FUNCIÓN: VERIFICAR CLIENTE ---
    async function verificarCliente(tokenQr) {
        divInfoCliente.className = 'alert alert-light mt-3 shadow-sm border text-center';
        divInfoCliente.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i> Buscando cliente...';
        divInfoCliente.classList.remove('d-none');

        try {
            // --- 1. FUERZA BRUTA PARA EL ID ---
            // Intentamos obtener el ID de todas las formas posibles
            let nid = appState.negocioActivoId;
            
            // Si appState falla, miramos la URL (?id=5)
            if (!nid || nid === 'undefined') {
                const params = new URLSearchParams(window.location.search);
                nid = params.get('id');
            }
            
            // Si todo falla, asumimos el ID 5 (La Kosleña) para salvar las papas ahora
            if (!nid) nid = 5; 

            console.log(`📡 TEST V5 - Enviando ID: ${nid} | QR: ${tokenQr}`);

            const data = await fetchData(`/api/club/admin/cliente-info/${tokenQr}?negocio_id=${nid}`);
            
            if (data.encontrado) {
                // ... (Lógica de éxito igual que antes) ...
                nombreClienteActual = data.nombre.split(' ')[0];
                
                // Nivel con fallback seguro
                const nivel = data.nivel || { nombre: 'Miembro', color: '#0d6efd', icono: 'fa-user' };

                divInfoCliente.className = 'alert mt-3 shadow-sm border-0 fade show';
                divInfoCliente.style.backgroundColor = `${nivel.color}15`; 
                divInfoCliente.style.borderLeft = `5px solid ${nivel.color}`;
                
                divInfoCliente.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="text-white rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" 
                             style="width: 50px; height: 50px; min-width: 50px; background-color: ${nivel.color};">
                            <i class="fas ${nivel.icono} fa-lg"></i>
                        </div>
                        <div class="flex-grow-1 text-start">
                            <h6 class="fw-bold text-dark mb-0 text-uppercase">${data.nombre}</h6>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <div class="small fw-bold" style="color: ${nivel.color}">${nivel.nombre}</div>
                                <div class="small text-muted fw-bold">Saldo: <span class="fs-6 text-dark">${data.puntos}</span></div>
                            </div>
                        </div>
                    </div>
                `;
                mostrarNotificacion(`Hola ${nombreClienteActual}`, 'success');
                inputCantidad.focus(); 
            } else {
                throw new Error('Cliente no existe en BD');
            }

        } catch (error) {
            console.error(error);
            divInfoCliente.classList.add('d-none');
            inputCliente.value = "";
            
            // 👇👇👇 EL MENSAJE NUEVO PARA DETECTAR SI ACTUALIZÓ 👇👇👇
            mostrarNotificacion(`😡 ERROR DE TEST (V5): ${error.message}`, 'error');
        }
    }

    // --- 4. CÁMARA ---
    async function iniciarCamara() {
        if (typeof window.Html5Qrcode === 'undefined') {
            mostrarNotificacion('Librería de cámara no detectada', 'error');
            return;
        }

        resetearInterfaz(); // Limpiar todo antes de empezar

        cameraContainer.style.display = 'block';
        if(btnStart) btnStart.style.display = 'none';

        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader"); 
        }

        try {
            const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
            await html5QrCode.start({ facingMode: "environment" }, config, 
                (decodedText) => {
                    const audio = document.getElementById('scan-sound');
                    if(audio) audio.play().catch(e => {});
                    
                    inputCliente.value = decodedText;
                    detenerCamara();
                    verificarCliente(decodedText);
                },
                (err) => {} 
            );
        } catch (err) {
            mostrarNotificacion('Error al iniciar cámara.', 'error');
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

    // --- 5. SUBMIT Y PANTALLA WHATSAPP ---
    formCarga.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!inputCliente.value) {
            mostrarNotificacion('Debe escanear un QR primero', 'warning');
            return;
        }

        const txtOriginal = btnConfirmar.innerHTML;
        btnConfirmar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cargando...';
        btnConfirmar.disabled = true;

        const cantidadPuntos = inputCantidad.value; // Guardar valor antes de reset

        try {
            const res = await fetchData('/api/club/admin/cargar-puntos', {
                method: 'POST',
                body: JSON.stringify({
                    cliente_identificador: inputCliente.value,
                    cantidad: cantidadPuntos,
                    motivo: "Carga Terminal Móvil",
                    negocio_id: appState.negocioActivoId 
                })
            });

            // --- ÉXITO: CAMBIO DE PANTALLA A MODO "WHATSAPP" ---
            
            mostrarNotificacion(`✅ Carga Exitosa!`, 'success');
            
            // 1. Ocultar formulario para que no carguen doble sin querer
            formCarga.style.display = 'none';
            if(btnStart) btnStart.style.display = 'none'; // Ocultar boton scan

            // 2. Preparar Link de WhatsApp
            // Usamos window.location.origin para que el link sea dinámico (localhost o dominio real)
           const linkApp = `${window.location.origin}/app-club?id=${appState.negocioActivoId}`;
            
            // El mensaje usa el nuevo link
            const mensaje = `Hola ${nombreClienteActual}! Sumaste *${cantidadPuntos} Puntos* 💎. Tu saldo actual es: *${res.nuevo_saldo}*. Mirá tus premios acá: ${linkApp}`;
            const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            // 3. Inyectar HTML de éxito
            divResultadoCarga.innerHTML = `
                <div class="mb-4">
                    <div class="display-1 text-success mb-2"><i class="fa fa-check-circle"></i></div>
                    <h2 class="fw-bold">¡Carga Exitosa!</h2>
                    <p class="text-muted">Se acreditaron ${cantidadPuntos} puntos 💎.</p>
                </div>

                <div class="d-grid gap-3">
                    <a href="${linkWhatsapp}" target="_blank" class="btn btn-success btn-lg py-3 rounded-pill shadow fw-bold">
                        <i class="fab fa-whatsapp fa-lg me-2"></i> Enviar Comprobante
                    </a>
                    
                    <button id="btn-nueva-carga" class="btn btn-outline-dark py-3 rounded-pill fw-bold">
                        <i class="fa fa-qrcode me-2"></i> Nueva Carga
                    </button>
                </div>
            `;
            
            divResultadoCarga.classList.remove('d-none');
            
            // 4. Activar botón "Nueva Carga"
            document.getElementById('btn-nueva-carga').onclick = () => {
                resetearInterfaz();
                iniciarCamara(); // Volvemos directo a la cámara para agilizar
            };

        } catch (error) {
            mostrarNotificacion(error.message || 'Error al cargar puntos', 'error');
        } finally {
            btnConfirmar.innerHTML = txtOriginal;
            btnConfirmar.disabled = false;
        }
    });
}