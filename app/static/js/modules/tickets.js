/* app/static/js/modules/tickets.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

// ── Estado local del módulo ────────────────────────────────────────────────
let todosLosTickets = [];
let usuariosDelNegocio = [];
let vistaActual = 'tabla'; // 'tabla' | 'kanban'

// ── Helpers ────────────────────────────────────────────────────────────────
function badgePrioridad(p) {
    const label = { urgente: '🔴 Urgente', alta: '🟠 Alta', media: '🔵 Media', baja: '⚪ Baja' };
    return `<span class="badge-prioridad ${p}">${label[p] || p}</span>`;
}

function badgeEstado(e) {
    const label = {
        abierto: 'Abierto', en_progreso: 'En Progreso',
        pendiente: 'Pendiente', resuelto: 'Resuelto', cerrado: 'Cerrado'
    };
    return `<span class="badge-estado ${e}">${label[e] || e}</span>`;
}

function formatFecha(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
        ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function slaInfo(ticket) {
    if (!ticket.fecha_limite) return '-';
    const clase = ticket.sla_vencido ? 'vencida' : '';
    if (ticket.sla_vencido) {
        return `<span class="sla-vencido-badge">⚠️ VENCIDO</span>`;
    }
    return `<span class="fecha-limite ${clase}">${formatFecha(ticket.fecha_limite)}</span>`;
}

function inicialDe(nombre) {
    return nombre ? nombre.charAt(0).toUpperCase() : '?';
}

// ── Carga principal ────────────────────────────────────────────────────────
async function cargarTickets() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) {
        todosLosTickets = [];
        renderizarTickets();
        return;
    }

    // Filtros actuales
    const estado = document.getElementById('filtro-tickets-estado')?.value || '';
    const prioridad = document.getElementById('filtro-tickets-prioridad')?.value || '';
    const asignadoId = document.getElementById('filtro-tickets-asignado')?.value || '';
    const busqueda = document.getElementById('tickets-busqueda')?.value || '';

    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (prioridad) params.set('prioridad', prioridad);
    if (asignadoId) params.set('asignado_id', asignadoId);
    if (busqueda) params.set('q', busqueda);

    try {
        todosLosTickets = await fetchData(`/api/negocios/${negocioId}/tickets?${params.toString()}`);
        await cargarStats();
        renderizarTickets();
    } catch (e) {
        console.error('[Tickets] Error cargando:', e);
        todosLosTickets = [];
        renderizarTickets(); // Siempre actualizar el tbody aunque sea vacío
        mostrarNotificacion('Error al cargar tickets', 'error');
    }
}

async function cargarStats() {
    const negocioId = appState.negocioActivoId;
    try {
        const stats = await fetchData(`/api/negocios/${negocioId}/tickets/stats`);
        document.getElementById('stat-abiertos').textContent = stats.abiertos ?? 0;
        document.getElementById('stat-en-progreso').textContent = stats.en_progreso ?? 0;
        document.getElementById('stat-urgentes').textContent = stats.urgentes ?? 0;
        document.getElementById('stat-vencidos').textContent = stats.vencidos ?? 0;
        document.getElementById('stat-resueltos').textContent = stats.resueltos ?? 0;
    } catch (e) { /* silencioso */ }
}

async function cargarUsuarios() {
    const negocioId = appState.negocioActivoId;
    try {
        const todos = await fetchData('/api/usuarios');
        // Filtrar solo los que tienen asignado el negocio activo
        usuariosDelNegocio = todos.filter(u =>
            !u.negocios_asignados ||
            u.negocios_asignados.length === 0 ||
            u.negocios_asignados.some(n => String(n.id) === String(negocioId))
        );
        const selAsignado = document.getElementById('ticket-asignado');
        const filtroAsignado = document.getElementById('filtro-tickets-asignado');
        [selAsignado, filtroAsignado].forEach(sel => {
            if (!sel) return;
            const defaultOpt = sel.id === 'ticket-asignado' ? '— Sin asignar —' : 'Todos los asignados';
            sel.innerHTML = `<option value="">${defaultOpt}</option>`;
            usuariosDelNegocio.forEach(u => {
                sel.innerHTML += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
            });
        });
    } catch (e) {
        console.warn('[Tickets] No se pudieron cargar usuarios:', e);
    }
}

