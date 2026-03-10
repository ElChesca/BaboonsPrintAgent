// app/static/js/modules/agente_facturacion.js
import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

const fmtCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fmtFecha = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—';

// ── Carga reporte del día ────────────────────────────────────────────────────
async function cargarReporte(fecha = null) {
    const fechaInput = document.getElementById('agente-fecha-filtro');
    const fechaQuery = fecha || fechaInput.value || new Date().toISOString().split('T')[0];
    fechaInput.value = fechaQuery;

    try {
        const data = await fetchData(`/api/agente/facturacion/reporte?fecha=${fechaQuery}`);
        renderKpis(data);
        renderTabla(data.facturas || []);
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

    // Badge de modo
    const badge = document.getElementById('agente-badge-modo');
    if (data.facturas && data.facturas.length > 0) {
        const modo = data.facturas[0].estado;
        badge.textContent = modo === 'simulacion' ? '🧪 Simulación' : '✅ Real';
        badge.className   = modo === 'simulacion' ? 'badge-modo badge-sim' : 'badge-modo badge-real';
    } else {
        badge.textContent = '— Sin datos';
        badge.className   = 'badge-modo';
    }
}

// ── Tabla de facturas ─────────────────────────────────────────────────────────
function renderTabla(facturas) {
    const tbody = document.getElementById('agente-tabla-body');
    if (!facturas.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Sin facturas para esta fecha</td></tr>';
        return;
    }

    tbody.innerHTML = facturas.map(f => {
        const statsClase = f.estado === 'ok' ? 'badge-estado-ok'
                         : f.estado === 'simulacion' ? 'badge-estado-sim'
                         : 'badge-estado-error';
        const estadoLabel = f.estado === 'ok' ? '✅ OK'
                          : f.estado === 'simulacion' ? '🧪 SIM'
                          : '❌ Error';

        // Items colapsados como tooltip
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
            <td title="${itemsText}" style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${itemsText}</td>
            <td style="text-align:right; font-weight:600;">${fmtCurrency(f.importe_total)}</td>
            <td><span class="badge-estado ${statsClase}">${estadoLabel}</span></td>
        </tr>`;
    }).join('');
}

// ── Ejecutar manualmente hoy ──────────────────────────────────────────────────
async function ejecutarHoy() {
    const confirmado = confirm(
        '⚠️ ¿Ejecutar el agente de facturación para HOY?\n\n' +
        'En modo SIMULACIÓN: no emite facturas reales.\n' +
        'En modo REAL: emite facturas en ARCA (homologación).\n\n' +
        '¿Continuar?'
    );
    if (!confirmado) return;

    const btn = document.getElementById('btn-agente-ejecutar');
    btn.disabled = true;
    btn.textContent = '⏳ Ejecutando...';

    try {
        const res = await fetchData('/api/agente/facturacion/ejecutar-hoy', {
            method: 'POST',
            body: JSON.stringify({ modo: 'simulacion' })
        });
        mostrarNotificacion(
            `✅ Agente ejecutado: ${res.ok} facturas OK, ${res.errores} errores. Total: ${fmtCurrency(res.total_facturado)}`,
            'success'
        );
        // Refrescar reporte
        await cargarReporte();
    } catch (err) {
        mostrarNotificacion('Error al ejecutar el agente: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Ejecutar Hoy (Manual)';
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
    } catch (e) {
        // silencioso — el calendario es un bonus
    }
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
                     title="${d.dia_semana} ${d.fecha}: ${d.cantidad} facturas">
            <span class="cal-num">${diaMes}</span>
            <span class="cal-dow">${diaSem}</span>
            <span class="cal-count">${d.cantidad}</span>
        </div>`;
    }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function inicializarAgenteFacturacion() {
    // Fecha default = hoy
    const hoyISO = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('agente-fecha-filtro');
    if (fechaInput) fechaInput.value = hoyISO;

    // Cargar reporte inicial
    cargarReporte(hoyISO);
    cargarCalendario();

    // Listeners
    document.getElementById('btn-agente-reporte')
        ?.addEventListener('click', () => cargarReporte());

    document.getElementById('btn-agente-ejecutar')
        ?.addEventListener('click', ejecutarHoy);
}
