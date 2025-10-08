// app/static/js/modules/historial_ingresos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function cargarHistorialIngresos() {
    if (!appState.negocioActivoId) return;
    try {
        const historial = await fetchData(`/api/negocios/${appState.negocioActivoId}/ingresos`);
        const tbody = document.querySelector('#tabla-historial-ingresos tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        historial.forEach(ingreso => {
            const fecha = new Date(ingreso.fecha).toLocaleString('es-AR');
            tbody.innerHTML += `
                <tr class="master-row" onclick="mostrarDetalleIngreso(${ingreso.id}, this)">
                    <td>${fecha}</td>
                    <td>${ingreso.proveedor_nombre || 'N/A'}</td>
                    <td>${ingreso.referencia || '-'}</td>
                    <td><button class="btn-secondary btn-small">Ver Detalles</button></td>
                </tr>
            `;
        });
    } catch (error) {
        mostrarNotificacion('No se pudo cargar el historial de ingresos: ' + error.message, 'error');
    }
}

export async function mostrarDetalle(ingresoId, masterRow) {
    const existingDetail = document.querySelector('.detail-row');
    if (existingDetail) existingDetail.remove();
    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));

    if (masterRow.classList.contains('active-temp')) {
        masterRow.classList.remove('active-temp');
        return;
    }
    masterRow.classList.add('active-temp');

    try {
        const detalles = await fetchData(`/api/ingresos/${ingresoId}/detalles`);
        let detailHtml = '<td colspan="4" class="detalle-td"><table class="tabla-detalle"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo Unit.</th></tr></thead><tbody>';
        detalles.forEach(d => {
            detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>$${(d.precio_costo_unitario || 0).toFixed(2)}</td></tr>`;
        });
        detailHtml += '</tbody></table></td>';

        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.innerHTML = detailHtml;
        masterRow.insertAdjacentElement('afterend', detailRow);
        masterRow.classList.add('active');
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los detalles del ingreso.', 'error');
    } finally {
        masterRow.classList.remove('active-temp');
    }
}


export function renderizarTabla() {
    const tbody = document.querySelector('#tabla-historial-ingresos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    historial.forEach(ingreso => {
        const fecha = new Date(ingreso.fecha).toLocaleString('es-AR');
        // ✨ CORRECCIÓN: Llamamos a la función con el nombre correcto 'mostrarDetalleIngreso'
        tbody.innerHTML += `
            <tr class="master-row" onclick="mostrarDetalleIngreso(${ingreso.id}, this)">
                <td>${fecha}</td>
                <td>${ingreso.proveedor_nombre || 'N/A'}</td>
                <td>${ingreso.referencia || '-'}</td>
                <td><button class="btn-secondary btn-small">Ver Detalles</button></td>
            </tr>
        `;
    });
}

export function inicializarLogicaHistorial() {
    cargarHistorialIngresos();
}