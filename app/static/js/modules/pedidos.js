import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { formatearMoneda, formatearNumero } from '../uiHelpers.js';

// Estado temporal para edición
let pedidoTemporalEdit = [];
let idPedidoEditando = null;
let pedidosPaginaActual = 0;
const PEDIDOS_POR_PAGINA = 50;

export async function inicializarPedidos() {
    const filtroFecha = document.getElementById('filtro-fecha-pedidos');
    const filtroHR = document.getElementById('filtro-hr-pedidos');

    if (filtroFecha) {
        // Por defecto hoy
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        filtroFecha.value = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        filtroFecha.onchange = () => cargarPedidos(true);
    }

    if (filtroHR) {
        filtroHR.onchange = () => cargarPedidos(true);
        cargarHojasRutaFiltro();
    }

    const filtroEstado = document.getElementById('filtro-estado-pedidos');
    if (filtroEstado) {
        filtroEstado.onchange = () => cargarPedidos(true);
    }

    cargarPedidos(true);

    // Eventos para selección masiva
    const selectAll = document.getElementById('select-all-pedidos');
    if (selectAll) {
        selectAll.onchange = (e) => {
            const checks = document.querySelectorAll('.pedido-check');
            checks.forEach(c => c.checked = e.target.checked);
            actualizarBarraAcciones();
        };
    }

    // Eventos para buscador en modal de edición
    const inputBusqueda = document.getElementById('edit-buscar-producto-pedido');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', (e) => buscarProductosPedidoEdit(e.target.value));
    }

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        const sugg = document.getElementById('edit-sugerencias-productos-pedido');
        if (sugg && !sugg.contains(e.target) && e.target.id !== 'edit-buscar-producto-pedido') {
            sugg.style.display = 'none';
        }
    });

    window.cargarPedidos = cargarPedidos;
    // Funciones Globales para ser llamadas desde el HTML (onclick)
    window.abrirModalEditarPedido = (id) => abrirModalEditarPedido(id);
    window.verDetallePedido = (id) => verDetallePedido(id);
    window.cambiarEstadoPedido = (id, est) => cambiarEstadoPedido(id, est);
    window.imprimirRemitoPDF = (id) => imprimirRemitoPDF(id);
    window.cambiarPaginaPedidos = (delta) => cambiarPaginaPedidos(delta);

    window.notificarWhatsappPreparado = async (id) => {
        try {
            const p = await fetchData(`/api/pedidos/${id}`);
            const m = await import('./whatsapp.js');
            m.whatsapp.notificarPreparado(p.cliente_nombre, id);
        } catch (e) {
            console.error(e);
            mostrarNotificacion('Error al enviar WhatsApp', 'error');
        }
    };

    window.imprimirReciboPDF = async (id) => {
        try {
            const p = await fetchData(`/api/pedidos/${id}`);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const negocio = appState.negociosCache.find(n => n.id == appState.negocioActivoId) || { nombre: 'Baboons' };

            // Diseño simple de recibo
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("RECIBO DE PAGO", 105, 20, { align: 'center' });

            doc.setFontSize(10);
            doc.text(negocio.nombre, 105, 28, { align: 'center' });
            doc.line(20, 35, 190, 35);

            doc.setFontSize(12);
            doc.text(`Nro. Comprobante: #${p.venta_id || p.id}`, 20, 50);
            doc.text(`Fecha: ${new Date(p.fecha).toLocaleDateString()}`, 190, 50, { align: 'right' });

            doc.setFontSize(14);
            doc.text(`Recibimos de: ${p.cliente_nombre}`, 20, 70);

            doc.setFontSize(12);
            doc.text(`Por concepto de: Pedido #${p.id}`, 20, 85);
            doc.text(`Método de Pago: ${p.metodo_pago || 'Efectivo'}`, 20, 95);

            doc.setLineWidth(1);
            doc.rect(20, 110, 170, 30);
            doc.setFontSize(18);
            doc.text(`TOTAL PAGADO:`, 30, 130);
            doc.text(formatearMoneda(p.total - (p.descuento_pago_contado || 0)), 180, 130, { align: 'right' });

            doc.setFontSize(10);
            doc.text("Documento no válido como factura.", 105, 280, { align: 'center' });

            doc.save(`Recibo_Pago_Pedido_${id}.pdf`);
        } catch (e) {
            console.error(e);
            mostrarNotificacion('Error al generar recibo', 'error');
        }
    };
    window.cerrarModalDetallePedido = () => document.getElementById('modal-detalle-pedido').style.display = 'none';
    window.guardarEdicionPedido = guardarEdicionPedido;
    window.anularPedido = anularPedido;
}

