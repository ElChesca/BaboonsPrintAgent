// static/js/modules/home_consorcio.js
// ✨ ARCHIVO NUEVO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Función para cargar el resumen de Expensas del Inquilino ---
async function cargarResumenExpensas() {
    const tbody = document.getElementById('portal-tabla-expensas');
    if (!tbody) return; // Si no está el div del portal, no hace nada
    
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/mis-expensas`;
        const expensas = await fetchData(url);
        
        tbody.innerHTML = '';
        if (expensas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No tienes expensas emitidas.</td></tr>';
            return;
        }
        
        expensas.forEach(ex => {
            const periodo = new Date(ex.periodo + 'T00:00:00').toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            const vencimiento = new Date(ex.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES');
            tbody.innerHTML += `
                <tr>
                    <td>${periodo}</td>
                    <td>${ex.nombre_unidad}</td>
                    <td>${vencimiento}</td>
                    <td>${ex.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td><strong>${ex.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></td>
                    <td><span class="estado-${ex.estado_pago.toLowerCase().replace(' ', '-')}">${ex.estado_pago}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar expensas.</td></tr>';
        mostrarNotificacion('Error al cargar tus expensas.', 'error');
    }
}

// --- Función para cargar el resumen de Reclamos del Inquilino ---
async function cargarResumenReclamos() {
    const tbody = document.getElementById('portal-tabla-reclamos');
    if (!tbody) return; // Si no está el div del portal, no hace nada
    
    try {
        // Usamos la API de reclamos que ya filtra por usuario
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos`;
        const reclamos = await fetchData(url);
        
        tbody.innerHTML = '';
        if (reclamos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No tienes reclamos registrados.</td></tr>';
            return;
        }

        reclamos.forEach(r => {
            const fechaAct = new Date(r.fecha_actualizacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const globo = (r.comentarios_count > 0) ? `<span class="comentario-badge">${r.comentarios_count}</span>` : '';
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="estado-${r.estado.toLowerCase().replace(' ', '-')}">${r.estado}</span></td>
                    <td>${fechaAct}</td>
                    <td><strong>${r.nombre_unidad}</strong></td>
                    <td>${r.titulo}</td>
                    <td>${globo}</td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error al cargar reclamos.</td></tr>';
        mostrarNotificacion('Error al cargar tus reclamos.', 'error');
    }
}

// --- Función de Inicialización ---
export async function inicializarLogicaHomeConsorcio() {
    // Si es admin, no hace nada (solo ve los íconos)
    if (esAdmin()) {
        console.log("Home Consorcio: Vista de Admin (íconos).");
        return;
    }

    // Si es inquilino (operador), carga los resúmenes
    console.log("Home Consorcio: Vista de Inquilino (Portal).");
    cargarResumenExpensas();
    cargarResumenReclamos();
}