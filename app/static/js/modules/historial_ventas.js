import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';
import { imprimirVentaPDF } from './sales/utils.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

// Variable para almacenar el ID de venta que se va a anular
let ventaIdParaAnular = null;

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
            const rows = historial.map(venta => {
                // ✨ Badge de estado mejorado con soporte para Anulada
                let estadoHtml;
                if (venta.estado === 'Facturada') {
                    estadoHtml = `<span class="status-badge status-convertido">${venta.tipo_factura || 'X'}: ${venta.numero_factura || 'N/A'}</span>`;
                } else if (venta.estado === 'Anulada') {
                    estadoHtml = `<span class="status-badge" style="background:#fde8e8;color:#c0392b;border:1px solid #e74c3c;">🚫 Anulada</span>`;
                } else {
                    estadoHtml = `<span class="status-badge status-pendiente">Pendiente</span>`;
                }

                // Solo sumar al total las ventas NO anuladas
                if (venta.estado !== 'Anulada') {
                    totalGeneral += venta.total;
                }

                // ✨ Botón Anular: solo si la venta no está Anulada ni Facturada
                const puedeAnular = venta.estado !== 'Anulada' && venta.estado !== 'Facturada';
                const accionesHtml = `
                    <button class="btn-secondary btn-ver-detalles" title="Ver Detalles">🔽</button>
                    <button class="btn-outline-primary btn-imprimir-remito" title="Imprimir Remito">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    ${puedeAnular ? `<button class="btn-facturar" title="Facturar" style="font-size:0.75rem;">Facturar</button>` : ''}
                    ${puedeAnular ? `<button class="btn-anular-venta" title="Anular venta (Nota de Crédito)" style="background:#e74c3c;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">🚫 Anular</button>` : ''}
                `;

                // Estilo de fila atenuada para ventas anuladas
                const rowStyle = venta.estado === 'Anulada' ? 'opacity:0.6;background:#fafafa;' : '';

                return `
                    <tr class="master-row" data-id="${venta.id}" style="${rowStyle}">
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

// ✨ NUEVA FUNCIÓN: Muestra el modal de anulación
function abrirModalAnulacion(ventaId) {
    ventaIdParaAnular = ventaId;
    const modal = document.getElementById('modal-anular-venta');
    const spanId = document.getElementById('modal-anular-venta-id');
    const textarea = document.getElementById('motivo-anulacion');
    if (!modal) return;

    spanId.textContent = ventaId;
    textarea.value = '';
    modal.style.display = 'flex';
    setTimeout(() => textarea.focus(), 100);
}

function cerrarModalAnulacion() {
    const modal = document.getElementById('modal-anular-venta');
    if (modal) modal.style.display = 'none';
    ventaIdParaAnular = null;
}

// ✨ NUEVA FUNCIÓN: Llama al endpoint para anular la venta
async function confirmarAnulacion() {
    if (!ventaIdParaAnular) return;

    const motivo = document.getElementById('motivo-anulacion').value.trim();
    if (!motivo) {
        mostrarNotificacion('El motivo de anulación es obligatorio.', 'warning');
        document.getElementById('motivo-anulacion').focus();
        return;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-anulacion');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Procesando...';

    try {
        const response = await fetch(`/api/ventas/${ventaIdParaAnular}/anular`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al anular la venta');
        }

        mostrarNotificacion(data.message, 'success');
        cerrarModalAnulacion();
        // Recargar el historial para reflejar los cambios
        await cargarHistorialVentas();

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = '✅ Confirmar Anulación';
    }
}

export function inicializarLogicaHistorialVentas() {
    const tablaBody = document.querySelector('#tabla-historial-ventas tbody');
    const btnFiltrar = document.getElementById('btn-filtrar-ventas');
    if (!tablaBody || !btnFiltrar) return;

    btnFiltrar.addEventListener('click', cargarHistorialVentas);

    // ── Eventos del modal de anulación ───────────────────────────────────
    const btnCancelar = document.getElementById('btn-cancelar-anulacion');
    const btnConfirmar = document.getElementById('btn-confirmar-anulacion');
    const btnClose = document.getElementById('close-modal-anular');
    const modal = document.getElementById('modal-anular-venta');

    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalAnulacion);
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarAnulacion);
    if (btnClose) btnClose.addEventListener('click', cerrarModalAnulacion);

    // Cerrar modal al hacer click fuera
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalAnulacion();
        });
    }

    // ── Delegación de eventos en la tabla ────────────────────────────────
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
        } else if (e.target.classList.contains('btn-anular-venta')) {
            // ✨ Abrir modal de anulación
            abrirModalAnulacion(ventaId);
        }
    });

    cargarHistorialVentas();
}