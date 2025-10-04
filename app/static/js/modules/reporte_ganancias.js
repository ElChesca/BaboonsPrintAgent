import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let reporteCache = [];

async function cargarReporte() {
    const fechaDesde = document.getElementById('filtro-fecha-desde-ganancias').value;
    const fechaHasta = document.getElementById('filtro-fecha-hasta-ganancias').value;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/reportes/ganancias?${params.toString()}`;
        reporteCache = await fetchData(url);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('Error al cargar el reporte: ' + error.message, 'error');
    }
}

function renderizarTabla() {
    const tablaBody = document.querySelector('#tabla-reporte-ganancias tbody');
    tablaBody.innerHTML = '';
    let totales = { ventas: 0, costo: 0, ganancia: 0 };

    if (reporteCache.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="5">No se encontraron registros.</td></tr>';
        return;
    }

    reporteCache.forEach(item => {
        totales.ventas += item.total_ventas;
        totales.costo += item.total_costo;
        totales.ganancia += item.ganancia_neta;
        const fila = `
            <tr>
                <td>${item.producto_nombre}</td>
                <td>${item.cantidad_vendida}</td>
                <td>$${item.total_ventas.toFixed(2)}</td>
                <td>$${item.total_costo.toFixed(2)}</td>
                <td class="diferencia-positiva">$${item.ganancia_neta.toFixed(2)}</td>
            </tr>
        `;
        tablaBody.innerHTML += fila;
    });

    // Renderizar totales en el footer de la tabla
    const filaTotales = document.getElementById('fila-totales-ganancias');
    filaTotales.innerHTML = `
        <td><strong>TOTALES</strong></td>
        <td>-</td>
        <td><strong>$${totales.ventas.toFixed(2)}</strong></td>
        <td><strong>$${totales.costo.toFixed(2)}</strong></td>
        <td class="diferencia-positiva"><strong>$${totales.ganancia.toFixed(2)}</strong></td>
    `;
}

function exportarAPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Reporte de Ganancias por Producto", 14, 16);
    doc.autoTable({
        html: '#tabla-reporte-ganancias', // Exporta la tabla tal como se ve
        startY: 20,
    });

    doc.save(`reporte_ganancias_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function inicializarLogicaReporteGanancias() {
    const btnFiltrar = document.getElementById('btn-filtrar-ganancias');
    const btnExportarPDF = document.getElementById('btn-exportar-ganancias-pdf');

    cargarReporte(); // Carga inicial

    btnFiltrar.addEventListener('click', cargarReporte);
    btnExportarPDF.addEventListener('click', exportarAPDF);
}