import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';
import { imprimirVentaPDF } from './sales/utils.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

// Variable para almacenar el ID de venta que se va a anular
let ventaIdParaAnular = null;
let ventasChartInstance = null; // ✨ Instancia local para Chart.js
let historialVentasCache = []; // ✨ Caché local para búsquedas sin re-fetch

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
        historialVentasCache = historial; // Guardar en caché
        tbody.innerHTML = '';
        let totalGeneral = 0;
        let cantidadValidas = 0; // Para los KPI

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay ventas para el período seleccionado.</td></tr>';
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
                    cantidadValidas++;
                }

                // ✨ Botón Anular: solo si la venta no está Anulada ni Facturada
                const puedeAnular = venta.estado !== 'Anulada' && venta.estado !== 'Facturada';
                const accionesHtml = `
                    <button class="btn-secondary btn-ver-detalles" title="Ver Detalles">🔽</button>
                    <button class="btn-outline-primary btn-imprimir-remito" title="Imprimir Remito">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    ${puedeAnular ? `<button class="btn-facturar" title="Facturar" style="font-size:0.75rem;">Facturar</button>` : ''}
                    ${puedeAnular ? `<button class="btn-corregir-pago" title="Corregir Pago" style="background:var(--primary-color);color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">💸 Pago</button>` : ''}
                    ${puedeAnular ? `<button class="btn-anular-venta" title="Anular venta (Nota de Crédito)" style="background:#e74c3c;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">🚫 Anular</button>` : ''}
                `;

                // Estilo de fila atenuada para ventas anuladas
                const rowStyle = venta.estado === 'Anulada' ? 'opacity:0.6;background:#fafafa;' : '';

                return `
                    <tr class="master-row" data-id="${venta.id}" style="${rowStyle}">
                        <td><strong>#${venta.numero_interno}</strong></td>
                        <td>${new Date(venta.fecha).toLocaleString('es-AR')}</td>
                        <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                        <td>${venta.metodo_pago}</td>
                        <td>${formatCurrency(venta.total)}</td>
                        <td>${estadoHtml}</td>
                        <td>${venta.pedido_id ? `<span class="badge bg-light text-dark">#${venta.pedido_id}</span> ${venta.hoja_ruta_id ? `<small class="text-muted">(HR #${venta.hoja_ruta_id})</small>` : '<small class="text-muted">(Directa)</small>'}` : '-'}</td>
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

        // ✨ ACTUALIZAR KPI DASHBOARD
        const ticketPromedio = cantidadValidas > 0 ? (totalGeneral / cantidadValidas) : 0;
        document.getElementById('kpi-ingresos').textContent = formatCurrency(totalGeneral);
        document.getElementById('kpi-operaciones').textContent = cantidadValidas;
        document.getElementById('kpi-ticket-promedio').textContent = formatCurrency(ticketPromedio);

        // ✨ ACTUALIZAR GRÁFICO (AGRUPANDO POR FECHA SOLAMENTE LAS VÁLIDAS)
        actualizarGraficoVentas(historial.filter(v => v.estado !== 'Anulada'));

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
        let detailHtml = '<td colspan="8"><table class="tabla-bonita" style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th></tr></thead><tbody>';
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
    const p = historialVentasCache.find(x => x.id == ventaId);
    const modal = document.getElementById('modal-anular-venta');
    const spanNro = document.getElementById('modal-anular-venta-nro');
    const textarea = document.getElementById('motivo-anulacion');
    if (!modal) return;

    spanNro.textContent = p ? p.numero_interno : ventaId;
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

