// app/static/js/modules/proveedores.js
import { fetchData } from '../api.js';
import { appState, loadContent } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
// Asegúrate de que XLSX esté disponible globalmente (cargado en index.html)

let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
let proveedoresCache = [];

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
function resetFormulario() {
    if (!form) return;
    if(tituloForm) tituloForm.textContent = 'Añadir Nuevo Proveedor';
    form.reset();
    if(idInput) idInput.value = '';
    if(btnCancelar) btnCancelar.style.display = 'none';
}
async function guardarProveedor(e) {
    e.preventDefault();
    if (!nombreInput || !contactoInput || !telefonoInput || !emailInput || !idInput) return;
    const id = idInput.value;
    const data = {
        nombre: nombreInput.value.trim(),
        contacto: contactoInput.value.trim(),
        telefono: telefonoInput.value.trim(),
        email: emailInput.value.trim()
    };
    if (!data.nombre) return mostrarNotificacion('El nombre es obligatorio.', 'warning');

    const esEdicion = !!id;
    const url = esEdicion ? `/api/proveedores/${id}` : `/api/negocios/${appState.negocioActivoId}/proveedores`;
    const method = esEdicion ? 'PUT' : 'POST';
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Guardando...'; }
    try {
        await fetchData(url, { method, body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
        mostrarNotificacion(`Proveedor ${esEdicion ? 'actualizado' : 'creado'}.`, 'success');
        resetFormulario();
        await cargarProveedores();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al guardar.', 'error');
    } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Guardar'; }
    }
}
// Ya no se exporta
function editarProveedor(id) {
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar || !form) return;
    const proveedor = proveedoresCache.find(p => p.id === id);
    if (!proveedor) return mostrarNotificacion('Proveedor no encontrado.', 'error');
    tituloForm.textContent = 'Editar Proveedor';
    idInput.value = proveedor.id;
    nombreInput.value = proveedor.nombre || '';
    contactoInput.value = proveedor.contacto || '';
    telefonoInput.value = proveedor.telefono || '';
    emailInput.value = proveedor.email || '';
    btnCancelar.style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Sí se exporta
export async function borrarProveedor(id) {
    if (!confirm(`¿Seguro de eliminar proveedor ID ${id}?`)) return;
    try {
        await fetchData(`/api/proveedores/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Proveedor eliminado.', 'success');
        await cargarProveedores();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al eliminar.', 'error');
        console.error(`Error borrando proveedor (ID: ${id}):`, error);
    }
}


// --- Lógica Cuenta Corriente ---
function abrirModalCtaCte(proveedorId) {
    const filaProveedor = document.querySelector(`#tabla-proveedores tbody tr[data-proveedor-id="${proveedorId}"]`);
    const proveedorNombre = filaProveedor ? filaProveedor.dataset.proveedorNombre : `ID ${proveedorId}`;
    if (!modalCtaCte || !tituloModalCtaCte || !proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !reporteContainerCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
        console.error("Faltan elementos HTML del modal Cta Cte.");
        return mostrarNotificacion("Error al abrir reporte Cta Cte.", "error");
    }

    tituloModalCtaCte.textContent = `Cuenta Corriente: ${proveedorNombre}`;
    proveedorIdInputCtaCte.value = proveedorId;
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    try {
      fechaDesdeInputCtaCte.valueAsDate = inicioMes;
      fechaHastaInputCtaCte.valueAsDate = hoy;
    } catch(e) {
      console.error("Error setting default dates:", e);
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      fechaDesdeInputCtaCte.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
      fechaHastaInputCtaCte.value = `${yyyy}-${mm}-${dd}`;
    }
    reporteContainerCtaCte.innerHTML = '<p style="text-align: center;">Seleccione un rango de fechas y presione \'Generar\'.</p>';
    btnImprimirCtaCte.disabled = true;
    btnExportarCtaCte.disabled = true;
    modalCtaCte.style.display = 'flex';
}

async function generarReporteCtaCte() {
     if (!proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !reporteContainerCtaCte || !btnGenerarCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) return;
    const proveedorId = proveedorIdInputCtaCte.value;
    const fechaDesde = fechaDesdeInputCtaCte.value;
    const fechaHasta = fechaHastaInputCtaCte.value;
    if (!proveedorId || !fechaDesde || !fechaHasta) return mostrarNotificacion("Seleccione proveedor y fechas.", "warning");
    if (new Date(fechaDesde) > new Date(fechaHasta)) return mostrarNotificacion("La fecha 'Desde' no puede ser mayor que 'Hasta'.", "warning");

    reporteContainerCtaCte.innerHTML = '<p style="text-align: center;">Generando reporte...</p>';
    btnGenerarCtaCte.disabled = true;
    btnImprimirCtaCte.disabled = true;
    btnExportarCtaCte.disabled = true;

    try {
        const url = `/api/negocios/${appState.negocioActivoId}/proveedores/${proveedorId}/cuenta-corriente?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        const data = await fetchData(url);
        if (!data || !data.movimientos) throw new Error("Respuesta inválida del servidor.");

        let tablaHtml = `<table id="tabla-reporte-cta-cte" class="tabla-bonita" style="margin-top: 15px;"><thead><tr><th>Fecha</th><th>Concepto</th><th>Debe</th><th>Haber</th><th>Saldo</th></tr></thead><tbody>`;
        data.movimientos.forEach(mov => {
            const fechaFormateada = mov.tipo === 'Saldo Anterior' ? formatDate(mov.fecha) : formatDate(mov.fecha, true);
            tablaHtml += `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td>${mov.concepto || mov.tipo}</td>
                    <td style="text-align: right;">${mov.debe !== null ? formatCurrency(mov.debe) : ''}</td>
                    <td style="text-align: right;">${mov.haber !== null ? formatCurrency(mov.haber) : ''}</td>
                    <td style="text-align: right;">${formatCurrency(mov.saldo)}</td>
                </tr>`;
        });
        tablaHtml += `</tbody></table>`;
        tablaHtml += `<p style="text-align: right; margin-top: 10px; font-weight: bold;">Saldo Inicial (${formatDate(data.fecha_desde)}): ${formatCurrency(data.saldo_inicial)} | Saldo Final (${formatDate(data.fecha_hasta)}): ${formatCurrency(data.movimientos[data.movimientos.length - 1]?.saldo ?? data.saldo_inicial)}</p>`;

        reporteContainerCtaCte.innerHTML = tablaHtml;
        btnImprimirCtaCte.disabled = false;
        btnExportarCtaCte.disabled = false;
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al generar reporte.', 'error');
        reporteContainerCtaCte.innerHTML = `<p style="text-align: center; color: red;">Error: ${error.message || 'No se pudo generar.'}</p>`;
    } finally {
        if (btnGenerarCtaCte) btnGenerarCtaCte.disabled = false;
    }
}

function imprimirReporteCtaCte() {
    const reporteNode = document.getElementById('reporte-cta-cte-container');
    const titulo = tituloModalCtaCte ? tituloModalCtaCte.textContent : 'Cuenta Corriente';
    const fechaDesde = fechaDesdeInputCtaCte ? fechaDesdeInputCtaCte.value : '';
    const fechaHasta = fechaHastaInputCtaCte ? fechaHastaInputCtaCte.value : '';
    const periodo = fechaDesde && fechaHasta ? `Período: ${formatDate(fechaDesde)} al ${formatDate(fechaHasta)}` : '';
    if (!reporteNode || reporteNode.children.length === 0 || reporteNode.querySelector('p')?.textContent.startsWith('Seleccione')) return mostrarNotificacion("Genere un reporte para imprimir.", "warning");
    const contenido = reporteNode.innerHTML;
    const printWindow = window.open('', '_blank', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Imprimir Cuenta Corriente</title>');
    printWindow.document.write(`<style>body{font-family:Arial,sans-serif;font-size:10pt}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ccc;padding:4px;text-align:left}th{background-color:#eee;font-weight:bold}td:nth-child(3),td:nth-child(4),td:nth-child(5){text-align:right}p{margin-top:10px}@media print{button{display:none}body{margin:20mm}}</style>`);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>${titulo}</h1><p>${periodo}</p>`);
    printWindow.document.write(contenido);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = function() { printWindow.print(); };
}

function exportarReporteCtaCteExcel() {
    const tabla = document.getElementById('tabla-reporte-cta-cte');
    if (!tabla) return mostrarNotificacion("Genere un reporte para exportar.", "warning");
    if (typeof XLSX === 'undefined') return mostrarNotificacion("Error: Librería XLSX no cargada.", "error");
    try {
        const wb = XLSX.utils.table_to_book(tabla, { sheet: "Cuenta Corriente" });
        const proveedorNombre = (tituloModalCtaCte ? tituloModalCtaCte.textContent : 'Proveedor').replace('Cuenta Corriente: ', '').replace(/[^a-z0-9]/gi, '_');
        const fechaDesde = fechaDesdeInputCtaCte ? fechaDesdeInputCtaCte.value : 'desde';
        const fechaHasta = fechaHastaInputCtaCte ? fechaHastaInputCtaCte.value : 'hasta';
        const filename = `CtaCte_${proveedorNombre}_${fechaDesde}_a_${fechaHasta}.xlsx`;
        XLSX.writeFile(wb, filename);
        mostrarNotificacion("Reporte exportado.", "success");
    } catch (error) {
        mostrarNotificacion("Error al exportar.", "error");
        console.error("Error exportando Cta Cte:", error);
    }
}

// --- Lógica de Inicialización ---
function handleTablaClick(e) {
    const target = e.target;
    const proveedorRow = target.closest('tr');
    const proveedorId = proveedorRow?.dataset.proveedorId;
    if (!proveedorId) return;
    const id = parseInt(proveedorId);
    if (target.classList.contains('btn-edit')) editarProveedor(id);
    else if (target.classList.contains('btn-delete')) borrarProveedor(id);
    else if (target.classList.contains('btn-ver-ingresos')) window.location.hash = `#historial_ingresos?proveedor=${id}`;
    else if (target.classList.contains('btn-ver-pagos')) window.location.hash = `#historial_pagos_proveedores?proveedor=${id}`;
    else if (target.classList.contains('btn-cta-cte')) abrirModalCtaCte(id);
}
function closeModalCtaCteHandler() { if (modalCtaCte) modalCtaCte.style.display = 'none'; }

export function inicializarLogicaProveedores() {
    console.log("Inicializando lógica de proveedores...");
    form = document.getElementById('form-proveedor');
    const tablaBody = document.querySelector('#tabla-proveedores tbody');
    modalCtaCte = document.getElementById('modal-cta-cte');
    closeModalCtaCte = document.getElementById('close-modal-cta-cte');
    tituloModalCtaCte = document.getElementById('modal-cta-cte-titulo');
    proveedorIdInputCtaCte = document.getElementById('cta-cte-proveedor-id');
    fechaDesdeInputCtaCte = document.getElementById('cta-cte-fecha-desde');
    fechaHastaInputCtaCte = document.getElementById('cta-cte-fecha-hasta');
    btnGenerarCtaCte = document.getElementById('btn-generar-cta-cte');
    reporteContainerCtaCte = document.getElementById('reporte-cta-cte-container');
    btnImprimirCtaCte = document.getElementById('btn-imprimir-cta-cte');
    btnExportarCtaCte = document.getElementById('btn-exportar-cta-cte');

    if (!form || !tablaBody || !modalCtaCte || !closeModalCtaCte || !tituloModalCtaCte || !proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !btnGenerarCtaCte || !reporteContainerCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
        console.error("Error Crítico: Faltan elementos HTML en proveedores.html.");
        return mostrarNotificacion("Error al cargar página proveedores.", "error");
    }

    tituloForm = document.getElementById('form-proveedor-titulo');
    idInput = document.getElementById('proveedor-id');
    nombreInput = document.getElementById('proveedor-nombre');
    contactoInput = document.getElementById('proveedor-contacto');
    telefonoInput = document.getElementById('proveedor-telefono');
    emailInput = document.getElementById('proveedor-email');
    btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar) {
         console.error("Faltan elementos internos en el formulario.");
    }

    // Limpiar listeners
    form.removeEventListener('submit', guardarProveedor);
    btnCancelar.removeEventListener('click', resetFormulario);
    tablaBody.removeEventListener('click', handleTablaClick);
    closeModalCtaCte.removeEventListener('click', closeModalCtaCteHandler);
    btnGenerarCtaCte.removeEventListener('click', generarReporteCtaCte);
    btnImprimirCtaCte.removeEventListener('click', imprimirReporteCtaCte);
    btnExportarCtaCte.removeEventListener('click', exportarReporteCtaCteExcel);
    console.log("Listeners de proveedores limpiados.");

    // Añadir listeners
    if(form) form.addEventListener('submit', guardarProveedor);
    if(btnCancelar) btnCancelar.addEventListener('click', resetFormulario);
    if(tablaBody) tablaBody.addEventListener('click', handleTablaClick);
    if(closeModalCtaCte) closeModalCtaCte.addEventListener('click', closeModalCtaCteHandler);
    if(btnGenerarCtaCte) btnGenerarCtaCte.addEventListener('click', generarReporteCtaCte);
    if(btnImprimirCtaCte) btnImprimirCtaCte.addEventListener('click', imprimirReporteCtaCte);
    if(btnExportarCtaCte) btnExportarCtaCte.addEventListener('click', exportarReporteCtaCteExcel);
    console.log("Listeners de proveedores añadidos.");

    cargarProveedores();
    resetFormulario();
    console.log("Lógica de proveedores inicializada.");
}

// --- CAMBIO AQUÍ: Quitar la exportación duplicada ---
export { inicializarLogicaProveedores, borrarProveedor };
// Ya no necesitamos exportar editarProveedor aquí