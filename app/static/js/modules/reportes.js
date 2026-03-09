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
    const filterChoferCon = document.getElementById('filtro-chofer-container');
    const filterHRCon = document.getElementById('filtro-hr-container');

    containerVentas.style.display = tipo === 'ventas' ? 'block' : 'none';
    containerEntregas.style.display = tipo === 'entregas' ? 'block' : 'none';
    containerBajadas.style.display = tipo === 'bajadas_detalle' ? 'block' : 'none';

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

function exportarAPDF() {
    const tipo = document.getElementById('tipo-reporte').value;
    let elementId = 'reporte-container-ventas';
    if (tipo === 'entregas') elementId = 'reporte-container-entregas';
    if (tipo === 'bajadas_detalle') elementId = 'reporte-container-bajadas-detalle';

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

    // Ajustar orientación si es entregas (más columnas)
    if (tipo === 'entregas') {
        opt.jsPDF.orientation = 'landscape';
    } else {
        opt.jsPDF.orientation = 'portrait';
    }

    // Llamamos a la librería para que genere el PDF
    html2pdf().from(element).set(opt).save();
}
