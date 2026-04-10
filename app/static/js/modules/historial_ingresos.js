// app/static/js/modules/historial_ingresos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// --- Elementos del DOM (declarados aquí, asignados en init) ---
let tablaBody;
let modalDetalles;
let closeModalBtn;
let contenidoModal;
let filtroProveedorSelect;

// --- Helpers ---
const formatCurrency = (value) => {
    const numberValue = Number(value);
    return isNaN(numberValue) ? '$ 0.00' : numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString;
    }
};

const formatFacturaNro = (tipo, prefijo, numero) => {
    if (!prefijo || !numero) return '-';
    const paddedPrefijo = String(prefijo).padStart(4, '0');
    const paddedNumero = String(numero).padStart(8, '0');
    return `${tipo || 'FC'} ${paddedPrefijo}-${paddedNumero}`;
};

const getEstadoBadgeClass = (estado) => {
    switch (String(estado).toLowerCase()) {
        case 'pagada': return 'status-pagada';
        case 'parcial': return 'status-parcial';
        case 'pendiente': return 'status-pendiente';
        default: return 'status-desconocido';
    }
};


// --- Funciones de Renderizado ---

// --- Estado local para paginación ---
let offset = 0;
const LIMIT = 50;

/** Renderiza la tabla del historial de ingresos */
function renderizarHistorial(ingresos, append = false) {
    if (!tablaBody) return;
    
    if (!append) {
        tablaBody.innerHTML = ''; 
        offset = 0; // Reset offset on new load
    }

    if (!ingresos || ingresos.length === 0) {
        if (!append) {
            tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay ingresos para mostrar.</td></tr>';
        }
        removeCargarMasBtn();
        return;
    }

    ingresos.forEach(ingreso => {
        const row = document.createElement('tr');
        const estadoPago = ingreso.estado_pago || 'pendiente';
        const factura = `${ingreso.factura_tipo || 'FC'} ${String(ingreso.factura_prefijo || 0).padStart(4, '0')}-${String(ingreso.factura_numero || 0).padStart(8, '0')}`;
        
        row.innerHTML = `
            <td class="ps-4">${formatDate(ingreso.fecha)}</td>
            <td class="fw-bold text-slate-700">${ingreso.proveedor_nombre || 'N/A'}</td>
            <td>${factura}</td>
            <td><small class="text-muted">${ingreso.referencia || '-'}</small></td>
            <td class="text-end fw-bold text-slate-800">${formatCurrency(ingreso.total_factura)}</td>
            <td class="text-end text-success">${formatCurrency(ingreso.monto_pagado || 0)}</td>
            <td class="text-end text-danger">${formatCurrency(ingreso.saldo_pendiente || 0)}</td>
            <td class="text-center"><span class="status-badge ${getEstadoBadgeClass(estadoPago)}">${estadoPago}</span></td>
            <td class="pe-4">
                <div class="btn-group shadow-sm" style="border-radius: 8px; overflow: hidden;">
                    <button class="btn btn-white btn-sm px-3 border btn-ver-detalles" data-id="${ingreso.id}" title="Ver Detalles">
                        <i class="fas fa-eye text-primary"></i>
                    </button>
                    <button class="btn btn-white btn-sm px-3 border border-start-0" onclick="window.descargarPDFIngreso(${ingreso.id})" title="Imprimir PDF">
                        <i class="fas fa-print text-muted"></i>
                    </button>
                    ${(ingreso.monto_pagado > 0 || estadoPago === 'pagada') ? '' : `
                    <button class="btn btn-white btn-sm px-3 border border-start-0" onclick="window.eliminarIngreso(${ingreso.id}, '${factura}')" title="Eliminar definitivamente">
                        <i class="fas fa-trash-alt text-danger"></i>
                    </button>
                    `}
                </div>
            </td>
        `;
        tablaBody.appendChild(row);
    });

    // Delegación de eventos para los botones "Ver" (pueden ser muchos, mejor delegar o re-asignar)
    tablaBody.querySelectorAll('.btn-ver-detalles').forEach(btn => {
        btn.onclick = () => mostrarDetailModal(btn.dataset.id);
    });

    // Gestionar botón "Cargar más"
    if (ingresos.length === LIMIT) {
        addCargarMasBtn();
    } else {
        removeCargarMasBtn();
    }
}

