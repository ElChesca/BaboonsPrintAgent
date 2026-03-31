// app/static/js/comisiones.js
// Módulo de Liquidación de Comisiones de Vendedores - Compatible con el sistema SPA

import { fetchData, sendData } from './api.js';
import { appState } from './main.js';
import { mostrarNotificacion } from './modules/notifications.js';

// Estado local del módulo
let currentCalculoState = null;

export function inicializarComisiones() {
    // Fechas por defecto: mes actual
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const fechaDesde = document.getElementById('fechaDesdeInput');
    const fechaHasta = document.getElementById('fechaHastaInput');
    if (fechaDesde) fechaDesde.value = primerDia.toISOString().split('T')[0];
    if (fechaHasta) fechaHasta.value = hoy.toISOString().split('T')[0];

    // Event Listeners Tabs
    const reglaTab = document.getElementById('reglas-tab');
    const historialTab = document.getElementById('historial-tab');
    if (reglaTab) reglaTab.addEventListener('click', cargarReglas);
    if (historialTab) historialTab.addEventListener('click', cargarHistorial);

    // Event Listeners Formularios
    const formGlobal = document.getElementById('formReglaGlobal');
    const formEspecifica = document.getElementById('formReglaEspecifica');
    const btnCalcular = document.getElementById('btnCalcular');
    const btnConfirmar = document.getElementById('btnConfirmarLiquidacion');

    if (formGlobal) formGlobal.addEventListener('submit', guardarReglaGlobal);
    if (formEspecifica) formEspecifica.addEventListener('submit', guardarReglaEspecifica);
    if (btnCalcular) btnCalcular.addEventListener('click', calcularLiquidacion);
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarLiquidacion);

    // Exponer funciones necesarias para onclick en el HTML
    window.abrirModalExcepcion = abrirModalExcepcion;
    window.editarExcepcion = editarExcepcion;

    // Cargar vendedores para los selects
    cargarVendedoresSelects();
}

async function cargarVendedoresSelects() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
        const selectLiquidar = document.getElementById('liquidarVendedorSelect');
        const selectModal = document.getElementById('re_vendedor_id');

        let optionsHTML = '<option value="">Seleccione un vendedor...</option>';
        (data || []).forEach(v => {
            optionsHTML += `<option value="${v.id}">${v.nombre}</option>`;
        });

        if (selectLiquidar) selectLiquidar.innerHTML = optionsHTML;
        if (selectModal) selectModal.innerHTML = optionsHTML;
    } catch (err) {
        console.error('Error cargando vendedores:', err);
    }
}

// ====================== REGLAS ======================

