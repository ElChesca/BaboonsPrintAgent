// app/static/js/modules/verificador.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// --- Estado del Módulo ---
let itemsEscaneados = [];
let listasDePrecioDisponibles = new Map();
let html5QrCode; // Guardaremos la instancia de la clase base
let isScannerActive = false; // Flag para saber el estado

// --- Helpers Específicos ---
const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

// --- Lógica de Renderizado (sin cambios) ---
function renderizarLista() {
    // (Esta función no necesita cambios)
    const elListaItems = document.getElementById('lista-items-verificador');
    const elTotalMonto = document.getElementById('total-monto-verificador');
    const elSelectListaTotal = document.getElementById('lista-precio-total-verificador');
    if (!elListaItems || !elTotalMonto || !elSelectListaTotal) return;
    elListaItems.innerHTML = '';
    let totalCalculado = 0;
    const listaIdParaTotal = elSelectListaTotal.value;
    itemsEscaneados.forEach(item => {
        let precioParaTotal = 0;
        if (listaIdParaTotal && item.precios && Array.isArray(item.precios)) {
            const precioEncontrado = item.precios.find(p => p.lista_id == listaIdParaTotal);
            if (precioEncontrado && precioEncontrado.valor !== null) precioParaTotal = precioEncontrado.valor;
        }
        totalCalculado += precioParaTotal;
        let preciosHtml = '<ul style="padding-left: 20px; margin-top: 5px;">';
        if (item.precios && Array.isArray(item.precios)) {
            item.precios.forEach(p => {
                const valorDisplay = (p.valor !== null) ? formatCurrency(p.valor) : '(Sin precio)';
                preciosHtml += `<li><b>${p.nombre_lista}: ${valorDisplay}</b> (Regla: ${p.regla_aplicada || 'N/A'})</li>`;
            });
        } else {
            preciosHtml += '<li>(Este producto no tiene precios definidos)</li>';
        }
        preciosHtml += '</ul>';
        const itemHtml = `<div class="card" style="margin-bottom: 10px;"><div class="card-body"><h5 class="card-title">${item.descripcion}</h5><h6 class="card-subtitle mb-2 text-muted">Stock: ${item.stock_actual}</h6><div class="item-precios">${preciosHtml}</div></div></div>`;
        elListaItems.innerHTML += itemHtml;
    });
    elTotalMonto.textContent = formatCurrency(totalCalculado);
}

function actualizarListasDePrecio(precios) {
    // (Esta función no necesita cambios)
    const elSelectListaTotal = document.getElementById('lista-precio-total-verificador');
    if (!elSelectListaTotal) return;
    if (!precios || !Array.isArray(precios)) return;
    let hayNuevasListas = false;
    precios.forEach(p => {
        if (!listasDePrecioDisponibles.has(p.lista_id)) {
            listasDePrecioDisponibles.set(p.lista_id, p.nombre_lista);
            hayNuevasListas = true;
        }
    });
    if (hayNuevasListas) {
        elSelectListaTotal.innerHTML = '<option value="">(Elija lista para total)</option>';
        listasDePrecioDisponibles.forEach((nombre, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = nombre;
            elSelectListaTotal.appendChild(option);
        });
    }
}

// --- Nueva Lógica del Scanner ---

/**
 * Detiene el escaneo y apaga la cámara.
 */
function detenerEscaneo() {
    if (html5QrCode && isScannerActive) {
        const elScanStatus = document.getElementById('scan-status-verificador');
        const readerContainer = document.getElementById('reader-verificador');

        html5QrCode.stop().then(() => {
            console.log("Scanner detenido exitosamente.");
            isScannerActive = false;
            if (readerContainer) readerContainer.style.display = 'none'; // Ocultamos el visor
            if (elScanStatus) elScanStatus.textContent = "Presione 'Iniciar Escáner' para usar la cámara.";
        }).catch(err => {
            console.error("Fallo al detener el scanner.", err);
        });
    }
}

/**
 * Inicia el escaneo y enciende la cámara.
 */
