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