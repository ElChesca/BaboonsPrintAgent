import { fetchData } from '../api.js';
import { appState } from '../main.js';

async function cargarHistorial() {
    if (!appState.negocioActivoId) return;

    const tbody = document.querySelector('#tabla-historial-presupuestos tbody');
    if (!tbody) return;

    try {
        const presupuestos = await fetchData(`/api/negocios/${appState.negocioActivoId}/presupuestos`);
        tbody.innerHTML = '';
        if (presupuestos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay presupuestos registrados.</td></tr>';
            return;
        }

        presupuestos.forEach(p => {
            let estadoHtml;
            if (p.convertido_a_venta) {
                estadoHtml = '<span class="status-badge status-convertido">Facturado</span>';
            } else if (p.anulado) {
                estadoHtml = '<span class="status-badge status-anulado">Anulado</span>';
            } else {
                estadoHtml = '<span class="status-badge status-pendiente">Pendiente</span>';
            }

            const fila = `
                <tr data-id="${p.id}">
                    <td>${p.id}</td>
                    <td>${new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                    <td>${p.cliente_nombre}</td>
                    <td>${p.vendedor_nombre}</td>
                    <td>${estadoHtml}</td>
                    <td class="acciones">
                        <button class="btn-editar">Ver</button>
                        ${!p.convertido_a_venta && !p.anulado ? '<button class="btn-primary btn-facturar">Facturar</button>' : ''}
                        ${!p.anulado ? '<button class="btn-borrar btn-anular">Anular</button>' : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });

    } catch (error) {
        console.error("Error al cargar historial de presupuestos:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar los datos.</td></tr>';
    }
}

export function inicializarLogicaHistorialPresupuestos() {
    // Por ahora, solo cargamos el historial. Los botones de filtro y acciones se añadirán después.
    cargarHistorial();
}