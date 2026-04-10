// app/static/js/modules/agente_facturacion.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

const fmtCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fmtFecha = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—';

let currentConfig = null;
let lastReportData = [];

// ── Carga reporte del día ────────────────────────────────────────────────────
async function cargarReporte(fecha = null) {
    const fechaInput = document.getElementById('agente-fecha-filtro');
    const fechaQuery = fecha || fechaInput.value || new Date().toISOString().split('T')[0];
    fechaInput.value = fechaQuery;

    try {
        const data = await fetchData(`/api/agente/facturacion/reporte?fecha=${fechaQuery}`);
        lastReportData = data.facturas || [];
        renderKpis(data);
        renderTabla(lastReportData);
    } catch (err) {
        mostrarNotificacion('Error al cargar el reporte: ' + err.message, 'error');
    }
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
function renderKpis(data) {
    document.getElementById('kpi-ok').textContent    = data.total_ok ?? '—';
    document.getElementById('kpi-error').textContent = data.total_error ?? '—';
    document.getElementById('kpi-monto').textContent = fmtCurrency(data.total_monto);
    document.getElementById('kpi-fecha').textContent = fmtFecha(data.fecha);

    const badge = document.getElementById('agente-badge-modo');
    if (data.facturas && data.facturas.length > 0) {
        const modo = data.facturas[0].estado;
        badge.textContent = modo === 'simulacion' ? '🧪 Simulación' : '✅ Real';
        badge.className   = modo === 'simulacion' ? 'badge-modo badge-sim' : 'badge-modo badge-real';
    } else if (currentConfig) {
        badge.textContent = currentConfig.modo_ejecucion === 'simulacion' ? '🧪 Simulación' : '✅ Real';
        badge.className   = currentConfig.modo_ejecucion === 'simulacion' ? 'badge-modo badge-sim' : 'badge-modo badge-real';
    }
}

// ── Tabla de facturas ─────────────────────────────────────────────────────────
function renderTabla(facturas) {
    const tbody = document.getElementById('agente-tabla-body');
    if (!facturas.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">Sin facturas para esta fecha</td></tr>';
        return;
    }

    tbody.innerHTML = facturas.map((f, idx) => {
        const statsClase = f.estado === 'ok' ? 'badge-estado-ok'
                         : f.estado === 'simulacion' ? 'badge-estado-sim'
                         : 'badge-estado-error';
        const estadoLabel = f.estado === 'ok' ? '✅ OK'
                          : f.estado === 'simulacion' ? '🧪 SIM'
                          : '❌ Error';

        const items = f.items || [];
        const itemsText = items.map(i => `${i.nombre} x${i.cantidad}`).join(' | ');

        const hora = f.fecha_hora_emision
            ? new Date(f.fecha_hora_emision).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            : '—';

        return `<tr>
            <td>${hora}</td>
            <td><code style="font-size:0.8rem;">${f.numero_factura || '—'}</code></td>
            <td><code style="font-size:0.8rem;">${f.cae || f.detalle_error || '—'}</code></td>
            <td>${f.vencimiento_cae || '—'}</td>
            <td title="${itemsText}" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${itemsText}</td>
            <td style="text-align:right; font-weight:600;">${fmtCurrency(f.importe_total)}</td>
            <td><span class="badge-estado ${statsClase}">${estadoLabel}</span></td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.verFacturaDigital(${idx})" title="Ver Factura">👁️</button>
            </td>
        </tr>`;
    }).join('');
}

// ── Visualizador de Factura ──────────────────────────────────────────────────
window.verFacturaDigital = (idx) => {
    const f = lastReportData[idx];
    if (!f) return;

    document.getElementById('view-fecha').textContent = fmtFecha(f.fecha_hora_emision.split('T')[0]);
    document.getElementById('view-pv').textContent    = f.numero_factura?.split('-')[0] || '00001';
    document.getElementById('view-nro').textContent   = f.numero_factura?.split('-')[1] || '00000000';
    document.getElementById('view-cae').textContent   = f.cae || '—';
    document.getElementById('view-vto').textContent   = f.vencimiento_cae || '—';
    document.getElementById('view-total').textContent = fmtCurrency(f.importe_total);

    const itemsBody = document.getElementById('view-items-body');
    itemsBody.innerHTML = (f.items || []).map(i => `
        <tr>
            <td style="padding:5px 0;">${i.nombre} x${i.cantidad}</td>
            <td style="text-align:right;">${i.cantidad}</td>
            <td style="text-align:right;">${fmtCurrency(i.subtotal)}</td>
        </tr>
    `).join('');

    document.getElementById('modal-factura-viewer').style.display = 'flex';
};

// ── Ejecutar manualmente hoy ──────────────────────────────────────────────────
async function ejecutarHoy() {
    const modoActual = currentConfig?.modo_ejecucion || 'simulacion';
    const confirmado = confirm(
        `⚠️ ¿Ejecutar el agente de facturación para HOY?\n\n` +
        `Estás en modo: ${modoActual.toUpperCase()}\n\n` +
        `¿Continuar?`
    );
    if (!confirmado) return;

    const btn = document.getElementById('btn-agente-ejecutar');
    btn.disabled = true;
    btn.textContent = '⏳ Ejecutando...';

    try {
        const res = await fetchData('/api/agente/facturacion/ejecutar-hoy', {
            method: 'POST',
            body: JSON.stringify({ modo: modoActual })
        });
        mostrarNotificacion(
            `✅ Agente ejecutado: ${res.ok} facturas OK, ${res.errores} errores. Total: ${fmtCurrency(res.total_facturado)}`,
            'success'
        );
        await cargarReporte();
        cargarCalendario();
    } catch (err) {
        mostrarNotificacion('Error al ejecutar el agente: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Ejecutar Manual';
    }
}

// ── Calendario mensual ────────────────────────────────────────────────────────
async function cargarCalendario() {
    const hoy = new Date();
    try {
        const data = await fetchData(
            `/api/agente/facturacion/distribucion-mes?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`
        );
        renderCalendario(data.distribucion || []);
    } catch (e) { }
}

function renderCalendario(dias) {
    const cont = document.getElementById('agente-calendario');
    if (!cont || !dias.length) return;
    const maxCant = Math.max(...dias.map(d => d.cantidad), 1);

    cont.innerHTML = dias.map(d => {
        const fecha = new Date(d.fecha + 'T12:00:00');
        const diaMes = fecha.getDate();
        const diaSem = fecha.toLocaleDateString('es-AR', { weekday: 'short' });
        const intensidad = Math.round((d.cantidad / maxCant) * 100);
        const esHoy = d.fecha === new Date().toISOString().split('T')[0];

        return `<div class="cal-dia ${esHoy ? 'cal-hoy' : ''}"
                     style="background: rgba(var(--primary-rgb), ${(intensidad / 100) * 0.7});"
                     title="${d.dia_semana} ${d.fecha}: ${d.cantidad} facturas proyectadas">
            <span class="cal-num">${diaMes}</span>
            <span class="cal-dow">${diaSem}</span>
            <span class="cal-count">${d.cantidad}</span>
        </div>`;
    }).join('');
}

// ── Gestión de Configuración ──────────────────────────────────────────────────
async function cargarConfig() {
    try {
        currentConfig = await fetchData('/api/agente/facturacion/config');
        document.getElementById('cfg-meta').value = currentConfig.meta_mensual;
        document.getElementById('cfg-modo').value = currentConfig.modo_ejecucion;
        document.getElementById('cfg-cuit').value = currentConfig.cuit_negocio || '';
        document.getElementById('cfg-pv').value   = currentConfig.punto_venta;
        document.getElementById('cfg-variabilidad').value = currentConfig.variabilidad_porcentaje;
        document.getElementById('cfg-var-value').textContent = `${currentConfig.variabilidad_porcentaje}%`;
        document.getElementById('cfg-autopilot').checked = currentConfig.auto_pilot;
        renderKpis({ fecha: new Date().toISOString().split('T')[0] });
    } catch (err) { }
}

async function guardarConfig(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
        meta_mensual: parseInt(formData.get('meta_mensual')),
        modo_ejecucion: formData.get('modo_ejecucion'),
        cuit_negocio: formData.get('cuit_negocio'),
        punto_venta: parseInt(formData.get('punto_venta')),
        variabilidad_porcentaje: parseInt(formData.get('variabilidad_porcentaje')),
        auto_pilot: document.getElementById('cfg-autopilot').checked
    };

    try {
        await sendData('/api/agente/facturacion/config', payload);
        mostrarNotificacion('Configuración guardada correctamente.', 'success');
        currentConfig = { ...currentConfig, ...payload };
        cargarCalendario();
        document.querySelector('[data-tab="reporte"]').click();
    } catch (err) {
        mostrarNotificacion('Error al guardar: ' + err.message, 'error');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function inicializarAgenteFacturacion() {
    const hoyISO = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('agente-fecha-filtro');
    if (fechaInput) fechaInput.value = hoyISO;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const targetEl = document.getElementById(`tab-agente-${target}`);
            if (targetEl) {
                targetEl.classList.add('active');
                targetEl.style.display = 'block';
                document.querySelectorAll('.tab-content:not(.active)').forEach(el => el.style.display = 'none');
            }
        });
    });

    const range = document.getElementById('cfg-variabilidad');
    range?.addEventListener('input', (e) => {
        document.getElementById('cfg-var-value').textContent = `${e.target.value}%`;
    });

    document.getElementById('agente-config-form')?.addEventListener('submit', guardarConfig);
    cargarConfig();
    cargarReporte(hoyISO);
    cargarCalendario();

    document.getElementById('btn-agente-reporte')?.addEventListener('click', () => cargarReporte());
    document.getElementById('btn-agente-ejecutar')?.addEventListener('click', ejecutarHoy);
}
