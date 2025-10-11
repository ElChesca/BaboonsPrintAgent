// app/static/js/modules/dashboard.js
import { fetchData } from '../api.js';
// ✨ 1. Importamos el estado global para saber qué negocio está activo
import { appState } from '../main.js';

async function cargarEstadisticas() {
    try {
        const ventasHoyEl = document.getElementById('stat-ventas-hoy');
        const bajoStockEl = document.getElementById('stat-bajo-stock');
        const totalClientesEl = document.getElementById('stat-total-clientes');
        const tablaActividadReciente = document.querySelector('#tabla-actividad-reciente tbody');
        
        if (!ventasHoyEl || !bajoStockEl || !totalClientesEl || !tablaActividadReciente) return;
        
        // ✨ 2. Construimos la URL correcta con el ID del negocio activo
        const stats = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/stats`);

        // Ahora stats.ventas_hoy ya no será undefined
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

export function inicializarLogicaDashboard() {
    cargarEstadisticas();
}
// ✨ NUEVA FUNCIÓN para el gráfico de métodos de pago
async function cargarGraficoMetodosPago() {
    const ctx = document.getElementById('payment-methods-chart');
    if (!ctx) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/dashboard/payment_methods`);
        
        const labels = data.map(item => item.metodo_pago);
        const totals = data.map(item => item.total);

        // Creamos el gráfico usando Chart.js
        new Chart(ctx, {
            type: 'doughnut', // Tipo de gráfico: dona
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Vendido',
                    data: totals,
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 99, 132, 0.7)',
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error al cargar datos de métodos de pago:", error);
    }
}

// ✨ NUEVA FUNCIÓN para el ranking de categorías
async function cargarRankingCategorias() {
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