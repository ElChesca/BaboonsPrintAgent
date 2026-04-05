// app/static/js/modules/proveedores.js
import { fetchData } from '../api.js';
import { appState, loadContent } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
// Asegúrate de que XLSX esté disponible globalmente (cargado en index.html)

let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
let cuitInput, condicionFiscalInput, datosBancariosInput, condicionesPagoInput, filtroInput;
let proveedoresCache = [];

let modalCtaCte, closeModalCtaCte, tituloModalCtaCte, proveedorIdInputCtaCte,
    fechaDesdeInputCtaCte, fechaHastaInputCtaCte, btnGenerarCtaCte,
    reporteContainerCtaCte, btnImprimirCtaCte, btnExportarCtaCte;

let modalComprobante, closeModalComprobante, formComprobante, btnCancelarComprobante,
    compProveedorId, compFecha, compTipo, compPrefijo, compNumero, compTotal, compReferencia,
    inputPdfImport, btnParsePdf;

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
        if (includeTime) {
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
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay proveedores para mostrar.</td></tr>';
        return;
    }
    
    const busqueda = filtroInput?.value.toLowerCase() || '';
    const filtrados = proveedoresCache.filter(p => 
        (p.nombre || '').toLowerCase().includes(busqueda) || 
        (p.cuit || '').includes(busqueda) ||
        (p.contacto || '').toLowerCase().includes(busqueda)
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No se encontraron resultados para la búsqueda.</td></tr>';
        return;
    }

    filtrados.forEach(p => {
        tbody.innerHTML += `
            <tr data-proveedor-id="${p.id}" data-proveedor-nombre="${p.nombre || ''}">
                <td>
                    <div style="font-weight: bold; color: #1d2671;">${p.nombre || 'Sin Nombre'}</div>
                    <div style="font-size: 0.8rem; color: #666;">${p.email || ''}</div>
                </td>
                <td>
                    <div class="badge-premium badge-cuit">${p.cuit || 'Sin CUIT'}</div>
                    <div style="font-size: 0.75rem; color: #888; margin-top: 4px;">${p.condicion_fiscal || '-'}</div>
                </td>
                <td>
                    <div>${p.contacto || '-'}</div>
                    <div style="font-size: 0.8rem; color: #00b894;"><i class="fas fa-phone-alt"></i> ${p.telefono || '-'}</div>
                </td>
                <td style="text-align: right; font-weight: bold; color: ${p.saldo_cta_cte < 0 ? '#e74c3c' : '#2d3436'};">
                    ${formatCurrency(p.saldo_cta_cte)}
                </td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-warning btn-sm btn-cta-cte" data-id="${p.id}" title="Cuenta Corriente"><i class="fas fa-file-invoice"></i></button>
                        <button class="btn btn-success btn-sm btn-registrar-pago" data-id="${p.id}" title="Pagar"><i class="fas fa-hand-holding-usd"></i></button>
                        <button class="btn btn-dark btn-sm btn-cargar-comprobante" data-id="${p.id}" title="Cargar Deuda"><i class="fas fa-plus"></i></button>
                        <div class="dropdown">
                            <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item btn-ver-ingresos" data-id="${p.id}" href="#"><i class="fas fa-history"></i> Historial Ingresos</a></li>
                                <li><a class="dropdown-item btn-edit" data-id="${p.id}" href="#"><i class="fas fa-edit"></i> Editar</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item btn-delete text-danger" data-id="${p.id}" href="#"><i class="fas fa-trash"></i> Eliminar</a></li>
                            </ul>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
}

// --- Lógica Formulario Proveedor ---
function resetFormulario() {
    if (!form) return;
    if (tituloForm) tituloForm.textContent = 'Añadir Nuevo Proveedor';
    form.reset();
    if (idInput) idInput.value = '';
    if (btnCancelar) btnCancelar.style.display = 'none';
}
async function guardarProveedor(e) {
    e.preventDefault();
    if (!nombreInput || !contactoInput || !telefonoInput || !emailInput || !idInput) return;
    const id = idInput.value;
    const data = {
        nombre: nombreInput.value.trim(),
        cuit: cuitInput.value.trim(),
        condicion_fiscal: condicionFiscalInput.value,
        contacto: contactoInput.value.trim(),
        telefono: telefonoInput.value.trim(),
        email: emailInput.value.trim(),
        condiciones_pago: condicionesPagoInput.value.trim(),
        datos_bancarios: datosBancariosInput.value.trim()
    };
    if (!data.nombre) return mostrarNotificacion('El nombre es obligatorio.', 'warning');

    const esEdicion = !!id;
    const url = esEdicion ? `/api/proveedores/${id}` : `/api/negocios/${appState.negocioActivoId}/proveedores`;
    const method = esEdicion ? 'PUT' : 'POST';
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Guardando...'; }
    try {
        await fetchData(url, { method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
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
    cuitInput.value = proveedor.cuit || '';
    condicionFiscalInput.value = proveedor.condicion_fiscal || '';
    contactoInput.value = proveedor.contacto || '';
    telefonoInput.value = proveedor.telefono || '';
    emailInput.value = proveedor.email || '';
    condicionesPagoInput.value = proveedor.condiciones_pago || '';
    datosBancariosInput.value = proveedor.datos_bancarios || '';
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
    } catch (e) {
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
    printWindow.onload = function () { printWindow.print(); };
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


// --- Lógica Carga de Comprobantes ---
function abrirModalComprobante(proveedorId) {
    if (!modalComprobante || !compProveedorId || !compFecha) return;
    compProveedorId.value = proveedorId;
    compFecha.valueAsDate = new Date();
    formComprobante.reset();
    compProveedorId.value = proveedorId; // Reset borra el hidden id
    compFecha.valueAsDate = new Date();
    modalComprobante.style.display = 'flex';
}

function cerrarModalComprobante() {
    if (modalComprobante) modalComprobante.style.display = 'none';
}

async function guardarComprobante(e) {
    e.preventDefault();
    if (!appState.negocioActivoId) return mostrarNotificacion("No hay negocio activo.", "error");

    const data = {
        fecha: compFecha.value,
        factura_tipo: compTipo.value,
        factura_prefijo: compPrefijo.value,
        factura_numero: compNumero.value,
        total: parseFloat(compTotal.value),
        referencia: compReferencia.value.trim()
    };

    if (isNaN(data.total) || data.total <= 0) {
        return mostrarNotificacion("Ingrese un monto válido.", "warning");
    }

    const proveedorId = compProveedorId.value;
    const url = `/api/negocios/${appState.negocioActivoId}/proveedores/${proveedorId}/comprobante`;

    try {
        const btn = formComprobante.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        await fetchData(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        mostrarNotificacion("Comprobante registrado con éxito.", "success");
        cerrarModalComprobante();
        await cargarProveedores(); // Refrescar para ver nuevo saldo
    } catch (error) {
        mostrarNotificacion("Error al registrar comprobante: " + error.message, "error");
    } finally {
        const btn = formComprobante.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Registrar en Cta. Cte.';
    }
}

// --- Lógica de Importación Inteligente (PDF) ---
async function handlePdfImport() {
    const file = inputPdfImport.files[0];
    if (!file) return mostrarNotificacion("Seleccione un archivo PDF primero.", "warning");

    try {
        btnParsePdf.disabled = true;
        btnParsePdf.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) { // Revisamos solo las primeras 2 páginas
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(" ") + "\n";
        }

        console.log("Texto extraído del PDF:", fullText);
        const data = extractVoucherData(fullText);

        if (data.fecha) {
            // Convertir dd/mm/aaaa a aaaa-mm-dd
            const parts = data.fecha.split('/');
            compFecha.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (data.tipo) compTipo.value = data.tipo;
        if (data.prefijo) compPrefijo.value = data.prefijo.padStart(4, '0');
        if (data.numero) compNumero.value = data.numero.padStart(8, '0');
        if (data.total) compTotal.value = data.total;

        mostrarNotificacion("Datos extraídos con éxito.", "success");
    } catch (error) {
        console.error("Error al procesar PDF:", error);
        mostrarNotificacion("No se pudo leer el PDF. Asegúrese de que sea una Factura AFIP original.", "error");
    } finally {
        btnParsePdf.disabled = false;
        btnParsePdf.innerHTML = '<i class="fas fa-search"></i> Escanear';
    }
}

// --- Lógica de Registro de Pago (Mixto) ---
let modalPago, formPago, btnAgregarMetodo, metodosContainer, tplPagoFila,
    facturasContainer, totalSelPago, totalEspPago, totalIngPago, difPago, datePago;

let facturasPendientesArr = [];
let chequesCarteraArr = [];

async function abrirModalPagoProveedor(proveedorId) {
    if (!modalPago) return;
    const fila = document.querySelector(`#tabla-proveedores tbody tr[data-proveedor-id="${proveedorId}"]`);
    const nombre = fila ? fila.dataset.proveedorNombre : `ID ${proveedorId}`;
    
    document.getElementById('pago-proveedor-id-hidden').value = proveedorId;
    modalPago.querySelector('h3').innerHTML = `<i class="fas fa-hand-holding-usd"></i> Registrar Pago: ${nombre}`;
    
    facturasContainer.innerHTML = '<p style="text-align: center;">Cargando facturas...</p>';
    metodosContainer.innerHTML = '';
    datePago.valueAsDate = new Date();
    totalSelPago.textContent = '$ 0.00';
    actualizarTotalesPago();

    modalPago.style.display = 'flex';

    try {
        // Cargar facturas pendientes y cheques en cartera en paralelo
        const [facturas, cheques] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores/${proveedorId}/facturas-pendientes`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/cheques?tipo=tercero&estado=en_cartera`)
        ]);
        
        facturasPendientesArr = facturas || [];
        chequesCarteraArr = cheques || [];
        
        renderizarFacturasPendientes();
        agregarFilaMetodoPago(); // Agregar primera fila por defecto (Efectivo)
    } catch (error) {
        console.error("Error al cargar datos de pago:", error);
        mostrarNotificacion("No se pudieron cargar las facturas o cheques.", "error");
    }
}

