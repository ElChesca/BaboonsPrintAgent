// app/static/js/modules/verificador.js
// Importamos los helpers compartidos
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// --- Estado del Módulo ---
let itemsEscaneados = [];
let listasDePrecioDisponibles = new Map(); // Para el <select>
let html5QrcodeScanner; // Guardamos la instancia del scanner

// --- Helpers Específicos ---
const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

/**
 * Renderiza la lista de items escaneados y calcula el total
 * basándose en la lista de precios seleccionada.
 */
function renderizarLista() {
    const elListaItems = document.getElementById('lista-items-verificador');
    const elTotalMonto = document.getElementById('total-monto-verificador');
    const elSelectListaTotal = document.getElementById('lista-precio-total-verificador');

    if (!elListaItems || !elTotalMonto || !elSelectListaTotal) return;

    elListaItems.innerHTML = '';
    let totalCalculado = 0;
    const listaIdParaTotal = elSelectListaTotal.value;

    itemsEscaneados.forEach(item => {
        let precioParaTotal = 0;
        
        // Buscamos el precio correspondiente a la lista seleccionada
        if (listaIdParaTotal && item.precios && Array.isArray(item.precios)) {
            const precioEncontrado = item.precios.find(p => p.lista_id == listaIdParaTotal);
            if (precioEncontrado && precioEncontrado.valor !== null) {
                precioParaTotal = precioEncontrado.valor;
            }
        }
        totalCalculado += precioParaTotal;

        // --- HTML para la tarjeta del item ---
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

        const itemHtml = `
            <div class="card" style="margin-bottom: 10px;">
                <div class="card-body">
                    <h5 class="card-title">${item.descripcion}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">Stock: ${item.stock_actual}</h6>
                    <div class="item-precios">${preciosHtml}</div>
                </div>
            </div>
        `;
        elListaItems.innerHTML += itemHtml;
    });

    elTotalMonto.textContent = formatCurrency(totalCalculado);
}

/**
 * Actualiza el <select> con las listas de precios encontradas
 */
