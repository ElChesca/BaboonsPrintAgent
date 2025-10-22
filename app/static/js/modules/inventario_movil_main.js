// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
let NEGOCIO_ACTIVO_ID = null;

// --- Selectores Globales ---
const negocioSelector = document.getElementById('negocio-selector-movil');
const manualCodeInput = document.getElementById('manual-code-input');
const btnBuscarManual = document.getElementById('btn-buscar-manual');
const qrReaderDiv = document.getElementById('qr-reader');
const statusElement = document.getElementById('scanner-status');
const productInfoDiv = document.getElementById('product-info');
const productNameEl = document.getElementById('product-name');
const productSkuEl = document.getElementById('product-sku');
const productStockEl = document.getElementById('product-stock-actual');
const productIdInput = document.getElementById('product-id');
const cantidadNuevaInput = document.getElementById('cantidad-nueva');
const btnAjustar = document.getElementById('btn-ajustar-stock');
const btnCancelar = document.getElementById('btn-cancelar-ajuste');
const btnStartScanner = document.getElementById('btn-start-scanner');
const errorDiv = document.getElementById('error-message');
const scannerContainer = document.getElementById('scanner-container');

// Variable para la instancia del escáner
let html5QrcodeScannerInstance = null; // Renombramos para claridad

// --- Funciones API ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        mostrarError("No autenticado. Por favor, inicie sesión en la app principal.");
        throw new Error("No autenticado");
    }
    const defaultHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...options.headers };
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorMsg = `Error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errData.message || errorMsg; } catch (e) {}
            throw new Error(errorMsg);
        }
        if (response.status === 204) return null;
        return response.json();
    } catch (error) { console.error(`Error en fetchWithAuth (${options.method || 'GET'} ${url}):`, error); throw error; }
}

async function buscarProductoPorCodigo(codigo) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Por favor, seleccione un negocio primero."); return null; }
    console.log(`Buscando código '${codigo}' en NEGOCIO_ID: ${NEGOCIO_ACTIVO_ID}`);
    try {
        return await fetchWithAuth(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`);
    } catch (error) { mostrarError(error.message); return null; }
}

async function ajustarStock(productoId, cantidadNueva) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Por favor, seleccione un negocio primero."); return null; }
    try {
        const payload = { producto_id: parseInt(productoId), cantidad_nueva: parseInt(cantidadNueva), negocio_id: NEGOCIO_ACTIVO_ID };
        return await fetchWithAuth(`/api/inventario/ajustar`, { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) { mostrarError(error.message); return null; }
}

// --- Funciones UI ---
function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje);
    if (errorDiv) { errorDiv.textContent = mensaje; errorDiv.classList.remove('hidden'); setTimeout(() => { if (errorDiv) errorDiv.classList.add('hidden'); }, 5000); }
    else { alert(`Error: ${mensaje}`); }
}

function mostrarInfoProducto(producto) {
    if (!productNameEl || !productSkuEl || !productStockEl || !productIdInput || !cantidadNuevaInput || !productInfoDiv || !qrReaderDiv || !btnStartScanner || !statusElement) return;
    productNameEl.textContent = producto.nombre;
    productSkuEl.textContent = producto.sku || producto.codigo_barras;
    productStockEl.textContent = producto.stock;
    productIdInput.value = producto.id;
    cantidadNuevaInput.value = producto.stock;
    productInfoDiv.classList.remove('hidden');
    qrReaderDiv.classList.add('hidden');
    if (scannerContainer) scannerContainer.classList.add('hidden');
    btnStartScanner.classList.remove('hidden');
    statusElement.classList.add('hidden');
    cantidadNuevaInput.focus();
    cantidadNuevaInput.select();
}

function resetUI() {
    if (!productInfoDiv || !qrReaderDiv || !btnStartScanner || !statusElement || !manualCodeInput || !errorDiv) return;
    productInfoDiv.classList.add('hidden');
    manualCodeInput.value = '';
    if (NEGOCIO_ACTIVO_ID) {
        qrReaderDiv.classList.remove('hidden');
        btnStartScanner.classList.remove('hidden');
        statusElement.textContent = 'Apunte la cámara o ingrese el código manualmente.';
    } else {
        qrReaderDiv.classList.add('hidden');
        btnStartScanner.classList.add('hidden');
        statusElement.textContent = 'Seleccione un negocio para empezar.';
    }
    statusElement.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    // Detiene el escáner si está activo
    if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === Html5QrcodeScannerState.SCANNING) {
         html5QrcodeScannerInstance.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
    }
}

