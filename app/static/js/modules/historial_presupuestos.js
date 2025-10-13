import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });


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
                    <td>${formatCurrency(p.total_presupuestado)}</td>
                    <td>${p.observaciones || '-'}</td>
                    <td>${p.fecha_entrega_estimada ? new Date(p.fecha_entrega_estimada).toLocaleDateString('es-AR') : '-'}</td>
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
    const tablaBody = document.querySelector('#tabla-historial-presupuestos tbody');
    if (!tablaBody) return;

    // ✨ AÑADIMOS LA LÓGICA DE LOS BOTONES USANDO DELEGACIÓN DE EVENTOS
    tablaBody.addEventListener('click', async (e) => {
        const target = e.target;
        const presupuestoId = target.closest('tr').dataset.id;

        // --- Lógica para ANULAR ---
        if (target.classList.contains('btn-anular')) {
            if (confirm(`¿Estás seguro de que quieres ANULAR el presupuesto Nro. ${presupuestoId}?`)) {
                try {
                    const response = await fetchData(`/api/presupuestos/${presupuestoId}/anular`, { method: 'PUT' });
                    mostrarNotificacion(response.message, 'success');
                    cargarHistorial(); // Refrescamos la tabla
                } catch (error) {
                    mostrarNotificacion(error.message, 'error');
                }
            }
        }

        // --- Lógica para FACTURAR ---
        if (target.classList.contains('btn-facturar')) {
            if (confirm(`¿Estás seguro de que quieres convertir el presupuesto Nro. ${presupuestoId} en una VENTA? Esta acción descontará stock.`)) {
                try {
                    const response = await fetchData(`/api/presupuestos/${presupuestoId}/convertir_a_venta`, { method: 'POST' });
                    mostrarNotificacion(response.message, 'success');
                    cargarHistorial(); // Refrescamos la tabla
                } catch (error) {
                    mostrarNotificacion(error.message, 'error');
                }
            }
        }
        
        // --- Lógica para VER / EDITAR ---
        if (target.classList.contains('btn-editar')) {
            // Guardamos el ID en sessionStorage para que la otra página lo lea
            sessionStorage.setItem('presupuestoIdParaEditar', presupuestoId);
            // Navegamos a la página de creación de presupuestos
            window.loadContent(null, 'static/presupuestos.html', document.querySelector('a[onclick*="presupuestos.html"]'));
        }
    });

    cargarHistorial(); // Carga inicial
}