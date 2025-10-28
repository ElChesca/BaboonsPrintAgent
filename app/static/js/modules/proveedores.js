// app/static/js/modules/proveedores.js
import { fetchData } from '../api.js';
import { appState, loadContent } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
// Asegúrate de que XLSX esté disponible globalmente (cargado en index.html)

// --- Elementos del DOM ---
let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
let proveedoresCache = [];
// Modal Cta Cte
let modalCtaCte, closeModalCtaCte, tituloModalCtaCte, proveedorIdInputCtaCte,
    fechaDesdeInputCtaCte, fechaHastaInputCtaCte, btnGenerarCtaCte,
    reporteContainerCtaCte, btnImprimirCtaCte, btnExportarCtaCte;

// --- Helpers ---
const formatCurrency = (value, showSign = true) => {
    const numberValue = Number(value);
    if (isNaN(numberValue)) return showSign ? '$ 0.00' : '0.00';
    const options = { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    let formatted = numberValue.toLocaleString('es-AR', options);
    if (!showSign) {
        formatted = formatted.replace(/[ARS$\s]/g, '').trim();
    }
    return formatted;
};
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        if(includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return date.toLocaleString('es-AR', options);
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString;
     }
};

// --- Carga y Renderizado Tabla Principal ---
async function cargarProveedores() {
    if (!appState.negocioActivoId) {
        mostrarNotificacion('Seleccione un negocio activo.', 'warning');
        const tbody = document.querySelector('#tabla-proveedores tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
        return;
    }
    try {
        proveedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los proveedores.', 'error');
        console.error("Error cargando proveedores:", error);
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-proveedores tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!proveedoresCache || proveedoresCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay proveedores para mostrar.</td></tr>';
        return;
    }
    proveedoresCache.forEach(p => {
        tbody.innerHTML += `
            <tr data-proveedor-id="${p.id}" data-proveedor-nombre="${p.nombre || ''}">
                <td>${p.nombre || 'Sin Nombre'}</td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${formatCurrency(p.saldo_cta_cte)}</td>
                <td>
                    <button class="btn btn-warning btn-sm btn-cta-cte" data-id="${p.id}" title="Ver Cuenta Corriente">Cta. Cte.</button>
                    <button class="btn btn-info btn-sm btn-ver-ingresos" data-id="${p.id}" title="Ver Ingresos">Ingresos</button>
                    <button class="btn btn-success btn-sm btn-ver-pagos" data-id="${p.id}" title="Ver Pagos">Pagos</button>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${p.id}" title="Editar">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${p.id}" title="Borrar">Borrar</button>
                </td>
            </tr>
        `;
    });
}

// --- Lógica Formulario Proveedor ---
function resetFormulario() { /* ... sin cambios ... */ }
async function guardarProveedor(e) { /* ... sin cambios ... */ }
function editarProveedor(id) { /* ... sin cambios ... */ }
// SÍ exportamos borrarProveedor aquí
export async function borrarProveedor(id) { /* ... sin cambios ... */ }


// --- Lógica Cuenta Corriente ---
function abrirModalCtaCte(proveedorId) { /* ... sin cambios ... */ }
async function generarReporteCtaCte() { /* ... sin cambios ... */ }
function imprimirReporteCtaCte() { /* ... sin cambios ... */ }
function exportarReporteCtaCteExcel() { /* ... sin cambios ... */ }


// --- Lógica de Inicialización ---
function handleTablaClick(e) { /* ... sin cambios ... */ }
function closeModalCtaCteHandler() { /* ... sin cambios ... */ }

export function inicializarLogicaProveedores() { /* ... sin cambios ... */ }