function renderizarFacturasPendientes() {
    if (facturasPendientesArr.length === 0) {
        facturasContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 10px;">No hay facturas pendientes para este proveedor.</p>';
        return;
    }

    let html = '<table class="table-sm" style="width: 100%; font-size: 0.85em;">';
    html += '<thead><tr><th></th><th>Factura</th><th>Vence</th><th>Saldo</th><th style="width: 80px;">A Pagar</th></tr></thead><tbody>';
    facturasPendientesArr.forEach(f => {
        html += `
            <tr>
                <td><input type="checkbox" class="chk-factura" data-id="${f.id}" data-saldo="${f.saldo_pendiente}"></td>
                <td>${f.factura_type} ${f.factura_prefijo}-${f.factura_numero}</td>
                <td style="white-space: nowrap;">${formatDate(f.fecha)}</td>
                <td style="text-align: right;">${formatCurrency(f.saldo_pendiente)}</td>
                <td>
                    <input type="number" class="input-aplicar" data-id="${f.id}" step="0.01" min="0" max="${f.saldo_pendiente}" 
                           value="${f.saldo_pendiente}" style="width: 100%; padding: 2px; text-align: right;" disabled>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    facturasContainer.innerHTML = html;

    // Listeners para los checkboxes e inputs
    facturasContainer.querySelectorAll('.chk-factura').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            const input = row.querySelector('.input-aplicar');
            input.disabled = !e.target.checked;
            if (e.target.checked) input.value = e.target.dataset.saldo;
            actualizarTotalesPago();
        });
    });

    facturasContainer.querySelectorAll('.input-aplicar').forEach(input => {
        input.addEventListener('input', () => {
             const max = parseFloat(input.getAttribute('max'));
             let val = parseFloat(input.value) || 0;
             if (val > max) input.value = max;
             if (val < 0) input.value = 0;
             actualizarTotalesPago();
        });
    });
}

function agregarFilaMetodoPago() {
    const clone = tplPagoFila.content.cloneNode(true);
    const row = clone.querySelector('.pago-metodo-fila');
    const select = row.querySelector('.select-metodo');
    const input = row.querySelector('.input-monto');
    const btnRemover = row.querySelector('.btn-remover-metodo');
    const extraFields = row.querySelector('.extra-fields');

    select.addEventListener('change', () => handleMetodoChange(select, extraFields));
    input.addEventListener('input', actualizarTotalesPago);
    btnRemover.addEventListener('click', () => {
        row.remove();
        actualizarTotalesPago();
    });

    metodosContainer.appendChild(clone);
    actualizarTotalesPago();
}

function handleMetodoChange(select, extraContainer) {
    const metodo = select.value;
    extraContainer.innerHTML = '';
    extraContainer.style.display = 'grid';
    extraContainer.style.gridTemplateColumns = '1fr 1fr';
    extraContainer.style.gap = '10px';

    if (metodo === 'Transferencia') {
        extraContainer.innerHTML = `
            <input type="text" class="form-control input-banco" placeholder="Banco" required>
            <input type="text" class="form-control input-ref" placeholder="Nro Transacción" required>
        `;
    } else if (metodo === 'Cheque Tercero') {
        let options = '<option value="">-- Seleccionar Cheque --</option>';
        chequesCarteraArr.forEach(c => {
            options += `<option value="${c.id}" data-monto="${c.monto}">${c.banco} #${c.numero_cheque} (${formatCurrency(c.monto)})</option>`;
        });
        extraContainer.innerHTML = `
            <select class="form-control select-cheque-id" style="grid-column: 1 / span 2;" required>${options}</select>
        `;
        const selCheque = extraContainer.querySelector('.select-cheque-id');
        selCheque.addEventListener('change', () => {
            const opt = selCheque.selectedOptions[0];
            const monto = opt?.dataset.monto || 0;
            const row = select.closest('.pago-metodo-fila');
            row.querySelector('.input-monto').value = monto;
            actualizarTotalesPago();
        });
    } else if (metodo === 'Cheque Propio') {
        extraContainer.innerHTML = `
            <input type="text" class="form-control input-banco" placeholder="Banco" required>
            <input type="text" class="form-control input-ref" placeholder="Nro Cheque" required>
            <div style="grid-column: 1 / span 2;">
                <label style="font-size: 0.8em; color: #666;">Vencimiento Cheque:</label>
                <input type="date" class="form-control input-venc-cheque" required>
            </div>
        `;
    } else {
        extraContainer.style.display = 'none';
    }
}

