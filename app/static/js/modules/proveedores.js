// app/static/js/modules/proveedores.js
import { fetchData } from '../api.js';
import { appState, loadContent } from '../main.js'; // Necesitamos negocioActivoId y loadContent
import { mostrarNotificacion } from './notifications.js';
// Asegúrate de que XLSX esté disponible globalmente (cargado en index.html)
// Si no, necesitarías importarlo: import * as XLSX from 'ruta/a/xlsx.full.min.js';

// --- Elementos del DOM (añadimos los del modal) ---
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
    // Opciones para formato argentino
    const options = { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    let formatted = numberValue.toLocaleString('es-AR', options);
    // Intento manual de quitar el símbolo si showSign es false (toLocaleString a veces lo ignora)
    if (!showSign) {
        formatted = formatted.replace(/[ARS$\s]/g, '').trim(); // Quita ARS, $ y espacios
    }
    return formatted;
};
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        // Ajustar por zona horaria local si es necesario (ISO string usualmente es UTC)
        // const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        // const localDate = new Date(date.getTime() - userTimezoneOffset); // Ojo con esto si las fechas ya vienen locales

        const options = { day: '2-digit', month: '2-digit', year: 'numeric' }; // Formato DD/MM/YYYY
        if(includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit'; // Opcional
        }
        return date.toLocaleString('es-AR', options); // Usar directamente date
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString;
     }
};