// --- Lógica del Escáner ---
// en static/js/modules/inventario_movil_main.js

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    if(statusElement) statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;
    if(manualCodeInput) manualCodeInput.value = decodedText;

    // ✨ --- CAMBIO CLAVE: NO detenemos el scanner todavía --- ✨
    // if (html5QrcodeScannerInstance && ...) { /* clear() */ } 

    // Llamamos a la función de búsqueda
    buscarProductoPorCodigo(decodedText)
        .then(producto => {
            // ✨ LOG: ¿Llegamos aquí?
            console.log("Resultado de buscarProductoPorCodigo:", producto); 

            if (producto) {
                navigator.vibrate(100);
                mostrarInfoProducto(producto); // Muestra info y OCULTA el scanner
            } else {
                mostrarError(`Producto con código ${decodedText} no encontrado.`);
                // Mostramos el botón para reintentar manualmente
                if(btnStartScanner) btnStartScanner.classList.remove('hidden'); 
                if(qrReaderDiv) qrReaderDiv.classList.add('hidden'); // Ocultamos el div del scanner
            }
        })
        .catch(err => {
            // ✨ LOG: ¿Hubo error en la búsqueda?
            console.error("Error en .catch de buscarProductoPorCodigo:", err); 
            mostrarError(`Error al buscar producto: ${err.message}`);
            if(btnStartScanner) btnStartScanner.classList.remove('hidden');
            if(qrReaderDiv) qrReaderDiv.classList.add('hidden');
        })
        .finally(() => {
            // ✨ --- AHORA SÍ DETENEMOS EL SCANNER --- ✨
            // Este bloque se ejecuta SIEMPRE, haya funcionado o no la búsqueda
            console.log("Ejecutando .finally() para limpiar el escáner.");
            if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === Html5QrcodeScannerState.SCANNING) {
                html5QrcodeScannerInstance.clear()
                    .then(() => console.log("Escáner limpiado con éxito."))
                    .catch(error => console.error("Fallo al limpiar el escáner en .finally().", error));
            } else {
                 console.log("El escáner no estaba activo o no existe, no se limpió.");
            }
        });
}

function onScanFailure(error) {
    if (typeof error === 'string' && !error.toLowerCase().includes("not found")) { console.warn(`Error de escaneo: ${error}`); }
    else if (error instanceof Error && error.name !== 'NotFoundException') { console.warn(`Error de escaneo: ${error.name}`, error); }
}

function iniciarScanner() {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Seleccione un negocio."); return; }
    console.log("iniciarScanner called");
    if(statusElement) statusElement.textContent = 'Iniciando cámara...';
    if(btnStartScanner) btnStartScanner.classList.add('hidden');
    if(qrReaderDiv) qrReaderDiv.classList.remove('hidden');
    if(productInfoDiv) productInfoDiv.classList.add('hidden');

    if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrcodeScannerInstance.clear().catch(err => console.error("Error al limpiar scanner previo", err));
    }

    try {
        if (typeof Html5QrcodeScanner === 'undefined') throw new Error("La librería Html5QrcodeScanner no se cargó.");
        console.log("Html5QrcodeScanner encontrado!");

        const formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
        ];

        html5QrcodeScannerInstance = new Html5QrcodeScanner( "qr-reader", { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: formatsToSupport, experimentalFeatures: { useBarCodeDetectorIfSupported: true }, facingMode: "environment" }, false );
        html5QrcodeScannerInstance.render(onScanSuccess, onScanFailure);
        if(statusElement) statusElement.textContent = 'Listo para escanear.';

    } catch (error) {
        console.error("Error al inicializar Html5QrcodeScanner:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}. ¿Permitiste acceso a cámara?`);
        if(statusElement) statusElement.textContent = `Error: ${error.message}`;
        if(btnStartScanner) btnStartScanner.classList.remove('hidden');
        if(qrReaderDiv) qrReaderDiv.classList.add('hidden');
    }
}

// --- Función de Búsqueda ---
async function buscarYMostrarProducto(codigo) {
    if (!codigo) { mostrarError("Ingrese un código."); return; }
    if(statusElement) statusElement.textContent = `Buscando: ${codigo}...`;
    const producto = await buscarProductoPorCodigo(codigo);
    if (producto) { navigator.vibrate(50); mostrarInfoProducto(producto); }
    else { if(statusElement) statusElement.textContent = 'Intente de nuevo.'; }
}

