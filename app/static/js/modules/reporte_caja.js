// app/static/js/modules/reporte_caja.js

import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// Caché para guardar los datos y no pedirlos cada vez.
let sesionesCache = [];

/**
 * Función principal que se exporta. Se llama desde main.js cuando se carga la página de reportes.
 */
export async function inicializarLogicaReporteCaja() {
    // Si no estamos en la página correcta, no hacemos nada.
    const tablaReportes = document.getElementById('tabla-reportes-caja');
    if (!tablaReportes) return;

    // Lógica para cerrar el modal de detalles
    const modal = document.getElementById('modal-detalles-caja');
    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = () => modal.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // Pedimos los datos iniciales al servidor.
    await fetchReportesCaja();
}

/**
 * Busca los datos de las sesiones de caja cerradas en el servidor.
 */
async function fetchReportesCaja() {
    if (!appState.negocioActivoId) {
        mostrarNotificacion("Seleccione un negocio para ver los reportes.", "error");
        return;
    }
    try {
        sesionesCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/reportes/caja`);
        renderReportes();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los reportes: ' + error.message, 'error');
        const tbody = document.querySelector('#tabla-reportes-caja tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8">Error al cargar los datos.</td></tr>';
    }
}

/**
 * Dibuja los datos de los reportes en la tabla HTML.
 */
function renderReportes() {
    const tbody = document.querySelector('#tabla-reportes-caja tbody');
    if (!tbody) return;

    if (sesionesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No hay cierres de caja para mostrar.</td></tr>';
        return;
    }

    tbody.innerHTML = ''; // Limpiamos la tabla antes de dibujar
    sesionesCache.forEach(sesion => {
        const tr = document.createElement('tr');
        // Usamos una clase para resaltar diferencias, similar a como se hace con el stock bajo.
        const diferenciaClass = sesion.diferencia !== 0 ? 'stock-bajo' : '';
        const diferenciaSigno = sesion.diferencia > 0 ? '+' : '';
        
        // Formateamos los valores para que se vean bien
        const formatCurrency = (value) => `$${parseFloat(value).toFixed(2)}`;
        const formatDate = (dateString) => new Date(dateString).toLocaleString('es-AR');

        tr.innerHTML = `
            <td>${formatDate(sesion.fecha_apertura)}</td>
            <td>${formatDate(sesion.fecha_cierre)}</td>
            <td>${sesion.usuario_nombre}</td>
            <td>${formatCurrency(sesion.monto_inicial)}</td>
            <td>${formatCurrency(sesion.monto_final_esperado)}</td>
            <td>${formatCurrency(sesion.monto_final_contado)}</td>
            <td class="${diferenciaClass}">${diferenciaSigno}${formatCurrency(sesion.diferencia)}</td>
            <td><button class="btn-edit" onclick="verDetallesCaja(${sesion.id})">Ver Detalles</button></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Muestra el detalle de una sesión de caja específica en un modal.
 * Se expone globalmente para que el botón onclick la pueda encontrar.
 */
window.verDetallesCaja = async function(sesionId) {
    const modal = document.getElementById('modal-detalles-caja');
    const contenido = document.getElementById('contenido-detalles-caja');
    contenido.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';

    try {
        // Buscamos los detalles de los métodos de pago
        const desglosePagos = await fetchData(`/api/reportes/caja/${sesionId}/detalles`);
        
        // Buscamos la info general de la sesión que ya tenemos en caché
        const sesionInfo = sesionesCache.find(s => s.id === sesionId);
        if (!sesionInfo) throw new Error("No se encontró la información de la sesión.");

        let desgloseHtml = '<ul>';
        if (Object.keys(desglosePagos).length > 0) {
            for (const metodo in desglosePagos) {
                desgloseHtml += `<li><strong>${metodo}:</strong> $${desglosePagos[metodo].toFixed(2)}</li>`;
            }
        } else {
            desgloseHtml += '<li>No se registraron ventas en esta sesión.</li>';
        }
        desgloseHtml += '</ul>';

        contenido.innerHTML = `
            <h4>Resumen de la Sesión #${sesionInfo.id}</h4>
            <p><strong>Usuario:</strong> ${sesionInfo.usuario_nombre}</p>
            <p><strong>Apertura:</strong> ${new Date(sesionInfo.fecha_apertura).toLocaleString('es-AR')}</p>
            <p><strong>Cierre:</strong> ${new Date(sesionInfo.fecha_cierre).toLocaleString('es-AR')}</p>
            <hr>
            <h4>Desglose de Ventas por Método de Pago</h4>
            ${desgloseHtml}
        `;

    } catch (error) {
        contenido.innerHTML = `<p style="color: red;">Error al cargar los detalles: ${error.message}</p>`;
    }
}