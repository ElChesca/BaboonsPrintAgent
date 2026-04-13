/* app/static/js/modules/dashboard.js */

import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let paymentChartInstance = null;
let profitChartInstance = null;

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const formatDate = (date) => {
    const d = new Date(date);
    return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

export function inicializarLogicaDashboard() {
    console.log("🚀 Inicializando Dashboard Premium...");
    
    // Setear fechas iniciales (Hoy)
    const hoy = new Date();
    const desEl = document.getElementById('dash-desde');
    const hasEl = document.getElementById('dash-hasta');
    
    if (desEl && !desEl.value) {
        desEl.value = formatDate(hoy);
        hasEl.value = formatDate(hoy);
    }

    // Event Listeners
    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    if (btnRefresh) btnRefresh.onclick = () => cargarTodo();

    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const { desde, hasta } = getPeriodoFromPill(btn.dataset.periodo);
            if (desEl) desEl.value = formatDate(desde);
            if (hasEl) hasEl.value = formatDate(hasta);
            cargarTodo();
        };
    });

    // Carga inicial
    cargarTodo();
}

async function cargarTodo() {
    const btn = document.getElementById('btn-refresh-dashboard');
    if (btn) btn.classList.add('loading');

    const desde = document.getElementById('dash-desde').value;
    const hasta = document.getElementById('dash-hasta').value;

    try {
        await Promise.all([
            cargarStatsPrincipales(desde, hasta),
            cargarProfitability(desde, hasta),
            cargarMixPagos(desde, hasta),
            cargarRankingCategorias(desde, hasta)
        ]);
    } catch (error) {
        console.error("Error en dashboard:", error);
    } finally {
        if (btn) btn.classList.remove('loading');
    }
}

async function cargarStatsPrincipales(desde, hasta) {
    if (!appState.negocioActivoId) return;
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/dashboard/stats?fecha_desde=${desde}&fecha_hasta=${hasta}`;
        const data = await fetchData(url);
        
        document.getElementById('dash-stat-ventas').innerText = formatCurrency(data.ventas_periodo);
        document.getElementById('dash-stat-stock').innerText = data.productos_bajo_stock;
        document.getElementById('dash-stat-clientes').innerText = data.total_clientes;
        document.getElementById('dash-ventas-sub').innerText = `${data.actividad_reciente.length} movimientos registrados`;

        // Tabla Actividad Reciente
        const tabla = document.getElementById('tabla-actividad-reciente');
        if (tabla) {
            tabla.innerHTML = data.actividad_reciente.map(v => `
                <tr>
                    <td>${new Date(v.fecha).toLocaleDateString()}</td>
                    <td>${v.cliente_nombre || 'Final'}</td>
                    <td class="text-right" style="font-weight: 800;">${formatCurrency(v.total)}</td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="text-center">Sin actividad</td></tr>';
        }

    } catch (e) { console.error(e); }
}

async function cargarProfitability(desde, hasta) {
    if (!appState.negocioActivoId) return;
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/dashboard/profitability?desde=${desde}&hasta=${hasta}`;
        const data = await fetchData(url);

        // KPIs de Rentabilidad
        const margenEl = document.getElementById('dash-stat-margen');
        if (margenEl) {
            margenEl.innerText = `${data.porcentaje_margen}%`;
            margenEl.className = `kpi-value ${data.porcentaje_margen > 0 ? 'text-success' : 'text-danger'}`;
        }
        document.getElementById('dash-margen-monto').innerText = `Ganancia: ${formatCurrency(data.margen_bruto)}`;

        // Panel de Costos
        document.getElementById('cost-ventas-val').innerText = formatCurrency(data.ventas_totales);
        document.getElementById('cost-cmv-val').innerText = formatCurrency(data.costo_total_estimado);
        document.getElementById('cost-utilidad-val').innerText = formatCurrency(data.margen_bruto);
        document.getElementById('cost-compras-val').innerText = formatCurrency(data.total_compras);
        
        const percCMV = data.ventas_totales > 0 ? (data.costo_total_estimado / data.ventas_totales * 100).toFixed(1) : 0;
        document.getElementById('cost-cmv-perc').innerText = `(${percCMV}% de venta)`;

        renderProfitChart(data);

    } catch (e) { console.error(e); }
}

async function cargarMixPagos(desde, hasta) {
    if (!appState.negocioActivoId) return;
    const ctx = document.getElementById('payment-methods-chart');
    if (!ctx) return;

    try {
        const url = `/api/negocios/${appState.negocioActivoId}/dashboard/payment_methods?fecha_desde=${desde}&fecha_hasta=${hasta}`;
        const data = await fetchData(url);

        if (paymentChartInstance) paymentChartInstance.destroy();

        paymentChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(i => i.metodo_pago),
                datasets: [{
                    data: data.map(i => i.total),
                    backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 6, font: { size: 10, weight: '600' } } }
                },
                cutout: '70%'
            }
        });
    } catch (e) { console.error(e); }
}

async function cargarRankingCategorias(desde, hasta) {
     if (!appState.negocioActivoId) return;
    const tabla = document.getElementById('category-ranking-table');
    if (!tabla) return;
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/dashboard/category_ranking?fecha_desde=${desde}&fecha_hasta=${hasta}`;
        const data = await fetchData(url);
        tabla.innerHTML = data.map(c => `
            <tr>
                <td style="font-weight: 600;">${c.nombre}</td>
                <td class="text-right" style="font-weight: 800; color: #1e293b;">${formatCurrency(c.total)}</td>
            </tr>
        `).join('') || '<tr><td colspan="2" class="text-center">Sin datos</td></tr>';
    } catch (e) { console.error(e); }
}

function renderProfitChart(data) {
    const ctx = document.getElementById('chart-profit-comparison');
    if (!ctx) return;

    if (profitChartInstance) profitChartInstance.destroy();

    profitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Economía del Gasto/Venta'],
            datasets: [
                { label: 'Ventas', data: [data.ventas_totales], backgroundColor: '#2563eb', borderRadius: 6 },
                { label: 'Costo (CMV)', data: [data.costo_total_estimado], backgroundColor: '#f43f5e', borderRadius: 6 },
                { label: 'Compras', data: [data.total_compras], backgroundColor: '#8b5cf6', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
            scales: {
                y: { grid: { display: false }, ticks: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function getPeriodoFromPill(periodo) {
    const hoy = new Date();
    let desde = new Date(hoy);
    switch (periodo) {
        case 'hoy': break;
        case '7d': desde.setDate(hoy.getDate() - 6); break;
        case '30d': desde.setDate(hoy.getDate() - 29); break;
        case 'mes': desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); break;
    }
    return { desde, hasta: hoy };
}

window.inicializarLogicaDashboard = inicializarLogicaDashboard;
