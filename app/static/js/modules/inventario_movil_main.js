// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
let NEGOCIO_ACTIVO_ID = null; // Se establecerá al seleccionar del dropdown

// --- Selectores Globales (elementos que esperamos existan siempre) ---
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
const scannerContainer = document.getElementById('scanner-container'); // Contenedor del <video> original


// Variable para la instancia del escáner
let html5QrcodeScanner = null;

// --- Funciones API ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    // ✨ CORRECCIÓN: Quitamos el 'return' ilegal de aquí ✨
    if (!token) {
        mostrarError("No autenticado. Por favor, inicie sesión en la app principal.");
        throw new Error("No autenticado"); // Lanza error para detener la ejecución
    }
    
    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorMsg = `Error ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errData.message || errorMsg;
            } catch(e) { /* Ignora si no hay JSON */ }
            throw new Error(errorMsg);
        }
        if (response.status === 204) return null;
        return response.json();
    } catch (error) {
        console.error(`Error en fetchWithAuth (${options.method || 'GET'} ${url}):`, error);
        throw error; // Relanza el error para que lo maneje quien llamó
    }
}

async function buscarProductoPorCodigo(codigo) {
    if (!NEGOCIO_ACTIVO_ID) {
        mostrarError("Por favor, seleccione un negocio primero.");
        return null;
    }
    console.log(`Buscando código '${codigo}' en NEGOCIO_ID: ${NEGOCIO_ACTIVO_ID}`);
    try {
        return await fetchWithAuth(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`);
    } catch (error) {
        // fetchWithAuth ya loguea el error
        mostrarError(error.message);
        return null;
    }
}

async function ajustarStock(productoId, cantidadNueva) {
    if (!NEGOCIO_ACTIVO_ID) {
        mostrarError("Por favor, seleccione un negocio primero.");
        return null;
    }
    try {
        const payload = {
            producto_id: parseInt(productoId),
            cantidad_nueva: parseInt(cantidadNueva),
            negocio_id: NEGOCIO_ACTIVO_ID
        };
        return await fetchWithAuth(`/api/inventario/ajustar`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (error) {
        // fetchWithAuth ya loguea el error
        mostrarError(error.message);
        return null;
    }
}

// --- Funciones UI ---
function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje);
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
             if (errorDiv) errorDiv.classList.add('hidden');
        }, 5000);
    } else {
        alert(`Error: ${mensaje}`);
    }
}

function mostrarInfoProducto(producto) {
    if (!productNameEl || !productSkuEl || !productStockEl || !productIdInput || !cantidadNuevaInput || !productInfoDiv || !qrReaderDiv || !btnStartScanner || !statusElement) return; // Verifica si existen los elementos

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

    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
         html5QrcodeScanner.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
    }
    // No reinicia el escáner automáticamente
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

function onScanFailure(error) {
    // Evita mostrar errores si simplemente no detectó nada
    // La librería a veces lanza strings, no objetos Error
    if (typeof error === 'string' && !error.toLowerCase().includes("not found")) {
        console.warn(`Error de escaneo: ${error}`);
    } else if (error instanceof Error && error.name !== 'NotFoundException') {
         console.warn(`Error de escaneo: ${error.name}`, error);
    }
}

function iniciarScanner() {
    if (!NEGOCIO_ACTIVO_ID) {
        mostrarError("Seleccione un negocio antes de iniciar el escáner.");
        return;
    }
    console.log("iniciarScanner called with html5-qrcode");
    if(statusElement) statusElement.textContent = 'Iniciando cámara...';
    if(btnStartScanner) btnStartScanner.classList.add('hidden');
    if(qrReaderDiv) qrReaderDiv.classList.remove('hidden');
    if(productInfoDiv) productInfoDiv.classList.add('hidden');

    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrcodeScanner.clear().catch(err => console.error("Error al limpiar scanner previo", err));
    }

    try {
        // Verifica si la librería está cargada
        if (typeof Html5QrcodeScanner === 'undefined') {
            throw new Error("La librería Html5QrcodeScanner no se cargó.");
        }
        
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
        ];

        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 150 },
                formatsToSupport: formatsToSupport,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                facingMode: "environment"
            },
            false
        );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        if(statusElement) statusElement.textContent = 'Listo para escanear.';

    } catch (error) {
        console.error("Error al inicializar Html5QrcodeScanner:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}. ¿Permitiste el acceso a la cámara?`);
        if(statusElement) statusElement.textContent = `Error: ${error.message}`;
        if(btnStartScanner) btnStartScanner.classList.remove('hidden');
        if(qrReaderDiv) qrReaderDiv.classList.add('hidden');
    }
}

