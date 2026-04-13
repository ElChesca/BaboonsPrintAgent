/* app/static/js/modules/resto_stats.js */

let paxChartInstance = null;

export async function inicializarRestoStats() {
    console.log("📊 Inicializando Dashboard de Estadísticas Restó...");
    
    if (typeof window.appState === 'undefined' || !window.appState.negocioActivoId) {
        console.warn("Falta appState o negocioActivoId para cargar estadísticas.");
        return;
    }

    const inputDesde = document.getElementById('filter-desde');
    const inputHasta = document.getElementById('filter-hasta');
    const btnRefresh = document.getElementById('btn-refresh-stats');

    if (inputDesde && !inputDesde.value) {
        const hoy = new Date().toISOString().split('T')[0];
        inputDesde.value = hoy;
        inputHasta.value = hoy;
    }

    if (btnRefresh) {
        btnRefresh.onclick = () => cargarDatosStats();
    }

    await cargarDatosStats();
}

async function cargarDatosStats() {
    const btnRefresh = document.getElementById('btn-refresh-stats');
    const desde = document.getElementById('filter-desde').value;
    const hasta = document.getElementById('filter-hasta').value;
    const negocioId = window.appState.negocioActivoId;

    if (btnRefresh) btnRefresh.classList.add('loading');

    try {
        const url = `/api/negocios/${negocioId}/stats?desde=${desde}&hasta=${hasta}`;
        const data = await window.fetchData(url);
        
        renderResumen(data.resumen, data.reservas);
        renderRanking(data.ranking_staff);
        renderTopProductos(data.top_productos);
        renderTopCategorias(data.top_categorias);
        renderKDSStats(data.kds_stats);
        renderMesasKPI(data.mesas_estado, data.pax_hoy, data.tiempo_promedio_min);
        renderPaxChart(data.pax_historial);
        
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
    } finally {
        if (btnRefresh) btnRefresh.classList.remove('loading');
    }
}

function renderResumen(resumen, reservas) {
    const montoEl = document.getElementById('stat-ventas-monto');
    const countEl = document.getElementById('stat-ventas-count');
    
    const resTotalEl = document.getElementById('stat-reservas-total');
    const resConfEl = document.getElementById('stat-res-confirmadas');
    const resPendEl = document.getElementById('stat-res-pendientes');
    
    if (montoEl && window.formatCurrency) {
        montoEl.innerText = window.formatCurrency(resumen ? resumen.monto_total : 0);
    }
    if (countEl) countEl.innerText = resumen ? resumen.total_ventas : 0;

    // Render Reservas Breakdown
    if (resTotalEl) resTotalEl.innerText = reservas ? reservas.total : 0;
    if (resConfEl) resConfEl.innerText = reservas ? reservas.confirmadas : 0;
    if (resPendEl) resPendEl.innerText = reservas ? reservas.pendientes : 0;
}

function renderMesasKPI(mesas, paxHoy, tiempoPromedio) {
    const ocupadasEl = document.getElementById('stat-mesas-ocupadas');
    const paxEl = document.getElementById('stat-pax-count');
    const tiempoEl = document.getElementById('stat-tiempo-promedio');

    const ocupadasCount = (mesas.ocupada || 0) + (mesas.cuenta || 0) + (mesas.en_cobro || 0);
    if (ocupadasEl) ocupadasEl.innerText = ocupadasCount;
    
    if (paxEl) paxEl.innerText = paxHoy || 0;
    if (tiempoEl) tiempoEl.innerText = `${tiempoPromedio || 0} min`;
}

function renderKDSStats(kds) {
    const container = document.getElementById('kds-stats-list');
    if (!container) return;

    if (!kds || kds.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">Sin datos KDS</td></tr>`;
        return;
    }

    container.innerHTML = kds.map(k => `
        <tr>
            <td style="font-weight: 700; color: #1e293b;">${k.destino}</td>
            <td class="text-right">
                <span style="font-weight: 800; color: #2563eb;">${k.total_cantidad}</span>
            </td>
        </tr>
    `).join('');
}

function renderRanking(ranking) {
    const container = document.getElementById('ranking-staff-list');
    if (!container) return;
    
    if (!ranking || ranking.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-3 text-muted">Sin ventas</td></tr>`;
        return;
    }

    container.innerHTML = ranking.map(r => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; border-radius: 6px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 0.7rem;">
                        <i class="fas fa-user"></i>
                    </div>
                    <span style="font-weight: 600;">${r.nombre}</span>
                </div>
            </td>
            <td class="text-right">
                <span style="font-weight: 800; color: #1e293b;">
                    ${window.formatCurrency ? window.formatCurrency(r.total_vendido) : r.total_vendido}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderTopCategorias(categorias) {
    const container = document.getElementById('top-categorias-list');
    if (!container) return;

    if (!categorias || categorias.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-3 text-muted">Sin datos</td></tr>`;
        return;
    }

    container.innerHTML = categorias.map(c => `
        <tr>
            <td style="font-weight: 600;">${c.nombre}</td>
            <td class="text-right">
                <span style="padding: 2px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 800; font-size: 0.8rem;">
                    ${c.total_cantidad}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderTopProductos(productos) {
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (!productos || productos.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-3 text-muted">Sin datos</td></tr>`;
        return;
    }

    container.innerHTML = productos.map(p => `
        <tr>
            <td style="font-weight: 600; font-size: 0.85rem;">${p.nombre}</td>
            <td class="text-right">
                <span style="padding: 2px 8px; border-radius: 6px; background: rgba(37, 99, 235, 0.1); color: #2563eb; font-weight: 800; font-size: 0.8rem;">
                    ${p.total_cantidad}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderPaxChart(historial) {
    const ctx = document.getElementById('paxChart');
    if (!ctx) return;

    if (paxChartInstance) {
        paxChartInstance.destroy();
    }

    const labels = historial.map(h => {
        const date = new Date(h.fecha);
        return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    });
    const counts = historial.map(h => h.cantidad);

    if (labels.length === 1) {
        labels.push(labels[0]);
        counts.push(0);
    }

    paxChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Comensales',
                data: counts,
                backgroundColor: 'rgba(6, 182, 212, 0.6)',
                borderColor: '#06b6d4',
                borderWidth: 2,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
            }
        }
    });
}

window.inicializarRestoStats = inicializarRestoStats;