async function cargarReglas() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/comisiones/reglas`);

        if (data.status === 'success') {
            if (data.global) {
                document.getElementById('rg_porcentaje').value = data.global.porcentaje || 0;
                document.getElementById('rg_monto_fijo').value = data.global.monto_fijo || 0;
                document.getElementById('rg_cc').checked = data.global.comisiona_cuenta_corriente || false;
            } else {
                document.getElementById('formReglaGlobal').reset();
            }

            const tbody = document.getElementById('listaExcepcionesBody');
            if (data.vendedores && data.vendedores.length > 0) {
                tbody.innerHTML = data.vendedores.map(r => `
                    <tr>
                        <td class="fw-bold">${r.vendedor_nombre}</td>
                        <td>
                            ${Number(r.porcentaje) > 0 ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-percent me-1"></i>${r.porcentaje}%</span>` : ''}
                            ${Number(r.monto_fijo) > 0 ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="fas fa-dollar-sign me-1"></i>${r.monto_fijo} Fijo</span>` : ''}
                        </td>
                        <td class="text-center">
                            ${r.comisiona_cuenta_corriente ? '<i class="fas fa-check-circle text-success fs-5"></i>' : '<i class="fas fa-times-circle text-danger fs-5"></i>'}
                        </td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-light text-primary" onclick="editarExcepcion(${r.vendedor_id}, ${r.porcentaje}, ${r.monto_fijo}, ${r.comisiona_cuenta_corriente})"><i class="fas fa-edit"></i></button>
                        </td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 bg-light rounded text-muted">No hay excepciones. Todos usan la regla global.</td></tr>';
            }
        }
    } catch (err) {
        mostrarNotificacion('Error al cargar reglas', 'error');
        console.error(err);
    }
}

async function guardarRegla(vendedor_id, porcentaje, monto_fijo, cc, isGlobal = true) {
    try {
        if (!porcentaje && !monto_fijo) {
            mostrarNotificacion('Debe especificar un porcentaje o un monto fijo.', 'warning');
            return;
        }

        const data = await sendData(`/api/negocios/${appState.negocioActivoId}/comisiones/reglas`, {
            vendedor_id,
            porcentaje: parseFloat(porcentaje) || 0,
            monto_fijo: parseFloat(monto_fijo) || 0,
            comisiona_cuenta_corriente: cc
        });

        if (data.status === 'success') {
            mostrarNotificacion(data.message, 'success');
            cargarReglas();
            if (!isGlobal) {
                const modalEl = document.getElementById('modalExcepcion');
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
        } else {
            mostrarNotificacion('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarNotificacion('Error al guardar regla.', 'error');
    }
}

function guardarReglaGlobal(e) {
    e.preventDefault();
    const p = document.getElementById('rg_porcentaje').value;
    const m = document.getElementById('rg_monto_fijo').value;
    const c = document.getElementById('rg_cc').checked;
    guardarRegla(null, p, m, c, true);
}

function guardarReglaEspecifica(e) {
    e.preventDefault();
    const v = document.getElementById('re_vendedor_id').value;
    const p = document.getElementById('re_porcentaje').value;
    const m = document.getElementById('re_monto_fijo').value;
    const c = document.getElementById('re_cc').checked;

    if (!v) {
        mostrarNotificacion('Seleccione un vendedor.', 'warning');
        return;
    }
    guardarRegla(v, p, m, c, false);
}

function abrirModalExcepcion() {
    document.getElementById('formReglaEspecifica').reset();
    document.getElementById('re_vendedor_id').disabled = false;
    new bootstrap.Modal(document.getElementById('modalExcepcion')).show();
}

function editarExcepcion(vendedorId, porc, monto, cc) {
    document.getElementById('re_vendedor_id').value = vendedorId;
    document.getElementById('re_vendedor_id').disabled = true;
    document.getElementById('re_porcentaje').value = porc;
    document.getElementById('re_monto_fijo').value = monto;
    document.getElementById('re_cc').checked = cc;
    new bootstrap.Modal(document.getElementById('modalExcepcion')).show();
}

// ====================== LIQUIDACIÓN ======================

async function calcularLiquidacion() {
    const btn = document.getElementById('btnCalcular');
    const vId = document.getElementById('liquidarVendedorSelect').value;
    const fDesde = document.getElementById('fechaDesdeInput').value;
    const fHasta = document.getElementById('fechaHastaInput').value;

    if (!vId || !fDesde || !fHasta) {
        mostrarNotificacion('Complete Vendedor y el rango de fechas', 'warning');
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/comisiones/previsualizar?vendedor_id=${vId}&fecha_desde=${fDesde}&fecha_hasta=${fHasta}`);

        if (data.status === 'success') {
            currentCalculoState = {
                vendedor_id: vId,
                fecha_desde: fDesde,
                fecha_hasta: fHasta,
                resumen: data.resumen,
                ventas_ids: data.ventas.map(v => v.id)
            };
            mostrarResultadoSimulacion(data);
        } else {
            mostrarNotificacion(data.message, 'error');
            document.getElementById('resultadoSimulacion').classList.add('d-none');
        }
    } catch (err) {
        mostrarNotificacion('Error al procesar el cálculo', 'error');
        console.error(err);
    } finally {
        btn.innerHTML = '<i class="fas fa-search me-2"></i> Calcular';
        btn.disabled = false;
    }
}