async function iniciarEscaneo() {
    const elScanStatus = document.getElementById('scan-status-verificador');
    const readerContainer = document.getElementById('reader-verificador');

    // Si ya está activo, no hacemos nada
    if (isScannerActive) return;

    // Si la instancia no existe, la creamos UNA SOLA VEZ
    if (!html5QrCode) {
        console.log("Creando nueva instancia de Html5Qrcode...");
        html5QrCode = new Html5Qrcode("reader-verificador", false);
    }

    if (readerContainer) readerContainer.style.display = 'block'; // Mostramos el visor
    if (elScanStatus) elScanStatus.textContent = "Iniciando cámara...";

    const config = {
        fps: 10,
        qrbox: { width: 350, height: 100 }, // Más ancha y menos alta
        facingMode: "environment"
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, // Pedir cámara trasera
            config,
            onScanSuccess, // Callback de éxito
            (errorMessage) => { /* ignorar errores de 'no QR encontrado' */ }
        );
        isScannerActive = true;
        if (elScanStatus) elScanStatus.textContent = "Apuntá la cámara al código de barras...";
    } catch (err) {
        mostrarNotificacion(`Error al iniciar la cámara: ${err}`, 'error');
        if (elScanStatus) elScanStatus.textContent = "Error al iniciar cámara.";
        isScannerActive = false;
        if (readerContainer) readerContainer.style.display = 'none';
    }
}

/**
 * Callback de éxito para el scanner (con un pequeño cambio)
 */
async function onScanSuccess(decodedText, decodedResult) {
    const elScanStatus = document.getElementById('scan-status-verificador');
    // Feedback inmediato de lectura
    elScanStatus.textContent = `Código leído: ${decodedText}. Buscando...`;
    
    // Pausamos el scanner para evitar múltiples lecturas del mismo código
    if (isScannerActive) html5QrCode.pause();

    try {
        const producto = await fetchData(`/api/negocios/${appState.negocioActivoId}/mobile/check-producto/${decodedText}`);
        itemsEscaneados.push(producto);
        actualizarListasDePrecio(producto.precios);
        renderizarLista();
        elScanStatus.textContent = `✅ "${producto.descripcion}" agregado.`;
    } catch (error) {
        // Usamos el texto decodificado en el mensaje de error para más claridad
        if (error.message.toLowerCase().includes('producto no encontrado')) {
            elScanStatus.textContent = `❌ Producto no encontrado para el código ${decodedText}.`;
        } else {
            elScanStatus.textContent = `❌ Error: ${error.message}`;
        }
        // La notificación emergente sigue siendo útil para errores inesperados
        mostrarNotificacion(error.message, 'error');
    }

    // Después de un momento, reanudamos el scanner
    setTimeout(() => {
        if (isScannerActive) {
            html5QrCode.resume();
            const currentStatus = document.getElementById('scan-status-verificador');
            if (currentStatus) currentStatus.textContent = "Apuntá la cámara al código de barras...";
        }
    }, 2500); // Aumentamos un poco la pausa para dar tiempo a leer el mensaje
}

/**
 * Limpia el estado y la UI
 */
function limpiarLecturas() {
    itemsEscaneados = [];
    renderizarLista();
    const elScanStatus = document.getElementById('scan-status-verificador');
    if (elScanStatus) elScanStatus.textContent = "Lecturas limpiadas.";
}

/**
 * Función de inicialización principal (EXPORTADA)
 */
export function inicializarLogicaVerificador() {
    itemsEscaneados = [];
    listasDePrecioDisponibles = new Map();

    const btnIniciar = document.getElementById('btn-iniciar-scanner');
    const btnDetener = document.getElementById('btn-detener-scanner');
    const btnLimpiar = document.getElementById('btn-limpiar-verificador');
    const selectLista = document.getElementById('lista-precio-total-verificador');
    const readerContainer = document.getElementById('reader-verificador');

    if (!btnIniciar || !btnDetener || !btnLimpiar || !selectLista || !readerContainer) {
        console.error("Faltan elementos HTML para el verificador.");
        return;
    }
    
    selectLista.innerHTML = '<option value="">(Elija lista)</option>';
    readerContainer.style.display = 'none'; // Oculto por defecto

    // Asignamos los nuevos eventos
    btnIniciar.addEventListener('click', iniciarEscaneo);
    btnDetener.addEventListener('click', detenerEscaneo);
    btnLimpiar.addEventListener('click', limpiarLecturas);
    selectLista.addEventListener('change', renderizarLista);

    renderizarLista();
}

// Limpieza al salir del módulo
// Esta función debe ser llamada por el router principal cuando se navega a otra página
export function limpiarVerificador() {
    detenerEscaneo();
    // No destruimos la instancia `html5QrCode` para poder reutilizarla
}
