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

    // ✨ MEJORA: Añadimos un listener único a la tabla para manejar todos los clics
    const tabla = document.querySelector('#tabla-historial-ventas tbody');
    if (tabla) {
        tabla.addEventListener('click', (e) => {
            // Buscamos la fila 'master-row' más cercana al elemento clickeado
            const fila = e.target.closest('tr.master-row');
            if (fila) {
                const ventaId = fila.dataset.ventaId;
                // Llamamos a la función global que está en window
                window.mostrarDetalleVenta(ventaId, fila);
            }
        });
    }
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
        // ✨ LA CORRECCIÓN CLAVE ESTÁ AQUÍ:
        // Nos aseguramos de que la llamada fetch SIEMPRE incluya los headers de autenticación.
        const response = await fetch(url, { headers: getAuthHeaders() });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al cargar el historial.');
        }
        const historial = await response.json();

        const tbody = document.querySelector('#tabla-historial-ventas tbody');
        const totalEl = document.getElementById('total-historial-ventas');
        if (!tbody || !totalEl) return;

        tbody.innerHTML = '';
        let totalGeneral = 0;

        historial.forEach(venta => {
            const fecha = new Date(venta.fecha).toLocaleString('es-AR');
            totalGeneral += venta.total;

            // ✨ MEJORA: Quitamos el 'onclick' y usamos 'data-venta-id' para un código más limpio.
            tbody.innerHTML += `
                <tr class="master-row" data-venta-id="${venta.id}">
                    <td>${venta.id}</td>
                    <td>${fecha}</td>
                    <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                    <td>${venta.metodo_pago}</td>
                    <td>$${venta.total.toFixed(2)}</td>
                    <td><button>🔽</button></td>
                </tr>
            `;
        });

        totalEl.textContent = `$${totalGeneral.toFixed(2)}`;

    } catch (error) {
        console.error("Error en cargarHistorialVentas:", error);
    }
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

    let detailHtml = '<td colspan="6"><table class="tabla-bonita" style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead><tbody>';
    detalles.forEach(d => {
        detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>$${d.precio_unitario.toFixed(2)}</td></tr>`;
    });
    detailHtml += '</tbody></table></td>';

    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row';
    detailRow.innerHTML = detailHtml;
    masterRow.insertAdjacentElement('afterend', detailRow);
}