function actualizarListasDePrecio(precios) {
    const elSelectListaTotal = document.getElementById('lista-precio-total-verificador');
    if (!elSelectListaTotal) return;
    
    if (!precios || !Array.isArray(precios)) {
        console.warn("actualizarListasDePrecio fue llamado sin un array de precios.");
        return; 
    }

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

/**
 * Limpia el estado y la UI
 */
function limpiarLecturas() {
    itemsEscaneados = [];
    renderizarLista();
    const elScanStatus = document.getElementById('scan-status-verificador');
    if (elScanStatus) {
        elScanStatus.textContent = "Lecturas limpiadas. Listo para escanear.";
    }
    // Opcional: Podríamos detener y reiniciar el scanner aquí si fuera necesario
    // if (html5QrcodeScanner) {
    //     html5QrcodeScanner.clear().catch(err => console.error("Error al limpiar scanner:", err));
    //     inicializarLogicaVerificador(); // O una función más específica para reiniciar
    // }
}

/**
 * Callback de éxito para el scanner
 */
async function onScanSuccess(decodedText, decodedResult) {
    const elScanStatus = document.getElementById('scan-status-verificador');
    elScanStatus.textContent = "Buscando producto...";
    
    try {
        const producto = await fetchData(
            `/api/negocios/${appState.negocioActivoId}/mobile/check-producto/${decodedText}`
        );
        
        itemsEscaneados.push(producto);
        
        actualizarListasDePrecio(producto.precios); 
        renderizarLista(); 
        elScanStatus.textContent = `✅ "${producto.descripcion}" agregado.`;

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
        elScanStatus.textContent = `❌ Error: ${error.message}`;
    }
    
    // Dejamos el mensaje por más tiempo para que el usuario lo vea
    setTimeout(() => {
        const currentStatus = document.getElementById('scan-status-verificador');
        // Solo volvemos a "Apuntá..." si no hubo otro escaneo o error mientras tanto
        if (currentStatus && currentStatus.textContent.startsWith('✅') || currentStatus.textContent.startsWith('❌')) {
             currentStatus.textContent = "Apuntá la cámara al código de barras...";
        }
    }, 3000); // 3 segundos
}

/**
 * Función de inicialización principal (EXPORTADA)
 */
export function inicializarLogicaVerificador() {
    console.log("Inicializando Verificador..."); // Log para depurar
    // Reseteamos el estado por si se está re-cargando
    itemsEscaneados = [];
    listasDePrecioDisponibles = new Map();

    // 1. Buscamos los elementos del DOM
    const btnLimpiar = document.getElementById('btn-limpiar-verificador');
    const selectLista = document.getElementById('lista-precio-total-verificador');
    const readerElement = document.getElementById('reader-verificador');

    if (!btnLimpiar || !selectLista || !readerElement) {
        console.error("Faltan elementos esenciales en 'verificador.html' para inicializar el scanner.");
        mostrarNotificacion("Error de página: Faltan componentes del verificador.", "error");
        return;
    }
    
    // --- LIMPIEZA ADICIONAL ---
    selectLista.innerHTML = '<option value="">(Elija lista)</option>';


    // 2. Asignamos Eventos
    btnLimpiar.addEventListener('click', limpiarLecturas);
    selectLista.addEventListener('change', renderizarLista); 

    // 3. Inicializar el Scanner
    
    // --- CAMBIO AQUÍ: Simplificamos la inicialización ---
    // Si ya existe una instancia Y ESTÁ ESCANEANDO, no hacemos nada más.
    // Esto evita que se intente renderizar múltiples veces si el usuario navega rápido.
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
         console.log("Scanner ya estaba activo.");
         renderizarLista(); // Aseguramos que la lista se muestre vacía
         // Ponemos el mensaje inicial por si acaso
         const elScanStatus = document.getElementById('scan-status-verificador');
         if(elScanStatus) elScanStatus.textContent = "Apuntá la cámara al código de barras...";
         return; 
    }

    // Si no existe o no estaba escaneando, creamos una NUEVA instancia.
    // Esto es importante porque clear() destruye la instancia anterior.
    // Aseguramos limpiar cualquier instancia previa por si quedó "colgada"
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Error al limpiar scanner previo:", err));
    }

    console.log("Creando nueva instancia de Html5QrcodeScanner...");
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader-verificador", 
        { 
            fps: 10, 
            qrbox: { width: 250, height: 150 },
            // Intentamos usar la cámara trasera por defecto
            facingMode: "environment" 
        },
        /* verbose= */ false 
    );
        
    // Iniciamos el render del scanner
    try {
        console.log("Llamando a html5QrcodeScanner.render()...");
        html5QrcodeScanner.render(onScanSuccess, (errorMessage) => {
             // Función opcional para manejar errores DURANTE el escaneo
             // console.warn(`QR error = ${errorMessage}`); 
        });
        console.log("html5QrcodeScanner.render() llamado con éxito.");
        // Agregamos una propiedad para saber si está escaneando
        html5QrcodeScanner.isScanning = true; 
    } catch (e) {
        console.error("Error al iniciar el scanner:", e);
        mostrarNotificacion("No se pudo iniciar la cámara. Verifique los permisos.", "error");
        // Aseguramos que isScanning quede en false si falla
        if(html5QrcodeScanner) html5QrcodeScanner.isScanning = false;
    }

    // 4. Render inicial
    renderizarLista();
}

// --- Limpieza al salir del módulo ---
// Esto es importante para detener la cámara cuando el usuario navega a otra sección.
// Necesitaríamos una forma de detectar cuándo se "descarga" el módulo.
// Por ahora, asumimos que 'inicializarLogicaVerificador' se llama cada vez que entra.
// El código actual ya detiene el scanner anterior al crear uno nuevo.