// ── Renderizar Tabla ───────────────────────────────────────────────────────
function renderizarTickets() {
    if (vistaActual === 'tabla') renderTabla();
    else renderKanban();
}

function renderTabla() {
    const tbody = document.getElementById('tbody-tickets');
    if (!tbody) return;
    if (todosLosTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">No hay tickets. ¡Buen trabajo! 🎉</td></tr>';
        return;
    }
    tbody.innerHTML = todosLosTickets.map(t => `
        <tr class="${t.sla_vencido && !['resuelto', 'cerrado'].includes(t.estado) ? 'fila-alerta' : ''}">
            <td><strong>#${t.id}</strong></td>
            <td>${badgePrioridad(t.prioridad)}</td>
            <td style="max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <span style="cursor:pointer; color:var(--primary-color);" onclick="window.abrirTicket(${t.id})">${t.titulo}</span>
                ${t.comentarios_count > 0 ? `<span style="font-size:11px;color:#94a3b8;margin-left:6px;">💬 ${t.comentarios_count}</span>` : ''}
            </td>
            <td>${t.categoria || '-'}</td>
            <td>${badgeEstado(t.estado)}</td>
            <td>${t.asignado_nombre || '<span style="color:#ccc;">—</span>'}</td>
            <td style="font-size:12px; color:#64748b;">${formatFecha(t.fecha_creacion)}</td>
            <td>${slaInfo(t)}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="window.abrirTicket(${t.id})">✏️</button>
            </td>
        </tr>
    `).join('');
}

// ── Renderizar Kanban ──────────────────────────────────────────────────────
function renderKanban() {
    const estados = ['abierto', 'en_progreso', 'pendiente', 'resuelto', 'cerrado'];
    estados.forEach(estado => {
        const container = document.getElementById(`kcards-${estado}`);
        const countEl = document.getElementById(`kcount-${estado}`);
        if (!container) return;
        const tickets = todosLosTickets.filter(t => t.estado === estado);
        if (countEl) countEl.textContent = tickets.length;
        if (tickets.length === 0) {
            container.innerHTML = '<p style="color:#cbd5e1;font-size:12px;text-align:center;padding:12px;">Sin tickets</p>';
            return;
        }
        container.innerHTML = tickets.map(t => `
            <div class="kanban-card ${t.prioridad} ${t.sla_vencido ? 'sla-vencido' : ''}" onclick="window.abrirTicket(${t.id})">
                <div class="kanban-card-titulo">${t.titulo}</div>
                <div style="margin-bottom:6px;">
                    ${badgePrioridad(t.prioridad)}
                    ${t.sla_vencido ? '<span class="sla-vencido-badge">⚠️</span>' : ''}
                </div>
                <div class="kanban-card-meta">
                    <span>👤 ${t.asignado_nombre || '—'}</span>
                    <span>💬 ${t.comentarios_count}</span>
                </div>
            </div>
        `).join('');
    });
}

