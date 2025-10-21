// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
const NEGOCIO_ACTIVO_ID = localStorage.getItem('negocioActivoId') || 1; 

// --- Selectores de Elementos ---
const scannerContainer = document.getElementById('scanner-container'); 
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

// Variable para la instancia del escáner
let html5QrcodeScanner = null;

// --- Funciones API ---

// ✨ FUNCIÓN DEFINIDA COMPLETAMENTE ✨
async function buscarProductoPorCodigo(codigo) {
    try {
        const token = localStorage.getItem('jwt_token');
        console.log("Token from localStorage:", token ? `Token found (${token.substring(0, 10)}...)` : 'Token NOT FOUND'); 
        if (!token) throw new Error("No autenticado (token no encontrado en localStorage)");

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

// ✨ FUNCIÓN DEFINIDA COMPLETAMENTE ✨
async function ajustarStock(productoId, cantidadNueva) {
    try {
        const token = localStorage.getItem('jwt_token');
        if (!token) throw new Error("No autenticado");
        const payload = { 
            producto_id: parseInt(productoId), // Asegura que sea número
            cantidad_nueva: parseInt(cantidadNueva), // Asegura que sea número
            negocio_id: NEGOCIO_ACTIVO_ID 
        };
        const response = await fetch(`/api/inventario/ajustar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
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

// --- Funciones UI ---

// ✨ FUNCIÓN DEFINIDA COMPLETAMENTE ✨
function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje); 
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.classList.remove('hidden');
        // Oculta después de 5s para errores no críticos
        // if (!mensaje.toLowerCase().includes('autenticado') && !mensaje.toLowerCase().includes('permiso')) {
             setTimeout(() => errorDiv.classList.add('hidden'), 5000); 
        // }
    } else {
        alert(`Error: ${mensaje}`); // Fallback
    }
}

// ✨ FUNCIÓN DEFINIDA COMPLETAMENTE ✨
function mostrarInfoProducto(producto) {
    productNameEl.textContent = producto.nombre;
    productSkuEl.textContent = producto.sku || producto.codigo_barras;
    productStockEl.textContent = producto.stock;
    productIdInput.value = producto.id;
    cantidadNuevaInput.value = producto.stock; 
    
    productInfoDiv.classList.remove('hidden');
    if (qrReaderDiv) qrReaderDiv.classList.add('hidden'); // Oculta si existe
    if (scannerContainer) scannerContainer.classList.add('hidden'); // Oculta también el otro por si acaso
    btnStartScanner.classList.remove('hidden'); 
    statusElement.classList.add('hidden');
    
    cantidadNuevaInput.focus();
    cantidadNuevaInput.select();
}

function resetUI() {
    productInfoDiv.classList.add('hidden');
    if (qrReaderDiv) qrReaderDiv.classList.remove('hidden'); 
    if (scannerContainer) scannerContainer.classList.add('hidden'); // Mantenemos este oculto
    btnStartScanner.classList.add('hidden');
    statusElement.classList.remove('hidden');
    statusElement.textContent = 'Apunte la cámara al código de barras...';
    errorDiv.classList.add('hidden');
    if (html5QrcodeScanner) {
        // Detiene el escaneo si estaba activo antes de iniciar uno nuevo
        if (html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
        }
        iniciarScanner(); 
    }
}

// --- Lógica del Escáner (html5-qrcode) ---

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;

    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.clear().catch(error => console.error("Fallo al limpiar el escáner.", error));
    } 

    buscarProductoPorCodigo(decodedText).then(producto => {
        if (producto) {
            navigator.vibrate(100);
            mostrarInfoProducto(producto);
        } else {
            mostrarError(`Producto con código ${decodedText} no encontrado.`);
            btnStartScanner.classList.remove('hidden'); 
            if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
        }
    }).catch(err => {
        mostrarError(`Error al buscar producto: ${err.message}`);
        btnStartScanner.classList.remove('hidden');
        if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
    });
}

function onScanFailure(error) {
    // Evita mostrar errores si simplemente no detectó nada
    if (error.includes && !error.includes("NotFoundException")) {
        console.warn(`Error de escaneo: ${error}`);
    }
}

function iniciarScanner() {
    console.log("iniciarScanner called with html5-qrcode");
    statusElement.textContent = 'Iniciando cámara...';
    btnStartScanner.classList.add('hidden');
    if (qrReaderDiv) qrReaderDiv.classList.remove('hidden'); 
    productInfoDiv.classList.add('hidden'); 

    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        console.log("Intentando limpiar scanner previo...");
        html5QrcodeScanner.clear().catch(err => console.error("Error al limpiar scanner previo", err));
    }

    try {
         // ✨ CORRECCIÓN CLAVE: Usamos el objeto global Html5Qrcode ✨
         const formatsToSupport = [ 
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A, 
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE 
        ];

        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader", 
            { 
                fps: 10, 
                qrbox: { width: 250, height: 150 }, 
                formatsToSupport: formatsToSupport, // Usamos la variable
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true // Intenta usar API nativa si existe
                },
                facingMode: "environment" 
            },
             false 
        );
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        statusElement.textContent = 'Listo para escanear.';

    } catch (error) {
        console.error("Error al inicializar Html5QrcodeScanner:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}. ¿Permitiste el acceso a la cámara?`);
        statusElement.textContent = `Error: ${error.message}`;
        btnStartScanner.classList.remove('hidden'); 
        if (qrReaderDiv) qrReaderDiv.classList.add('hidden');
    }
}

// --- Event Listeners ---
// Aseguramos que los botones existan antes de añadir listeners
if (btnStartScanner) btnStartScanner.addEventListener('click', iniciarScanner);
if (btnAjustar) {
    btnAjustar.addEventListener('click', async () => { 
        const productoId = productIdInput.value;
        const cantidad = cantidadNuevaInput.value;
        if (!productoId || cantidad === '') {
            mostrarError("Faltan datos para el ajuste."); return;
        }
        btnAjustar.disabled = true;
        btnAjustar.textContent = 'Ajustando...';
        const resultado = await ajustarStock(productoId, cantidad);
        if (resultado) {
            alert('Stock ajustado con éxito.'); 
            resetUI();
        }
        btnAjustar.disabled = false;
        btnAjustar.textContent = '✅ Ajustar Stock';
    });
}
if (btnCancelar) btnCancelar.addEventListener('click', resetUI);

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // Verificamos si los elementos existen antes de manipularlos
    const localQrReaderDiv = document.getElementById('qr-reader');
    const localProductInfoDiv = document.getElementById('product-info');
    const localBtnStartScanner = document.getElementById('btn-start-scanner');

    if (localQrReaderDiv) localQrReaderDiv.classList.add('hidden'); 
    if (localProductInfoDiv) localProductInfoDiv.classList.add('hidden');
    if (localBtnStartScanner) localBtnStartScanner.classList.remove('hidden'); 

    console.log("DOM Cargado. Listo para iniciar escáner."); 
});