// --- Función de Búsqueda (Manual o Escaneo) ---
async function buscarYMostrarProducto(codigo) {
    if (!codigo) {
        mostrarError("Ingrese un código para buscar.");
        return;
    }
    if(statusElement) statusElement.textContent = `Buscando código: ${codigo}...`;
    const producto = await buscarProductoPorCodigo(codigo);
    if (producto) {
        navigator.vibrate(50);
        mostrarInfoProducto(producto);
    } else {
        if(statusElement) statusElement.textContent = 'Intente escanear o ingrese otro código.';
    }
}

// --- Inicialización y Listeners Principales ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Cargado. Iniciando configuración...");

    // Obtenemos referencias a elementos DENTRO del DOMContentLoaded
    const localStatusElement = document.getElementById('scanner-status');
    const localNegocioSelector = document.getElementById('negocio-selector-movil');
    const localBtnStartScanner = document.getElementById('btn-start-scanner');
    const localQrReaderDiv = document.getElementById('qr-reader');
    const localProductInfoDiv = document.getElementById('product-info');
    const localManualCodeInput = document.getElementById('manual-code-input');
    const localBtnBuscarManual = document.getElementById('btn-buscar-manual');
    const localBtnAjustar = document.getElementById('btn-ajustar-stock');
    const localBtnCancelar = document.getElementById('btn-cancelar-ajuste');

    // Verifica si los elementos esenciales existen
    if (!localStatusElement || !localNegocioSelector || !localBtnStartScanner || !localQrReaderDiv || !localProductInfoDiv || !localManualCodeInput || !localBtnBuscarManual || !localBtnAjustar || !localBtnCancelar) {
        console.error("Error: Faltan elementos esenciales del DOM en inventario_movil.html");
        mostrarError("Error interno: La página no cargó correctamente.");
        return;
    }

    // --- Carga de Negocios ---
    try {
        const negocios = await fetchWithAuth('/api/negocios');
        localNegocioSelector.innerHTML = '<option value="">-- Seleccione Negocio --</option>';
        negocios.forEach(n => {
            localNegocioSelector.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
        });
        const savedNegocioId = localStorage.getItem('negocioActivoId');
        if (savedNegocioId && negocios.some(n => n.id == savedNegocioId)) {
            localNegocioSelector.value = savedNegocioId;
            NEGOCIO_ACTIVO_ID = savedNegocioId;
            localBtnStartScanner.classList.remove('hidden');
            localStatusElement.textContent = 'Apunte la cámara o ingrese código.';
        } else {
             localStatusElement.textContent = 'Seleccione un negocio.';
        }
    } catch (error) {
        mostrarError("Error al cargar negocios: " + error.message);
        localNegocioSelector.innerHTML = '<option value="">Error</option>';
        localStatusElement.textContent = 'Error al cargar negocios.';
    }

    // --- Listeners ---
    localNegocioSelector.addEventListener('change', (e) => {
        NEGOCIO_ACTIVO_ID = e.target.value;
        localStorage.setItem('negocioActivoId', NEGOCIO_ACTIVO_ID);
        resetUI(); // resetUI usa las variables globales
        console.log("Negocio activo cambiado a ID:", NEGOCIO_ACTIVO_ID);
    });

    localBtnBuscarManual.addEventListener('click', () => {
        buscarYMostrarProducto(localManualCodeInput.value);
    });

    localManualCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarYMostrarProducto(localManualCodeInput.value);
        }
    });

    localBtnStartScanner.addEventListener('click', iniciarScanner); // Llama a la función global

    localBtnAjustar.addEventListener('click', async () => {
        const productoId = productIdInput.value; // Usa la variable global
        const cantidad = cantidadNuevaInput.value; // Usa la variable global
        if (!productoId || cantidad === '') {
            mostrarError("Faltan datos para el ajuste."); return;
        }
        localBtnAjustar.disabled = true;
        localBtnAjustar.textContent = 'Ajustando...';
        const resultado = await ajustarStock(productoId, cantidad); // Llama a la función global
        if (resultado) {
            alert('Stock ajustado con éxito.');
            resetUI(); // Llama a la función global
        }
        localBtnAjustar.disabled = false;
        localBtnAjustar.textContent = '✅ Ajustar Stock';
    });

    localBtnCancelar.addEventListener('click', resetUI); // Llama a la función global

    // Estado inicial de la UI
    localQrReaderDiv.classList.add('hidden');
    localProductInfoDiv.classList.add('hidden');
    if (!NEGOCIO_ACTIVO_ID) localBtnStartScanner.classList.add('hidden');

    console.log("Configuración inicial completa.");
});