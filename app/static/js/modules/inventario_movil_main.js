// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
let NEGOCIO_ACTIVO_ID = null;

// --- Selectores Globales (elementos que deben existir sí o sí) ---
// Obtenemos referencias fuera para usarlas en varias funciones
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
const scannerContainer = document.getElementById('scanner-container'); // Opcional, pero lo dejamos por si acaso

let html5QrcodeScanner = null;

// --- Funciones API ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        mostrarError("No autenticado. Por favor, inicie sesión.");
        throw new Error("No autenticado"); 
    }
    const defaultHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...options.headers };
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorMsg = `Error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errData.message || errorMsg; } catch(e) {}
            throw new Error(errorMsg);
        }
        if (response.status === 204) return null;
        return response.json();
    } catch (error) { console.error(`Error en fetchWithAuth (${options.method || 'GET'} ${url}):`, error); throw error; }
}

async function buscarProductoPorCodigo(codigo) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Seleccione un negocio."); return null; }
    console.log(`Buscando código '${codigo}' en NEGOCIO_ID: ${NEGOCIO_ACTIVO_ID}`); 
    try {
        return await fetchWithAuth(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`);
    } catch (error) { mostrarError(error.message); return null; }
}

async function ajustarStock(productoId, cantidadNueva) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Seleccione un negocio."); return null; }
    try {
        const payload = { producto_id: parseInt(productoId), cantidad_nueva: parseInt(cantidadNueva), negocio_id: NEGOCIO_ACTIVO_ID };
        return await fetchWithAuth(`/api/inventario/ajustar`, { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) { mostrarError(error.message); return null; }
}

// --- Funciones UI ---
function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje); 
    if (errorDiv) { errorDiv.textContent = mensaje; errorDiv.classList.remove('hidden'); setTimeout(() => errorDiv.classList.add('hidden'), 5000); } 
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
        statusElement.textContent = 'Apunte la cámara o ingrese código.';
    } else {
        qrReaderDiv.classList.add('hidden');
        btnStartScanner.classList.add('hidden');
        statusElement.textContent = 'Seleccione un negocio.';
    }
    statusElement.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
         html5QrcodeScanner.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
    }
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    if(statusElement) statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;
    if(manualCodeInput) manualCodeInput.value = decodedText;
    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrcodeScanner.clear().catch(error => console.error("Fallo al limpiar el escáner.", error));
    }
    buscarYMostrarProducto(decodedText);
}
function onScanFailure(error) { /* ... (sin cambios) ... */ }

function iniciarScanner() {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Seleccione un negocio."); return; }
    console.log("iniciarScanner called");
    if(statusElement) statusElement.textContent = 'Iniciando cámara...';
    if(btnStartScanner) btnStartScanner.classList.add('hidden');
    if(qrReaderDiv) qrReaderDiv.classList.remove('hidden');
    if(productInfoDiv) productInfoDiv.classList.add('hidden');

    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) { /* ... limpiar ... */ }

    try {
        if (typeof Html5QrcodeScanner === 'undefined') throw new Error("Html5QrcodeScanner no cargado.");
        const formatsToSupport = [ /* ... (lista de formatos) ... */ ];
        html5QrcodeScanner = new Html5QrcodeScanner( /* ... configuración ... */ );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        if(statusElement) statusElement.textContent = 'Listo para escanear.';
    } catch (error) { /* ... (manejo de errores) ... */ }
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
        console.error("Error FATAL: Faltan elementos esenciales del DOM en inventario_movil.html. Verifica los IDs.");
        alert("Error: La página no cargó correctamente. Faltan elementos.");
        return; // Detiene la ejecución
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
        }
    } catch (error) { /* ... (manejo error carga negocios) ... */ }

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
    btnAjustar.addEventListener('click', async () => { /* ... (lógica ajuste stock) ... */ });
    btnCancelar.addEventListener('click', resetUI);

    // Estado inicial UI
    qrReaderDiv.classList.add('hidden');
    productInfoDiv.classList.add('hidden');
    if (!NEGOCIO_ACTIVO_ID) btnStartScanner.classList.add('hidden');

    console.log("Configuración inicial completa.");
});