function mostrarResultadoSimulacion(data) {
    const resultDiv = document.getElementById('resultadoSimulacion');
    const emptyDiv = document.getElementById('simulacionVacia');

    if (data.ventas.length === 0) {
        resultDiv.classList.add('d-none');
        emptyDiv.classList.remove('d-none');
        return;
    }

    emptyDiv.classList.add('d-none');
    resultDiv.classList.remove('d-none');

    document.getElementById('resumenCantOp').textContent = data.resumen.cantidad_operaciones;
    document.getElementById('resumenRegla').textContent = data.resumen.regla_aplicada;

    let det = [];
    if (data.resumen.porcentaje > 0) det.push(`${data.resumen.porcentaje}%`);
    if (data.resumen.monto_fijo > 0) det.push(`$${data.resumen.monto_fijo} fijo`);
    document.getElementById('resumenDetalle').textContent = det.join(' + ');
    document.getElementById('resumenTotal').textContent = data.resumen.monto_total_comision.toFixed(2);

    const tbody = document.getElementById('listaVentasLiquidarBody');
    tbody.innerHTML = data.ventas.map(v => {
        let badgeTipo = v.tipo_factura
            ? '<span class="badge bg-info text-dark">V. Directa</span>'
            : '<span class="badge bg-secondary">Pedido</span>';

        let comisionHTML = `$${v.comision_calculada.toFixed(2)}`;
        if (v.comision_calculada === 0) comisionHTML = `<span class="text-danger small"><i class="fas fa-times me-1"></i>No aplica</span>`;

        return `
        <tr>
            <td class="small">${new Date(v.fecha).toLocaleString()}</td>
            <td>${badgeTipo}</td>
            <td class="fw-bold">$${Number(v.total).toFixed(2)}</td>
            <td class="small text-muted">
                ${v.metodo_pago === 'Cuenta Corriente' ? '<i class="fas fa-book-open text-warning me-1"></i>' : '<i class="fas fa-money-bill-wave text-success me-1"></i>'}
                ${v.metodo_pago || 'N/A'}
            </td>
            <td class="text-end fw-bold text-primary">${comisionHTML}</td>
        </tr>`;
    }).join('');
}

async function confirmarLiquidacion() {
    if (!currentCalculoState || currentCalculoState.ventas_ids.length === 0) {
        mostrarNotificacion('No hay cálculos para asentar', 'warning');
        return;
    }

    if (!confirm(`¿Está seguro de cerrar esta liquidación por un total de $${currentCalculoState.resumen.monto_total_comision.toFixed(2)}?\n\nLas ventas seleccionadas no podrán volver a comisionarse.`)) {
        return;
    }

    const obs = document.getElementById('observacionesLiquidacion').value;
    const btn = document.getElementById('btnConfirmarLiquidacion');

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asentando...';
        btn.disabled = true;

        const data = await sendData(`/api/negocios/${appState.negocioActivoId}/comisiones/liquidar`, {
            vendedor_id: currentCalculoState.vendedor_id,
            fecha_desde: currentCalculoState.fecha_desde,
            fecha_hasta: currentCalculoState.fecha_hasta,
            monto_total: currentCalculoState.resumen.monto_total_comision,
            cantidad_operaciones: currentCalculoState.resumen.cantidad_operaciones,
            ventas_ids: currentCalculoState.ventas_ids,
            observaciones: obs
        });

        if (data.status === 'success') {
            mostrarNotificacion('Liquidación registrada con el Comprobante #' + data.liquidacion_id, 'success');
            document.getElementById('resultadoSimulacion').classList.add('d-none');
            document.getElementById('observacionesLiquidacion').value = '';
            currentCalculoState = null;
        } else {
            mostrarNotificacion('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarNotificacion('Error al asentar liquidación', 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-check-circle me-1"></i> Confirmar Liquidación';
        btn.disabled = false;
    }
}

// ====================== HISTORIAL ======================

async function cargarHistorial() {
    try {
        const tbody = document.getElementById('historialBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm" role="status"></div> Cargando...</td></tr>';

        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/comisiones/historial`);

        if (data.status === 'success') {
            if (data.historial.length > 0) {
                tbody.innerHTML = data.historial.map(h => `
                 <tr>
                    <td class="fw-bold text-secondary">#${h.id}</td>
                    <td>${new Date(h.fecha_liquidacion).toLocaleString()}</td>
                    <td class="fw-bold text-dark"><i class="fas fa-user-circle text-muted me-1"></i>${h.vendedor_nombre}</td>
                    <td class="small"><span class="badge bg-light text-dark border"><i class="fas fa-calendar-alt me-1"></i>${h.fecha_desde} a ${h.fecha_hasta}</span></td>
                    <td class="text-center fw-medium">${h.cantidad_operaciones}</td>
                    <td class="small text-muted text-truncate" style="max-width: 150px;" title="${h.observaciones || ''}">${h.observaciones || '-'}</td>
                    <td class="text-end fw-bold text-success fs-6">$${Number(h.monto_total).toFixed(2)}</td>
                 </tr>`).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><i class="fas fa-box-open fa-2x mb-3 opacity-25 d-block"></i>No hay registros de liquidaciones.</td></tr>';
            }
        }
    } catch (err) {
        mostrarNotificacion('Error al cargar historial', 'error');
    }
}
