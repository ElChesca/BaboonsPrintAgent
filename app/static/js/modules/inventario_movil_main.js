// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
const NEGOCIO_ACTIVO_ID = localStorage.getItem('negocioActivoId') || 1; 

// --- Selectores de Elementos ---
const scannerContainer = document.getElementById('scanner-container'); // Mantenemos este por si queremos ocultar/mostrar
const qrReaderDiv = document.getElementById('qr-reader'); // El div donde se renderizará el scanner
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

// --- Funciones API (buscarProductoPorCodigo, ajustarStock se quedan igual) ---
async function buscarProductoPorCodigo(codigo) { /* ... (igual que antes) ... */ }
async function ajustarStock(productoId, cantidadNueva) { /* ... (igual que antes) ... */ }

// --- Funciones UI (mostrarError, mostrarInfoProducto se quedan igual) ---
function mostrarError(mensaje) { /* ... (igual que antes) ... */ }
function mostrarInfoProducto(producto) {
    productNameEl.textContent = producto.nombre;
    productSkuEl.textContent = producto.sku || producto.codigo_barras;
    productStockEl.textContent = producto.stock;
    productIdInput.value = producto.id;
    cantidadNuevaInput.value = producto.stock; 
    
    productInfoDiv.classList.remove('hidden');
    qrReaderDiv.classList.add('hidden'); // Oculta el div del scanner
    btnStartScanner.classList.remove('hidden'); 
    statusElement.classList.add('hidden');
    
    cantidadNuevaInput.focus();
    cantidadNuevaInput.select();
}

function resetUI() {
    productInfoDiv.classList.add('hidden');
    qrReaderDiv.classList.remove('hidden'); // Muestra el div del scanner de nuevo
    btnStartScanner.classList.add('hidden');
    statusElement.classList.remove('hidden');
    statusElement.textContent = 'Apunte la cámara al código de barras...';
    errorDiv.classList.add('hidden');
    // Reanudamos el escaneo si ya estaba iniciado
    if (html5QrcodeScanner) {
        // Para html5-qrcode, la forma más simple es volver a renderizar
        iniciarScanner(); 
    }
}

async function buscarProductoPorCodigo(codigo) {
    try {
        const token = localStorage.getItem('jwt_token');
        
        // ✨ Log para verificar el token ✨
        console.log("Token from localStorage:", token ? `Token found (${token.substring(0, 10)}...)` : 'Token NOT FOUND'); 
        
        if (!token) throw new Error("No autenticado (token no encontrado en localStorage)");

        const response = await fetch(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Leemos el mensaje del backend
            const errData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
            // Lanzamos el mensaje específico
            throw new Error(errData.error || `Error ${response.status}`); 
        }
        return await response.json();
    } catch (error) {
        console.error("Error buscando producto:", error);
        mostrarError(error.message); // Muestra el error (ej: 401 si falla token)
        return null; // Devuelve null si hay error
    }
}
// --- Lógica del Escáner (html5-qrcode) ---

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;

    // Detenemos el escáner ANTES de hacer la llamada a la API
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Fallo al limpiar el escáner.", error);
        });
    }

    // Buscamos el producto
    
    buscarProductoPorCodigo(decodedText).then(producto => {
        if (producto) {
            navigator.vibrate(100);
            mostrarInfoProducto(producto);
        } else {
            mostrarError(`Producto con código ${decodedText} no encontrado.`);
            // No reiniciamos automáticamente, el usuario puede reintentar con el botón
            btnStartScanner.classList.remove('hidden'); // Mostrar botón para re-escanear
            qrReaderDiv.classList.add('hidden');
        }
    }).catch(err => {
        mostrarError(`Error al buscar producto: ${err.message}`);
        btnStartScanner.classList.remove('hidden');
        qrReaderDiv.classList.add('hidden');
    });
}

function onScanFailure(error) {
    // Ignoramos errores comunes como "QR code parse error" para no molestar
    if (!error.includes("NotFoundError")) {
       console.warn(`Error de escaneo: ${error}`);
       // Podríamos mostrar un mensaje sutil al usuario si quisiéramos
       // statusElement.textContent = 'Intenta alinear mejor el código.';
    }
}

function iniciarScanner() {
    console.log("iniciarScanner called with html5-qrcode");
    statusElement.textContent = 'Iniciando cámara...';
    btnStartScanner.classList.add('hidden');
    qrReaderDiv.classList.remove('hidden'); // Asegúrate que el div del lector esté visible
    productInfoDiv.classList.add('hidden'); // Oculta la info del producto

    // Verificamos si ya existe una instancia para evitar errores
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        console.log("El escáner ya estaba activo, limpiando...");
        html5QrcodeScanner.clear().catch(err => console.error("Error al limpiar scanner previo", err));
    }

    try {
        // Creamos una nueva instancia del escáner
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader", // ID del div donde se renderizará
            { 
                fps: 10, // Cuadros por segundo a escanear
                qrbox: { width: 250, height: 150 }, // Tamaño del recuadro de escaneo (ajusta si es necesario)
                // ✨ IMPORTANTE: Especificamos los formatos de código de barras
                formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A, 
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.QR_CODE 
                ],
                // Pedimos explícitamente la cámara trasera
                facingMode: "environment" 
            },
            /* verbose= */ false // No mostrar logs internos de la librería
        );
        
        // Iniciamos el renderizado y escaneo
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        statusElement.textContent = 'Listo para escanear.';

    } catch (error) {
        console.error("Error al inicializar Html5QrcodeScanner:", error);
        mostrarError(`No se pudo iniciar el escáner: ${error.message}. ¿Permitiste el acceso a la cámara?`);
        statusElement.textContent = `Error: ${error.message}`;
        btnStartScanner.classList.remove('hidden'); // Muestra botón para reintentar
        qrReaderDiv.classList.add('hidden');
    }
}

// --- Event Listeners ---
btnStartScanner.addEventListener('click', iniciarScanner);
btnAjustar.addEventListener('click', async () => { /* ... (esta función se queda igual) ... */ });
btnCancelar.addEventListener('click', resetUI);

// --- Inicialización ---

// ✨ ENVOLVEMOS la lógica inicial en DOMContentLoaded ✨
document.addEventListener('DOMContentLoaded', () => {
    // Aseguramos el estado inicial de la UI una vez que el DOM está listo
    if (qrReaderDiv) qrReaderDiv.classList.add('hidden'); 
    if (productInfoDiv) productInfoDiv.classList.add('hidden');
    if (btnStartScanner) btnStartScanner.classList.remove('hidden'); 

    console.log("DOM Cargado. Listo para iniciar escáner."); // Log adicional
});
