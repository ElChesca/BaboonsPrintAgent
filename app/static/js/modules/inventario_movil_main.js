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

// --- Nuevos Selectores (Unificado) ---
const sourceRadios = document.querySelectorAll('input[name="stock-source"]');
const vehiculoContainer = document.getElementById('container-vehiculo-selector');
const vehiculoSelector = document.getElementById('vehiculo-selector-movil');

// Variable para la instancia del escáner
let html5QrcodeScannerInstance = null;

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
            try { const errData = await response.json(); errorMsg = errData.error || errData.message || errorMsg; } catch (e) { }
            throw new Error(errorMsg);
        }
        if (response.status === 204) return null;
        return response.json();
    } catch (error) { console.error(`Error en fetchWithAuth (${options.method || 'GET'} ${url}):`, error); throw error; }
}

async function buscarProductoPorCodigo(codigo) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Por favor, seleccione un negocio primero."); return null; }

    // Identificar origen
    const source = Array.from(sourceRadios).find(r => r.checked)?.value || 'deposito';
    const vehiculoId = vehiculoSelector.value;

    if (source === 'vehiculo' && !vehiculoId) {
        mostrarError("Por favor, seleccione un vehículo.");
        return null;
    }

    console.log(`Buscando código '${codigo}' en origen: ${source} (Negocio: ${NEGOCIO_ACTIVO_ID})`);
    try {
        // Primero buscamos el producto en el negocio (como siempre)
        const producto = await fetchWithAuth(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`);

        // Si el origen es vehículo, necesitamos el stock de ESE camión
        if (producto && source === 'vehiculo') {
            const stockData = await fetchWithAuth(`/api/vehiculos/${vehiculoId}/stock`);
            // Buscamos este producto en el stock del camión
            const stockItem = stockData.find(s => s.producto_id === producto.id);
            producto.stock = stockItem ? stockItem.cantidad : 0;
            producto.source_type = 'vehiculo';
            producto.vehiculo_id = vehiculoId;
        } else if (producto) {
            producto.source_type = 'deposito';
        }

        return producto;
    } catch (error) { mostrarError(error.message); return null; }
}

async function ajustarStock(productoId, cantidadNueva) {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Por favor, seleccione un negocio primero."); return null; }

    const source = Array.from(sourceRadios).find(r => r.checked)?.value || 'deposito';
    const vehiculoId = vehiculoSelector.value;

    try {
        if (source === 'vehiculo') {
            if (!vehiculoId) throw new Error("Seleccione un vehículo");
            const payload = { producto_id: parseInt(productoId), cantidad_nueva: parseFloat(cantidadNueva), negocio_id: NEGOCIO_ACTIVO_ID };
            return await fetchWithAuth(`/api/vehiculos/${vehiculoId}/stock/ajustar`, { method: 'POST', body: JSON.stringify(payload) });
        } else {
            const payload = { producto_id: parseInt(productoId), cantidad_nueva: parseFloat(cantidadNueva), negocio_id: NEGOCIO_ACTIVO_ID };
            return await fetchWithAuth(`/api/inventario/ajustar`, { method: 'POST', body: JSON.stringify(payload) });
        }
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
    productStockEl.innerHTML = `${producto.stock} <small class="text-muted">(${producto.source_type === 'vehiculo' ? 'En Camión' : 'En Depósito'})</small>`;
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
    if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === 'SCANNING') {
        html5QrcodeScannerInstance.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
    }
}

// --- Lógica del Escáner ---

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    if (statusElement) statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;
    if (manualCodeInput) manualCodeInput.value = decodedText;

    buscarProductoPorCodigo(decodedText)
        .then(producto => {
            if (producto) {
                if (navigator.vibrate) navigator.vibrate(100);
                mostrarInfoProducto(producto);
            } else {
                mostrarError(`Producto con código ${decodedText} no encontrado.`);
                if (btnStartScanner) btnStartScanner.classList.remove('hidden');
                if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
            }
        })
        .catch(err => {
            console.error("Error al buscar producto:", err);
            mostrarError(`Error al buscar producto: ${err.message}`);
            if (btnStartScanner) btnStartScanner.classList.remove('hidden');
            if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
        })
        .finally(() => {
            if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === 'SCANNING') {
                html5QrcodeScannerInstance.clear().catch(error => console.error("Fallo al limpiar el escáner.", error));
            }
        });
}

function onScanFailure(error) {
    if (typeof error === 'string' && !error.toLowerCase().includes("not found")) { console.warn(`Error de escaneo: ${error}`); }
}

function iniciarScanner() {
    if (!NEGOCIO_ACTIVO_ID) { mostrarError("Seleccione un negocio."); return; }
    if (statusElement) statusElement.textContent = 'Iniciando cámara...';
    if (btnStartScanner) btnStartScanner.classList.add('hidden');
    if (qrReaderDiv) qrReaderDiv.classList.remove('hidden');
    if (productInfoDiv) productInfoDiv.classList.add('hidden');

    if (html5QrcodeScannerInstance && html5QrcodeScannerInstance.getState() === 'SCANNING') {
        html5QrcodeScannerInstance.clear().catch(err => console.error("Error al limpiar scanner previo", err));
    }

    try {
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
        ];

        html5QrcodeScannerInstance = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: formatsToSupport, experimentalFeatures: { useBarCodeDetectorIfSupported: true }, facingMode: "environment" }, false);
        html5QrcodeScannerInstance.render(onScanSuccess, onScanFailure);
        if (statusElement) statusElement.textContent = 'Listo para escanear.';
    } catch (error) {
        console.error("Error al inicializar Html5QrcodeScanner:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}.`);
        if (btnStartScanner) btnStartScanner.classList.remove('hidden');
        if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
    }
}