async function cargarPedidos(resetPaging = false) {
    if (resetPaging === true) {
        pedidosPaginaActual = 0;
    }

    const fecha = document.getElementById('filtro-fecha-pedidos').value;
    const hr_id = document.getElementById('filtro-hr-pedidos').value;
    const estado = document.getElementById('filtro-estado-pedidos') ? document.getElementById('filtro-estado-pedidos').value : '';

    try {
        let url = `/api/negocios/${appState.negocioActivoId}/pedidos`;
        const params = new URLSearchParams();
        if (fecha) params.append('fecha', fecha);
        if (hr_id) params.append('hoja_ruta_id', hr_id);
        if (estado) params.append('estado', estado);

        // Paginar
        params.append('limit', PEDIDOS_POR_PAGINA);
        params.append('offset', pedidosPaginaActual * PEDIDOS_POR_PAGINA);

        url += `?${params.toString()}`;

        const res = await fetchData(url);

        // La respuesta ahora viene como { pedidos: [], total: N }
        const pedidos = res.pedidos || [];
        renderPedidos(pedidos);
        actualizarPaginacionPedidos(res.total);

        // Reset checkbox global
        const selectAll = document.getElementById('select-all-pedidos');
        if (selectAll) selectAll.checked = false;
        actualizarBarraAcciones();
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error cargando pedidos', 'error');
    }
}

function actualizarPaginacionPedidos(totalItems) {
    const pnl = document.getElementById('paginacion-pedidos');
    if (!pnl) return;

    pnl.setAttribute('style', 'display: flex !important');
    const label = document.getElementById('label-pagina-pedidos');
    if (label) label.textContent = `Página ${pedidosPaginaActual + 1}`;

    const btnPrev = document.getElementById('btn-prev-pedidos');
    const btnNext = document.getElementById('btn-next-pedidos');

    if (btnPrev) btnPrev.disabled = (pedidosPaginaActual === 0);
    if (btnNext) {
        const totalPaginas = Math.ceil(totalItems / PEDIDOS_POR_PAGINA);
        btnNext.disabled = (pedidosPaginaActual >= totalPaginas - 1 || totalPaginas === 0);
    }
}

function cambiarPaginaPedidos(delta) {
    pedidosPaginaActual += delta;
    if (pedidosPaginaActual < 0) pedidosPaginaActual = 0;
    cargarPedidos(false);
}