function addCargarMasBtn() {
    removeCargarMasBtn();
    const tfoot = document.querySelector('#tabla-historial-ingresos tfoot') || document.createElement('tfoot');
    if (!document.querySelector('#tabla-historial-ingresos tfoot')) {
        document.getElementById('tabla-historial-ingresos').appendChild(tfoot);
    }
    tfoot.innerHTML = `
        <tr>
            <td colspan="9" class="text-center py-3 bg-light">
                <button class="btn btn-outline-primary btn-sm px-4 shadow-sm" id="btn-cargar-mas-ingresos">
                    <i class="fas fa-plus me-2"></i>Cargar más ingresos
                </button>
            </td>
        </tr>
    `;
    const btn = document.getElementById('btn-cargar-mas-ingresos');
    if (btn) btn.onclick = () => {
        offset += LIMIT;
        cargarHistorial(true);
    };
}

function removeCargarMasBtn() {
    const tfoot = document.querySelector('#tabla-historial-ingresos tfoot');
    if (tfoot) tfoot.innerHTML = '';
}

/** Carga y muestra los detalles de un ingreso en el modal */
export async function mostrarDetailModal(ingresoId) {
    if (!modalDetalles || !contenidoModal || !closeModalBtn) return;
    
    contenidoModal.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted small">Consultando detalles fiscales...</p></div>';
    modalDetalles.style.display = 'flex';

    const btnImp = document.getElementById('btn-imprimir-ingreso-modal');
    if (btnImp) {
        btnImp.onclick = () => window.descargarPDFIngreso(ingresoId);
    }

    try {
        const response = await fetchData(`/api/ingresos/${ingresoId}/detalles`);
        const { maestro, detalles } = response;

        if (!detalles || detalles.length === 0) {
            contenidoModal.innerHTML = '<p class="text-center p-4">No se encontraron detalles para este ingreso.</p>';
            return;
        }

        let tablaHtml = `
            <div class="table-responsive">
                <table class="table table-sm table-borderless align-middle mb-0" style="font-size: 0.85rem;">
                    <thead class="bg-light text-muted">
                        <tr>
                            <th class="ps-3">PRODUCTO</th>
                            <th class="text-center">CANT.</th>
                            <th class="text-end">UNIT. BRUTO</th>
                            <th class="text-center">DCTOS %</th>
                            <th class="text-center">IVA %</th>
                            <th class="text-end pe-3">SUBTOTAL (NETO)</th>
                        </tr>
                    </thead>
                    <tbody class="border-top">
        `;

        let totalNetoItems = 0;
        detalles.forEach(d => {
            const cant = Number(d.cantidad) || 0;
            const bruto = Number(d.precio_costo_unitario) || 0;
            const dto1 = Number(d.descuento_1) || 0;
            const dto2 = Number(d.descuento_2) || 0;
            const iva = Number(d.iva_porcentaje) || 21;
            
            const netoUnit = bruto * (1 - dto1 / 100) * (1 - dto2 / 100);
            const subtotalNeto = cant * netoUnit;
            totalNetoItems += subtotalNeto;

            tablaHtml += `
                <tr class="border-bottom text-slate-700">
                    <td class="ps-3 py-2 fw-bold text-slate-800">${d.nombre}</td>
                    <td class="text-center">${cant}</td>
                    <td class="text-end text-muted">$ ${bruto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                    <td class="text-center"><small>${dto1 > 0 || dto2 > 0 ? `${dto1}% + ${dto2}%` : '-'}</small></td>
                    <td class="text-center"><span class="badge bg-light text-dark border">${iva}%</span></td>
                    <td class="text-end pe-3 fw-bold">$ ${subtotalNeto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        });

        const totalPercepciones = (Number(maestro.iva_percepcion) || 0) + (Number(maestro.iibb_percepcion) || 0);
        const impInternos = Number(maestro.impuestos_internos) || 0;

        tablaHtml += `
                    </tbody>
                </table>
            </div>

            <div class="row mt-4 pt-3 border-top g-3">
                <div class="col-md-7">
                    <p class="small text-muted mb-2 text-uppercase fw-bold tracking-wider">Conceptos Globales</p>
                    <div class="d-flex flex-wrap gap-2">
                        <div class="bg-light rounded p-2 px-3 border shadow-xs">
                            <label class="d-block micro-label text-muted">IVA 21%</label>
                            <span class="fw-bold">$ ${Number(maestro.iva_21 || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="bg-light rounded p-2 px-3 border shadow-xs">
                            <label class="d-block micro-label text-muted">IVA 10.5%</label>
                            <span class="fw-bold">$ ${Number(maestro.iva_105 || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="bg-light rounded p-2 px-3 border shadow-xs">
                            <label class="d-block micro-label text-muted">PERCEPCIONES</label>
                            <span class="fw-bold text-orange-600">$ ${totalPercepciones.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="bg-light rounded p-2 px-3 border shadow-xs" style="background-color: #f0fdf4 !important;">
                            <label class="d-block micro-label text-muted">IMP. INTERNOS</label>
                            <span class="fw-bold text-success">$ ${impInternos.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-5">
                    <div class="baboons-card p-3 bg-slate-900 text-white border-0 shadow-lg text-end">
                        <label class="d-block text-white-50 small mb-1 tracking-wider text-uppercase">Total Comprobante</label>
                        <h2 class="mb-0 fw-bold">$ ${Number(maestro.total_factura || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</h2>
                    </div>
                </div>
            </div>
        `;
        contenidoModal.innerHTML = tablaHtml;

    } catch (error) {
        console.error("Error mostrando detalle ingreso:", error);
        mostrarNotificacion('Error al cargar la información fiscal.', 'error');
        contenidoModal.innerHTML = `<div class="p-4 text-center text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2"></i><p>Error: ${error.message}</p></div>`;
    }
}

// Re-exportamos con el nombre original para compatibilidad si fuera necesario
export const mostrarDetalle = mostrarDetailModal;

// --- Lógica Principal ---

async function cargarHistorial(append = false) {
    if (!tablaBody || !filtroProveedorSelect) return;
    
    if (!appState.negocioActivoId || appState.negocioActivoId === 'null') {
         console.warn("[Historial] Esperando negocioActivoId válido...");
         setTimeout(() => cargarHistorial(append), 1000);
         return;
    }

    if (!append) {
        tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Cargando historial...</td></tr>';
        offset = 0;
    }

    let url = `/api/negocios/${appState.negocioActivoId}/ingresos?limit=${LIMIT}&offset=${offset}`;
    const proveedorIdSeleccionado = filtroProveedorSelect.value;
    if (proveedorIdSeleccionado && proveedorIdSeleccionado !== 'null') {
        url += `&proveedor_id=${proveedorIdSeleccionado}`;
    }

    try {
        const ingresos = await fetchData(url);
        if (Array.isArray(ingresos)) {
            renderizarHistorial(ingresos, append);
        } else {
            throw new Error("Respuesta inválida");
        }
    } catch (error) {
        console.error("Error cargando historial:", error);
        mostrarNotificacion('Error al cargar historial.', 'error');
        if (!append) tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error al cargar.</td></tr>';
    }
}

/** ELIMINAR INGRESO */
window.eliminarIngreso = async function(ingresoId, facturaNro) {
    if (!confirm(`¿Estás SEGURO que deseas ELIMINAR el ingreso ${facturaNro}?\n\nEsta acción:\n1. Restará el stock ingresado.\n2. Restará el monto pendiente del saldo del proveedor.\n3. Es IRREVERSIBLE.`)) return;
    
    // Segunda confirmación para seguridad extra
    if (!confirm(`¡ADVERTENCIA FINAL! Confirmá para borrar definitivamente.`)) return;

    try {
        mostrarNotificacion('Eliminando ingreso...', 'info');
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/ingresos/${ingresoId}`, {
            method: 'DELETE'
        });
        mostrarNotificacion(res.message || 'Ingreso eliminado correctamente.', 'success');
        cargarHistorial(false); // Recargar desde cero
    } catch (error) {
        console.error("Error eliminando ingreso:", error);
        mostrarNotificacion(error.error || error.message || 'Error al eliminar ingreso.', 'error');
    }
};


async function poblarFiltroProveedores() {
    if (!filtroProveedorSelect) return Promise.reject("Elemento select no encontrado");
    filtroProveedorSelect.innerHTML = '<option value="">-- Todos --</option>';
    filtroProveedorSelect.disabled = true;

    if (!appState.negocioActivoId) return Promise.resolve();

    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedores.forEach(p => {
            filtroProveedorSelect.appendChild(new Option(p.nombre, p.id));
        });

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const provUrl = urlParams.get('proveedor');
        if (provUrl) filtroProveedorSelect.value = provUrl;

        filtroProveedorSelect.disabled = false;
        return Promise.resolve();
    } catch (error) {
        filtroProveedorSelect.innerHTML = '<option value="">Error al cargar</option>';
        return Promise.reject(error);
    }
}

function handleTablaClick(event) {
    const target = event.target;
    if (target.classList.contains('btn-ver-detalles') || target.closest('.btn-ver-detalles')) {
        const btn = target.classList.contains('btn-ver-detalles') ? target : target.closest('.btn-ver-detalles');
        const id = btn.dataset.id;
        if (id) mostrarDetailModal(id);
    }
}

function closeModalHandler() {
    if(modalDetalles) modalDetalles.style.display = 'none';
}

export function inicializarLogicaHistorialIngresos() {
    tablaBody = document.querySelector('#tabla-historial-ingresos tbody');
    modalDetalles = document.getElementById('modal-detalles-ingreso');
    closeModalBtn = document.getElementById('close-detalles-ingreso');
    contenidoModal = document.getElementById('contenido-detalles-ingreso');
    filtroProveedorSelect = document.getElementById('filtro-proveedor-ingresos');

    if (!tablaBody || !modalDetalles || !closeModalBtn || !contenidoModal || !filtroProveedorSelect) return;

    tablaBody.addEventListener('click', handleTablaClick);
    closeModalBtn.addEventListener('click', closeModalHandler);
    filtroProveedorSelect.addEventListener('change', cargarHistorial);

    (async () => {
        try {
            await poblarFiltroProveedores();
            await cargarHistorial();
        } catch (error) {
            console.error(error);
        }
    })();
}

// --- PDF GENERATION ---
window.descargarPDFIngreso = async function(ingresoId) {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            mostrarNotificacion('jsPDF no disponible', 'error');
            return;
        }

        mostrarNotificacion('Generando PDF...', 'info');
        const { maestro, detalles } = await fetchData(`/api/ingresos/${ingresoId}/detalles`);
        
        let config = null;
        const negocioPrincipal = (appState.negociosCache || []).find(n => n.id == appState.negocioActivoId) || { nombre: 'Baboons ERP' };
        
        try {
            config = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/config`);
            if (!config.razon_social) config.razon_social = negocioPrincipal.nombre;
            if (!config.domicilio) config.domicilio = negocioPrincipal.direccion || '';
        } catch(e) {
            config = { razon_social: negocioPrincipal.nombre, domicilio: negocioPrincipal.direccion || '' };
        }

        const doc = new jsPDF();
        
        // Cabecera
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); 
        doc.text(config.razon_social.toUpperCase(), 105, 20, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`${config.domicilio || ''} | CUIT: ${config.cuit || ''}`, 105, 26, { align: 'center' });
        doc.line(14, 30, 196, 30);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text("COMPROBANTE DE INGRESO", 14, 40);
        
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Comprobante: ${maestro?.factura_tipo || ''} ${maestro?.factura_prefijo || ''}-${maestro?.factura_numero || ''}`, 14, 48);
        doc.text(`Proveedor: ${maestro?.proveedor_nombre || 'N/A'}`, 14, 54);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 196, 48, { align: 'right' });
        if (maestro?.cae) doc.text(`CAE: ${maestro.cae}`, 196, 54, { align: 'right' });

        const tableData = detalles.map((d, i) => [
            i + 1,
            d.nombre,
            d.cantidad,
            `$ ${Number(d.precio_costo_unitario || 0).toFixed(2)}`,
            `${d.iva_porcentaje}%`,
            `$ ${(Number(d.cantidad || 0) * Number(d.precio_costo_unitario || 0) * (1 - (Number(d.descuento_1 || 0) / 100))).toFixed(2)}`
        ]);

        doc.autoTable({
            startY: 60,
            head: [['#', 'Producto', 'Cant.', 'Bruto', 'IVA', 'Subtotal']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.text(`RESUMEN FISCAL`, 140, finalY);
        doc.setFontSize(9);
        doc.text(`IVA 21%: $ ${(Number(maestro?.iva_21) || 0).toFixed(2)}`, 140, finalY + 6);
        doc.text(`IVA 10.5%: $ ${(Number(maestro?.iva_105) || 0).toFixed(2)}`, 140, finalY + 11);
        doc.text(`Percepciones: $ ${((Number(maestro?.iva_percepcion)||0) + (Number(maestro?.iibb_percepcion)||0)).toFixed(2)}`, 140, finalY + 16);
        doc.text(`Imp. Internos: $ ${(Number(maestro?.impuestos_internos) || 0).toFixed(2)}`, 140, finalY + 21);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: $ ${(Number(maestro?.total_factura) || 0).toFixed(2)}`, 140, finalY + 30);

        doc.save(`Ingreso_${ingresoId}.pdf`);
        mostrarNotificacion('PDF guardado', 'success');
    } catch (e) {
        console.error(e);
        mostrarNotificacion('Error al generar PDF', 'error');
    }
};