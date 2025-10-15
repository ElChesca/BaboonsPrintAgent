import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

async function cargarHistorialVentas() {
    if (!appState.negocioActivoId) return;

    const tbody = document.querySelector('#tabla-historial-ventas tbody');
    const totalEl = document.getElementById('total-historial-ventas');
    if (!tbody || !totalEl) return;

    // Lógica del filtro de fechas (Punto 2)
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
        const historial = await fetchData(url);
        tbody.innerHTML = '';
        let totalGeneral = 0;

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay ventas para el período seleccionado.</td></tr>';
        } else {
            historial.forEach(venta => {
                // ✨ CORRECCIÓN (Punto 1): Lógica para mostrar el estado correctamente
                const estado = venta.estado === 'Facturada' 
                    ? `<span class="status-badge status-convertido">${venta.tipo_factura || 'X'}: ${venta.numero_factura || 'N/A'}</span>`
                    : `<span class="status-badge status-pendiente">Pendiente</span>`;

                totalGeneral += venta.total;

                tbody.innerHTML += `
                    <tr class="master-row" data-id="${venta.id}">
                        <td>${venta.id}</td>
                        <td>${new Date(venta.fecha).toLocaleString('es-AR')}</td>
                        <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                        <td>${venta.metodo_pago}</td>
                        <td>${formatCurrency(venta.total)}</td>
                        <td>${estado}</td>
                        <td class="acciones">
                            <button class="btn-secondary btn-ver-detalles">🔽</button>
                            ${venta.estado !== 'Facturada' ? '<button class="btn-primary btn-facturar">Facturar</button>' : ''}
                        </td>
                    </tr>
                `;
            });
        }
        totalEl.textContent = formatCurrency(totalGeneral);
    } catch (error) {
        console.error("Error en cargarHistorialVentas:", error);
        mostrarNotificacion(error.message, 'error');
    }
}

async function mostrarDetalleVenta(ventaId, masterRow) {
    const existingDetail = document.querySelector('.detail-row');
    if (existingDetail) {
        existingDetail.remove();
        if (masterRow.classList.contains('active')) {
            masterRow.classList.remove('active');
            return;
        }
    }

    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));
    masterRow.classList.add('active');

    try {
        const detalles = await fetchData(`/api/ventas/${ventaId}/detalles`);
        let detailHtml = '<td colspan="7"><table class="tabla-bonita" style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead><tbody>';
        detalles.forEach(d => {
            detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>${formatCurrency(d.precio_unitario)}</td></tr>`;
        });
        detailHtml += '</tbody></table></td>';

        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.innerHTML = detailHtml;
        masterRow.insertAdjacentElement('afterend', detailRow);
    } catch (error) {
        mostrarNotificacion('Error al cargar los detalles de la venta.', 'error');
    }
}

async function facturar(ventaId, tipo) {
    try {
        const response = await fetchData(`/api/ventas/${ventaId}/facturar`, {
            method: 'POST', body: JSON.stringify({ tipo: tipo })
        });
        mostrarNotificacion(response.message, 'success');
        document.getElementById('modal-facturar').style.display = 'none';
        cargarHistorialVentas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaHistorialVentas() {
    const tablaBody = document.querySelector('#tabla-historial-ventas tbody');
    const btnFiltrar = document.getElementById('btn-filtrar-ventas');
    if (!tablaBody || !btnFiltrar) return;

    // ✨ CORRECCIÓN (Punto 2): Conectamos el botón de filtrar
    btnFiltrar.addEventListener('click', cargarHistorialVentas);

    tablaBody.addEventListener('click', (e) => {
        const fila = e.target.closest('tr.master-row');
        if (!fila) return;
        const ventaId = fila.dataset.id;
        
        if (e.target.classList.contains('btn-facturar')) {
            sessionStorage.setItem('ventaParaFacturar', ventaId);
            window.loadContent(null, 'static/factura.html', e.target);
        } else if (e.target.classList.contains('btn-ver-detalles')) {
            mostrarDetalleVenta(ventaId, fila);
        }
    });

    cargarHistorialVentas(); // Carga inicial
}