// --- Carga y Renderizado Tabla Principal (añadir botón Cta. Cte.) ---
async function cargarProveedores() {
    if (!appState.negocioActivoId) {
        mostrarNotificacion('Seleccione un negocio activo para ver proveedores.', 'warning');
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
        // Guardamos el nombre en data-attribute para usarlo en el título del modal
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

// --- Lógica Formulario Proveedor (sin cambios) ---
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
export async function borrarProveedor(id) {
    if (!confirm(`¿Seguro de eliminar proveedor ID ${id}?`)) return;
    try {
        await fetchData(`/api/proveedores/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Proveedor eliminado.', 'success');
        await cargarProveedores();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al eliminar.', 'error');
    }
}


// --- ✨ NUEVA LÓGICA PARA CUENTA CORRIENTE ✨ ---

/** Abre el modal de Cta Cte y establece valores iniciales */
function abrirModalCtaCte(proveedorId) {
    // Buscar el nombre desde el atributo data-proveedor-nombre de la fila TR
    const filaProveedor = document.querySelector(`#tabla-proveedores tbody tr[data-proveedor-id="${proveedorId}"]`);
    const proveedorNombre = filaProveedor ? filaProveedor.dataset.proveedorNombre : `ID ${proveedorId}`;

    if (!modalCtaCte || !tituloModalCtaCte || !proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !reporteContainerCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
        console.error("Faltan elementos HTML del modal Cta Cte.");
        mostrarNotificacion("Error al abrir reporte Cta Cte.", "error");
        return;
    }

    tituloModalCtaCte.textContent = `Cuenta Corriente: ${proveedorNombre}`;
    proveedorIdInputCtaCte.value = proveedorId;

    // Establecer fechas por defecto (ej: inicio de mes actual hasta hoy)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1); // Primer día del mes actual
    try {
      fechaDesdeInputCtaCte.valueAsDate = inicioMes;
      fechaHastaInputCtaCte.valueAsDate = hoy;
    } catch(e) {
      console.error("Error setting default dates:", e);
      // Fallback a strings YYYY-MM-DD
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      fechaDesdeInputCtaCte.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
      fechaHastaInputCtaCte.value = `${yyyy}-${mm}-${dd}`;
    }


    // Limpiar reporte anterior y deshabilitar botones
    reporteContainerCtaCte.innerHTML = '<p style="text-align: center;">Seleccione un rango de fechas y presione \'Generar\'.</p>';
    btnImprimirCtaCte.disabled = true;
    btnExportarCtaCte.disabled = true;

    modalCtaCte.style.display = 'flex';
}

/** Llama a la API y genera el reporte de Cta Cte */
async function generarReporteCtaCte() {
    // Validar elementos necesarios
     if (!proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !reporteContainerCtaCte || !btnGenerarCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
          console.error("Faltan elementos del modal al generar reporte.");
          return;
     }

    const proveedorId = proveedorIdInputCtaCte.value;
    const fechaDesde = fechaDesdeInputCtaCte.value;
    const fechaHasta = fechaHastaInputCtaCte.value;

    if (!proveedorId || !fechaDesde || !fechaHasta) {
        return mostrarNotificacion("Seleccione proveedor y fechas.", "warning");
    }
    // Validación simple de fechas
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
        return mostrarNotificacion("La fecha 'Desde' no puede ser mayor que 'Hasta'.", "warning");
    }


    reporteContainerCtaCte.innerHTML = '<p style="text-align: center;">Generando reporte...</p>';
    btnGenerarCtaCte.disabled = true;
    btnImprimirCtaCte.disabled = true;
    btnExportarCtaCte.disabled = true;

    try {
        const url = `/api/negocios/${appState.negocioActivoId}/proveedores/${proveedorId}/cuenta-corriente?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        console.log("Generando reporte Cta Cte desde:", url);
        const data = await fetchData(url);

        if (!data || !data.movimientos) {
             throw new Error("Respuesta inválida del servidor al generar Cta Cte.");
        }
        console.log("Datos Cta Cte recibidos:", data);

        // Construir tabla HTML
        let tablaHtml = `
            <table id="tabla-reporte-cta-cte" class="tabla-bonita" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Debe</th>
                        <th>Haber</th>
                        <th>Saldo</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Añadir saldo inicial como primera fila (ya viene en data.movimientos)
        data.movimientos.forEach(mov => {
            const fechaFormateada = mov.tipo === 'Saldo Anterior'
                ? formatDate(mov.fecha) // Solo fecha para saldo anterior
                : formatDate(mov.fecha, true); // Fecha y hora para movimientos
            tablaHtml += `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td>${mov.concepto || mov.tipo}</td>
                    <td style="text-align: right;">${mov.debe !== null ? formatCurrency(mov.debe) : ''}</td>
                    <td style="text-align: right;">${mov.haber !== null ? formatCurrency(mov.haber) : ''}</td>
                    <td style="text-align: right;">${formatCurrency(mov.saldo)}</td>
                </tr>
            `;
        });

        tablaHtml += `
                </tbody>
            </table>
            <p style="text-align: right; margin-top: 10px; font-weight: bold;">
                Saldo Inicial (${formatDate(data.fecha_desde)}): ${formatCurrency(data.saldo_inicial)} |
                Saldo Final (${formatDate(data.fecha_hasta)}): ${formatCurrency(data.movimientos[data.movimientos.length - 1]?.saldo ?? data.saldo_inicial)}
            </p>
        `;

        reporteContainerCtaCte.innerHTML = tablaHtml;
        btnImprimirCtaCte.disabled = false;
        btnExportarCtaCte.disabled = false;

    } catch (error) {
        mostrarNotificacion(error.message || 'Error al generar el reporte Cta Cte.', 'error');
        console.error("Error generando reporte Cta Cte:", error);
        reporteContainerCtaCte.innerHTML = `<p style="text-align: center; color: red;">Error: ${error.message || 'No se pudo generar el reporte.'}</p>`;
    } finally {
        if (btnGenerarCtaCte) btnGenerarCte.disabled = false;
    }
}

/** Imprime el contenido del reporte */
function imprimirReporteCtaCte() {
    const reporteNode = document.getElementById('reporte-cta-cte-container');
    const titulo = tituloModalCtaCte ? tituloModalCtaCte.textContent : 'Cuenta Corriente';
    const fechaDesde = fechaDesdeInputCtaCte ? fechaDesdeInputCtaCte.value : '';
    const fechaHasta = fechaHastaInputCtaCte ? fechaHastaInputCtaCte.value : '';
    const periodo = fechaDesde && fechaHasta ? `Período: ${formatDate(fechaDesde)} al ${formatDate(fechaHasta)}` : '';


    if (!reporteNode || reporteNode.children.length === 0 || reporteNode.querySelector('p')?.textContent.startsWith('Seleccione')) {
        mostrarNotificacion("Primero genere un reporte para imprimir.", "warning");
        return;
    }
    const contenido = reporteNode.innerHTML;

    const printWindow = window.open('', '_blank', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Imprimir Cuenta Corriente</title>');
    // Estilos básicos para impresión
    printWindow.document.write(`
        <style>
            body { font-family: Arial, sans-serif; font-size: 10pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
            th { background-color: #eee; font-weight: bold; }
            td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; } /* Debe, Haber, Saldo */
            p { margin-top: 10px; }
            @media print {
                button { display: none; } /* Ocultar botones al imprimir */
                body { margin: 20mm; } /* Márgenes de impresión */
            }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>${titulo}</h1>`);
    printWindow.document.write(`<p>${periodo}</p>`);
    printWindow.document.write(contenido);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    // Usar onload para asegurar que todo esté listo antes de imprimir
    printWindow.onload = function() {
        printWindow.print();
        // printWindow.close(); // Opcional: cerrar ventana después de imprimir
    };
}

/** Exporta la tabla del reporte a Excel */
function exportarReporteCtaCteExcel() {
    const tabla = document.getElementById('tabla-reporte-cta-cte');
    if (!tabla) {
        mostrarNotificacion("Primero genere un reporte para exportar.", "warning");
        return;
    }
    if (typeof XLSX === 'undefined') {
        mostrarNotificacion("Error: La librería de exportación (XLSX) no está cargada.", "error");
        console.error("XLSX no está definido. Asegúrate de que el script se cargó en index.html.");
        return;
    }


    try {
        // Crear hoja de cálculo a partir de la tabla HTML
        const wb = XLSX.utils.table_to_book(tabla, { sheet: "Cuenta Corriente" });

        // Obtener nombre y fechas para el archivo
        const proveedorNombre = (tituloModalCtaCte ? tituloModalCtaCte.textContent : 'Proveedor').replace('Cuenta Corriente: ', '').replace(/[^a-z0-9]/gi, '_'); // Limpiar nombre
        const fechaDesde = fechaDesdeInputCtaCte ? fechaDesdeInputCtaCte.value : 'desde';
        const fechaHasta = fechaHastaInputCtaCte ? fechaHastaInputCtaCte.value : 'hasta';
        const filename = `CtaCte_${proveedorNombre}_${fechaDesde}_a_${fechaHasta}.xlsx`;

        // Generar archivo y descargar
        XLSX.writeFile(wb, filename);
        mostrarNotificacion("Reporte exportado a Excel.", "success");

    } catch (error) {
        mostrarNotificacion("Error al exportar a Excel.", "error");
        console.error("Error exportando Cta Cte a Excel:", error);
    }
}


// --- Lógica de Inicialización ---

/** Maneja clicks en la tabla principal (delegación) */
function handleTablaClick(e) {
    const target = e.target;
    const proveedorRow = target.closest('tr'); // Fila del proveedor
    const proveedorId = proveedorRow?.dataset.proveedorId;

    if (!proveedorId) return;
    const id = parseInt(proveedorId);

    if (target.classList.contains('btn-edit')) {
        editarProveedor(id);
    } else if (target.classList.contains('btn-delete')) {
        borrarProveedor(id);
    } else if (target.classList.contains('btn-ver-ingresos')) {
        window.location.hash = `#historial_ingresos?proveedor=${id}`;
    } else if (target.classList.contains('btn-ver-pagos')) {
        window.location.hash = `#historial_pagos_proveedores?proveedor=${id}`;
    } else if (target.classList.contains('btn-cta-cte')) {
        abrirModalCtaCte(id); // Pasar ID numérico
    }
}

/** Handler para cerrar el modal Cta Cte */
function closeModalCtaCteHandler() {
    if (modalCtaCte) modalCtaCte.style.display = 'none';
}


export function inicializarLogicaProveedores() {
    console.log("Inicializando lógica de proveedores...");
    form = document.getElementById('form-proveedor');
    const tablaBody = document.querySelector('#tabla-proveedores tbody');

    // --- Seleccionar elementos del Modal Cta Cte ---
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
    // --- Fin selección modal ---

    // Validar existencia de todos los elementos necesarios
    if (!form || !tablaBody || !modalCtaCte || !closeModalCtaCte || !tituloModalCtaCte || !proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !btnGenerarCtaCte || !reporteContainerCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
        console.error("Error Crítico: Faltan elementos HTML en proveedores.html (formulario, tabla o modal Cta Cte completo). Verifica los IDs.");
        mostrarNotificacion("Error al cargar la página de proveedores (componentes faltantes).","error");
        return; // Detener si falta algo esencial
    }

    // Obtener refs a inputs del form principal
    tituloForm = document.getElementById('form-proveedor-titulo');
    idInput = document.getElementById('proveedor-id');
    nombreInput = document.getElementById('proveedor-nombre');
    contactoInput = document.getElementById('proveedor-contacto');
    telefonoInput = document.getElementById('proveedor-telefono');
    emailInput = document.getElementById('proveedor-email');
    btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar) {
         console.error("Faltan elementos internos en el formulario de proveedores.");
         // No detenemos aquí, pero el form puede no funcionar
    }


    // Limpiar listeners para evitar duplicados
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
    if(tablaBody) tablaBody.addEventListener('click', handleTablaClick); // Delegación
    if(closeModalCtaCte) closeModalCtaCte.addEventListener('click', closeModalCtaCteHandler);
    if(btnGenerarCtaCte) btnGenerarCtaCte.addEventListener('click', generarReporteCtaCte);
    if(btnImprimirCtaCte) btnImprimirCtaCte.addEventListener('click', imprimirReporteCtaCte);
    if(btnExportarCtaCte) btnExportarCtaCte.addEventListener('click', exportarReporteCtaCteExcel);
    console.log("Listeners de proveedores añadidos.");

    cargarProveedores(); // Carga inicial
    resetFormulario(); // Asegurar que el form esté limpio al inicio
    console.log("Lógica de proveedores inicializada.");
}

// Exportar funciones necesarias
export { inicializarLogicaProveedores, borrarProveedor };