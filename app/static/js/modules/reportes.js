// app/static/js/modules/reportes.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';

export function inicializarLogicaReportes() {
    document.getElementById('btn-generar-reporte').addEventListener('click', cargarReporteVentas);
    document.getElementById('btn-exportar-pdf').addEventListener('click', exportarAPDF);
    
    // Carga inicial
    cargarReporteVentas();
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

    const response = await fetch(url, { headers: getAuthHeaders() });
    const data = await response.json();

    const tbody = document.querySelector('#tabla-reporte-ventas tbody');
    const tfootTotal = document.getElementById('reporte-total-general');
    document.getElementById('reporte-titulo').textContent = `Reporte de Ventas - ${negocioNombre}`;
    
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
}

function exportarAPDF() {
    const element = document.getElementById('reporte-container');
    const negocioNombre = document.getElementById('selector-negocio').options[document.getElementById('selector-negocio').selectedIndex].text;
    const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    
    const opt = {
      margin:       1,
      filename:     `reporte_ventas_${negocioNombre}_${fecha}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Llamamos a la librería para que genere el PDF
    html2pdf().from(element).set(opt).save();
}