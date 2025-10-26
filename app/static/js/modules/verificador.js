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
        // --- ¡ARREGLO N°1! ---
        // Nos aseguramos que item.precios exista antes de buscar (find)
        if (listaIdParaTotal && item.precios && Array.isArray(item.precios)) {
            const precioEncontrado = item.precios.find(p => p.lista_id == listaIdParaTotal);
            if (precioEncontrado && precioEncontrado.valor !== null) {
                precioParaTotal = precioEncontrado.valor;
            }
        }
        totalCalculado += precioParaTotal;

        // --- HTML para la tarjeta del item ---
        let preciosHtml = '<ul style="padding-left: 20px; margin-top: 5px;">';
        
        // --- ¡ARREGLO N°2! (El que arregla el error 'precios.forEach') ---
        // Verificamos que item.precios exista y sea un array antes de recorrerlo
        if (item.precios && Array.isArray(item.precios)) {
            item.precios.forEach(p => {
                const valorDisplay = (p.valor !== null) ? formatCurrency(p.valor) : '(Sin precio)';
                preciosHtml += `<li><b>${p.nombre_lista}: ${valorDisplay}</b> (Regla: ${p.regla_aplicada || 'N/A'})</li>`;
            });
        } else {
            // Si no hay precios, mostramos un mensaje
            preciosHtml += '<li>(Este producto no tiene precios definidos)</li>';
        }
        preciosHtml += '</ul>';

        // Usé clases genéricas, podés adaptarlas a tu framework (Bootstrap, etc.)
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
    
    // --- ¡ARREGLO N°3! (El que arregla el error 'precios.forEach') ---
    // Si 'precios' es undefined o no es un array, no hacemos nada.
    if (!precios || !Array.isArray(precios)) {
        console.warn("actualizarListasDePrecio fue llamado sin un array de precios.");
        return; 
    }
    // --- FIN DEL ARREGLO ---

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
}

/**
 * Callback de éxito para el scanner
 */
async function onScanSuccess(decodedText, decodedResult) {
    const elScanStatus = document.getElementById('scan-status-verificador');
    elScanStatus.textContent = "Buscando producto...";
    
    try {
        // Usamos el helper 'fetchData' y el 'appState'
        const producto = await fetchData(
            `/api/negocios/${appState.negocioActivoId}/mobile/check-producto/${decodedText}`
        );
        
        // ¡Importante! 'producto.precios' puede ser undefined si la API no lo devuelve.
        // Las funciones de abajo (actualizarListasDePrecio, renderizarLista)
        // ya están "blindadas" gracias a los arreglos N°1, 2 y 3.
        
        itemsEscaneados.push(producto);
        
        // Actualizamos la UI
        actualizarListasDePrecio(producto.precios); // Esto ahora es seguro
        renderizarLista(); // Esto ahora es seguro
        elScanStatus.textContent = `✅ "${producto.descripcion}" agregado.`;

    } catch (error) {
        // Usamos el helper 'mostrarNotificacion'
        mostrarNotificacion(error.message, 'error');
        elScanStatus.textContent = `❌ Error: ${error.message}`;
    }
    
    setTimeout(() => {
        // Validamos que el scanner exista y esté en estado "SCANNING" (2)
        if (html5QrcodeScanner && html5QrcodeScanner.getState() === 2) { 
           elScanStatus.textContent = "Apuntá la cámara al código de barras...";
        }
    }, 2000);
}

/**
 * Función de inicialización principal (EXPORTADA)
 */
export function inicializarLogicaVerificador() {
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
    // Reseteamos el select por si quedó con datos de la carga anterior
    selectLista.innerHTML = '<option value="">(Elija lista)</option>';


    // 2. Asignamos Eventos
    btnLimpiar.addEventListener('click', limpiarLecturas);
    selectLista.addEventListener('change', renderizarLista); // Recalcula si cambia el select

    // 3. Inicializar el Scanner
    // Verificamos si ya existe una instancia para no duplicarla
    // Y nos aseguramos de que no esté ya renderizado (estado 1 o 2)
    if (!html5QrcodeScanner || html5QrcodeScanner.getState() === 1 /* NOT_STARTED */ ) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader-verificador", // ID del div
            { fps: 10, qrbox: { width: 250, height: 150 } }, // Ajuste de tamaño
            false // verbose
        );
    }
    
    // Iniciamos el render del scanner
    // (Asegúrate de que la biblioteca Html5Qrcode esté cargada globalmente)
    try {
        // Solo renderizamos si no está ya escaneando
        if (html5QrcodeScanner.getState() !== 2 /* SCANNING */) {
            html5QrcodeScanner.render(onScanSuccess);
        }
    } catch (e) {
        console.error("Error al iniciar el scanner:", e);
        mostrarNotificacion("No se pudo iniciar la cámara. Verifique los permisos.", "error");
    }

    // 4. Render inicial
    renderizarLista();
}