// ── Abrir Modal de Ticket ──────────────────────────────────────────────────
window.abrirTicket = async function (ticketId = null) {
    const modal = document.getElementById('modal-ticket');
    const form = document.getElementById('form-ticket');
    const panelAct = document.getElementById('panel-actividad');
    const btnDel = document.getElementById('btn-delete-ticket');

    // Reset
    form.reset();
    document.getElementById('ticket-id').value = '';
    panelAct.style.display = 'none';
    btnDel.style.display = 'none';

    const esAdmin = appState.userRol === 'admin' || appState.userRol === 'superadmin';
    document.querySelectorAll('#modal-ticket .admin-only').forEach(el => {
        el.style.display = esAdmin ? '' : 'none';
    });

    if (ticketId) {
        document.getElementById('modal-ticket-titulo').textContent = `Ticket #${ticketId}`;
        try {
            const ticket = await fetchData(`/api/tickets/${ticketId}`);
            document.getElementById('ticket-id').value = ticket.id;
            document.getElementById('ticket-titulo').value = ticket.titulo || '';
            document.getElementById('ticket-descripcion').value = ticket.descripcion || '';
            document.getElementById('ticket-categoria').value = ticket.categoria || 'General';
            document.getElementById('ticket-prioridad').value = ticket.prioridad || 'media';
            document.getElementById('ticket-estado').value = ticket.estado || 'abierto';
            document.getElementById('ticket-asignado').value = ticket.usuario_asignado_id || '';
            document.getElementById('ticket-horas-estimadas').value = ticket.horas_estimadas || '';
            document.getElementById('ticket-horas-reales').value = ticket.horas_reales || '';
            if (ticket.fecha_limite) {
                const fl = new Date(ticket.fecha_limite);
                document.getElementById('ticket-fecha-limite').value = fl.toISOString().slice(0, 16);
            }
            document.getElementById('ticket-email-contacto').value = ticket.email_contacto || '';
            document.getElementById('ticket-notificaciones').checked = ticket.recibir_notificaciones !== false;
            // SLA info
            const slaInfoEl = document.getElementById('ticket-sla-info');
            if (ticket.sla_vencido) {
                slaInfoEl.style.display = '';
                slaInfoEl.innerHTML = '⚠️ <strong>SLA VENCIDO.</strong> Este ticket superó su tiempo límite.';
            } else if (ticket.fecha_limite) {
                slaInfoEl.style.display = '';
                slaInfoEl.innerHTML = `⏰ Fecha límite SLA: <strong>${formatFecha(ticket.fecha_limite)}</strong>`;
            } else {
                slaInfoEl.style.display = 'none';
            }

            if (esAdmin) btnDel.style.display = '';
            panelAct.style.display = '';
            await cargarActividad(ticketId);
        } catch (e) {
            mostrarNotificacion('Error al cargar el ticket', 'error');
            return;
        }
    } else {
        document.getElementById('modal-ticket-titulo').textContent = 'Nuevo Ticket';
        document.getElementById('ticket-sla-info').style.display = 'none';
    }

    modal.style.display = 'flex';
};

async function cargarActividad(ticketId) {
    const lista = document.getElementById('ticket-actividad-lista');
    lista.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Cargando...</p>';
    try {
        const comentarios = await fetchData(`/api/tickets/${ticketId}/comentarios`);
        if (comentarios.length === 0) {
            lista.innerHTML = '<p style="color:#cbd5e1;font-size:12px;">Sin actividad aún.</p>';
            return;
        }
        lista.innerHTML = comentarios.map(c => `
            <div class="actividad-item ${c.tipo === 'cambio_estado' ? 'cambio-estado' : ''}">
                <div class="actividad-avatar ${c.tipo === 'cambio_estado' ? 'sistema' : ''}">${inicialDe(c.usuario_nombre)}</div>
                <div class="actividad-content">
                    ${c.comentario}
                    <div class="actividad-meta">${c.usuario_nombre} · ${formatFecha(c.fecha_creacion)}</div>
                </div>
            </div>
        `).join('');
        lista.scrollTop = lista.scrollHeight;
    } catch (e) {
        lista.innerHTML = '<p style="color:#ef4444;">Error al cargar actividad.</p>';
    }
}

// ── Submit del formulario ──────────────────────────────────────────────────
async function guardarTicket(e) {
    e.preventDefault();
    const ticketId = document.getElementById('ticket-id').value;
    const negocioId = appState.negocioActivoId;

    const payload = {
        titulo: document.getElementById('ticket-titulo').value.trim(),
        descripcion: document.getElementById('ticket-descripcion').value.trim(),
        categoria: document.getElementById('ticket-categoria').value,
        prioridad: document.getElementById('ticket-prioridad').value,
        estado: document.getElementById('ticket-estado').value,
        usuario_asignado_id: document.getElementById('ticket-asignado').value || null,
        horas_estimadas: document.getElementById('ticket-horas-estimadas').value || null,
        horas_reales: document.getElementById('ticket-horas-reales').value || null,
        fecha_limite: document.getElementById('ticket-fecha-limite').value || null,
        email_contacto: document.getElementById('ticket-email-contacto').value.trim() || null,
        recibir_notificaciones: document.getElementById('ticket-notificaciones').checked
    };

    try {
        if (ticketId) {
            await sendData(`/api/tickets/${ticketId}`, payload, 'PUT');
            mostrarNotificacion('Ticket actualizado ✅', 'success');
        } else {
            await sendData(`/api/negocios/${negocioId}/tickets`, payload, 'POST');
            mostrarNotificacion('Ticket creado ✅', 'success');
        }
        document.getElementById('modal-ticket').style.display = 'none';
        await cargarTickets();
    } catch (err) {
        mostrarNotificacion('Error al guardar el ticket', 'error');
    }
}

