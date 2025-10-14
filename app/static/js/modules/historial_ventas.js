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

    try {
        const historial = await fetchData(`/api/negocios/${appState.negocioActivoId}/ventas`);
        tbody.innerHTML = '';
        let totalGeneral = 0;

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay ventas registradas.</td></tr>';
        } else {
            historial.forEach(venta => {
                const fecha = new Date(venta.fecha).toLocaleString('es-AR');
                const estado = venta.estado === 'Facturada' 
                    ? `<span class="status-badge status-convertido">${venta.tipo_factura || 'X'}: ${venta.numero_factura || 'N/A'}</span>`
                    : `<span class="status-badge status-pendiente">Pendiente</span>`;

                totalGeneral += venta.total;

                tbody.innerHTML += `
                    <tr class="master-row" data-id="${venta.id}">
                        <td>${venta.id}</td>
                        <td>${fecha}</td>
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
        // Si el detalle que cerramos es el de la fila actual, nos detenemos.
        if (masterRow.classList.contains('active')) {
            masterRow.classList.remove('active');
            return;
        }
    }

    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));
    masterRow.classList.add('active');

    try {
        // Usamos fetchData para consistencia y manejo de errores
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

function abrirModalFacturacion(ventaId) {
    const modal = document.getElementById('modal-facturar');
    document.getElementById('modal-facturar-texto').textContent = `¿Cómo deseas facturar la Venta Nro. ${ventaId}?`;
    
    document.getElementById('btn-facturar-oficial').onclick = () => facturar(ventaId, 'oficial');
    document.getElementById('btn-facturar-negro').onclick = () => facturar(ventaId, 'negro');
    
    modal.style.display = 'flex';
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
    if (!tablaBody) return;

    // --- Listener único e inteligente para toda la tabla ---
    tablaBody.addEventListener('click', (e) => {
        const fila = e.target.closest('tr.master-row');
        if (!fila) return;
        
        const ventaId = fila.dataset.id;
        
        // --- Acción para "Facturar" ---
        if (e.target.classList.contains('btn-facturar')) {
            // 1. Guardamos el ID de la venta en la memoria del navegador.
            sessionStorage.setItem('ventaParaFacturar', ventaId);
            // 2. Cargamos la nueva página de facturación.
            window.loadContent(null, 'static/factura.html', e.target);
        } 
        // --- Acción para "Ver Detalles" ---
        else if (e.target.classList.contains('btn-ver-detalles')) {
            mostrarDetalleVenta(ventaId, fila);
        }
    });

    // --- Lógica para cerrar el modal (por si se usa en otro lado) ---
    const modal = document.getElementById('modal-facturar');
    const closeModalBtn = document.getElementById('close-facturar-modal');
    if (modal && closeModalBtn) {
        closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    // --- Carga inicial de datos ---
    cargarHistorialVentas();
}