function actualizarTotalesPago() {
    // 1. Total seleccionado de facturas
    let totalSel = 0;
    if (facturasContainer) {
        facturasContainer.querySelectorAll('.chk-factura:checked').forEach(chk => {
            const row = chk.closest('tr');
            const input = row.querySelector('.input-aplicar');
            totalSel += parseFloat(input.value || 0);
        });
    }
    totalSelPago.textContent = formatCurrency(totalSel);
    totalEspPago.textContent = formatCurrency(totalSel);

    // 2. Total ingresado en métodos de pago
    let totalIng = 0;
    if (metodosContainer) {
        metodosContainer.querySelectorAll('.input-monto').forEach(inp => {
            totalIng += parseFloat(inp.value || 0);
        });
    }
    totalIngPago.textContent = formatCurrency(totalIng);

    // 3. Diferencia
    const diff = totalSel - totalIng;
    difPago.textContent = formatCurrency(Math.abs(diff));
    difPago.style.color = Math.abs(diff) < 0.01 ? '#11998e' : '#e74c3c';
}

async function handleConfirmarPago(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const proveedorId = document.getElementById('pago-proveedor-id-hidden').value;
    
    // 1. Recopilar aplicaciones (pueden ser parciales)
    const aplicaciones = [];
    facturasContainer.querySelectorAll('.chk-factura:checked').forEach(chk => {
        const row = chk.closest('tr');
        const input = row.querySelector('.input-aplicar');
        aplicaciones.push({
            ingreso_id: parseInt(chk.dataset.id),
            monto_aplicado: parseFloat(input.value) || 0
        });
    });

    // 2. Recopilar detalles de pago
    const detalles = [];
    let errorMonto = false;
    metodosContainer.querySelectorAll('.pago-metodo-fila').forEach(row => {
        const metodo = row.querySelector('.select-metodo').value;
        const monto = parseFloat(row.querySelector('.input-monto').value);
        if (isNaN(monto) || monto <= 0) {
            errorMonto = true;
            return;
        }

        const det = { metodo_pago: metodo, monto: monto };
        
        if (metodo === 'Transferencia') {
            det.banco = row.querySelector('.input-banco').value;
            det.referencia = row.querySelector('.input-ref').value;
        } else if (metodo === 'Cheque Tercero') {
            const chkId = row.querySelector('.select-cheque-id').value;
            if (!chkId) errorMonto = true;
            det.cheque_id = parseInt(chkId);
        } else if (metodo === 'Cheque Propio') {
            det.banco = row.querySelector('.input-banco').value;
            det.referencia = row.querySelector('.input-ref').value;
            det.fecha_vencimiento = row.querySelector('.input-venc-cheque').value;
        }
        detalles.push(det);
    });

    if (errorMonto) return mostrarNotificacion("Revise los métodos de pago y montos.", "warning");
    if (detalles.length === 0) return mostrarNotificacion("Debe ingresar al menos un método de pago.", "warning");

    const totalIng = detalles.reduce((acc, d) => acc + d.monto, 0);
    const totalAplicado = aplicaciones.reduce((acc, a) => acc + a.monto_aplicado, 0);

    // 3. Validaciones de negocio
    if (totalIng < totalAplicado - 0.01) {
        return mostrarNotificacion(`El monto total ingresado (${formatCurrency(totalIng)}) no es suficiente para cubrir lo que intenta aplicar (${formatCurrency(totalAplicado)}).`, "warning");
    }

    let confirmMsg = "¿Está seguro de registrar este pago?";
    if (aplicaciones.length === 0) {
        confirmMsg = `Está registrando un pago de ${formatCurrency(totalIng)} COMPLETAMENTE A CUENTA. El saldo del proveedor bajará pero no se aplicará a facturas específicas. ¿Continuar?`;
    } else if (totalIng > totalAplicado + 0.01) {
        const diferencia = totalIng - totalAplicado;
        confirmMsg = `El total ingresado (${formatCurrency(totalIng)}) es mayor al total aplicado (${formatCurrency(totalAplicado)}). La diferencia de ${formatCurrency(diferencia)} quedará como PAGO A CUENTA. ¿Continuar?`;
    }

    if (!confirm(confirmMsg)) return;

    // 4. Envío al servidor
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        }

        const payload = {
            proveedor_id: parseInt(proveedorId),
            monto_total: totalIng,
            aplicaciones: aplicaciones,
            detalles: detalles,
            fecha: document.getElementById('pago-fecha').value,
            caja_sesion_id: appState.cajaSesionIdActiva
        };

        await fetchData(`/api/negocios/${appState.negocioActivoId}/pagos-proveedores`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        mostrarNotificacion("Pago registrado correctamente.", "success");
        modalPago.style.display = 'none';
        cargarProveedores();
    } catch (error) {
        mostrarNotificacion("Error al registrar pago: " + error.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar y Registrar Pago';
        }
    }
}

