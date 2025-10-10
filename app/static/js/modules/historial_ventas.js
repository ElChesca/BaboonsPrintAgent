// app/static/js/modules/historial_ventas.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';

export function inicializarLogicaHistorialVentas() {
    const btnFiltrar = document.getElementById('btn-filtrar-ventas');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', cargarHistorialVentas);
    }
    cargarHistorialVentas(); // Carga inicial
}

async function cargarHistorialVentas() {
    if (!appState.negocioActivoId) return;

    const fechaDesde = document.getElementById('fecha-desde').value;
    const fechaHasta = document.getElementById('fecha-hasta').value;

    let url = `/api/negocios/${appState.negocioActivoId}/ventas`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);

    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Error al cargar el historial.');
        const historial = await response.json();

        const tbody = document.querySelector('#tabla-historial-ventas tbody');
        const totalEl = document.getElementById('total-historial-ventas');
        if (!tbody || !totalEl) return;

        tbody.innerHTML = '';
        let totalGeneral = 0; // ✨ NUEVO: Variable para sumar el total

        historial.forEach(venta => {
            const fecha = new Date(venta.fecha).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            totalGeneral += venta.total; // Sumamos al total

            // ✨ CAMBIO: Añadimos las nuevas celdas (ID y Metodo de Pago)
            tbody.innerHTML += `
                <tr class="master-row" onclick="mostrarDetalleVenta(${venta.id}, this)">
                    <td>${venta.id}</td>
                    <td>${fecha}</td>
                    <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                    <td>${venta.metodo_pago}</td>
                    <td>$${venta.total.toFixed(2)}</td>
                    <td><button>🔽</button></td>
                </tr>
            `;
        });

        // ✨ NUEVO: Actualizamos el elemento del total en el tfoot
        totalEl.textContent = `$${totalGeneral.toFixed(2)}`;

    } catch (error) {
        console.error("Error en cargarHistorialVentas:", error);
        // Podrías mostrar una notificación al usuario aquí
    }
}

export async function mostrarDetalleVenta(ventaId, masterRow) {
    const existingDetail = document.querySelector('.detail-row');
    if (existingDetail) existingDetail.remove();
    
    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));

    if (masterRow.nextElementSibling && masterRow.nextElementSibling.classList.contains('detail-row')) {
        // Si el detalle ya está abierto debajo de esta fila, simplemente lo cerramos y salimos.
        return;
    }
    
    masterRow.classList.add('active');

    const response = await fetch(`/api/ventas/${ventaId}/detalles`, { headers: getAuthHeaders() });
    const detalles = await response.json();

    // ✨ CAMBIO: El colspan ahora es 6 para abarcar todas las columnas
    let detailHtml = '<td colspan="6" style="background-color: #fafafa; padding: 20px;"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead><tbody>';
    detalles.forEach(d => {
        detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>$${d.precio_unitario.toFixed(2)}</td></tr>`;
    });
    detailHtml += '</tbody></table></td>';

    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row';
    detailRow.innerHTML = detailHtml;
    masterRow.insertAdjacentElement('afterend', detailRow);
}