// ── Agregar comentario ─────────────────────────────────────────────────────
async function agregarComentario(e) {
    e.preventDefault();
    const ticketId = document.getElementById('ticket-id').value;
    const texto = document.getElementById('nuevo-comentario').value.trim();
    if (!texto) return;
    try {
        await sendData(`/api/tickets/${ticketId}/comentarios`, { comentario: texto }, 'POST');
        document.getElementById('nuevo-comentario').value = '';
        await cargarActividad(ticketId);
        await cargarStats();
    } catch (err) {
        mostrarNotificacion('Error al enviar comentario', 'error');
    }
}

// ── Eliminar ticket ────────────────────────────────────────────────────────
async function eliminarTicket() {
    const ticketId = document.getElementById('ticket-id').value;
    if (!ticketId) return;
    if (!confirm('¿Eliminar este ticket? Esta acción no se puede deshacer.')) return;
    try {
        await sendData(`/api/tickets/${ticketId}`, {}, 'DELETE');
        mostrarNotificacion('Ticket eliminado', 'success');
        document.getElementById('modal-ticket').style.display = 'none';
        await cargarTickets();
    } catch (err) {
        mostrarNotificacion('Error al eliminar', 'error');
    }
}

// ── Configuración de alertas email ─────────────────────────────────────────
async function abrirModalAlertas() {
    const negocioId = appState.negocioActivoId;
    const modal = document.getElementById('modal-alertas');
    modal.style.display = 'flex';
    await cargarAlertasEmail(negocioId);
}

async function cargarAlertasEmail(negocioId) {
    const lista = document.getElementById('alertas-email-lista');
    lista.innerHTML = '<li>Cargando...</li>';
    try {
        const emails = await fetchData(`/api/negocios/${negocioId}/tickets/alertas-config`);
        if (emails.length === 0) {
            lista.innerHTML = '<li style="color:#94a3b8;">Sin emails configurados.</li>';
            return;
        }
        lista.innerHTML = emails.map(e => `
            <li>
                <span class="${e.activo ? 'email-activo' : 'email-inactivo'}">
                    ${e.activo ? '✅' : '❌'} ${e.email}
                </span>
                <div style="display:flex;gap:6px;">
                    <button class="btn-secondary btn-sm" onclick="window.toggleEmail(${e.id}, ${negocioId})">
                        ${e.activo ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button class="btn-danger btn-sm" onclick="window.eliminarEmail(${e.id}, ${negocioId})">🗑️</button>
                </div>
            </li>
        `).join('');
    } catch (err) {
        lista.innerHTML = '<li style="color:#ef4444;">Error al cargar emails.</li>';
    }
}

window.toggleEmail = async function (id, negocioId) {
    await sendData(`/api/negocios/${negocioId}/tickets/alertas-config`, { accion: 'toggle', id }, 'POST');
    mostrarNotificacion('Configuración actualizada', 'success');
    await cargarAlertasEmail(negocioId);
};

window.eliminarEmail = async function (id, negocioId) {
    if (!confirm('¿Eliminar este email?')) return;
    await sendData(`/api/negocios/${negocioId}/tickets/alertas-config`, { accion: 'eliminar', id }, 'POST');
    mostrarNotificacion('Email eliminado', 'success');
    await cargarAlertasEmail(negocioId);
};

