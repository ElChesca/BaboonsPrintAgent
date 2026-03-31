import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// --- Instancias de Chart.js ---
let paymentChartInstance = null;
let distEfectividadChart = null;
let distCobranzaChart = null;
let distRebotesChart = null;

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const formatDate = (date) => {
    const d = new Date(date);
    return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

// ========================================================
//  LÓGICA ÚNICO PUNTO DE ENTRADA
// ========================================================
export function inicializarLogicaDashboard() {
    const tipo = appState.negocioActivoTipo || 'retail';

    if (tipo === 'distribuidora') {
        // Ocultar sección genérica, activar la de distribuidora
        const genDiv = document.getElementById('dash-generic');
        const distDiv = document.getElementById('dash-distribuidora');
        if (genDiv) genDiv.style.display = 'none';
        if (distDiv) distDiv.style.display = 'block';
        inicializarDashDistribucion();
    } else {
        // Dashboard genérico (retail, consorcio, etc.)
        const genDiv = document.getElementById('dash-generic');
        const distDiv = document.getElementById('dash-distribuidora');
        if (genDiv) genDiv.style.display = 'block';
        if (distDiv) distDiv.style.display = 'none';
        inicializarDashGenerico();
    }
}

// ========================================================
//  DASHBOARD GENÉRICO (retail / consorcio)
// ========================================================
function actualizarTitulosRango(fechaDesde, fechaHasta) {
    const elementosRango = document.querySelectorAll('.rango-fechas');
    let textoRango = "(Hoy)";
    if (fechaDesde && fechaHasta) {
        if (fechaDesde === fechaHasta) {
            textoRango = `(${new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR')})`;
        } else {
            const desdeFormateado = new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR');
            const hastaFormateado = new Date(fechaHasta + 'T00:00:00').toLocaleDateString('es-AR');
            textoRango = `(del ${desdeFormateado} al ${hastaFormateado})`;
        }
    }
    elementosRango.forEach(el => el.textContent = textoRango);
}

async function cargarEstadisticasPrincipales(fechaDesde, fechaHasta) {
    if (!appState.negocioActivoId) return;
    try {
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/stats`;
        if (fechaDesde && fechaHasta) url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        const stats = await fetchData(url);
        document.getElementById('stat-ventas-hoy').textContent = `$${(stats.ventas_periodo || 0).toFixed(2)}`;
        document.getElementById('stat-bajo-stock').textContent = stats.productos_bajo_stock;
        document.getElementById('stat-total-clientes').textContent = stats.total_clientes;
        const tabla = document.querySelector('#tabla-actividad-reciente');
        tabla.innerHTML = '';
        if (!stats.actividad_reciente?.length) {
            tabla.innerHTML = '<tr><td colspan="3">No hay actividad en el período.</td></tr>';
        } else {
            stats.actividad_reciente.forEach(v => {
                tabla.innerHTML += `<tr><td>${new Date(v.fecha).toLocaleString('es-AR')}</td><td>${v.cliente_nombre || 'Consumidor Final'}</td><td>$${v.total.toFixed(2)}</td></tr>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarGraficoMetodosPago(fechaDesde, fechaHasta) {
    if (!appState.negocioActivoId) return;
    const ctx = document.getElementById('payment-methods-chart');
    if (!ctx) return;
    if (paymentChartInstance) { paymentChartInstance.destroy(); paymentChartInstance = null; }
    try {
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/payment_methods`;
        if (fechaDesde && fechaHasta) url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        const data = await fetchData(url);
        if (!data?.length) { ctx.parentNode.innerHTML = '<p style="text-align:center;padding:20px;">Sin datos de métodos de pago.</p><canvas id="payment-methods-chart" style="display:none;"></canvas>'; return; }
        const newCtx = document.getElementById('payment-methods-chart').getContext('2d');
        paymentChartInstance = new Chart(newCtx, {
            type: 'doughnut',
            data: { labels: data.map(i => i.metodo_pago), datasets: [{ data: data.map(i => i.total), backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'], borderColor: '#fff', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
        });
    } catch (e) { console.error(e); }
}

async function cargarRankingCategorias(fechaDesde, fechaHasta) {
    const tabla = document.getElementById('category-ranking-table');
    if (!tabla) return;
    try {
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/category_ranking`;
        if (fechaDesde && fechaHasta) url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        const data = await fetchData(url);
        tabla.innerHTML = '';
        if (!data?.length) { tabla.innerHTML = '<tr><td colspan="2">Sin datos.</td></tr>'; return; }
        data.forEach(cat => tabla.innerHTML += `<tr><td>${cat.nombre}</td><td>$${(cat.total || 0).toFixed(2)}</td></tr>`);
    } catch (e) { console.error(e); }
}

function cargarDatosDashboard() {
    const desde = document.getElementById('fecha-desde')?.value;
    const hasta = document.getElementById('fecha-hasta')?.value;
    if (!desde || !hasta) { mostrarNotificacion("Seleccione ambas fechas.", "warning"); return; }
    if (new Date(desde) > new Date(hasta)) { mostrarNotificacion("'Desde' no puede ser posterior a 'Hasta'.", "warning"); return; }
    actualizarTitulosRango(desde, hasta);
    cargarEstadisticasPrincipales(desde, hasta);
    cargarGraficoMetodosPago(desde, hasta);
    cargarRankingCategorias(desde, hasta);
}

function inicializarDashGenerico() {
    const fechaDesdeEl = document.getElementById('fecha-desde');
    const fechaHastaEl = document.getElementById('fecha-hasta');
    const btn = document.getElementById('btn-filtrar-dashboard');
    if (!fechaDesdeEl || !fechaHastaEl || !btn) return;
    const hoy = new Date();
    const hace30 = new Date(); hace30.setDate(hoy.getDate() - 30);
    fechaDesdeEl.value = formatDate(hace30);
    fechaHastaEl.value = formatDate(hoy);
    btn.addEventListener('click', cargarDatosDashboard);
    cargarDatosDashboard();
}

// ========================================================
//  DASHBOARD DISTRIBUIDORA
// ========================================================
const ESTADO_BADGES = {
    'borrador': { bg: '#f1f5f9', color: '#64748b', label: 'Borrador' },
    'activa': { bg: '#dbeafe', color: '#2563eb', label: 'Activa' },
    'completada': { bg: '#dcfce7', color: '#16a34a', label: 'Completada' },
    'cancelada': { bg: '#fee2e2', color: '#dc2626', label: 'Cancelada' },
};
const PEDIDO_BADGES = {
    'entregado': { bg: '#dcfce7', color: '#16a34a' },
    'pendiente': { bg: '#fef9c3', color: '#ca8a04' },
    'preparado': { bg: '#dbeafe', color: '#2563eb' },
    'en_ruta': { bg: '#ede9fe', color: '#7c3aed' },
};

function setDistPeriodo(desde, hasta) {
    const desEl = document.getElementById('dist-desde');
    const hasEl = document.getElementById('dist-hasta');
    if (desEl) desEl.value = formatDate(desde);
    if (hasEl) hasEl.value = formatDate(hasta);
}

function getPeriodoFromPill(periodo) {
    const hoy = new Date();
    let desde = new Date(hoy);
    switch (periodo) {
        case 'hoy': break;
        case '7d': desde.setDate(hoy.getDate() - 6); break;
        case '30d': desde.setDate(hoy.getDate() - 29); break;
        case 'mes': desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); break;
        case 'anio': desde = new Date(hoy.getFullYear(), 0, 1); break;
    }
    return { desde, hasta: hoy };
}

async function cargarDistribucion(desdeDate, hastaDate) {
    if (!appState.negocioActivoId) return;
    const desde = formatDate(desdeDate);
    const hasta = formatDate(hastaDate);

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/distribucion?desde=${desde}&hasta=${hasta}`);
        const { kpis, ranking_vendedores, ranking_productos, ranking_clientes } = data;

        // 1. KPIs
        document.getElementById('kpi-facturacion').textContent = formatCurrency(kpis.facturacion);
        document.getElementById('kpi-pedidos-total').textContent = kpis.pedidos_total;
        document.getElementById('kpi-pedidos-entregados').textContent = kpis.pedidos_entregados;
        document.getElementById('kpi-pedidos-pendientes').textContent = kpis.pedidos_pendientes;
        document.getElementById('kpi-rutas').textContent = kpis.rutas_completadas;
        document.getElementById('kpi-clientes').textContent = kpis.clientes_visitados;

        // 2. Ranking Vendedores
        const tablaV = document.getElementById('dist-tabla-ranking');
        if (tablaV) {
            tablaV.innerHTML = '';
            if (!ranking_vendedores?.length) {
                tablaV.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Sin datos.</td></tr>';
            } else {
                ranking_vendedores.forEach((v, i) => {
                    tablaV.innerHTML += `
                        <tr>
                            <td style="font-weight:700; color:${i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#cbd5e1'}">${i + 1}</td>
                            <td>${v.nombre}</td>
                            <td style="text-align:center;">${v.visitas || 0}</td>
                            <td style="text-align:center;">${v.pedidos}</td>
                            <td style="font-weight:600;">${formatCurrency(v.total)}</td>
                        </tr>`;
                });
            }
        }

        // 3. Ranking Productos
        const tablaP = document.getElementById('dist-tabla-productos');
        if (tablaP) {
            tablaP.innerHTML = '';
            if (!ranking_productos?.length) {
                tablaP.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin datos.</td></tr>';
            } else {
                ranking_productos.forEach((p, i) => {
                    tablaP.innerHTML += `
                        <tr>
                            <td style="font-weight:700; color:${i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#cbd5e1'}">${i + 1}</td>
                            <td>${p.nombre}</td>
                            <td style="text-align:center;">${(p.total_vendido || 0).toLocaleString()}</td>
                            <td style="text-align:center;">${p.pedidos}</td>
                        </tr>`;
                });
            }
        }

        // 4. Ranking Clientes
        const tablaC = document.getElementById('dist-tabla-clientes');
        if (tablaC) {
            tablaC.innerHTML = '';
            if (!ranking_clientes?.length) {
                tablaC.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin datos.</td></tr>';
            } else {
                ranking_clientes.forEach((c, i) => {
                    tablaC.innerHTML += `
                        <tr>
                            <td style="font-weight:700; color:${i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#cbd5e1'}">${i + 1}</td>
                            <td>${c.nombre}</td>
                            <td style="text-align:center;">${c.pedidos}</td>
                            <td style="font-weight:600;">${formatCurrency(c.total_gastado)}</td>
                        </tr>`;
                });
            }
        }

        // 5. Gráficos Operativos
        const ctxEf = document.getElementById('dist-chart-efectividad');
        if (ctxEf) {
            if (distEfectividadChart) distEfectividadChart.destroy();
            distEfectividadChart = new Chart(ctxEf.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Entregas Limpias', 'Con Rebotes'],
                    datasets: [{
                        data: [data.efectividad_entrega.entregas_ok, data.efectividad_entrega.entregas_con_rebote],
                        backgroundColor: ['#10b981', '#f59e0b'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                }
            });
        }

        // Gráfico: Mix de Cobranza
        const ctxCob = document.getElementById('dist-chart-cobranza');
        if (ctxCob) {
            if (distCobranzaChart) distCobranzaChart.destroy();
            const labelsMap = { 'efectivo': 'Efectivo', 'transferencia': 'Transf.', 'cheque': 'Cheque', 'pos': 'POS' };
            const labels = data.mix_cobranza.map(c => labelsMap[c.metodo_pago] || c.metodo_pago);
            const values = data.mix_cobranza.map(c => c.total);
            distCobranzaChart = new Chart(ctxCob.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                }
            });
        }

        // Gráfico: Motivos de Rebote
        const ctxReb = document.getElementById('dist-chart-rebotes');
        if (ctxReb) {
            if (distRebotesChart) distRebotesChart.destroy();
            const labels = data.motivos_rebote.map(m => m.motivo);
            const values = data.motivos_rebote.map(m => m.cantidad);
            distRebotesChart = new Chart(ctxReb.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Cant. Items',
                        data: values,
                        backgroundColor: '#94a3b8',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { precision: 0 } },
                        y: { grid: { display: false } }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error cargando dashboard distribución:", e);
        mostrarNotificacion("Error al cargar el dashboard.", "error");
    }
}

function inicializarDashDistribucion() {
    // Setear periodo inicial: Hoy
    const hoy = new Date();
    setDistPeriodo(hoy, hoy);

    // Pills
    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const { desde, hasta } = getPeriodoFromPill(btn.dataset.periodo);
            setDistPeriodo(desde, hasta);
            cargarDistribucion(desde, hasta);
        });
    });

    // Botón filtrar custom
    document.getElementById('btn-dist-filtrar')?.addEventListener('click', () => {
        const desStr = document.getElementById('dist-desde')?.value;
        const hasStr = document.getElementById('dist-hasta')?.value;
        if (!desStr || !hasStr) { mostrarNotificacion("Seleccioná ambas fechas.", "warning"); return; }
        document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        cargarDistribucion(new Date(desStr + 'T00:00:00'), new Date(hasStr + 'T00:00:00'));
    });

    // Carga inicial con "Hoy"
    cargarDistribucion(hoy, hoy);
}