async function buscarYMostrarProducto(codigo) {
    if (!codigo) { mostrarError("Ingrese un código."); return; }
    if (statusElement) statusElement.textContent = `Buscando: ${codigo}...`;
    const producto = await buscarProductoPorCodigo(codigo);
    if (producto) { if (navigator.vibrate) navigator.vibrate(50); mostrarInfoProducto(producto); }
}

// --- Inicialización y Listeners ---
export async function inicializarLogicaInventarioMovil() {
    if (!negocioSelector || !manualCodeInput || !btnBuscarManual || !qrReaderDiv || !statusElement || !productInfoDiv || !productNameEl || !productSkuEl || !productStockEl || !productIdInput || !cantidadNuevaInput || !btnAjustar || !btnCancelar || !btnStartScanner || !errorDiv) {
        console.error("Error FATAL: Faltan elementos esenciales del DOM.");
        return;
    }

    // --- Carga de Negocios y Vehículos ---
    try {
        const negocios = await fetchWithAuth('/api/negocios');
        negocioSelector.innerHTML = '<option value="">-- Seleccione Negocio --</option>';
        negocios.forEach(n => { negocioSelector.innerHTML += `<option value="${n.id}">${n.nombre}</option>`; });

        const savedNegocioId = localStorage.getItem('negocioId') || localStorage.getItem('negocioActivoId');
        if (savedNegocioId && negocios.some(n => n.id == savedNegocioId)) {
            negocioSelector.value = savedNegocioId;
            NEGOCIO_ACTIVO_ID = savedNegocioId;
            await cargarVehiculos();
            btnStartScanner.classList.remove('hidden');
            statusElement.textContent = 'Listo. Apunte cámara o ingrese código.';
        } else {
            statusElement.textContent = 'Seleccione un negocio.';
            btnStartScanner.classList.add('hidden');
        }
    } catch (error) {
        mostrarError("Error al cargar datos: " + error.message);
    }

    // --- Listeners ---
    negocioSelector.addEventListener('change', async (e) => {
        NEGOCIO_ACTIVO_ID = e.target.value;
        localStorage.setItem('negocioId', NEGOCIO_ACTIVO_ID);
        await cargarVehiculos();
        resetUI();
    });

    sourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'vehiculo') {
                vehiculoContainer.style.display = 'block';
            } else {
                vehiculoContainer.style.display = 'none';
            }
            resetUI();
        });
    });

    btnBuscarManual.addEventListener('click', () => buscarYMostrarProducto(manualCodeInput.value));
    manualCodeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarYMostrarProducto(manualCodeInput.value); } });
    btnStartScanner.addEventListener('click', iniciarScanner);
    btnAjustar.addEventListener('click', async () => {
        const productoId = productIdInput.value;
        const cantidad = cantidadNuevaInput.value;
        if (!productoId || cantidad === '' || isNaN(parseFloat(cantidad))) {
            mostrarError("Ingrese una cantidad válida."); return;
        }
        btnAjustar.disabled = true; btnAjustar.textContent = 'Ajustando...';
        const resultado = await ajustarStock(productoId, cantidad);
        if (resultado) { alert('Stock ajustado con éxito.'); resetUI(); }
        btnAjustar.disabled = false; btnAjustar.textContent = '✅ Ajustar Stock';
    });
    btnCancelar.addEventListener('click', resetUI);
}

async function cargarVehiculos() {
    if (!NEGOCIO_ACTIVO_ID) return;
    try {
        const vehiculos = await fetchWithAuth(`/api/vehiculos?negocio_id=${NEGOCIO_ACTIVO_ID}`);
        vehiculoSelector.innerHTML = '<option value="">-- Seleccione un Vehículo --</option>';
        vehiculos.filter(v => v.activo).forEach(v => {
            vehiculoSelector.innerHTML += `<option value="${v.id}">${v.patente} - ${v.modelo}</option>`;
        });
    } catch (e) {
        console.error("Error cargando vehículos", e);
    }
}