// ── SLA preview al cambiar prioridad ──────────────────────────────────────
function actualizarSlaPreview() {
    const prioridad = document.getElementById('ticket-prioridad')?.value;
    const ticketId = document.getElementById('ticket-id')?.value; // No mostrar en edit
    const slaInfoEl = document.getElementById('ticket-sla-info');
    if (ticketId || !slaInfoEl) return; // Solo en creación
    const horas = { urgente: 4, alta: 24, media: 72, baja: null };
    const h = horas[prioridad];
    if (!h) {
        slaInfoEl.style.display = 'none';
    } else {
        slaInfoEl.style.display = '';
        slaInfoEl.innerHTML = `⏰ SLA automático: <strong>${h} hora${h > 1 ? 's' : ''}</strong> desde la creación`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export async function inicializarTickets() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) {
        mostrarNotificacion('Seleccioná un negocio primero', 'error');
        return;
    }

    // Cargar usuarios para los selectores
    await cargarUsuarios();
    await cargarTickets();

    // Switcher de vista
    document.getElementById('btn-vista-tabla-tickets')?.addEventListener('click', () => {
        vistaActual = 'tabla';
        document.getElementById('tickets-vista-tabla').style.display = '';
        document.getElementById('tickets-vista-kanban').style.display = 'none';
        document.getElementById('btn-vista-tabla-tickets').classList.add('active');
        document.getElementById('btn-vista-kanban-tickets').classList.remove('active');
        renderizarTickets();
    });
    document.getElementById('btn-vista-kanban-tickets')?.addEventListener('click', () => {
        vistaActual = 'kanban';
        document.getElementById('tickets-vista-tabla').style.display = 'none';
        document.getElementById('tickets-vista-kanban').style.display = '';
        document.getElementById('btn-vista-tabla-tickets').classList.remove('active');
        document.getElementById('btn-vista-kanban-tickets').classList.add('active');
        renderizarTickets();
    });

    // Filtros
    ['filtro-tickets-estado', 'filtro-tickets-prioridad', 'filtro-tickets-asignado'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', cargarTickets);
    });

    // Búsqueda con debounce
    let busquedaTimer;
    document.getElementById('tickets-busqueda')?.addEventListener('input', () => {
        clearTimeout(busquedaTimer);
        busquedaTimer = setTimeout(cargarTickets, 350);
    });

    // Botón nuevo ticket
    document.getElementById('btn-nuevo-ticket')?.addEventListener('click', () => {
        window.abrirTicket(null);
    });

    // Formulario ticket
    document.getElementById('form-ticket')?.addEventListener('submit', guardarTicket);

    // Formulario comentario
    document.getElementById('form-comentario')?.addEventListener('submit', agregarComentario);

    // Eliminar ticket
    document.getElementById('btn-delete-ticket')?.addEventListener('click', eliminarTicket);

    // SLA preview al cambiar prioridad
    document.getElementById('ticket-prioridad')?.addEventListener('change', actualizarSlaPreview);

    // Cerrar modales
    document.getElementById('close-modal-ticket')?.addEventListener('click', () => {
        document.getElementById('modal-ticket').style.display = 'none';
    });
    document.getElementById('close-modal-alertas')?.addEventListener('click', () => {
        document.getElementById('modal-alertas').style.display = 'none';
    });
    document.querySelectorAll('#modal-ticket, #modal-alertas').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    });

    // Config alertas email
    document.getElementById('btn-config-alertas')?.addEventListener('click', abrirModalAlertas);
    document.getElementById('btn-agregar-email')?.addEventListener('click', async () => {
        const email = document.getElementById('nuevo-email-alerta')?.value.trim();
        if (!email) return;
        try {
            await sendData(`/api/negocios/${negocioId}/tickets/alertas-config`, { accion: 'agregar', email }, 'POST');
            document.getElementById('nuevo-email-alerta').value = '';
            mostrarNotificacion('Email agregado ✅', 'success');
            await cargarAlertasEmail(negocioId);
        } catch (err) {
            mostrarNotificacion('Error al agregar email', 'error');
        }
    });
}
