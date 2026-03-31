// app/static/js/modules/reportes.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

export function inicializarLogicaReportes() {
    document.getElementById('btn-generar-reporte').addEventListener('click', generarReporteActual);
    document.getElementById('btn-exportar-pdf').addEventListener('click', exportarAPDF);
    document.getElementById('tipo-reporte').addEventListener('change', alternarVistaReporte);

    // Carga inicial
    cargarChoferes();
    alternarVistaReporte();
    generarReporteActual();
}

function alternarVistaReporte() {
    const tipo = document.getElementById('tipo-reporte').value;
    const containerVentas = document.getElementById('reporte-container-ventas');
    const containerEntregas = document.getElementById('reporte-container-entregas');
    const containerBajadas = document.getElementById('reporte-container-bajadas-detalle');
    const containerHREjecutivo = document.getElementById('reporte-container-hr-ejecutivo');
    const filterChoferCon = document.getElementById('filtro-chofer-container');
    const filterHRCon = document.getElementById('filtro-hr-container');

    containerVentas.style.display = tipo === 'ventas' ? 'block' : 'none';
    containerEntregas.style.display = tipo === 'entregas' ? 'block' : 'none';
    containerBajadas.style.display = tipo === 'bajadas_detalle' ? 'block' : 'none';
    containerHREjecutivo.style.display = tipo === 'hr_ejecutivo' ? 'block' : 'none';

    // Solo mostramos el filtro de chofer y el de HR en el reporte detallado
    filterChoferCon.style.display = tipo === 'bajadas_detalle' ? 'flex' : 'none';
    filterHRCon.style.display = tipo === 'bajadas_detalle' ? 'flex' : 'none';
}

async function generarReporteActual() {
    const tipo = document.getElementById('tipo-reporte').value;
    if (tipo === 'ventas') {
        await cargarReporteVentas();
    } else if (tipo === 'entregas') {
        await cargarReporteEntregas();
    } else if (tipo === 'bajadas_detalle') {
        await cargarReporteBajadasDetalle();
    } else if (tipo === 'hr_ejecutivo') {
        await cargarReporteHREjecutivo();
    }
}

