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
async function startScan() {
    // ✨ CORRECCIÓN: Verifica si tenemos un ID o Constraints válidos
    if (!codeReader || (!selectedDeviceId && !videoConstraints)) { 
        mostrarError("El lector de códigos no está inicializado o no hay cámara seleccionada.");
        return;
    }
    try {
        statusElement.textContent = 'Iniciando cámara...';
        
        // ✨ CORRECCIÓN: Decide cómo llamar a decodeFromVideoDevice
        let decodePromise;
        if (selectedDeviceId) {
            // Si tenemos ID, lo usamos (preferido)
             decodePromise = codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', handleDecodeResult);
        } else {
             // Si no hay ID, usamos las constraints generales
             decodePromise = codeReader.decodeFromConstraints({ video: videoConstraints }, 'scanner-video', handleDecodeResult);
        }

        await decodePromise; // Espera a que la promesa inicie (no necesariamente a que termine de escanear)

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

// ✨ NUEVO: Función separada para manejar el resultado del escaneo
async function handleDecodeResult(result, err) {
    if (result) {
        codeReader.stopStreams(); 
        const code = result.getText();
        statusElement.textContent = `Código detectado: ${code}. Buscando...`;
        
        const producto = await buscarProductoPorCodigo(code);
        
        if (producto) {
            navigator.vibrate(100); 
            mostrarInfoProducto(producto);
        } else {
            mostrarError(`Producto con código ${code} no encontrado.`);
            setTimeout(() => startScan(), 2000); 
        }
    }
    if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error('Error de escaneo:', err);
        mostrarError(`Error de escaneo: ${err.message}`);
        setTimeout(() => startScan(), 3000);
    }
}


async function iniciarScanner() {
    console.log("iniciarScanner called"); 
    try {
        statusElement.textContent = 'Inicializando lector de códigos...';
        if (typeof ZXing === 'undefined' || typeof ZXing.BrowserMultiFormatReader === 'undefined') {
            throw new Error("La librería ZXing no se cargó correctamente.");
        }
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        statusElement.textContent = 'Buscando cámaras disponibles...';
        console.log("Attempting to list video devices..."); 
        
        let videoInputDevices = [];
        try {
             videoInputDevices = await codeReader.listVideoInputDevices();
        } catch (deviceError) { /* ... (manejo de errores de listado) ... */ }
        console.log("Video devices found:", videoInputDevices);

        if (videoInputDevices.length > 0) {
            // Intentamos obtener el ID de la primera cámara
            selectedDeviceId = videoInputDevices[0].deviceId; 
            // ✨ Guardamos las constraints como fallback ✨
            videoConstraints = { deviceId: selectedDeviceId } // Por defecto
            // Si no hay ID, usamos una constraint más genérica (puede ser útil en iOS)
            if (!selectedDeviceId) {
                 videoConstraints = { facingMode: "environment" }; // Intenta usar la cámara trasera
                 console.log("No device ID found, using facingMode constraint.");
            } else {
                 console.log(`Selected device ID: ${selectedDeviceId}`);
            }
        } else {
             // Si no hay cámaras, probamos una constraint genérica
             videoConstraints = { facingMode: "environment" };
             console.log("No specific video devices found, attempting generic facingMode.");
             // No lanzamos error aquí, dejaremos que startScan intente usar las constraints
        }

        startScan(); // Iniciamos el escaneo con lo que tengamos (ID o constraints)

    } catch (error) { /* ... (manejo de errores de inicialización) ... */ }
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