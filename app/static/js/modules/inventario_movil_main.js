// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
// Ya no necesitamos la License Key de Scandit
const NEGOCIO_ACTIVO_ID = localStorage.getItem('negocioActivoId') || 1; // Ajusta cómo obtienes esto

// --- Selectores de Elementos ---
const scannerContainer = document.getElementById('scanner-container');
const videoElement = document.getElementById('scanner-video');
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

// Variable para la instancia del lector de códigos
let codeReader = null;
let selectedDeviceId = null; // Para guardar la cámara seleccionada

// --- Funciones API (buscarProductoPorCodigo, ajustarStock se quedan igual) ---
async function buscarProductoPorCodigo(codigo) {
    try {
        const token = localStorage.getItem('jwt_token');
        if (!token) throw new Error("No autenticado");
        const response = await fetch(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
            throw new Error(errData.error || `Error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error buscando producto:", error);
        mostrarError(error.message);
        return null;
    }
}

async function ajustarStock(productoId, cantidadNueva) {
    try {
        const token = localStorage.getItem('jwt_token');
        if (!token) throw new Error("No autenticado");
        const payload = { producto_id: productoId, cantidad_nueva: cantidadNueva, negocio_id: NEGOCIO_ACTIVO_ID };
        const response = await fetch(`/api/inventario/ajustar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
            throw new Error(errData.error || `Error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
         console.error("Error ajustando stock:", error);
        mostrarError(error.message);
        return null;
    }
}

// --- Funciones UI (mostrarError, mostrarInfoProducto, resetUI se quedan igual) ---
function mostrarError(mensaje) { /* ... */ }
function mostrarInfoProducto(producto) { /* ... */ }

function resetUI() {
    productInfoDiv.classList.add('hidden');
    scannerContainer.classList.remove('hidden');
    btnStartScanner.classList.add('hidden');
    statusElement.classList.remove('hidden');
    statusElement.textContent = 'Apunte la cámara al código de barras...';
    errorDiv.classList.add('hidden');
    // Reanudamos el escaneo si ya estaba iniciado
    if (codeReader && selectedDeviceId) {
        startScan(); 
    }
}

// --- Lógica del Escáner (ZXing-JS) ---

// Función separada para iniciar el escaneo
async function startScan() {
    if (!codeReader || !selectedDeviceId) {
        mostrarError("El lector de códigos no está inicializado.");
        return;
    }
    try {
        statusElement.textContent = 'Buscando cámara...';
        await codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', async (result, err) => {
            if (result) {
                // Código detectado
                codeReader.stopStreams(); // Detiene la cámara temporalmente
                const code = result.getText();
                statusElement.textContent = `Código detectado: ${code}. Buscando...`;
                
                const producto = await buscarProductoPorCodigo(code);
                
                if (producto) {
                    navigator.vibrate(100); // Pequeña vibración (si el navegador lo permite)
                    mostrarInfoProducto(producto);
                } else {
                    mostrarError(`Producto con código ${code} no encontrado.`);
                    // Reanuda el escaneo después de un momento
                    setTimeout(() => startScan(), 2000); 
                }
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                // Maneja otros errores que no sean "no se encontró código"
                console.error('Error de escaneo:', err);
                mostrarError(`Error de escaneo: ${err.message}`);
                // Intentar reiniciar el escaneo podría ser útil aquí
                setTimeout(() => startScan(), 3000);
            }
        });
        statusElement.textContent = 'Listo para escanear.';
        scannerContainer.classList.remove('hidden');
        btnStartScanner.classList.add('hidden');

    } catch (error) {
        console.error("Error al iniciar el escaneo:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}`);
        statusElement.textContent = `Error: ${error.message}`;
        scannerContainer.classList.add('hidden');
        btnStartScanner.classList.remove('hidden');
    }
}

async function iniciarScanner() {
    // ✨ LOG 1: ¿Se llama a la función?
    console.log("iniciarScanner called"); 
    try {
        statusElement.textContent = 'Inicializando lector de códigos...';
        // ✨ LOG 2: ¿Existe el objeto ZXing?
        console.log("ZXing object:", typeof ZXing !== 'undefined' ? ZXing : 'Not Found'); 
        if (typeof ZXing === 'undefined') {
            throw new Error("La librería ZXing no se cargó correctamente.");
        }
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        statusElement.textContent = 'Buscando cámaras disponibles...';
        // ✨ LOG 3: ¿Podemos listar las cámaras?
        console.log("Attempting to list video devices..."); 
        const videoInputDevices = await codeReader.listVideoInputDevices();
        console.log("Video devices found:", videoInputDevices); // ✨ LOG 4: ¿Cuántas encontró?

        if (videoInputDevices.length === 0) {
            throw new Error("No se encontraron cámaras.");
        }

        selectedDeviceId = videoInputDevices[0].deviceId; 
        console.log(`Selected device ID: ${selectedDeviceId}`); // ✨ LOG 5: ¿Qué cámara se usará?

        // Iniciamos el escaneo
        startScan();

    } catch (error) {
        // ✨ LOG 6: ¿Hubo algún error durante la inicialización?
        console.error("Error al inicializar ZXing:", error); 
        mostrarError(`No se pudo inicializar el lector: ${error.message}`);
        statusElement.textContent = `Error: ${error.message}`;
        btnStartScanner.classList.remove('hidden');
    }
}

// --- Event Listeners ---
btnStartScanner.addEventListener('click', () => {
    // ✨ LOG 0: ¿Se activa el listener del botón?
    console.log("Botón 'Iniciar Escáner' clickeado!"); 
    iniciarScanner();
});

btnAjustar.addEventListener('click', async () => { /* ... (esta función se queda igual) ... */ });
btnCancelar.addEventListener('click', resetUI);

// --- Inicialización ---
scannerContainer.classList.add('hidden'); 
productInfoDiv.classList.add('hidden');
btnStartScanner.classList.remove('hidden'); 

// Ya no necesitamos verificar la license key