// app/static/js/modules/historial_pagos_proveedores.js
import { fetchData } from '../api.js';
import { appState } from '../main.js'; // Necesitamos negocioActivoId
import { mostrarNotificacion } from './notifications.js';

// --- Elementos del DOM ---
let tablaBodyHistorialPagos, filtroProveedorSelectPagos;

// --- Helpers ---
const formatCurrency = (value) => {
    const numberValue = Number(value);
    return isNaN(numberValue) ? '$ 0.00' : numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        // Ajustar opciones para formato deseado (ej. sin hora si prefieres)
        return new Date(dateString).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString; 
    }
};

// --- Funciones de Renderizado ---

/** Renderiza la tabla del historial de pagos */
function renderizarHistorialPagos(pagos) {
    if (!tablaBodyHistorialPagos) return;
    tablaBodyHistorialPagos.innerHTML = ''; // Limpiar

    if (!pagos || pagos.length === 0) {
        tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay pagos registrados para mostrar.</td></tr>';
        return;
    }

    pagos.forEach(pago => {
        const row = document.createElement('tr');
        // Asegurarse de que las columnas coincidan con el HTML
        row.innerHTML = `
            <td>${formatDate(pago.fecha)}</td>
            <td>${pago.proveedor_nombre || 'N/A'}</td>
            <td>${formatCurrency(pago.monto_total)}</td>
            <td>${pago.metodo_pago || '-'}</td>
            <td>${pago.referencia || '-'}</td>
            <!--<td>${pago.usuario_nombre || '-'}</td> Opcional -->
            <!--<td><button class="btn btn-info btn-sm" data-id="${pago.id}">Detalles</button></td> Opcional -->
        `;
        tablaBodyHistorialPagos.appendChild(row);
    });
}

// --- Lógica Principal ---

/** Carga el historial de pagos desde la API, aplicando filtros */
async function cargarHistorialPagos() {
    if (!appState.negocioActivoId) {
         if (tablaBodyHistorialPagos) tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
         return;
    }
    
    // Construir URL con filtro de proveedor si está seleccionado
    let url = `/api/negocios/${appState.negocioActivoId}/pagos-proveedores`;
    const proveedorIdSeleccionado = filtroProveedorSelectPagos.value;
    
    // Usar filtro del dropdown O el filtro pasado por URL (appState)
    const proveedorIdFinal = proveedorIdSeleccionado || appState.filtroProveedorId; 
    
    if (proveedorIdFinal) {
        url += `?proveedor_id=${proveedorIdFinal}`;
        // Si usamos el filtro de appState, lo seleccionamos en el dropdown
        if (!proveedorIdSeleccionado && appState.filtroProveedorId) {
            filtroProveedorSelectPagos.value = appState.filtroProveedorId;
        }
    }
    appState.filtroProveedorId = null; // Limpiar filtro temporal después de usarlo

    try {
        const pagos = await fetchData(url);
        renderizarHistorialPagos(pagos);
    } catch (error) {
        mostrarNotificacion('Error al cargar el historial de pagos.', 'error');
        console.error("Error cargando historial pagos:", error);
        if (tablaBodyHistorialPagos) tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar historial.</td></tr>';
    }
}

/** Llena el selector de proveedores para el filtro */
async function poblarFiltroProveedoresPagos() {
    if (!filtroProveedorSelectPagos) return;
    filtroProveedorSelectPagos.innerHTML = '<option value="">-- Todos --</option>'; 
    
    // Asegurarse de tener negocio activo
    if (!appState.negocioActivoId) return; 

    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedores.forEach(p => {
            filtroProveedorSelectPagos.appendChild(new Option(p.nombre, p.id));
        });
        // Si había un filtro previo (pasado por hash), lo seleccionamos
        if (appState.filtroProveedorId) {
             filtroProveedorSelectPagos.value = appState.filtroProveedorId;
        }

    } catch (error) {
        console.error("Error poblando filtro proveedores para pagos:", error);
    }
}

// --- Inicialización del Módulo ---
export function inicializarLogicaHistorialPagosProveedores() { 
    console.log("Inicializando módulo Historial de Pagos a Proveedores...");

    tablaBodyHistorialPagos = document.querySelector('#tabla-historial-pagos tbody');
    filtroProveedorSelectPagos = document.getElementById('filtro-proveedor-pagos');

    if (!tablaBodyHistorialPagos || !filtroProveedorSelectPagos) {
        console.error("Error crítico: Faltan elementos HTML en historial_pagos_proveedores.html");
        mostrarNotificacion("Error al cargar la página de historial de pagos.", "error");
        return;
    }

    // Leer ID de proveedor desde query params (si venimos del botón 'Pagos')
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const proveedorIdFromUrl = urlParams.get('proveedor');
    if (proveedorIdFromUrl) {
         console.log(`Proveedor ID ${proveedorIdFromUrl} recibido desde URL para historial pagos.`);
         // Guardar temporalmente para usarlo en cargarHistorialPagos y poblarFiltro
         appState.filtroProveedorId = proveedorIdFromUrl; 
    } else {
         appState.filtroProveedorId = null; 
    }

    // Limpiar listeners anteriores
    filtroProveedorSelectPagos.removeEventListener('change', cargarHistorialPagos); 
    // Añadir listener para el filtro
    filtroProveedorSelectPagos.addEventListener('change', cargarHistorialPagos);

    // Carga inicial: poblar filtro y LUEGO cargar historial
    poblarFiltroProveedoresPagos().then(() => {
         cargarHistorialPagos(); 
    }); 
}
