import { fetchData } from '../api.js';
import { appState } from '../main.js';

async function cargarEstadisticasPrincipales() {
    // ✨ LA CORRECCIÓN CLAVE: Si no hay un negocio activo, no hacemos nada.
    if (!appState.negocioActivoId) return;

    try {
        const ventasHoyEl = document.getElementById('stat-ventas-hoy');
        const bajoStockEl = document.getElementById('stat-bajo-stock');
        const totalClientesEl = document.getElementById('stat-total-clientes');
        const tablaActividadReciente = document.querySelector('#tabla-actividad-reciente');
        
        if (!ventasHoyEl || !bajoStockEl || !totalClientesEl || !tablaActividadReciente) return;
        
        const stats = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/stats`);

        ventasHoyEl.textContent = `$${stats.ventas_hoy.toFixed(2)}`;
        bajoStockEl.textContent = stats.productos_bajo_stock;
        totalClientesEl.textContent = stats.total_clientes;

        tablaActividadReciente.innerHTML = '';
        if (stats.actividad_reciente.length === 0) {
            tablaActividadReciente.innerHTML = '<tr><td colspan="3">No hay actividad reciente.</td></tr>';
        } else {
            stats.actividad_reciente.forEach(venta => {
                const fecha = new Date(venta.fecha).toLocaleString('es-AR');
                const fila = `
                    <tr>
                        <td>${fecha}</td>
                        <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                        <td>$${venta.total.toFixed(2)}</td>
                    </tr>
                `;
                tablaActividadReciente.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar stats del dashboard:", error);
    }
}

async function cargarGraficoMetodosPago() {
    // ✨ LA CORRECCIÓN CLAVE: Si no hay un negocio activo, no hacemos nada.
    if (!appState.negocioActivoId) return;

    const ctx = document.getElementById('payment-methods-chart');
    if (!ctx) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/payment_methods`);
        
        if (data.length === 0) return; // Si no hay datos, no dibujamos el gráfico.

        const labels = data.map(item => item.metodo_pago);
        const totals = data.map(item => item.total);

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Vendido',
                    data: totals,
                    backgroundColor: ['rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 99, 132, 0.7)'],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
        });
    } catch (error) {
        console.error("Error al cargar datos de métodos de pago:", error);
    }
}

async function cargarRankingCategorias() {
    // ✨ LA CORRECCIÓN CLAVE: Si no hay un negocio activo, no hacemos nada.
    if (!appState.negocioActivoId) return;

    const tablaBody = document.getElementById('category-ranking-table');
    if (!tablaBody) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/category_ranking`);
        
        tablaBody.innerHTML = '';
        if (data.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="2">No hay datos de categorías.</td></tr>';
        } else {
            data.forEach(cat => {
                const fila = `
                    <tr>
                        <td>${cat.nombre}</td>
                        <td>$${cat.total.toFixed(2)}</td>
                    </tr>
                `;
                tablaBody.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar ranking de categorías:", error);
    }
}

export function inicializarLogicaDashboard() {
    cargarEstadisticasPrincipales();
    cargarGraficoMetodosPago();
    cargarRankingCategorias();
}