// app/static/js/modules/historial_ingresos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js'; // Necesitamos negocioActivoId y filtroProveedorId
import { mostrarNotificacion } from './notifications.js';

// --- Elementos del DOM ---
let tablaBody, modalDetalles, closeModalBtn, contenidoModal, filtroProveedorSelect;

// --- Helpers ---
const formatCurrency = (value) => {
    const numberValue = Number(value);
    return isNaN(numberValue) ? '$ 0.00' : numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Asume que la fecha viene en formato ISO o similar que JS pueda parsear
    try {
        return new Date(dateString).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString; // Devolver original si falla
    }
};

// Formatea el número de factura
const formatFacturaNro = (tipo, prefijo, numero) => {
    if (!prefijo || !numero) return '-';
    return `${tipo || 'FC'} ${prefijo}-${numero}`;
};

// Devuelve una clase CSS basada en el estado
const getEstadoBadgeClass = (estado) => {
    switch (estado) {
        case 'pagada': return 'status-pagada'; // Necesitarás definir esta clase en global.css
        case 'parcial': return 'status-parcial'; // Necesitarás definir esta clase
        case 'pendiente': return 'status-pendiente'; // Ya la tienes?
        default: return '';
    }
};


// --- Funciones de Renderizado ---

/** Renderiza la tabla del historial de ingresos */
function renderizarHistorial(ingresos) {
    if (!tablaBody) return;
    tablaBody.innerHTML = ''; // Limpiar

    if (!ingresos || ingresos.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay ingresos para mostrar con los filtros seleccionados.</td></tr>';
        return;
    }

    ingresos.forEach(ingreso => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(ingreso.fecha)}</td>
            <td>${ingreso.proveedor_nombre || 'N/A'}</td>
            <td>${formatFacturaNro(ingreso.factura_tipo, ingreso.factura_prefijo, ingreso.factura_numero)}</td>
            <td>${ingreso.referencia || '-'}</td>
            <td>${formatCurrency(ingreso.total_factura)}</td>
            <td>${formatCurrency(ingreso.monto_pagado)}</td>
            <td>${formatCurrency(ingreso.saldo_pendiente)}</td>
            <td><span class="status-badge ${getEstadoBadgeClass(ingreso.estado_pago)}">${ingreso.estado_pago || 'pendiente'}</span></td>
            <td><button class="btn btn-info btn-sm btn-ver-detalles" data-id="${ingreso.id}">Ver</button></td>
        `;
        tablaBody.appendChild(row);
    });
}

/** Carga y muestra los detalles de un ingreso en el modal */
export async function mostrarDetalle(ingresoId) { // Mantenemos export por si se llama desde main.js
    if (!modalDetalles || !contenidoModal) return;
    contenidoModal.innerHTML = '<p>Cargando detalles...</p>';
    modalDetalles.style.display = 'flex';

    try {
        const detalles = await fetchData(`/api/ingresos/${ingresoId}/detalles`);
        if (!detalles || detalles.length === 0) {
            contenidoModal.innerHTML = '<p>Este ingreso no tiene detalles registrados.</p>';
            return;
        }

        let tablaHtml = `
            <table class="tabla-bonita" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Costo Unit.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        let totalCalculado = 0;
        detalles.forEach(d => {
            const cantidad = Number(d.cantidad) || 0;
            const costoUnit = d.precio_costo_unitario !== null ? Number(d.precio_costo_unitario) : 0;
            const subtotal = cantidad * costoUnit;
            totalCalculado += subtotal;
            tablaHtml += `
                <tr>
                    <td>${d.nombre || 'Producto desconocido'}</td>
                    <td>${cantidad}</td>
                    <td>${d.precio_costo_unitario !== null ? formatCurrency(costoUnit) : '-'}</td>
                    <td>${formatCurrency(subtotal)}</td>
                </tr>
            `;
        });
        tablaHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" style="text-align: right;">Total Items:</th>
                        <th>${formatCurrency(totalCalculado)}</th>
                    </tr>
                </tfoot>
            </table>
        `;
        contenidoModal.innerHTML = tablaHtml;

    } catch (error) {
        mostrarNotificacion('Error al cargar los detalles del ingreso.', 'error');
        console.error("Error mostrando detalle ingreso:", error);
        contenidoModal.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

// --- Lógica Principal ---

/** Carga el historial de ingresos desde la API, aplicando filtros */
async function cargarHistorial() {
    if (!appState.negocioActivoId) {
         if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
         return;
    }
    
    // --- NUEVO: Construir URL con filtro ---
    let url = `/api/negocios/${appState.negocioActivoId}/ingresos`;
    const proveedorIdSeleccionado = filtroProveedorSelect.value;
    if (proveedorIdSeleccionado) {
        url += `?proveedor_id=${proveedorIdSeleccionado}`;
        // Si venimos de la navegación por hash, usamos appState.filtroProveedorId
    } else if (appState.filtroProveedorId) {
         url += `?proveedor_id=${appState.filtroProveedorId}`;
         // Seleccionamos el proveedor en el dropdown si encontramos el ID
         filtroProveedorSelect.value = appState.filtroProveedorId;
         appState.filtroProveedorId = null; // Limpiamos el filtro temporal
    }


    try {
        const ingresos = await fetchData(url);
        renderizarHistorial(ingresos);
    } catch (error) {
        mostrarNotificacion('Error al cargar el historial de ingresos.', 'error');
        console.error("Error cargando historial ingresos:", error);
        if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error al cargar historial.</td></tr>';
    }
}

/** Llena el selector de proveedores para el filtro */
async function poblarFiltroProveedores() {
    if (!filtroProveedorSelect) return;
    filtroProveedorSelect.innerHTML = '<option value="">-- Todos --</option>'; // Opción por defecto
    
    // Reutilizar proveedores si ya se cargaron en otro módulo? O cargar de nuevo?
    // Por simplicidad, cargamos de nuevo. Podría optimizarse.
    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedores.forEach(p => {
            filtroProveedorSelect.appendChild(new Option(p.nombre, p.id));
        });
        // Si había un filtro previo (pasado por hash), lo seleccionamos
        if (appState.filtroProveedorId) {
             filtroProveedorSelect.value = appState.filtroProveedorId;
        }

    } catch (error) {
        console.error("Error poblando filtro proveedores:", error);
        // No mostramos notif aquí, el filtro sigue usable con "Todos"
    }
}

// --- Inicialización del Módulo ---
export function inicializarLogicaHistorial() { // Renombramos aquí si es necesario
    console.log("Inicializando módulo Historial de Ingresos...");

    tablaBody = document.querySelector('#tabla-historial-ingresos tbody');
    modalDetalles = document.getElementById('modal-detalles-ingreso');
    closeModalBtn = document.getElementById('close-detalles-ingreso');
    contenidoModal = document.getElementById('contenido-detalles-ingreso');
    filtroProveedorSelect = document.getElementById('filtro-proveedor-ingresos');

    if (!tablaBody || !modalDetalles || !closeModalBtn || !contenidoModal || !filtroProveedorSelect) {
        console.error("Error crítico: Faltan elementos HTML en historial_ingresos.html");
        mostrarNotificacion("Error al cargar la página de historial.", "error");
        return;
    }

    // --- NUEVO: Leer ID de proveedor desde query params ---
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const proveedorIdFromUrl = urlParams.get('proveedor');
    if (proveedorIdFromUrl) {
         console.log(`Proveedor ID ${proveedorIdFromUrl} recibido desde URL.`);
         appState.filtroProveedorId = proveedorIdFromUrl; // Guardar temporalmente
    } else {
         appState.filtroProveedorId = null; // Asegurar que no quede filtro viejo
    }
    // --- FIN NUEVO ---


    // Limpiar listeners anteriores
    tablaBody.removeEventListener('click', handleTablaClick);
    closeModalBtn.removeEventListener('click', () => modalDetalles.style.display = 'none');
    filtroProveedorSelect.removeEventListener('change', cargarHistorial); // Listener para el filtro

    // Añadir listeners
    tablaBody.addEventListener('click', handleTablaClick);
    closeModalBtn.addEventListener('click', () => modalDetalles.style.display = 'none');
    filtroProveedorSelect.addEventListener('change', cargarHistorial);

    // Carga inicial
    poblarFiltroProveedores().then(() => {
         cargarHistorial(); // Cargar historial después de poblar filtro
    }); 
}

// --- Handler para clicks en la tabla ---
function handleTablaClick(event) {
    if (event.target.classList.contains('btn-ver-detalles')) {
        const ingresoId = event.target.dataset.id;
        if (ingresoId) {
            mostrarDetalle(ingresoId);
        }
    }
    // Podrías añadir lógica aquí para otros botones si los hubiera
}

// Asegurarse de exportar la función de inicialización con el nombre correcto
export { inicializarLogicaHistorial as inicializarLogicaHistorialIngresos }; 
