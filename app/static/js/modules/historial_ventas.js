import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';
import { imprimirVentaPDF } from './sales/utils.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

async function cargarHistorialVentas() {
    if (!appState.negocioActivoId) return;

    const tbody = document.querySelector('#tabla-historial-ventas tbody');
    const totalEl = document.getElementById('total-historial-ventas');
    if (!tbody || !totalEl) return;

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
            // ✨ OPTIMIZACIÓN: Construir string HTML y asignar una sola vez al DOM
            const rows = historial.map(venta => {
                const estadoHtml = venta.estado === 'Facturada'
                    ? `<span class="status-badge status-convertido">${venta.tipo_factura || 'X'}: ${venta.numero_factura || 'N/A'}</span>`
                    : `<span class="status-badge status-pendiente">Pendiente</span>`;

                totalGeneral += venta.total;

                const accionesHtml = `
                    <button class="btn-secondary btn-ver-detalles" title="Ver Detalles">🔽</button>
                    <button class="btn-outline-primary btn-imprimir-remito" title="Imprimir Remito">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    ${venta.estado !== 'Facturada' ? '<button class="btn-primary btn-facturar" title="Facturar">Facturar</button>' : ''}
                `;

                return `
                    <tr class="master-row" data-id="${venta.id}">
                        <td>${venta.id}</td>
                        <td>${new Date(venta.fecha).toLocaleString('es-AR')}</td>
                        <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                        <td>${venta.metodo_pago}</td>
                        <td>${formatCurrency(venta.total)}</td>
                        <td>${estadoHtml}</td>
                        <td class="acciones">${accionesHtml}</td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = rows;

            if (historial.length >= 50) {
                mostrarNotificacion('Mostrando las últimas 50 ventas. Use los filtros para ver más.', 'info');
            }
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

export function inicializarLogicaHistorialVentas() {
    const tablaBody = document.querySelector('#tabla-historial-ventas tbody');
    const btnFiltrar = document.getElementById('btn-filtrar-ventas');
    if (!tablaBody || !btnFiltrar) return;

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
        } else if (e.target.closest('.btn-imprimir-remito')) {
            imprimirVentaPDF(ventaId);
        }
    });

    cargarHistorialVentas();
}