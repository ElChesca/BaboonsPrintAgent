// app/static/js/modules/historial_ventas.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';

export function inicializarLogicaHistorialVentas() {
    const btnFiltrar = document.getElementById('btn-filtrar-ventas');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', cargarHistorialVentas);
    }
    // Carga inicial al entrar en la página
    cargarHistorialVentas();
}

async function cargarHistorialVentas() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;

    // Construimos la URL con los filtros de fecha si existen
    let url = `/api/negocios/${appState.negocioActivoId}/ventas`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);

    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    const response = await fetch(url, { headers: getAuthHeaders() });
    const historial = await response.json();

    const tbody = document.querySelector('#tabla-historial-ventas tbody');
    if (!tbody) return; // Asegurarnos de que la tabla exista

    tbody.innerHTML = ''; // Limpiamos la tabla
    historial.forEach(venta => {
        const fecha = new Date(venta.fecha).toLocaleString('es-AR');
        tbody.innerHTML += `
            <tr class="master-row" onclick="mostrarDetalleVenta(${venta.id}, this)">
                <td>${fecha}</td>
                <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                <td>$${venta.total.toFixed(2)}</td>
                <td><button>🔽</button></td>
            </tr>
        `;
    });
}

export async function mostrarDetalleVenta(ventaId, masterRow) {
    const existingDetail = document.querySelector('.detail-row');
    if (existingDetail) existingDetail.remove();
    if (masterRow.classList.contains('active')) {
        masterRow.classList.remove('active');
        return;
    }

    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));
    masterRow.classList.add('active');

    const response = await fetch(`/api/ventas/${ventaId}/detalles`, { headers: getAuthHeaders() });
    const detalles = await response.json();

    let detailHtml = '<td colspan="4" style="background-color: #fafafa; padding: 20px;"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead><tbody>';
    detalles.forEach(d => {
        detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>$${d.precio_unitario.toFixed(2)}</td></tr>`;
    });
    detailHtml += '</tbody></table></td>';

    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row';
    detailRow.innerHTML = detailHtml;
    masterRow.insertAdjacentElement('afterend', detailRow);
}