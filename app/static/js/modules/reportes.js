// app/static/js/modules/reportes.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

export function inicializarLogicaReportes() {
    document.getElementById('btn-generar-reporte').addEventListener('click', generarReporteActual);
    document.getElementById('btn-exportar-pdf').addEventListener('click', exportarAPDF);
    document.getElementById('tipo-reporte').addEventListener('change', alternarVistaReporte);

    // Carga inicial
    alternarVistaReporte();
    generarReporteActual();
}

function alternarVistaReporte() {
    const tipo = document.getElementById('tipo-reporte').value;
    const containerVentas = document.getElementById('reporte-container-ventas');
    const containerEntregas = document.getElementById('reporte-container-entregas');

    if (tipo === 'ventas') {
        containerVentas.style.display = 'block';
        containerEntregas.style.display = 'none';
    } else {
        containerVentas.style.display = 'none';
        containerEntregas.style.display = 'block';
    }
}

async function generarReporteActual() {
    const tipo = document.getElementById('tipo-reporte').value;
    if (tipo === 'ventas') {
        await cargarReporteVentas();
    } else {
        await cargarReporteEntregas();
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

function exportarAPDF() {
    const tipo = document.getElementById('tipo-reporte').value;
    let elementId = tipo === 'ventas' ? 'reporte-container-ventas' : 'reporte-container-entregas';

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