// --- Lógica de Inicialización ---
function handleTablaClick(e) {
    const target = e.target;
    // Prevenir el comportamiento por defecto de los enlaces con href="#"
    if (target.closest('a[href="#"]')) {
        e.preventDefault();
    }

    const proveedorRow = target.closest('tr');
    const proveedorId = proveedorRow?.dataset.proveedorId;
    if (!proveedorId) return;
    const id = parseInt(proveedorId);

    if (target.closest('.btn-edit')) editarProveedor(id);
    else if (target.closest('.btn-delete')) borrarProveedor(id);
    else if (target.closest('.btn-ver-ingresos')) window.location.hash = `#historial_ingresos?proveedor=${id}`;
    else if (target.closest('.btn-ver-pagos')) window.location.hash = `#historial_pagos_proveedores?proveedor=${id}`;
    else if (target.closest('.btn-cta-cte')) abrirModalCtaCte(id);
    else if (target.closest('.btn-cargar-comprobante')) abrirModalComprobante(id);
    else if (target.closest('.btn-registrar-pago')) abrirModalPagoProveedor(id);
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

    // Elementos Carga Comprobante
    modalComprobante = document.getElementById('modal-cargar-comprobante');
    closeModalComprobante = document.getElementById('close-modal-comprobante');
    formComprobante = document.getElementById('form-comprobante');
    btnCancelarComprobante = document.getElementById('btn-cancelar-comprobante');
    compProveedorId = document.getElementById('comp-proveedor-id');
    compFecha = document.getElementById('comp-fecha');
    compTipo = document.getElementById('comp-tipo');
    compPrefijo = document.getElementById('comp-prefijo');
    compNumero = document.getElementById('comp-numero');
    compTotal = document.getElementById('comp-total');
    compReferencia = document.getElementById('comp-referencia');
    inputPdfImport = document.getElementById('comp-pdf-import');
    btnParsePdf = document.getElementById('btn-parse-pdf');

    if (!form || !tablaBody || !modalCtaCte || !closeModalCtaCte || !tituloModalCtaCte || !proveedorIdInputCtaCte || !fechaDesdeInputCtaCte || !fechaHastaInputCtaCte || !btnGenerarCtaCte || !reporteContainerCtaCte || !btnImprimirCtaCte || !btnExportarCtaCte) {
        console.error("Error Crítico: Faltan elementos HTML en proveedores.html.");
        return mostrarNotificacion("Error al cargar página proveedores.", "error");
    }

    tituloForm = document.getElementById('form-proveedor-titulo');
    idInput = document.getElementById('proveedor-id');
    nombreInput = document.getElementById('proveedor-nombre');
    cuitInput = document.getElementById('proveedor-cuit');
    condicionFiscalInput = document.getElementById('proveedor-condicion-fiscal');
    contactoInput = document.getElementById('proveedor-contacto');
    telefonoInput = document.getElementById('proveedor-telefono');
    emailInput = document.getElementById('proveedor-email');
    condicionesPagoInput = document.getElementById('proveedor-condiciones-pago');
    datosBancariosInput = document.getElementById('proveedor-datos-bancarios');
    btnCancelar = document.getElementById('btn-cancelar-edicion');
    filtroInput = document.getElementById('filtro-proveedor');

    if (!tituloForm || !idInput || !nombreInput || !btnCancelar) {
        console.error("Faltan elementos internos en el formulario.");
    }

    if (filtroInput) {
        filtroInput.addEventListener('input', renderizarTabla);
    }

    // Limpiar listeners
    form.removeEventListener('submit', guardarProveedor);
    btnCancelar.removeEventListener('click', resetFormulario);
    tablaBody.removeEventListener('click', handleTablaClick);
    closeModalCtaCte.removeEventListener('click', closeModalCtaCteHandler);
    btnGenerarCtaCte.removeEventListener('click', generarReporteCtaCte);
    btnImprimirCtaCte.removeEventListener('click', imprimirReporteCtaCte);
    btnExportarCtaCte.removeEventListener('click', exportarReporteCtaCteExcel);

    if (closeModalComprobante) closeModalComprobante.removeEventListener('click', cerrarModalComprobante);
    if (btnCancelarComprobante) btnCancelarComprobante.removeEventListener('click', cerrarModalComprobante);
    if (formComprobante) formComprobante.removeEventListener('submit', guardarComprobante);
    if (btnParsePdf) btnParsePdf.removeEventListener('click', handlePdfImport);

    console.log("Listeners de proveedores limpiados.");

    // Añadir listeners
    if (form) form.addEventListener('submit', guardarProveedor);
    if (btnCancelar) btnCancelar.addEventListener('click', resetFormulario);
    if (tablaBody) tablaBody.addEventListener('click', handleTablaClick);
    if (closeModalCtaCte) closeModalCtaCte.addEventListener('click', closeModalCtaCteHandler);
    if (btnGenerarCtaCte) btnGenerarCtaCte.addEventListener('click', generarReporteCtaCte);
    if (btnImprimirCtaCte) btnImprimirCtaCte.addEventListener('click', imprimirReporteCtaCte);
    if (btnExportarCtaCte) btnExportarCtaCte.addEventListener('click', exportarReporteCtaCteExcel);

    if (closeModalComprobante) closeModalComprobante.addEventListener('click', cerrarModalComprobante);
    if (btnCancelarComprobante) btnCancelarComprobante.addEventListener('click', cerrarModalComprobante);
    if (formComprobante) formComprobante.addEventListener('submit', guardarComprobante);
    if (btnParsePdf) btnParsePdf.addEventListener('click', handlePdfImport);

    console.log("Listeners de proveedores añadidos.");

    // Elementos Pago Proveedor
    modalPago = document.getElementById('modal-pago-proveedor');
    formPago = document.getElementById('form-pago-proveedor');
    btnAgregarMetodo = document.getElementById('btn-agregar-metodo-pago');
    metodosContainer = document.getElementById('metodos-pago-container');
    tplPagoFila = document.getElementById('tpl-pago-fila');
    facturasContainer = document.getElementById('facturas-pendientes-container');
    totalSelPago = document.getElementById('total-seleccionado-pago');
    totalEspPago = document.getElementById('pago-total-esperado');
    totalIngPago = document.getElementById('pago-total-ingresado');
    difPago = document.getElementById('pago-diferencia');
    datePago = document.getElementById('pago-fecha');

    if (modalPago) {
        const closeBtn = document.getElementById('close-modal-pago-proveedor');
        const cancelBtn = document.getElementById('btn-cancelar-pago-proveedor');
        if (closeBtn) closeBtn.onclick = () => modalPago.style.display = 'none';
        if (cancelBtn) cancelBtn.onclick = () => modalPago.style.display = 'none';
        if (btnAgregarMetodo) btnAgregarMetodo.onclick = agregarFilaMetodoPago;
        if (formPago) formPago.onsubmit = handleConfirmarPago;
    }

    cargarProveedores();
    resetFormulario();
    console.log("Lógica de proveedores inicializada.");
}

