// static/js/modules/historial_inventario.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

function formatDateTime(isoString) {
    if (!isoString) return '-';
    // Formato simple DD/MM/AAAA HH:MM
    const date = new Date(isoString);
    return date.toLocaleString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function renderizarHistorial(historial) {
    const tbody = document.querySelector('#tabla-historial-inventario tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // Limpia la tabla

    if (!historial || historial.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay movimientos en el período seleccionado.</td></tr>';
        return;
    }

    historial.forEach(mov => {
        const cantidadClass = mov.cantidad_cambio > 0 ? 'cantidad-positiva' : (mov.cantidad_cambio < 0 ? 'cantidad-negativa' : '');
        const cantidadTexto = mov.cantidad_cambio > 0 ? `+${mov.cantidad_cambio}` : mov.cantidad_cambio;
        
        tbody.innerHTML += `
            <tr>
                <td>${formatDateTime(mov.fecha_movimiento)}</td>
                <td>${mov.producto_nombre} <small style="color: grey;">(ID: ${mov.producto_id})</small></td>
                <td>${mov.tipo_movimiento}</td>
                <td class="${cantidadClass}">${cantidadTexto}</td>
                <td>${mov.stock_resultante !== null ? mov.stock_resultante : '-'}</td>
                </tr>
        `;
    });
}

async function cargarHistorial() {
    if (!appState.negocioActivoId) {
        renderizarHistorial([]); // Muestra tabla vacía si no hay negocio
        return;
    }

    // Aquí podríamos añadir lógica para leer los filtros de fecha
    const url = `/api/negocios/${appState.negocioActivoId}/historial_inventario`;
    
    try {
        const historial = await fetchData(url);
        renderizarHistorial(historial);
    } catch (error) {
        mostrarNotificacion(`Error al cargar el historial: ${error.message}`, 'error');
        renderizarHistorial(null); // Indica error en la tabla
    }
}


export function inicializarHistorialInventario() {
    const btnFiltrar = document.getElementById('btn-filtrar-historial');
    
    if (btnFiltrar) {
        // Por ahora, el botón solo recarga, luego añadiremos filtros reales
        btnFiltrar.addEventListener('click', cargarHistorial);
    }

    // Carga inicial al entrar a la página
    cargarHistorial();
}