function renderPedidos(pedidos) {
    const tbody = document.querySelector('#tabla-pedidos-global tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    pedidos.forEach(p => {
        const tr = document.createElement('tr');
        const badgeClass = {
            'pendiente': 'bg-warning',
            'preparado': 'bg-info',
            'en_camino': 'bg-primary',
            'entregado': 'bg-success',
            'anulado': 'bg-danger'
        }[p.estado] || 'bg-secondary';

        const diasStr = p.dias_en_estado === 0 ? '(Hoy)' : `(${p.dias_en_estado} d.)`;

        // Solo se puede editar si NO está ENTREGADO ni ANULADO y la HR es BORRADOR o ACTIVA
        const esEditable = !['entregado', 'anulado'].includes(p.estado) && (!p.hoja_ruta_id || ['borrador', 'activa'].includes(p.hoja_ruta_estado));

        tr.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input pedido-check" value="${p.id}" onchange="toggleFilaSeleccionada(this)">
            </td>
            <td><span class="badge bg-light text-dark border">#${p.id}</span></td>
            <td>${new Date(p.fecha).toLocaleDateString()}</td>
            <td>${p.hoja_ruta_id ? `<span class="badge bg-secondary">#${p.hoja_ruta_id}</span>` : '-'}</td>
            <td><strong>${p.cliente_nombre}</strong></td>
            <td>${p.vendedor_nombre}</td>
            <td class="fw-bold">${formatearMoneda(p.total)}</td>
            <td><span class="badge ${badgeClass}">${p.estado.toUpperCase()} ${diasStr}</span></td>
            <td class="text-center">
                ${p.rebotes_count > 0 ? `<span class="badge bg-danger" title="Este pedido tuvo rebotes de mercadería"><i class="fas fa-undo"></i> ${formatearNumero(p.rebotes_count)}</span>` : '<span class="text-muted">-</span>'}
            </td>
            <td>${p.pagado ? '<span class="badge bg-success">Si</span>' : '<span class="badge bg-secondary">No</span>'}</td>
            <td><small>${p.metodo_pago || '-'}</small></td>
            <td>${p.caja_sesion_id ? `<span class="badge bg-light text-dark border">#${p.caja_sesion_id}</span>` : '-'}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" onclick="verDetallePedido(${p.id})">
                        <i class="fas fa-eye"></i> Detalles
                    </button>
                    ${esEditable ? `
                        <button class="btn btn-sm btn-outline-secondary" onclick="abrirModalEditarPedido(${p.id})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    ` : ''}
                    ${['pendiente', 'preparado'].includes(p.estado) ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="anularPedido(${p.id})" title="Anular Pedido">
                            <i class="fas fa-ban"></i> Anular
                        </button>
                    ` : ''}
                    ${p.estado === 'entregado' && p.venta_id ? `
                        <button class="btn btn-sm btn-outline-warning" onclick="abrirModalCorreccionPago(${p.id}, '${p.metodo_pago || ''}', ${p.total})" title="Corregir Método de Pago">
                            <i class="fas fa-money-check-alt"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function verDetallePedido(id) {
    try {
        const p = await fetchData(`/api/pedidos/${id}`);
        document.getElementById('det-pedido-id').innerText = p.id;
        document.getElementById('det-pedido-cliente').innerText = p.cliente_nombre;
        document.getElementById('det-pedido-direccion').innerText = p.cliente_direccion || 'Sin dirección';
        document.getElementById('det-pedido-fecha').innerText = new Date(p.fecha).toLocaleString();
        document.getElementById('det-pedido-vendedor').innerText = p.vendedor_nombre || 'N/A';
        document.getElementById('det-pedido-obs').innerText = p.observaciones || 'Sin observaciones';

        const tbody = document.querySelector('#tabla-detalles-pedido-items tbody');
        tbody.innerHTML = p.detalles.map(d => {
            const bonif = parseFloat(d.bonificacion || 0);
            return `
                <tr>
                    <td>${d.producto_nombre}</td>
                    <td class="text-center">${formatearNumero(d.cantidad)}</td>
                    <td class="text-end">${formatearMoneda(d.precio_unitario)}</td>
                    <td class="text-center ${bonif > 0 ? 'text-success fw-bold' : 'text-muted'}">${bonif > 0 ? formatearNumero(bonif) : '-'}</td>
                    <td class="text-end fw-bold">${formatearMoneda(d.subtotal)}</td>
                </tr>
            `;
        }).join('');

        const totalesDiv = document.getElementById('det-pedido-totales');
        totalesDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold">Subtotal:</span>
                    <span>${formatearMoneda(p.total)}</span>
                </div>
                ${p.descuento_pago_contado > 0 ? `
                <div class="d-flex justify-content-between align-items-center mb-1 text-success fw-bold">
                    <span>Bonif. Pago Contado:</span>
                    <span>- ${formatearMoneda(p.descuento_pago_contado)}</span>
                </div>
                ` : ''}
                <div class="d-flex justify-content-between align-items-center border-top pt-2">
                    <h5 class="fw-bold mb-0">TOTAL FINAL:</h5>
                    <h5 class="fw-bold mb-0 text-primary">${formatearMoneda(p.total - (p.descuento_pago_contado || 0))}</h5>
                </div>
            `;

        // Botón Editar en el detalle
        const btnEditar = document.getElementById('btn-editar-pedido-detalle');
        const esEditable = !['entregado', 'anulado'].includes(p.estado) && (!p.hoja_ruta_id || ['borrador', 'activa'].includes(p.hoja_ruta_estado));
        if (btnEditar) {
            btnEditar.style.display = esEditable ? 'block' : 'none';
            btnEditar.onclick = () => {
                cerrarModalDetallePedido();
                abrirModalEditarPedido(p.id);
            };
        }

        // Botones de Acción según estado
        const footer = document.getElementById('botones-estado-pedido');
        let btns = '';

        // Botón Remito (Siempre disponible)
        btns += `<button class="btn btn-outline-secondary me-auto" onclick="imprimirRemitoPDF(${id})"><i class="fas fa-file-pdf"></i> Remito</button>`;

        // Botón Recibo (Si está entregado / pagado)
        if (p.venta_id) {
            btns += `<button class="btn btn-outline-success" onclick="imprimirReciboPDF(${id})"><i class="fas fa-receipt"></i> Recibo</button>`;
        }


        if (p.estado === 'pendiente') {
            btns += `<button class="btn btn-primary" onclick="cambiarEstadoPedido(${id}, 'preparado')">Marcar Preparado</button>`;
            btns += `<button class="btn btn-outline-danger ms-2" onclick="anularPedido(${id})">Anular Pedido</button>`;
        } else if (p.estado === 'preparado') {
            // El administrador ya no puede pasarlo a reparto desde aquí. Debe hacerse desde el Control de Carga.
            btns += `<button class="btn btn-outline-danger ms-2" onclick="anularPedido(${id})">Anular Pedido</button>`;
        } else if (p.estado === 'entregado' && p.venta_id) {
            btns += `<button class="btn btn-warning" onclick="abrirModalCorreccionPago(${id}, '${p.metodo_pago || ''}', ${p.total})"><i class="fas fa-edit"></i> Corregir Pago</button>`;
        }

        btns += `<button class="btn btn-secondary" onclick="document.getElementById('modal-detalle-pedido').style.display='none'">Cerrar</button>`;
        footer.innerHTML = btns;

        // Botón WhatsApp
        const btnWhatsapp = document.createElement('a');
        btnWhatsapp.className = 'btn btn-success w-100 mt-2';
        btnWhatsapp.innerHTML = '<i class="fab fa-whatsapp"></i> Compartir por WhatsApp';
        btnWhatsapp.target = '_blank';

        const numero = p.telefono ? p.telefono.replace(/\D/g, '') : '';
        const negocioNombre = appState.negociosCache.find(n => n.id == appState.negocioActivoId)?.nombre || 'Baboons';
        const textoCompleto = `Hola *${p.cliente_nombre.trim()}*! 👋
Te paso el detalle de tu pedido *#${p.id}*:

${p.detalles.map(d => `▪️ ${d.cantidad} x ${d.producto_nombre} ($${formatearNumero(d.subtotal)})`).join('\n')}

💰 *Total: ${formatearMoneda(p.total)}*

${p.observaciones ? `📝 Nota: ${p.observaciones}\n` : ''}Muchas gracias!
*${negocioNombre}*`;

        btnWhatsapp.href = `https://wa.me/${numero}?text=${encodeURIComponent(textoCompleto)}`;

        if (!numero) {
            btnWhatsapp.classList.add('disabled');
            btnWhatsapp.title = 'El cliente no tiene teléfono registrado';
        }

        footer.appendChild(btnWhatsapp);

        // --- RENDERIZAR TOTALES ---
        const totalesContainer = document.getElementById('det-pedido-totales');
        if (totalesContainer) {
            const subtotal = (p.detalles || []).reduce((acc, d) => acc + (d.cantidad * d.precio_unitario), 0);
            const descuento = (p.detalles || []).reduce((acc, d) => acc + ((d.bonificacion || 0) * d.precio_unitario), 0);

            totalesContainer.innerHTML = `
                <div class="row g-2 justify-content-end align-items-center">
                    <div class="col-8 text-end">
                        <span class="text-muted small text-uppercase fw-bold">Subtotal de Bultos:</span>
                    </div>
                    <div class="col-4 text-end fw-bold">
                        ${formatearMoneda(subtotal)}
                    </div>
                    
                    <div class="col-8 text-end">
                        <span class="text-success small text-uppercase fw-bold">Bonificaciones / Descuentos:</span>
                    </div>
                    <div class="col-4 text-end text-success fw-bold">
                        - ${formatearMoneda(descuento)}
                    </div>

                    <div class="col-12 mt-2">
                        <div class="p-2 rounded-2 bg-dark text-white d-flex justify-content-between align-items-center shadow-sm">
                            <span class="ms-2 fw-bold text-uppercase" style="font-size: 0.85rem; letter-spacing: 1px;">TOTAL NETO</span>
                            <span class="me-2 h4 mb-0 fw-bold text-warning">${formatearMoneda(p.total)}</span>
                        </div>
                    </div>
                    
                    <div class="col-12 mt-2 text-end">
                        <span class="badge ${p.metodo_pago === 'Cuenta Corriente' ? 'bg-info' : 'bg-dark'} px-3 py-2 rounded-pill shadow-sm">
                           ${p.metodo_pago ? `Paga con: ${p.metodo_pago.toUpperCase()}` : 'SIN MÉTODO DE PAGO'}
                        </span>
                    </div>
                </div>
            `;
        }

        // --- RENDERIZAR REBOTES (Si existen) ---
        const rebotesContainer = document.getElementById('rebotes-pedido-container');
        if (rebotesContainer) {
            if (p.rebotes && p.rebotes.length > 0) {
                rebotesContainer.style.display = 'block';
                rebotesContainer.innerHTML = `
                    <h6 class="text-danger fw-bold border-bottom border-danger pb-2 mb-2">
                        <i class="fas fa-undo"></i> Rebotes Detectados en Entrega
                    </h6>
                    <table class="table table-sm table-borderless mb-0" style="font-size: 0.85rem;">
                        <tbody>
                            ${p.rebotes.map(r => `
                                <tr>
                                    <td><strong>${formatearNumero(r.cantidad)}</strong> x ${r.producto_nombre}</td>
                                    <td class="text-end text-danger fw-bold">${r.motivo || 'Motivo no especificado'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                rebotesContainer.style.display = 'none';
            }
        }

        // --- RENDERIZAR BITÁCORA (Si existe) ---
        await renderBitacoraPedido(id);

        document.getElementById('modal-detalle-pedido').style.display = 'flex';
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error cargando detalle del pedido', 'error');
    }
}

async function renderBitacoraPedido(pedidoId) {
    const container = document.getElementById('bitacora-pedido-container');
    if (!container) return;
    container.innerHTML = '';

    try {
        const historial = await fetchData(`/api/pedidos/${pedidoId}/historial`);
        if (historial.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <h6 class="border-bottom pb-2 mb-2"><i class="fas fa-history text-muted"></i> Bitácora de Cambios</h6>
            <div class="bitacora-items" style="max-height: 200px; overflow-y: auto; font-size: 0.85rem;">
                ${historial.map(h => {
            const data = typeof h.datos_anteriores === 'string' ? JSON.parse(h.datos_anteriores) : h.datos_anteriores;
            const fecha = new Date(h.fecha).toLocaleString();
            return `
                        <div class="bitacora-entry border-start border-3 border-info ps-2 mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="fw-bold text-primary">${fecha}</span>
                                <span class="badge bg-light text-dark border">${h.usuario_nombre}</span>
                            </div>
                            <div class="text-muted small mb-1">
                                <b>Motivo:</b> ${h.motivo || 'No especificado'}
                            </div>
                            <details>
                                <summary style="cursor:pointer; color:#0dcaf0;">Ver estado anterior ($${formatearMoneda(data.total)})</summary>
                                <div class="bg-light p-2 rounded mt-1 shadow-sm">
                                    <table class="table table-sm mb-0" style="font-size: 0.75rem;">
                                        <thead>
                                            <tr><th>Prod.</th><th class="text-center">Cant.</th><th class="text-end">Subt.</th></tr>
                                        </thead>
                                        <tbody>
                                            ${data.detalles.map(d => `
                                                <tr>
                                                    <td>${d.producto_nombre}</td>
                                                    <td class="text-center">${d.cantidad}</td>
                                                    <td class="text-end">${formatearMoneda(d.subtotal)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                    ${data.observaciones ? `<div class="mt-1 small"><b>Obs:</b> ${data.observaciones}</div>` : ''}
                                </div>
                            </details>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    } catch (e) {
        console.error('Error al cargar bitácora:', e);
        container.style.display = 'none';
    }
}

// --- LOGICA DE EDICION ---

export async function abrirModalEditarPedido(id) {
    idPedidoEditando = id;
    try {
        const p = await fetchData(`/api/pedidos/${id}`);
        // Mapear detalles a pedidoTemporalEdit
        pedidoTemporalEdit = p.detalles.map(d => ({
            producto_id: d.producto_id,
            nombre: d.producto_nombre,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            bonificacion: d.bonificacion || 0
        }));

        document.getElementById('edit-pedido-id').value = p.id;
        document.getElementById('edit-pedido-id-display').innerText = p.id;
        document.getElementById('edit-pedido-cliente-nombre').innerText = p.cliente_nombre;
        document.getElementById('edit-obs-pedido-modal').value = p.observaciones || '';

        renderItemsPedidoEdit();
        document.getElementById('modal-editar-pedido').style.display = 'flex';
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar datos para edición', 'error');
    }
}

function renderItemsPedidoEdit() {
    const tbody = document.querySelector('#tabla-items-pedido-edit tbody');
    if (!tbody) return;
    let total = 0;
    tbody.innerHTML = '';

    pedidoTemporalEdit.forEach((item, index) => {
        const bonif = item.bonificacion || 0;
        const cantCobrada = Math.max(0, item.cantidad - bonif);
        const subt = cantCobrada * item.precio_unitario;
        total += subt;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="max-width:180px;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.82rem;" title="${item.nombre}">${item.nombre}</div>
                ${bonif > 0 ? `<small class="text-success" style="font-size:0.7rem;">✓ cobra ${cantCobrada} de ${item.cantidad}</small>` : ''}
            </td>
            <td class="text-center" style="padding:4px;">
                <input type="number" step="any" min="0" class="form-control form-control-sm px-1" style="width:58px; text-align:center;" value="${item.cantidad}" onchange="actualizarCantEdit(${index}, this.value)">
            </td>
            <td class="text-end" style="font-size:0.8rem; white-space:nowrap;">$${item.precio_unitario.toLocaleString()}</td>
            <td class="text-center" style="padding:4px;">
                <input type="number" min="0" step="1" class="form-control form-control-sm px-1" style="width:50px; text-align:center;" value="${bonif}" onchange="actualizarBonifEdit(${index}, this.value)">
            </td>
            <td class="text-end fw-bold text-${bonif > 0 ? 'success' : 'dark'}" style="font-size:0.82rem; white-space:nowrap;">
                $${subt.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
            </td>
            <td style="padding:2px;"><button class="btn btn-link btn-sm text-danger p-0" onclick="quitarDeEdit(${index})">×</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('edit-total-pedido-modal').innerText = `$ ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

window.actualizarCantEdit = (index, val) => {
    pedidoTemporalEdit[index].cantidad = parseFloat(val) || 0;
    renderItemsPedidoEdit();
};
window.actualizarBonifEdit = (index, val) => {
    pedidoTemporalEdit[index].bonificacion = parseFloat(val) || 0;
    renderItemsPedidoEdit();
};
window.quitarDeEdit = (index) => {
    pedidoTemporalEdit.splice(index, 1);
    renderItemsPedidoEdit();
};

async function buscarProductosPedidoEdit(termino) {
    const sugg = document.getElementById('edit-sugerencias-productos-pedido');
    if (!termino || termino.length < 2) {
        sugg.style.display = 'none';
        return;
    }

    try {
        const url = `/api/negocios/${appState.negocioActivoId}/productos/buscar?query=${encodeURIComponent(termino)}`;
        const productos = await fetchData(url);
        if (productos.length === 0) {
            sugg.style.display = 'none';
            return;
        }

        sugg.innerHTML = productos.map(p => {
            const precio = p.precio_final || p.precio_venta || 0;
            return `
            <div class="p-2 border-bottom suggestion-item" style="cursor:pointer;" onclick="agregarAlPedidoEdit(${JSON.stringify({ ...p, precio_venta: precio }).replace(/"/g, '&quot;')})">
                <div class="d-flex justify-content-between">
                    <span>${p.nombre}</span>
                    <span class="fw-bold">$${precio.toLocaleString()}</span>
                </div>
                <small class="text-muted">Stock: ${p.stock}</small>
            </div>
        `}).join('');
        sugg.style.display = 'block';
    } catch (error) {
        console.error(error);
    }
}

window.agregarAlPedidoEdit = (p) => {
    const existe = pedidoTemporalEdit.find(it => it.producto_id === p.id);
    if (existe) {
        existe.cantidad += 1;
    } else {
        pedidoTemporalEdit.push({
            producto_id: p.id,
            nombre: p.nombre,
            cantidad: 1,
            precio_unitario: p.precio_venta,
            bonificacion: 0
        });
    }
    document.getElementById('edit-buscar-producto-pedido').value = '';
    document.getElementById('edit-sugerencias-productos-pedido').style.display = 'none';
    renderItemsPedidoEdit();
};

async function guardarEdicionPedido() {
    if (pedidoTemporalEdit.length === 0) {
        mostrarNotificacion('El pedido no puede estar vacío', 'warning');
        return;
    }

    const data = {
        detalles: pedidoTemporalEdit,
        observaciones: document.getElementById('edit-obs-pedido-modal').value,
        total: pedidoTemporalEdit.reduce((acc, it) => acc + (Math.max(0, it.cantidad - it.bonificacion) * it.precio_unitario), 0),
        motivo_edicion: 'Edición desde panel administrador'
    };

    try {
        await sendData(`/api/pedidos/${idPedidoEditando}`, data, 'PUT');
        mostrarNotificacion('Pedido actualizado con éxito', 'success');
        document.getElementById('modal-editar-pedido').style.display = 'none';
        cargarPedidos();
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al actualizar pedido', 'error');
    }
}

async function mostrarConsolidado() {
    const fecha = document.getElementById('filtro-fecha-pedidos').value;
    const modal = document.getElementById('modal-consolidado-pedidos');
    const tbody = document.querySelector('#tabla-consolidado-items tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Calculando mercadería y stock...</td></tr>';
    modal.style.display = 'flex';

    try {
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/pedidos?fecha=${fecha}`);
        const pedidos = res.pedidos || [];
        const promesas = pedidos.map(p => fetchData(`/api/pedidos/${p.id}`));
        const pedidosCompletos = await Promise.all(promesas);

        const productosNegocio = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        const stockMap = {};
        productosNegocio.forEach(pr => stockMap[pr.id] = pr.stock);

        const consolidado = {};
        pedidosCompletos.forEach(p => {
            if (p.estado === 'anulado') return;
            p.detalles.forEach(d => {
                if (!consolidado[d.producto_id]) {
                    consolidado[d.producto_id] = {
                        nombre: d.producto_nombre,
                        pendiente: 0,
                        preparado: 0,
                        stockActual: stockMap[d.producto_id] || 0
                    };
                }
                if (p.estado === 'pendiente') {
                    consolidado[d.producto_id].pendiente += d.cantidad;
                } else if (p.estado === 'preparado' || p.estado === 'entregado') {
                    consolidado[d.producto_id].preparado += d.cantidad;
                }
            });
        });

        const items = Object.values(consolidado).sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay mercadería comprometida para esta fecha</td></tr>';
        } else {
            tbody.innerHTML = items.map(it => {
                const totalComprometido = it.pendiente + it.preparado;
                const faltante = Math.max(0, it.pendiente - it.stockActual);
                const rowClass = faltante > 0 ? 'table-danger' : '';

                return `
                    <tr class="${rowClass}">
                        <td>${it.nombre}</td>
                        <td class="text-center text-warning">${formatearNumero(it.pendiente)}</td>
                        <td class="text-center text-info">${formatearNumero(it.preparado)}</td>
                        <td class="text-center fw-bold">${formatearNumero(totalComprometido)}</td>
                        <td class="text-center">${formatearNumero(it.stockActual)}</td>
                        <td class="text-center fw-bold text-danger">${faltante > 0 ? formatearNumero(faltante) : '-'}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}

async function cambiarEstadoPedido(id, nuevoEstado) {
    try {
        await sendData(`/api/pedidos/${id}/estado`, { estado: nuevoEstado }, 'PUT');
        mostrarNotificacion(`Pedido #${id} actualizado a ${nuevoEstado}`, 'success');
        document.getElementById('modal-detalle-pedido').style.display = 'none';
        cargarPedidos();
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error actualizando estado', 'error');
    }
}

async function anularPedido(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Confirmas anulación?',
        text: `El pedido #${id} pasará a estado ANULADO. Se liberará la reserva de stock y se devolverá a productos si estaba cargado en un camión.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, Anular',
        cancelButtonText: 'Volver'
    });

    if (isConfirmed) {
        try {
            await cambiarEstadoPedido(id, 'anulado');
        } catch (e) {
            console.error(e);
        }
    }
}

async function imprimirRemitoPDF(id) {
    try {
        const p = await fetchData(`/api/pedidos/${id}`);
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            mostrarNotificacion('Librería PDF no cargada', 'error');
            return;
        }

        const doc = new jsPDF();
        const negocio = appState.negociosCache.find(n => n.id == appState.negocioActivoId) || { nombre: 'Mi Negocio', direccion: '' };

        dibujarRemitoEnPDF(doc, p, negocio);

        doc.save(`Remito_Pedido_${p.id}_${(p.cliente_nombre || '').replace(/\\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al generar el Remito: ' + error.message, 'error');
    }
}

function dibujarRemitoEnPDF(doc, p, negocio) {
    // Cabecera: Negocio
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(negocio.nombre, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(negocio.direccion || '', 105, 26, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    // Sub-cabecera: Tipo de Documento y Número
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REMITO DE ENTREGA", 14, 45);
    doc.setFontSize(14);
    doc.text(`#${p.id}`, 196, 45, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date(p.fecha).toLocaleDateString()}`, 14, 52);
    doc.text(`Vendedor: ${p.vendedor_nombre || 'N/A'}`, 196, 52, { align: 'right' });

    // Datos del Cliente
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 61, 182, 26, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(14, 61, 182, 26, 'D');

    doc.setFont("helvetica", "bold");
    doc.text("DESTINATARIO:", 18, 68);
    doc.setFont("helvetica", "normal");
    doc.text(String(p.cliente_nombre || 'N/A'), 52, 68);

    doc.setFont("helvetica", "bold");
    doc.text("DIRECCIÓN:", 18, 75);
    doc.setFont("helvetica", "normal");
    doc.text(String(p.cliente_direccion || 'Sin dirección'), 52, 75);

    doc.setFont("helvetica", "bold");
    doc.text("TELÉFONO:", 18, 82);
    doc.setFont("helvetica", "normal");
    doc.text(String(p.telefono || 'Sin teléfono'), 52, 82);

    // Tabla de Items
    const headers = [["Cant.", "Producto", "Precio Unit.", "Bonif.", "Subtotal"]];
    const data = (p.detalles || []).map(d => {
        const bonif = parseFloat(d.bonificacion || 0);
        return [
            formatearNumero(d.cantidad),
            d.producto_nombre,
            formatearMoneda(d.precio_unitario),
            bonif > 0 ? formatearNumero(bonif) : '-',
            formatearMoneda(d.subtotal)
        ];
    });

    doc.autoTable({
        startY: 94,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 35, halign: 'right' }
        }
    });

    // Totales Finales
    let currentY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 140, currentY);
    doc.text(formatearMoneda(p.total), 196, currentY, { align: 'right' });
    currentY += 6;

    if (p.descuento_pago_contado > 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129); // Success color
        doc.text("Bonif. Pago Contado:", 140, currentY);
        doc.text(`- ${formatearMoneda(p.descuento_pago_contado)}`, 196, currentY, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        currentY += 6;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL FINAL:", 140, currentY);
    doc.text(formatearMoneda(p.total - (p.descuento_pago_contado || 0)), 196, currentY, { align: 'right' });
    currentY += 15;

    // Observaciones
    const obs = (p.observaciones || "").trim();
    if (obs) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Observaciones:", 14, currentY);
        doc.setFont("helvetica", "normal");
        const splitObs = doc.splitTextToSize(obs, 182);
        doc.text(splitObs, 14, currentY + 6);
        currentY += (splitObs.length * 5) + 5;
    }

    // Sección de Firma
    let startSignatureY = Math.max(currentY + 20, 250); // Empujar hacia abajo si hay observaciones, pero sin pasar 297 (A4 height)
    if (startSignatureY > 275) {
        doc.addPage();
        startSignatureY = 40;
    }

    doc.setLineWidth(0.3);
    doc.line(70, startSignatureY, 140, startSignatureY);
    doc.setFontSize(9);
    doc.text("Firma y Aclaración del Cliente", 105, startSignatureY + 5, { align: 'center' });
    doc.text("Recibí conforme mercadería y valor", 105, startSignatureY + 10, { align: 'center' });

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado por Multinegocio - v${window.APP_VERSION || ''} el ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
}

window.imprimirRemitoPDF = imprimirRemitoPDF;

async function cargarHojasRutaFiltro() {
    try {
        const hrs = await fetchData(`/api/negocios/${appState.negocioActivoId}/hoja_ruta`);
        const select = document.getElementById('filtro-hr-pedidos');
        if (!select) return;

        // Limpiar excepto la primera opción
        select.innerHTML = '<option value="">Todas las Hojas de Ruta</option>';

        // Solo mostrar HRs que no estén finalizadas o anuladas para facilitar la gestión
        const hrsFiltradas = hrs.filter(h => h.estado !== 'finalizada' && h.estado !== 'anulada');

        hrsFiltradas.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = `#${h.id} - ${h.vendedor_nombre} (${new Date(h.fecha).toLocaleDateString()})`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando HRs para filtro:', error);
    }
}

function actualizarBarraAcciones() {
    const checks = document.querySelectorAll('.pedido-check:checked');
    const bar = document.getElementById('bulk-actions-bar');
    const countSpan = document.getElementById('selected-count');

    if (checks.length > 0) {
        if (countSpan) countSpan.innerText = checks.length;
        if (bar) bar.style.display = 'block';
    } else {
        if (bar) bar.style.display = 'none';
        const selectAll = document.getElementById('select-all-pedidos');
        if (selectAll) selectAll.checked = false;
    }
}

window.toggleFilaSeleccionada = (el) => {
    const tr = el.closest('tr');
    if (tr) {
        if (el.checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }
    actualizarBarraAcciones();
};

function deseleccionarTodo() {
    const checks = document.querySelectorAll('.pedido-check');
    checks.forEach(c => c.checked = false);
    const selectAll = document.getElementById('select-all-pedidos');
    if (selectAll) selectAll.checked = false;
    actualizarBarraAcciones();
}

async function cambiarEstadoMasivo(nuevoEstado) {
    const checks = document.querySelectorAll('.pedido-check:checked');
    const ids = Array.from(checks).map(c => c.value);

    if (ids.length === 0) return;

    if (!confirm(`¿Confirmar cambio de estado a ${nuevoEstado.toUpperCase()} para ${ids.length} pedidos?`)) {
        return;
    }

    let exitos = 0;
    let errores = 0;

    mostrarNotificacion(`Procesando ${ids.length} pedidos...`, 'info');

    for (const id of ids) {
        try {
            await sendData(`/api/pedidos/${id}/estado`, { estado: nuevoEstado }, 'PUT');
            exitos++;
        } catch (error) {
            console.error(`Error en pedido #${id}:`, error);
            errores++;
        }
    }

    if (exitos > 0) {
        mostrarNotificacion(`Se actualizaron ${exitos} pedidos correctamente.`, 'success');
    }
    if (errores > 0) {
        mostrarNotificacion(`Hubo errores en ${errores} pedidos.`, 'error');
    }

    deseleccionarTodo();
    cargarPedidos();
}

// Exportar funciones adicionales al contexto global
window.actualizarBarraAcciones = actualizarBarraAcciones;
window.deseleccionarTodo = deseleccionarTodo;
window.cambiarEstadoMasivo = cambiarEstadoMasivo;

// Lógica de Modal de Corrección de Pagos
window.abrirModalCorreccionPago = (id, metodoActual, total = 0) => {
    document.getElementById('corregir-pago-pedido-id').value = id;
    document.getElementById('corregir-total-original-val').value = total;

    const select = document.getElementById('nuevo-metodo-pago-select');
    document.getElementById('motivo-correccion-pago').value = ''; // Limpiar motivo

    // Reset Mixto
    document.getElementById('corregir-monto-efectivo').value = 0;
    document.getElementById('corregir-monto-mp').value = 0;
    document.getElementById('corregir-monto-ctacte').value = total;
    document.getElementById('label-restante-mixto').innerText = formatearMoneda(total);

    if (metodoActual) {
        // Seleccionar la opción si existe, sino lo deja en Efectivo por default
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === metodoActual) {
                select.options[i].selected = true;
                break;
            }
        }
    }

    togglePanelMixtoCorreccion(metodoActual);
    document.getElementById('modal-corregir-pago').style.display = 'flex';
};

window.togglePanelMixtoCorreccion = (metodo) => {
    const panel = document.getElementById('panel-pago-mixto-correccion');
    if (panel) panel.style.display = (metodo === 'Mixto') ? 'block' : 'none';
    if (metodo === 'Mixto') recalcularMixtoCorreccion();
};

window.recalcularMixtoCorreccion = () => {
    const total = parseFloat(document.getElementById('corregir-total-original-val').value) || 0;
    const ef = parseFloat(document.getElementById('corregir-monto-efectivo').value) || 0;
    const mp = parseFloat(document.getElementById('corregir-monto-mp').value) || 0;

    const restante = Math.max(0, total - (ef + mp));
    document.getElementById('corregir-monto-ctacte').value = restante.toFixed(2);
    document.getElementById('label-restante-mixto').innerText = formatearMoneda(restante);
};

window.confirmarCorreccionPago = async () => {
    const id = document.getElementById('corregir-pago-pedido-id').value;
    const nuevoMetodo = document.getElementById('nuevo-metodo-pago-select').value;
    const motivo = document.getElementById('motivo-correccion-pago').value.trim();

    if (!nuevoMetodo) {
        mostrarNotificacion('Selecciona un método de pago', 'warning');
        return;
    }

    if (!motivo) {
        mostrarNotificacion('El motivo de la corrección es obligatorio', 'warning');
        return;
    }

    const payload = {
        nuevo_metodo_pago: nuevoMetodo,
        motivo: motivo
    };

    if (nuevoMetodo === 'Mixto') {
        payload.monto_efectivo = parseFloat(document.getElementById('corregir-monto-efectivo').value) || 0;
        payload.monto_mp = parseFloat(document.getElementById('corregir-monto-mp').value) || 0;
        payload.monto_cta_cte = parseFloat(document.getElementById('corregir-monto-ctacte').value) || 0;

        const totalCalc = payload.monto_efectivo + payload.monto_mp + payload.monto_cta_cte;
        const totalOrig = parseFloat(document.getElementById('corregir-total-original-val').value) || 0;

        if (Math.abs(totalCalc - totalOrig) > 1) {
            mostrarNotificacion('La suma de los montos no coincide con el total del pedido', 'warning');
            return;
        }
    }

    try {
        await sendData(`/api/pedidos/${id}/corregir_pago`, payload, 'POST');
        mostrarNotificacion(`Método de pago corregido exitosamente a ${nuevoMetodo}`, 'success');
        document.getElementById('modal-corregir-pago').style.display = 'none';
        document.getElementById('modal-detalle-pedido').style.display = 'none'; // cerrar si estaba abierto
        cargarPedidos();
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al corregir pago', 'error');
    }
};

async function imprimirRemitosMasivos() {
    const checks = document.querySelectorAll('.pedido-check:checked');
    const ids = Array.from(checks).map(c => c.value);

    if (ids.length === 0) return;

    if (!confirm(`¿Imprimir ${ids.length} remitos seleccionados en un solo PDF?`)) {
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            mostrarNotificacion('Librería PDF no cargada', 'error');
            return;
        }

        const doc = new jsPDF();
        const negocio = appState.negociosCache.find(n => n.id == appState.negocioActivoId) || { nombre: 'Mi Negocio', direccion: '' };

        mostrarNotificacion(`Generando PDF para ${ids.length} pedidos...`, 'info');

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const p = await fetchData(`/api/pedidos/${id}`);

            dibujarRemitoEnPDF(doc, p, negocio);

            // Add new page if it is not the last order 
            if (i < ids.length - 1) {
                doc.addPage();
            }
        }

        // Finalize and save
        doc.save(`Remitos_Masivos_${new Date().toISOString().split('T')[0]}.pdf`);
        mostrarNotificacion(`Descarga completada de PDF con ${ids.length} remitos.`, 'success');

    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al generar los Remitos Masivos: ' + error.message, 'error');
    }
}
window.imprimirRemitosMasivos = imprimirRemitosMasivos;

