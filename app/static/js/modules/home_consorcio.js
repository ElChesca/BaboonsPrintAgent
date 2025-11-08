// static/js/modules/home_consorcio.js
// ✨ ARCHIVO ACTUALIZADO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- (cargarResumenExpensas sin cambios) ---
async function cargarResumenExpensas() {
    const tbody = document.getElementById('portal-tabla-expensas');
    if (!tbody) return;
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
            tbody.innerHTML += `<tr><td>${periodo}</td><td>${ex.nombre_unidad}</td><td>${vencimiento}</td><td>${ex.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td><strong>${ex.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></td><td><span class="estado-${ex.estado_pago.toLowerCase().replace(' ', '-')}">${ex.estado_pago}</span></td></tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar expensas.</td></tr>';
    }
}

// --- (cargarResumenReclamos sin cambios) ---
async function cargarResumenReclamos() {
    const tbody = document.getElementById('portal-tabla-reclamos');
    if (!tbody) return;
    try {
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
            tbody.innerHTML += `<tr><td><span class="estado-${r.estado.toLowerCase().replace(' ', '-')}">${r.estado}</span></td><td>${fechaAct}</td><td><strong>${r.nombre_unidad}</strong></td><td>${r.titulo}</td><td>${globo}</td></tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error al cargar reclamos.</td></tr>';
    }
}

// --- ✨ NUEVA FUNCIÓN: Cargar Resumen de Noticias ---
async function cargarResumenNoticias() {
    const listaDiv = document.getElementById('portal-lista-noticias');
    if (!listaDiv) return;

    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/noticias`;
        const noticias = await fetchData(url);

        listaDiv.innerHTML = '';
        if (noticias.length === 0) {
            listaDiv.innerHTML = '<p>No hay comunicados para mostrar.</p>';
            return;
        }

        // Mostramos solo las 5 más recientes
        noticias.slice(0, 5).forEach(n => {
            const fecha = new Date(n.fecha_creacion).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
            const iconoFijado = n.es_fijado ? '<span class="pin-icon">📌 FIJADO</span>' : '';
            const claseFijado = n.es_fijado ? 'fijado' : '';

            listaDiv.innerHTML += `
                <div class="noticia-card ${claseFijado}">
                    <div class="noticia-card-header">
                        <h3>${n.titulo}</h3>
                        <div class="noticia-card-meta">
                            Publicado por <strong>${n.creador_nombre}</strong>
                            <br>
                            ${fecha}
                            ${iconoFijado}
                        </div>
                    </div>
                    <div class="noticia-card-body">
                        <p>${n.cuerpo}</p>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        listaDiv.innerHTML = '<p style="color: red;">Error al cargar comunicados.</p>';
    }
}

// --- Función de Inicialización (Actualizada) ---
export async function inicializarLogicaHomeConsorcio() {
    if (esAdmin()) {
        console.log("Home Consorcio: Vista de Admin (íconos).");
        return;
    }

    console.log("Home Consorcio: Vista de Inquilino (Portal).");
    cargarResumenExpensas();
    cargarResumenReclamos();
    cargarResumenNoticias(); // ✨ AÑADIDA
}