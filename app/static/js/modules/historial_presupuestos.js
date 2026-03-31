// app/static/js/modules/historial_presupuestos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

const fmtMoneda = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fmtFecha = (s) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

// ── Estado local ─────────────────────────────────────────────────────────────
let todosLosPresupuestos = [];   // lista completa
let presupuestoParaImprimir = null;  // datos del presupuesto abierto en modal

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectarEstado(p) {
    if (p.convertido_a_venta) return 'convertido';
    if (p.anulado) return 'anulado';
    return 'pendiente';
}

function estadoHtml(estado) {
    const map = {
        convertido: ['badge-pres-facturado', 'Facturado'],
        anulado: ['badge-pres-anulado', 'Anulado'],
        pendiente: ['badge-pres-pendiente', 'Pendiente'],
    };
    const [cls, label] = map[estado] || map.pendiente;
    return `<span class="badge-pres ${cls}">${label}</span>`;
}

// ── Cargar datos del backend ──────────────────────────────────────────────────
async function cargarHistorial() {
    if (!appState.negocioActivoId) return;

    const tbody = document.getElementById('pres-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="pres-loading">⏳ Cargando presupuestos…</td></tr>';

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/presupuestos`);
        todosLosPresupuestos = data || [];
        aplicarFiltros();
    } catch (error) {
        console.error('Error al cargar historial de presupuestos:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="pres-loading" style="color:#f87171;">❌ Error al cargar los datos.</td></tr>';
    }
}

// ── Filtrar y renderizar ──────────────────────────────────────────────────────
function aplicarFiltros() {
    const buscar = (document.getElementById('pres-buscar')?.value || '').toLowerCase();
    const desde = document.getElementById('fecha-desde-presupuestos')?.value;
    const hasta = document.getElementById('fecha-hasta-presupuestos')?.value;
    const estado = document.getElementById('pres-filtro-estado')?.value;

    const currentUser = getCurrentUser();
    const isAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'superadmin');

    let filtrados = todosLosPresupuestos.filter(p => {
        // Restricción vendedor
        if (!isAdmin && p.vendedor_id !== currentUser.id) return false;

        // Búsqueda texto
        if (buscar) {
            const haystack = `${p.id} ${p.numero} ${p.cliente_nombre} ${p.vendedor_nombre}`.toLowerCase();
            if (!haystack.includes(buscar)) return false;
        }

        // Fechas
        const fecha = new Date(p.fecha);
        if (desde && fecha < new Date(desde)) return false;
        if (hasta && fecha > new Date(hasta + 'T23:59:59')) return false;

        // Estado
        if (estado && detectarEstado(p) !== estado) return false;

        return true;
    });

    renderTabla(filtrados);
    renderKpis(filtrados);
}

// ── Renderizar tabla ──────────────────────────────────────────────────────────
function renderTabla(lista) {
    const tbody = document.getElementById('pres-tbody');
    const footer = document.getElementById('pres-tabla-footer');
    const count = document.getElementById('pres-contador');
    if (!tbody) return;

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="pres-loading">Sin resultados para los filtros aplicados.</td></tr>';
        if (footer) footer.style.display = 'none';
        return;
    }

    const currentUser = getCurrentUser();
    const isAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'superadmin');

    tbody.innerHTML = lista.map(p => {
        const estado = detectarEstado(p);
        const acciones = `
            <div class="pres-acciones">
                <button class="btn-icon-pres ver btn-editar" title="Ver / Editar">✏️ Editar</button>
                <button class="btn-icon-pres imprimir btn-imprimir" title="Imprimir presupuesto">🖨️ Imprimir</button>
                ${isAdmin && estado === 'pendiente' ? `<button class="btn-icon-pres facturar btn-facturar" title="Convertir a venta">✅ Facturar</button>` : ''}
                ${isAdmin && estado !== 'anulado' ? `<button class="btn-icon-pres anular btn-anular" title="Anular presupuesto">🗑️ Anular</button>` : ''}
            </div>`;

        return `<tr data-id="${p.id}">
            <td><strong>#${p.numero}</strong></td>
            <td>${fmtFecha(p.fecha)}</td>
            <td>${p.cliente_nombre || '—'}</td>
            <td>${p.vendedor_nombre || '—'}</td>
            <td style="text-align:right; font-weight:600;">${fmtMoneda(p.total_presupuestado)}</td>
            <td>${p.fecha_entrega_estimada ? fmtFecha(p.fecha_entrega_estimada) : '—'}</td>
            <td>${estadoHtml(estado)}</td>
            <td>${acciones}</td>
        </tr>`;
    }).join('');

    if (footer) footer.style.display = 'block';
    if (count) count.textContent = `${lista.length} presupuesto${lista.length !== 1 ? 's' : ''}`;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKpis(lista) {
    const pendientes = lista.filter(p => detectarEstado(p) === 'pendiente').length;
    const facturados = lista.filter(p => detectarEstado(p) === 'convertido').length;
    const monto = lista.reduce((acc, p) => acc + (p.total_presupuestado || 0), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-pres-total', lista.length);
    set('kpi-pres-pendiente', pendientes);
    set('kpi-pres-facturado', facturados);
    set('kpi-pres-monto', fmtMoneda(monto));
}

// ── Modal de impresión ────────────────────────────────────────────────────────
async function abrirModalImpresion(presupuestoId) {
    const p = todosLosPresupuestos.find(x => x.id == presupuestoId);
    if (!p) return;

    presupuestoParaImprimir = p;

    // Poblar datos básicos del modal desde la lista
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('print-numero', p.numero);
    set('print-fecha', fmtFecha(p.fecha));
    set('print-entrega', p.fecha_entrega_estimada ? fmtFecha(p.fecha_entrega_estimada) : 'A confirmar');
    set('print-cliente', p.cliente_nombre || 'Consumidor Final');
    set('print-vendedor', p.vendedor_nombre || '—');

    // Nombre de empresa desde el negocio activo
    const negocio = (appState.negociosCache || []).find(n => String(n.id) === String(appState.negocioActivoId));
    set('print-empresa-nombre', negocio?.nombre || 'Mi Empresa');

    // Observaciones
    const obsWrap = document.getElementById('print-obs-wrap');
    const obsEl = document.getElementById('print-observaciones');
    if (p.observaciones) {
        if (obsWrap) obsWrap.style.display = 'block';
        if (obsEl) obsEl.textContent = p.observaciones;
    } else {
        if (obsWrap) obsWrap.style.display = 'none';
    }

    // ── Mostrar modal antes de cargar ítems (UX rápido) ──
    const modal = document.getElementById('modal-imprimir-pres');
    if (modal) modal.style.display = 'flex';

    // ── Cargar detalle de ítems desde el endpoint ──
    const itemsTbody = document.getElementById('print-items');
    const subtotalEl = document.getElementById('print-subtotal');
    const totalEl = document.getElementById('print-total');

    if (itemsTbody) {
        itemsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:12px;color:#9ca3af;">⏳ Cargando ítems…</td></tr>';
    }

    try {
        const detalle = await fetchData(`/api/presupuestos/${presupuestoId}`);
        const items = detalle.detalles || [];
        const cabecera = detalle.cabecera || {};

        if (itemsTbody) {
            if (items.length) {
                let subtotal = 0;
                itemsTbody.innerHTML = items.map(item => {
                    const sub = parseFloat(item.subtotal) || (item.cantidad * item.precio_unitario);
                    subtotal += sub;
                    return `<tr>
                        <td>${item.descripcion_producto || '—'}</td>
                        <td>${item.cantidad}</td>
                        <td>${fmtMoneda(item.precio_unitario)}</td>
                        <td>${fmtMoneda(sub)}</td>
                    </tr>`;
                }).join('');

                const bonif = parseFloat(cabecera.bonificacion) || 0;
                const inter = parseFloat(cabecera.interes) || 0;
                const descFijo = parseFloat(cabecera.descuento_fijo) || 0;

                const basePostDescuento = subtotal - descFijo;
                const montoBonif = basePostDescuento * (bonif / 100);
                const basePostBonif = basePostDescuento - montoBonif;
                const montoInter = basePostBonif * (inter / 100);
                const totalFinal = basePostBonif + montoInter;

                if (subtotalEl) subtotalEl.textContent = fmtMoneda(subtotal);

                // Fila Descuento Fijo
                const descRow = document.getElementById('print-desc-row');
                if (descRow) {
                    if (descFijo > 0) {
                        descRow.style.display = 'flex';
                        const montoEl = document.getElementById('print-descuento-monto');
                        if (montoEl) montoEl.textContent = `- ${fmtMoneda(descFijo)}`;
                    } else {
                        descRow.style.display = 'none';
                    }
                }

                // Fila bonificación
                const bonifRow = document.getElementById('print-bonif-row');
                if (bonifRow) {
                    if (bonif > 0) {
                        bonifRow.style.display = 'flex';
                        const pctEl = document.getElementById('print-bonif-pct');
                        const montoEl = document.getElementById('print-bonif-monto');
                        if (pctEl) pctEl.textContent = bonif;
                        if (montoEl) montoEl.textContent = `- ${fmtMoneda(montoBonif)}`;
                    } else {
                        bonifRow.style.display = 'none';
                    }
                }

                // Fila interés
                const interRow = document.getElementById('print-inter-row');
                if (interRow) {
                    if (inter > 0) {
                        interRow.style.display = 'flex';
                        const pctEl = document.getElementById('print-inter-pct');
                        const montoEl = document.getElementById('print-inter-monto');
                        if (pctEl) pctEl.textContent = inter;
                        if (montoEl) montoEl.textContent = `+ ${fmtMoneda(montoInter)}`;
                    } else {
                        interRow.style.display = 'none';
                    }
                }

                // Total final: si hay bonif o interés, siempre usar el calculado
                const totalMostrar = (bonif > 0 || inter > 0) ? totalFinal : (p.total_presupuestado || subtotal);
                if (totalEl) totalEl.textContent = fmtMoneda(totalMostrar);
            } else {
                itemsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:20px;">Sin detalle de ítems disponible</td></tr>';
                if (subtotalEl) subtotalEl.textContent = fmtMoneda(p.total_presupuestado || 0);
                if (totalEl) totalEl.textContent = fmtMoneda(p.total_presupuestado || 0);
            }
        }
    } catch (err) {
        console.error('Error al cargar detalle del presupuesto:', err);
        if (itemsTbody) itemsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#f87171;padding:16px;">❌ Error al cargar ítems</td></tr>';
    }
}

function cerrarModalImpresion() {
    const modal = document.getElementById('modal-imprimir-pres');
    if (modal) modal.style.display = 'none';
}

function imprimirPresupuesto() {
    const contenido = document.getElementById('contenido-imprimible');
    if (!contenido) return;

    // Clonamos el contenido para la ventana nueva (sin los botones .no-print)
    const clone = contenido.cloneNode(true);
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a2e; background:#fff; }
        .print-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px;
        }
        .print-empresa { font-size: 1.4rem; font-weight: 800; color: #111827; }
        .print-doc-info { text-align: right; }
        .print-doc-info h2 { font-size: 1.5rem; font-weight: 900; color: #6d28d9; margin-bottom: 6px; letter-spacing: 0.05em; }
        .print-doc-info p { margin: 2px 0; font-size: 0.88rem; color: #374151; }
        .print-cliente-vendedor {
            display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
            background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;
        }
        .print-cliente-vendedor h4 { margin-bottom: 4px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
        .print-cliente-vendedor p { font-size: 1rem; font-weight: 600; color: #111827; }
        .print-tabla { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.88rem; }
        .print-tabla thead tr { background: #6d28d9; color: #fff; }
        .print-tabla th { padding: 10px 14px; text-align: left; font-weight: 700; }
        .print-tabla td { padding: 9px 14px; border-bottom: 1px solid #e5e7eb; color: #374151; }
        .print-tabla tbody tr:nth-child(even) { background: #f9fafb; }
        .print-tabla td:last-child, .print-tabla th:last-child { text-align: right; }
        .print-tabla td:nth-child(2), .print-tabla th:nth-child(2) { text-align: center; }
        .print-totales { margin-left: auto; width: 260px; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-bottom: 20px; }
        .print-total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 0.9rem; color: #374151; }
        .print-total-final { border-top: 2px solid #6d28d9; padding-top: 8px; margin-top: 4px; font-size: 1.1rem; color: #111827; }
        .print-obs { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.87rem; color: #92400e; }
        .print-pie { text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 0.78rem; color: #9ca3af; margin-top: 20px; }
    `;

    const ventana = window.open('', '_blank', 'width=900,height=700');
    ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Presupuesto #${document.getElementById('print-numero')?.textContent || ''}</title>
    <style>${css}</style>
</head>
<body>${clone.innerHTML}</body>
</html>`);
    ventana.document.close();
    ventana.focus();
    // Pequeño delay para que el browser termine de renderizar antes de imprimir
    setTimeout(() => {
        ventana.print();
        ventana.close();
    }, 350);
}

// ── Inicialización ────────────────────────────────────────────────────────────
export function inicializarLogicaHistorialPresupuestos() {
    const tbody = document.getElementById('pres-tbody');
    if (!tbody) return;

    // Exponer función de impresión para el onclick del HTML (módulos ES6 no son accesibles inline)
    window._imprimirPresupuesto = imprimirPresupuesto;

    // Delegación de eventos en la tabla
    tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const tr = btn.closest('tr');
        const id = tr?.dataset.id;
        if (!id) return;

        // VER / EDITAR
        if (btn.classList.contains('btn-editar')) {
            sessionStorage.setItem('presupuestoIdParaEditar', id);
            window.loadContent(null, 'static/presupuestos.html',
                document.querySelector('a[onclick*="presupuestos.html"]'));
        }

        // IMPRIMIR
        if (btn.classList.contains('btn-imprimir')) {
            await abrirModalImpresion(id);
        }

        // FACTURAR
        if (btn.classList.contains('btn-facturar')) {
            if (confirm(`¿Convertir el presupuesto #${id} en VENTA? Esta acción descontará stock.`)) {
                try {
                    const res = await fetchData(`/api/presupuestos/${id}/convertir_a_venta`, { method: 'POST' });
                    mostrarNotificacion(res.message, 'success');
                    await cargarHistorial();
                } catch (err) {
                    mostrarNotificacion(err.message, 'error');
                }
            }
        }

        // ANULAR
        if (btn.classList.contains('btn-anular')) {
            if (confirm(`¿Anular el presupuesto #${id}? Esta acción no se puede deshacer.`)) {
                try {
                    const res = await fetchData(`/api/presupuestos/${id}/anular`, { method: 'PUT' });
                    mostrarNotificacion(res.message, 'success');
                    await cargarHistorial();
                } catch (err) {
                    mostrarNotificacion(err.message, 'error');
                }
            }
        }
    });

    // Cerrar modal de impresión
    document.getElementById('btn-cerrar-modal-print')
        ?.addEventListener('click', cerrarModalImpresion);
    document.getElementById('btn-cerrar-modal-print-premium')
        ?.addEventListener('click', cerrarModalImpresion);

    // Cerrar modal haciendo click fuera
    document.getElementById('modal-imprimir-pres')
        ?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-imprimir-pres') cerrarModalImpresion();
        });

    // Filtros — botón Filtrar
    document.getElementById('btn-filtrar-presupuestos')
        ?.addEventListener('click', aplicarFiltros);

    // Búsqueda en tiempo real
    document.getElementById('pres-buscar')
        ?.addEventListener('input', aplicarFiltros);

    document.getElementById('pres-filtro-estado')
        ?.addEventListener('change', aplicarFiltros);

    // Limpiar filtros
    document.getElementById('btn-limpiar-filtros-pres')
        ?.addEventListener('click', () => {
            document.getElementById('pres-buscar').value = '';
            document.getElementById('fecha-desde-presupuestos').value = '';
            document.getElementById('fecha-hasta-presupuestos').value = '';
            document.getElementById('pres-filtro-estado').value = '';
            aplicarFiltros();
        });

    // Botón Nuevo Presupuesto
    document.getElementById('btn-nuevo-presupuesto')
        ?.addEventListener('click', () => {
            sessionStorage.removeItem('presupuestoIdParaEditar');
            window.loadContent(null, 'static/presupuestos.html',
                document.querySelector('a[onclick*="presupuestos.html"]'));
        });

    // Carga inicial
    cargarHistorial();
}