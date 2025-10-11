import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';

export function inicializarLogicaHistorial() {
    cargarHistorialIngresos();

    // ✨ MEJORA: Añadimos un listener único a la tabla para manejar todos los clics.
    const tabla = document.querySelector('#tabla-historial tbody');
    if (tabla) {
        tabla.addEventListener('click', (e) => {
            const fila = e.target.closest('tr.master-row');
            if (fila) {
                const ingresoId = fila.dataset.ingresoId;
                // Llamamos a la función global directamente desde el JavaScript.
                window.mostrarDetalleIngreso(ingresoId, fila);
            }
        });
    }
}

async function cargarHistorialIngresos() {
    if (!appState.negocioActivoId) return;
    try {
        const response = await fetch(`/api/negocios/${appState.negocioActivoId}/ingresos`, { headers: getAuthHeaders() });
        const historial = await response.json();
        
        const tbody = document.querySelector('#tabla-historial tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        historial.forEach(ingreso => {
            const fecha = new Date(ingreso.fecha).toLocaleString('es-AR');
            // ✨ CORRECCIÓN Y MEJORA: Quitamos el 'onclick' y usamos 'data-ingreso-id'.
            tbody.innerHTML += `
                <tr class="master-row" data-ingreso-id="${ingreso.id}">
                    <td>${fecha}</td>
                    <td>${ingreso.proveedor_nombre || '-'}</td>
                    <td>${ingreso.referencia || '-'}</td>
                    <td><button>🔽</button></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error al cargar historial de ingresos:", error);
    }
}

export async function mostrarDetalle(ingresoId, masterRow) {
    const existingDetail = document.querySelector('.detail-row');
    if (existingDetail) existingDetail.remove();
    
    // Prevenimos que se cierre y reabra al hacer doble clic
    if (masterRow.classList.contains('active')) {
        masterRow.classList.remove('active');
        return;
    }
    
    document.querySelectorAll('.master-row').forEach(row => row.classList.remove('active'));
    masterRow.classList.add('active');
    
    const response = await fetch(`/api/ingresos/${ingresoId}/detalles`, { headers: getAuthHeaders() });
    const detalles = await response.json();
    
    let detailHtml = '<td colspan="4" style="padding: 20px;"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo Unit.</th></tr></thead><tbody>';
    detalles.forEach(d => {
        const costoUnitario = d.precio_costo_unitario ? `$${d.precio_costo_unitario.toFixed(2)}` : '-';
        detailHtml += `<tr><td>${d.nombre}</td><td>${d.cantidad}</td><td>${costoUnitario}</td></tr>`;
    });
    detailHtml += '</tbody></table></td>';
    
    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row';
    detailRow.innerHTML = detailHtml;
    masterRow.insertAdjacentElement('afterend', detailRow);
}