// --- Inicialización y Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Cargado.");

    // Verifica si TODOS los elementos esenciales existen
    if (!negocioSelector || !manualCodeInput || !btnBuscarManual || !qrReaderDiv || !statusElement || !productInfoDiv || !productNameEl || !productSkuEl || !productStockEl || !productIdInput || !cantidadNuevaInput || !btnAjustar || !btnCancelar || !btnStartScanner || !errorDiv) {
        console.error("Error FATAL: Faltan elementos esenciales del DOM. Verifica IDs en inventario_movil.html.");
        alert("Error: La página no cargó correctamente. Faltan elementos.");
        return;
    }
    console.log("Elementos esenciales encontrados.");

    // --- Carga de Negocios ---
    try {
        const negocios = await fetchWithAuth('/api/negocios');
        negocioSelector.innerHTML = '<option value="">-- Seleccione Negocio --</option>';
        negocios.forEach(n => { negocioSelector.innerHTML += `<option value="${n.id}">${n.nombre}</option>`; });
        const savedNegocioId = localStorage.getItem('negocioActivoId');
        if (savedNegocioId && negocios.some(n => n.id == savedNegocioId)) {
            negocioSelector.value = savedNegocioId;
            NEGOCIO_ACTIVO_ID = savedNegocioId;
            btnStartScanner.classList.remove('hidden');
            statusElement.textContent = 'Listo. Apunte cámara o ingrese código.';
        } else {
             statusElement.textContent = 'Seleccione un negocio.';
             btnStartScanner.classList.add('hidden'); // Asegura ocultar si no hay negocio
        }
    } catch (error) {
        mostrarError("Error al cargar negocios: " + error.message);
        negocioSelector.innerHTML = '<option value="">Error</option>';
        statusElement.textContent = 'Error al cargar negocios.';
         btnStartScanner.classList.add('hidden'); // Asegura ocultar si hay error
    }

    // --- Listeners ---
    negocioSelector.addEventListener('change', (e) => {
        NEGOCIO_ACTIVO_ID = e.target.value;
        localStorage.setItem('negocioActivoId', NEGOCIO_ACTIVO_ID);
        resetUI();
        console.log("Negocio activo:", NEGOCIO_ACTIVO_ID);
    });
    btnBuscarManual.addEventListener('click', () => buscarYMostrarProducto(manualCodeInput.value));
    manualCodeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarYMostrarProducto(manualCodeInput.value); } });
    btnStartScanner.addEventListener('click', iniciarScanner);
    btnAjustar.addEventListener('click', async () => {
        const productoId = productIdInput.value;
        const cantidad = cantidadNuevaInput.value;
        if (!productoId || cantidad === '' || isNaN(parseInt(cantidad))) { // Verifica que cantidad sea un número
            mostrarError("Ingrese una cantidad válida."); return;
        }
        btnAjustar.disabled = true; btnAjustar.textContent = 'Ajustando...';
        const resultado = await ajustarStock(productoId, cantidad);
        if (resultado) { alert('Stock ajustado con éxito.'); resetUI(); }
        // Si hubo error, ajustarStock ya mostró el mensaje
        btnAjustar.disabled = false; btnAjustar.textContent = '✅ Ajustar Stock';
    });
    btnCancelar.addEventListener('click', resetUI);

    // Estado inicial UI (redundante pero seguro)
    qrReaderDiv.classList.add('hidden');
    productInfoDiv.classList.add('hidden');
    if (!NEGOCIO_ACTIVO_ID) btnStartScanner.classList.add('hidden');

    console.log("Configuración inicial completa.");
});

// Polyfill para getState() si no existe (algunas versiones viejas de la librería no lo tienen)
if (typeof Html5QrcodeScannerState === 'undefined') {
    var Html5QrcodeScannerState = { SCANNING: 'SCANNING', NOT_STARTED: 'NOT_STARTED', PAUSED: 'PAUSED' };
    // Añade un método getState simple si no existe
    if (typeof Html5QrcodeScanner.prototype.getState === 'undefined') {
         Html5QrcodeScanner.prototype.getState = function() {
             // Esto es una simplificación, no siempre será 100% preciso
             return this._isScanning ? Html5QrcodeScannerState.SCANNING : Html5QrcodeScannerState.NOT_STARTED;
         };
    }
}