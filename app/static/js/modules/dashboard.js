import { fetchData } from '../api.js';
import { mostrarError } from './ui.js'; // Asumo que tienes una función así en un módulo 'ui.js'


async function cargarEstadisticas() {
    try {
        // Seleccionamos los elementos aquí, dentro de la función,
        // porque no existirán hasta que se cargue el HTML.
        const ventasHoyEl = document.getElementById('stat-ventas-hoy');
        const bajoStockEl = document.getElementById('stat-bajo-stock');
        const totalClientesEl = document.getElementById('stat-total-clientes');
        const tablaActividadReciente = document.getElementById('tabla-actividad-reciente');
        
        // Si algún elemento no se encuentra, salimos para evitar errores.
        if (!ventasHoyEl || !bajoStockEl || !totalClientesEl || !tablaActividadReciente) return;

        const stats = await fetchData('/api/dashboard/stats');

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
                        <td>${venta.cliente_nombre}</td>
                        <td>$${venta.total.toFixed(2)}</td>
                    </tr>
                `;
                tablaActividadReciente.innerHTML += fila;
            });
        }
    } catch (error) {
        // mostrarError('No se pudieron cargar las estadísticas del dashboard.');
        console.error("Error al cargar stats del dashboard:", error);
    }
}

// initDashboard ahora es más simple: solo llama a la función de carga.
export function inicializarLogicaDashboard() {
    cargarEstadisticas();
}