// ✨ NUEVA FUNCIÓN: Agrupa y dibuja el gráfico Chart.js
function actualizarGraficoVentas(ventasValidas) {
    const ctx = document.getElementById('ventasChart');
    if (!ctx) return;

    // 1. Agrupar por fecha ("YYYY-MM-DD")
    const agrupado = {};
    ventasValidas.forEach(v => {
        // Asumiendo que v.fecha viene en ISO string o SQL date
        const f = new Date(v.fecha);
        const dia = f.toLocaleDateString('es-AR'); // Ej: "15/08/2023"

        if (!agrupado[dia]) agrupado[dia] = 0;
        agrupado[dia] += v.total;
    });

    // 2. Ordenamos cronológicamente si hay fechas
    const fechasLimpia = Object.keys(agrupado).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        // Parse "dd/mm/yyyy" a date para comparar bien
        const dA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
        const dB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
        return dA - dB;
    });

    const datos = fechasLimpia.map(fecha => agrupado[fecha]);

    // 3. Crear o actualizar Chart
    if (ventasChartInstance) {
        ventasChartInstance.destroy(); // Destruimos inst. anterior
    }

    ventasChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fechasLimpia,
            datasets: [{
                label: 'Ingresos por Día ($)',
                data: datos,
                backgroundColor: '#2196F3',
                borderColor: '#1976D2',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ' ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toLocaleString('es-AR');
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// 💸 LÓGICA DE CORRECCIÓN DE PAGO (NUEVO)
// ==========================================

let ventaIdParaCorregir = null;
let ventaTotalParaCorregir = 0;

function abrirModalCorreccionPagoVenta(ventaId, metodoActual, total) {
    ventaIdParaCorregir = ventaId;
    ventaTotalParaCorregir = total;

    const v = historialVentasCache.find(x => x.id == ventaId);
    const modal = document.getElementById('modal-corregir-pago-venta');
    document.getElementById('corregir-venta-nro').textContent = v ? v.numero_interno : ventaId;
    document.getElementById('corregir-venta-total').textContent = formatCurrency(total);
    document.getElementById('nuevo-metodo-pago-venta').value = metodoActual;
    document.getElementById('motivo-correccion-pago').value = '';
    
    // Reset Mixto panel
    document.getElementById('panel-mixto-venta').style.display = (metodoActual === 'Mixto') ? 'block' : 'none';
    document.getElementById('mixto-efectivo-venta').value = 0;
    document.getElementById('mixto-mp-venta').value = 0;
    document.getElementById('mixto-cta-cte-venta').value = 0;
    document.getElementById('mixto-error-venta').style.display = 'none';

    if (modal) modal.style.display = 'block';
}

function cerrarModalCorreccionPagoVenta() {
    const modal = document.getElementById('modal-corregir-pago-venta');
    if (modal) modal.style.display = 'none';
    ventaIdParaCorregir = null;
}

async function confirmarCorreccionPagoVenta() {
    if (!ventaIdParaCorregir) return;

    const nuevoMetodo = document.getElementById('nuevo-metodo-pago-venta').value;
    const motivo = document.getElementById('motivo-correccion-pago').value.trim();

    if (!motivo) {
        mostrarNotificacion('El motivo de la corrección es obligatorio para la auditoría.', 'warning');
        return;
    }

    const payload = {
        nuevo_metodo_pago: nuevoMetodo,
        motivo: motivo
    };

    if (nuevoMetodo === 'Mixto') {
        const ef = parseFloat(document.getElementById('mixto-efectivo-venta').value) || 0;
        const mp = parseFloat(document.getElementById('mixto-mp-venta').value) || 0;
        const cc = parseFloat(document.getElementById('mixto-cta-cte-venta').value) || 0;
        const totalIngresado = ef + mp + cc;

        if (Math.abs(totalIngresado - ventaTotalParaCorregir) > 0.01) {
            const errorEl = document.getElementById('mixto-error-venta');
            errorEl.textContent = `La suma (${formatCurrency(totalIngresado)}) debe coincidir con el total de la venta (${formatCurrency(ventaTotalParaCorregir)})`;
            errorEl.style.display = 'block';
            return;
        }
        payload.monto_efectivo = ef;
        payload.monto_mp = mp;
        payload.monto_cta_cte = cc;
    }

    const btn = document.getElementById('btn-confirmar-correccion-pago');
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const response = await fetch(`/api/ventas/${ventaIdParaCorregir}/corregir_pago`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error al corregir el pago');

        mostrarNotificacion(data.message, 'success');
        cerrarModalCorreccionPagoVenta();
        await cargarHistorialVentas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Cambios';
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
        } else if (e.target.classList.contains('btn-corregir-pago')) {
            const v = historialVentasCache.find(x => x.id == ventaId);
            if (v) abrirModalCorreccionPagoVenta(v.id, v.metodo_pago, v.total);
        }
    });

    // ── Eventos del modal de corrección de pago ──────────────────────────
    const btnCancelCorr = document.getElementById('btn-cancelar-correccion');
    const btnConfCorr = document.getElementById('btn-confirmar-correccion-pago');
    const btnCloseCorr = document.getElementById('close-modal-corregir-pago');
    const selectMetodo = document.getElementById('nuevo-metodo-pago-venta');

    if (btnCancelCorr) btnCancelCorr.addEventListener('click', cerrarModalCorreccionPagoVenta);
    if (btnConfCorr) btnConfCorr.addEventListener('click', confirmarCorreccionPagoVenta);
    if (btnCloseCorr) btnCloseCorr.addEventListener('click', cerrarModalCorreccionPagoVenta);
    if (selectMetodo) {
        selectMetodo.addEventListener('change', (e) => {
            document.getElementById('panel-mixto-venta').style.display = (e.target.value === 'Mixto') ? 'block' : 'none';
        });
    }

    // ✨ Establecer fechas por defecto al mes en curso (desde el día 1 hasta hoy)
    const inputDesde = document.getElementById('fecha-desde');
    const inputHasta = document.getElementById('fecha-hasta');
    if (inputDesde && inputHasta && !inputDesde.value && !inputHasta.value) {
        const hoy = new Date();
        const year = hoy.getFullYear();
        const month = String(hoy.getMonth() + 1).padStart(2, '0');
        const day = String(hoy.getDate()).padStart(2, '0');

        inputDesde.value = `${year}-${month}-01`;
        inputHasta.value = `${year}-${month}-${day}`; // Podría ser el último día del mes, pero 'hoy' es más lógico para un dashboard hasta la fecha
    }

    cargarHistorialVentas();
}