async function cargarReporteVentas() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;
    const negocioNombre = document.getElementById('selector-negocio').options[document.getElementById('selector-negocio').selectedIndex].text;

    let url = `/api/negocios/${appState.negocioActivoId}/reportes/ventas_diarias`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(data.error || 'Error al cargar reporte de ventas');
        }

        const tbody = document.querySelector('#tabla-reporte-ventas tbody');
        const tfootTotal = document.getElementById('reporte-total-general');
        document.getElementById('reporte-titulo-ventas').textContent = `Reporte de Ventas - ${negocioNombre}`;

        tbody.innerHTML = '';
        let totalGeneral = 0;
        data.forEach(row => {
            totalGeneral += row.total_vendido;
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(row.dia + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td>${row.cantidad_ventas}</td>
                    <td>$${row.total_vendido.toFixed(2)}</td>
                </tr>
            `;
        });

        tfootTotal.textContent = `$${totalGeneral.toFixed(2)}`;
    } catch (e) {
        console.error(e);
        mostrarNotificacion(e.message, 'error');
    }
}

async function cargarReporteEntregas() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;

    let url = `/api/negocios/${appState.negocioActivoId}/reportes/entregas`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(data.error || 'Error al cargar reporte de entregas');
        }

        const tbody = document.querySelector('#tabla-reporte-entregas tbody');
        document.getElementById('reporte-titulo-entregas').textContent = `Estado de Entregas (Logística)`;

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay hojas de ruta en este período.</td></tr>';
            return;
        }

        data.forEach(row => {
            const efectividadClass = row.efectividad >= 90 ? 'text-success' : (row.efectividad >= 50 ? 'text-warning' : 'text-danger');
            const estadoBadge = row.estado === 'finalizada' ? '<span class="badge bg-success">Finalizada</span>' :
                (row.estado === 'activa' ? '<span class="badge bg-primary">Activa</span>' : '<span class="badge bg-secondary">Borrador</span>');

            tbody.innerHTML += `
                <tr>
                    <td>${new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td>#${row.id}</td>
                    <td>
                        <strong>${row.vendedor_nombre}</strong><br>
                        <small class="text-muted"><i class="fas fa-truck"></i> ${row.vehiculo_patente || 'Sin Vehículo'}</small>
                    </td>
                    <td>${estadoBadge}</td>
                    <td>
                        <strong>${row.pedidos_entregados_count}</strong> / ${row.pedidos_total_count}
                    </td>
                    <td>
                        <strong>${row.total_kilos ? parseFloat(row.total_kilos).toFixed(2) : '0.00'}</strong> kg
                    </td>
                    <td>
                        Total: <strong>${row.total_clientes}</strong><br>
                        <small>Visitados: ${row.visitados_count}</small>
                    </td>
                    <td>
                        <strong class="${efectividadClass}">${row.efectividad.toFixed(1)}%</strong>
                    </td>
                    <td>$${row.total_recaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        mostrarNotificacion(e.message, 'error');
    }
}

async function cargarChoferes() {
    if (!appState.negocioActivoId) return;
    try {
        const response = await fetch(`/api/negocios/${appState.negocioActivoId}/vendedores`, { headers: getAuthHeaders() });
        const data = await response.json();
        const select = document.getElementById('filtro-chofer');
        if (!select) return;

        select.innerHTML = '<option value="">Todos</option>';
        data.forEach(v => {
            select.innerHTML += `<option value="${v.id}">${v.nombre}</option>`;
        });
    } catch (e) {
        console.error("Error cargando choferes:", e);
    }
}

async function cargarReporteBajadasDetalle() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;
    const choferId = document.getElementById('filtro-chofer').value;
    const hrId = document.getElementById('filtro-hr-id').value;

    let url = `/api/negocios/${appState.negocioActivoId}/reportes/bajadas-detalle`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (choferId) params.append('chofer_id', choferId);
    if (hrId) params.append('hoja_ruta_id', hrId);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(data.error || 'Error al cargar reporte detallado');
        }

        const tbody = document.querySelector('#tabla-reporte-bajadas-detalle tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay confirmaciones grabadas en este período.</td></tr>';
            return;
        }

        data.forEach(row => {
            const fechaHora = new Date(row.fecha_confirmacion).toLocaleString('es-AR');
            tbody.innerHTML += `
                <tr>
                    <td>${fechaHora}</td>
                    <td>#${row.hr_id}</td>
                    <td>${row.chofer_nombre}</td>
                    <td>${row.cliente_nombre}</td>
                    <td>#${row.pedido_id}</td>
                    <td>$${row.monto_pedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td><span class="badge bg-success">${row.estado}</span></td>
                    <td>${row.usuario_confirmacion || 'Sistema/App'}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        mostrarNotificacion(e.message, 'error');
    }
}

async function cargarReporteHREjecutivo() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;

    let url = `/api/negocios/${appState.negocioActivoId}/reportes/hojas-ruta-ejecutivo`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(data.error || 'Error al cargar reporte ejecutivo HR');
        }

        const tbody = document.getElementById('tbody-hr-ejecutivo');
        tbody.innerHTML = '';

        let totalNeto = 0;
        let totalBruto = 0;
        let totalBonif = 0;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No hay datos en este período.</td></tr>';
        } else {
            data.forEach(row => {
                totalNeto += row.importe_neto || 0;
                totalBruto += row.importe_bruto || 0;
                totalBonif += row.bonificacion_monto || 0;

                const fHR = row.hr_fecha ? new Date(row.hr_fecha).toLocaleDateString() : '-';
                const fEnt = row.fecha_entrega ? new Date(row.fecha_entrega).toLocaleString() : '-';

                const badgeEstado = (est) => {
                    const e = (est || '').toLowerCase();
                    if (e === 'entregado') return '<span class="badge bg-success">Entregado</span>';
                    if (e === 'pendiente') return '<span class="badge bg-warning text-dark">Pendiente</span>';
                    if (e === 'anulado') return '<span class="badge bg-danger">Anulado</span>';
                    return `<span class="badge bg-secondary">${est}</span>`;
                };

                tbody.innerHTML += `
                    <tr>
                        <td class="small">${fHR}</td>
                        <td class="fw-bold">#${row.hr_id}</td>
                        <td class="small">${row.cliente_nombre}</td>
                        <td class="text-end fw-bold text-success">$${(row.importe_neto || 0).toLocaleString()}</td>
                        <td class="text-end text-muted">$${(row.importe_bruto || 0).toLocaleString()}</td>
                        <td class="text-end text-danger">${row.bonificacion_monto > 0 ? '$' + row.bonificacion_monto.toLocaleString() : '-'}</td>
                        <td class="text-center small">${row.metodo_pago || '<span class="text-muted">N/D</span>'}</td>
                        <td class="small">${row.chofer_nombre || '-'}</td>
                        <td class="text-center">${badgeEstado(row.estado_pedido)}</td>
                        <td class="small text-muted" style="font-size: 0.75rem;">${fEnt}</td>
                    </tr>
                `;
            });
        }

        document.getElementById('total-hr-ejecutivo-neto').textContent = `$${totalNeto.toLocaleString()}`;
        document.getElementById('total-hr-ejecutivo-bruto').textContent = `$${totalBruto.toLocaleString()}`;
        document.getElementById('total-hr-ejecutivo-bonif').textContent = `$${totalBonif.toLocaleString()}`;

    } catch (e) {
        console.error(e);
        mostrarNotificacion(e.message, 'error');
    }
}

function exportarAPDF() {
    const tipo = document.getElementById('tipo-reporte').value;
    let elementId = 'reporte-container-ventas';
    if (tipo === 'entregas') elementId = 'reporte-container-entregas';
    if (tipo === 'bajadas_detalle') elementId = 'reporte-container-bajadas-detalle';
    if (tipo === 'hr_ejecutivo') elementId = 'reporte-container-hr-ejecutivo';

    const element = document.getElementById(elementId);
    const negocioNombre = document.getElementById('selector-negocio').options[document.getElementById('selector-negocio').selectedIndex].text;
    const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');

    const opt = {
        margin: 1,
        filename: `reporte_${tipo}_${negocioNombre}_${fecha}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'keyboard' } // Landscape mejor para entregas?
    };

    // Ajustar orientación si hay muchas columnas
    if (tipo === 'entregas' || tipo === 'hr_ejecutivo') {
        opt.jsPDF.orientation = 'landscape';
    } else {
        opt.jsPDF.orientation = 'portrait';
    }

    // Llamamos a la librería para que genere el PDF
    html2pdf().from(element).set(opt).save();
}
