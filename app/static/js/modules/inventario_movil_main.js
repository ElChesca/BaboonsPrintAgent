// static/js/modules/inventario_movil_main.js

// --- CONFIGURACIÓN ---
// Quitamos la lectura inicial del localStorage, ahora depende del selector
let NEGOCIO_ACTIVO_ID = null; 

// --- Selectores ---
// (Se añaden los nuevos)
const negocioSelector = document.getElementById('negocio-selector-movil');
const manualCodeInput = document.getElementById('manual-code-input');
const btnBuscarManual = document.getElementById('btn-buscar-manual');
// ... (resto de selectores: qrReaderDiv, statusElement, productInfoDiv, etc.)

let html5QrcodeScanner = null;

// --- Funciones API ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error("No autenticado");
    
    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' // Añadimos por defecto
    };
    options.headers = { ...defaultHeaders, ...options.headers };

    const response = await fetch(url, options);
    if (!response.ok) {
        let errorMsg = `Error ${response.status}`;
        try {
            const errData = await response.json();
            errorMsg = errData.error || errData.message || errorMsg;
        } catch(e) { /* Ignora si no hay JSON */ }
        throw new Error(errorMsg);
    }
    if (response.status === 204) return null; // No content
    return response.json();
}

async function buscarProductoPorCodigo(codigo) {
    // ✨ Ahora usa la variable global NEGOCIO_ACTIVO_ID ✨
    if (!NEGOCIO_ACTIVO_ID) {
        mostrarError("Por favor, seleccione un negocio primero.");
        return null;
    }
    console.log(`Buscando código '${codigo}' en NEGOCIO_ID: ${NEGOCIO_ACTIVO_ID}`); 
    try {
        // Usamos fetchWithAuth para simplificar
        return await fetchWithAuth(`/api/negocios/${NEGOCIO_ACTIVO_ID}/productos/por_codigo?codigo=${encodeURIComponent(codigo)}`);
    } catch (error) {
        console.error("Error buscando producto:", error);
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
        // Usamos fetchWithAuth
        return await fetchWithAuth(`/api/inventario/ajustar`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (error) {
         console.error("Error ajustando stock:", error);
        mostrarError(error.message);
        return null;
    }
}

// --- Funciones UI ---
function mostrarError(mensaje) { /* ... (sin cambios) ... */ }
function mostrarInfoProducto(producto) { /* ... (sin cambios) ... */ }

function resetUI() {
    productInfoDiv.classList.add('hidden');
    manualCodeInput.value = ''; // Limpia campo manual
    // Muestra/oculta controles según si hay negocio activo
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
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
         html5QrcodeScanner.clear().catch(err => console.warn("Error al limpiar en resetUI", err));
    }
    // No reinicia el escáner automáticamente aquí
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) {
     console.log(`Código escaneado: ${decodedText}`);
     statusElement.textContent = `Código detectado: ${decodedText}. Buscando...`;
     manualCodeInput.value = decodedText; // ✨ Pone el código en el input manual

     if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
         html5QrcodeScanner.clear().catch(error => console.error("Fallo al limpiar el escáner.", error));
     } 
     
     // Llama a la función que busca (igual que la búsqueda manual)
     buscarYMostrarProducto(decodedText); 
}
function onScanFailure(error) { /* ... (sin cambios) ... */ }

function iniciarScanner() {
    if (!NEGOCIO_ACTIVO_ID) {
        mostrarError("Seleccione un negocio antes de iniciar el escáner.");
        return;
    }
    console.log("iniciarScanner called with html5-qrcode");
    statusElement.textContent = 'Iniciando cámara...';
    btnStartScanner.classList.add('hidden');
    qrReaderDiv.classList.remove('hidden'); 
    productInfoDiv.classList.add('hidden'); 

    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) { /* ... limpiar ... */ }

    try {
        const formatsToSupport = [ /* ... (lista de formatos) ... */ ];
        html5QrcodeScanner = new Html5QrcodeScanner( /* ... configuración ... */ );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        statusElement.textContent = 'Listo para escanear.';
    } catch (error) { /* ... (manejo de errores) ... */ }
}

// ✨ --- NUEVA FUNCIÓN PARA BUSCAR Y MOSTRAR --- ✨
// Reutiliza la lógica de búsqueda tanto para escaneo como manual
async function buscarYMostrarProducto(codigo) {
    if (!codigo) {
        mostrarError("Ingrese un código para buscar.");
        return;
    }
    statusElement.textContent = `Buscando código: ${codigo}...`;
    const producto = await buscarProductoPorCodigo(codigo);
    if (producto) {
        navigator.vibrate(50); // Vibración más corta
        mostrarInfoProducto(producto);
    } else {
        // El error ya lo muestra buscarProductoPorCodigo
        statusElement.textContent = 'Intente escanear o ingrese otro código.';
    }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // ✨ --- CARGA DE NEGOCIOS AL INICIO --- ✨
    try {
        const negocios = await fetchWithAuth('/api/negocios'); // Llama a la API de negocios
        negocioSelector.innerHTML = '<option value="">-- Seleccione Negocio --</option>';
        negocios.forEach(n => {
            negocioSelector.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
        });
        // Intenta preseleccionar el guardado en localStorage si existe
        const savedNegocioId = localStorage.getItem('negocioActivoId');
        if (savedNegocioId && negocios.some(n => n.id == savedNegocioId)) {
            negocioSelector.value = savedNegocioId;
            NEGOCIO_ACTIVO_ID = savedNegocioId;
            // Habilita controles ahora que hay un negocio
            btnStartScanner.classList.remove('hidden'); 
            statusElement.textContent = 'Apunte la cámara o ingrese el código manualmente.';
        } else {
             statusElement.textContent = 'Seleccione un negocio para empezar.';
        }
    } catch (error) {
        mostrarError("Error al cargar negocios: " + error.message);
        negocioSelector.innerHTML = '<option value="">Error al cargar</option>';
        statusElement.textContent = 'Error al cargar negocios.';
    }

    // Listener para el cambio de negocio
    negocioSelector.addEventListener('change', (e) => {
        NEGOCIO_ACTIVO_ID = e.target.value;
        localStorage.setItem('negocioActivoId', NEGOCIO_ACTIVO_ID); // Guarda la selección
        resetUI(); // Resetea la UI para mostrar/ocultar botones
        console.log("Negocio activo cambiado a ID:", NEGOCIO_ACTIVO_ID);
    });

    // Listener para el botón de búsqueda manual
    btnBuscarManual.addEventListener('click', () => {
        buscarYMostrarProducto(manualCodeInput.value);
    });
    
    // Listener para Enter en el campo manual
     manualCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evita que se envíe algún formulario
            buscarYMostrarProducto(manualCodeInput.value);
        }
    });

    // Listener para iniciar scanner (se mantiene)
    btnStartScanner.addEventListener('click', iniciarScanner);
    
    // Listeners para ajustar/cancelar (se mantienen)
    btnAjustar.addEventListener('click', async () => { /* ... (lógica ajuste stock) ... */ });
    btnCancelar.addEventListener('click', resetUI);

    // Estado inicial de la UI
    if (qrReaderDiv) qrReaderDiv.classList.add('hidden'); 
    if (productInfoDiv) productInfoDiv.classList.add('hidden');
    // El botón de scanner se mostrará solo si se carga un negocio
    if (!NEGOCIO_ACTIVO_ID && btnStartScanner) btnStartScanner.classList.add('hidden'); 

    console.log("DOM Cargado. Esperando selección de negocio.");
});