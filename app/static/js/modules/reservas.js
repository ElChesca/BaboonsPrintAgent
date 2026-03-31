// app/static/js/modules/reservas.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let reservasCache = [];
let mesasCache = [];
let filtroEstado = 'all';
let fechaActual = new Date().toISOString().split('T')[0];
let updateInterval = null;

export function inicializarReservas() {
    const input = document.getElementById('res-fecha-input');
    if (input) {
        input.value = fechaActual;
        actualizarFechaDisplay(fechaActual);
    }
    cargarReservas();
    cargarMesasParaSelect();
    
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(actualizarBadgePendientes, 30000);
    actualizarBadgePendientes();

    // Attach global functions to window so the HTML onclick handlers work
    window.cambiarFecha = cambiarFecha;
    window.cargarReservas = cargarReservas;
    window.filtrarEstado = filtrarEstado;
    window.verDetalleReserva = verDetalleReserva;
    window.asignarMesaReserva = asignarMesaReserva;
    window.cambiarEstadoReserva = cambiarEstadoReserva;
    window.confirmarCancelar = confirmarCancelar;
    window.abrirModalNuevaReserva = abrirModalNuevaReserva;
    window.cerrarModal = cerrarModal;
    window.guardarReservaManual = guardarReservaManual;
    window.compartirPortal = compartirPortal;
    window.abrirModalConfigTurnos = abrirModalConfigTurnos;
    window.guardarConfigTurnos = guardarConfigTurnos;
    window.duplicarLunesATodos = duplicarLunesATodos;
    
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('change', handleFechaChange);
}

function compartirPortal() {
    const baseUrl = window.location.origin;
    const portalUrl = `${baseUrl}/reservas?id=${appState.negocioActivoId}`;
    const msg = encodeURIComponent(`¡Hola! 👋 Podés hacer tu reserva online en nuestro local haciendo clic en este link: \n\n${portalUrl}\n\n¡Te esperamos!`);
    
    // Intentar copiar al portapapeles
    navigator.clipboard.writeText(portalUrl).then(() => {
        mostrarNotificacion('¡Link copiado al portapapeles! 📋', 'success');
        // Abrir WhatsApp
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    }).catch(() => {
        // Fallback si no hay portapapeles (raro en navegadores modernos)
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    });
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') cerrarModal();
}

function handleFechaChange(e) {
    if (e.target && e.target.id === 'nr-fecha') cargarHorasDisponibles();
}

function cambiarFecha(delta) {
    const d = new Date(fechaActual);
    d.setDate(d.getDate() + delta);
    fechaActual = d.toISOString().split('T')[0];
    const input = document.getElementById('res-fecha-input');
    if (input) input.value = fechaActual;
    actualizarFechaDisplay(fechaActual);
    cargarReservas();
}

function actualizarFechaDisplay(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const el = document.getElementById('res-fecha-display');
    if (el) el.innerText = d.toLocaleDateString('es-AR', opts);
}

async function cargarReservas() {
    fechaActual = document.getElementById('res-fecha-input')?.value || fechaActual;
    actualizarFechaDisplay(fechaActual);
    const container = document.getElementById('res-list-container');
    if (!container) return;
    container.innerHTML = `<div class="res-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>`;
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas?fecha=${fechaActual}&estado=${filtroEstado}`);
        reservasCache = data || [];
        renderReservas();
    } catch (e) {
        container.innerHTML = `<div class="res-empty"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar reservas</p></div>`;
    }
}

function filtrarEstado(estado, btn) {
    filtroEstado = estado;
    document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderReservas();
}

function renderReservas() {
    const container = document.getElementById('res-list-container');
    if (!container) return;

    const lista = filtroEstado === 'all'
        ? reservasCache
        : reservasCache.filter(r => r.estado === filtroEstado);

    const statTotal = document.getElementById('stat-total-reservas');
    if (statTotal) statTotal.innerText = lista.length;
    const statPax = document.getElementById('stat-total-pax');
    if (statPax) statPax.innerText = lista.reduce((s, r) => s + parseInt(r.num_comensales || 0), 0);
    
    const pendientes = reservasCache.filter(r => r.estado === 'pendiente').length;
    const statPend = document.getElementById('stat-pendientes');
    if (statPend) statPend.innerText = pendientes;

    if (lista.length === 0) {
        container.innerHTML = `
        <div class="res-empty">
          <i class="fas fa-calendar-times"></i>
          <p style="font-size:1.1rem; font-weight:700; color:#64748b;">No hay reservas para esta fecha</p>
          <p style="color:#475569;">¿Querés cargar una manualmente?</p>
          <button class="btn-res-primary" style="margin:12px auto 0;display:inline-flex;" onclick="window.abrirModalNuevaReserva()">
            <i class="fas fa-plus"></i> Nueva Reserva
          </button>
        </div>`;
        return;
    }

    const manana = lista.filter(r => r.hora_reserva < '16:00');
    const noche = lista.filter(r => r.hora_reserva >= '16:00');

    let html = '';
    if (manana.length > 0) {
        html += `<div class="res-turno-header"><i class="fas fa-sun"></i> Turno Mediodía</div>`;
        html += manana.map(r => renderCard(r)).join('');
    }
    if (noche.length > 0) {
        html += `<div class="res-turno-header"><i class="fas fa-moon"></i> Turno Noche</div>`;
        html += noche.map(r => renderCard(r)).join('');
    }
    container.innerHTML = html;
}

const ORIGEN_ICONS = { telefono: '📞', whatsapp: '💬', portal: '🌐', presencial: '🚶', manual: '✏️' };

function renderCard(r) {
    const nombre = r.nombre_cliente || `${r.cliente_nombre_reg || ''} ${r.cliente_apellido || ''}`.trim() || 'Sin nombre';
    const icon = ORIGEN_ICONS[r.origen] || '✏️';
    const mesa = r.mesa_numero ? `Mesa ${r.mesa_numero}` : 'Sin mesa asignada';
    return `
      <div class="res-card ${r.estado}" onclick="window.verDetalleReserva(${r.id})">
        <div class="res-card-hora">${r.hora_reserva}</div>
        <div class="res-card-info">
          <h3>${nombre}</h3>
          <div class="res-card-meta">
            <span><i class="fas fa-users"></i> ${r.num_comensales} pax</span>
            <span><i class="fas fa-chair"></i> ${mesa}</span>
            ${r.telefono ? `<span><i class="fas fa-phone"></i> ${r.telefono}</span>` : ''}
            <span title="${r.origen}">${icon} ${r.origen}</span>
          </div>
          ${r.notas ? `<p style="color:#94a3b8; font-size:0.8rem; margin:6px 0 0; font-style:italic;">"${r.notas}"</p>` : ''}
        </div>
        <div class="res-card-right">
          <span class="res-estado-badge badge-${r.estado}">${r.estado}</span>
          <span class="res-pax-icon"><i class="fas fa-chevron-right" style="color:#475569;"></i></span>
        </div>
      </div>`;
}

function verDetalleReserva(id) {
    const r = reservasCache.find(x => x.id === id);
    if (!r) return;
    const nombre = r.nombre_cliente || `${r.cliente_nombre_reg || ''} ${r.cliente_apellido || ''}`.trim();
    const content = document.getElementById('detalle-reserva-content');
    const actions = document.getElementById('detalle-reserva-actions');
    if (!content || !actions) return;

    content.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Cliente</label>
          <p style="color:#f1f5f9;font-weight:700;margin:4px 0;">${nombre}</p></div>
        <div><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Fecha</label>
          <p style="color:#f1f5f9;font-weight:700;margin:4px 0;">${r.fecha_reserva} • ${r.hora_reserva}</p></div>
        <div><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Comensales</label>
          <p style="color:#f1f5f9;font-weight:700;margin:4px 0;">${r.num_comensales} personas</p></div>
        <div><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Teléfono</label>
          <p style="color:#f1f5f9;font-weight:700;margin:4px 0;">${r.telefono || '—'}</p></div>
        ${r.notas ? `<div style="grid-column:1/-1;"><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Notas</label>
          <p style="color:#f1f5f9;font-weight:600;margin:4px 0;font-style:italic;">"${r.notas}"</p></div>` : ''}
        <div><label style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;">Asignar Mesa</label>
          <select id="detalle-mesa-select" class="res-input" style="margin-top:4px;">
            <option value="">— sin asignar —</option>
            ${mesasCache.map(m => `<option value="${m.id}" ${r.mesa_id == m.id ? 'selected' : ''}>${m.numero} — ${m.zona || 'Principal'}</option>`).join('')}
          </select>
        </div>
      </div>
      ${r.telefono ? `
        <div class="wa-link-box" style="margin-top:16px;">
          <p class="wa-link-label"><i class="fab fa-whatsapp"></i> Contactar al cliente</p>
          <a href="https://wa.me/54${r.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${(nombre||'').split(' ')[0]}! ✅ Tu reserva en nuestro local está confirmada para el ${r.fecha_reserva} a las ${r.hora_reserva} hs para ${r.num_comensales} personas. ¡Te esperamos!`)}" target="_blank" class="wa-link-btn">
            <i class="fab fa-whatsapp"></i> Enviar Confirmación
          </a>
        </div>` : ''}`;

    actions.innerHTML = `
      <button class="btn-res-secondary" onclick="window.cerrarModal()">Cerrar</button>
      ${r.estado === 'pendiente' ? `<button class="btn-res-primary" style="background:linear-gradient(135deg,#10b981,#059669);" onclick="window.cambiarEstadoReserva(${r.id},'confirmada')"><i class="fas fa-check"></i> Confirmar</button>` : ''}
      ${r.estado !== 'cancelada' && r.estado !== 'completada' ? `<button class="btn-res-primary" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);" onclick="window.asignarMesaReserva(${r.id})"><i class="fas fa-chair"></i> Asignar Mesa</button>` : ''}
      ${r.estado === 'confirmada' ? `<button class="btn-res-primary" style="background:linear-gradient(135deg,#0ea5e9,#0369a1);" onclick="window.cambiarEstadoReserva(${r.id},'completada')"><i class="fas fa-check-double"></i> Completada</button>` : ''}
      ${r.estado !== 'cancelada' ? `<button class="btn-res-secondary" style="color:#f87171;border-color:rgba(248,113,113,0.3);" onclick="window.confirmarCancelar(${r.id})"><i class="fas fa-times"></i> Cancelar</button>` : ''}`;

    const modal = document.getElementById('modal-detalle-reserva');
    if (modal) modal.style.display = 'flex';
}

async function asignarMesaReserva(id) {
    const mesaId = document.getElementById('detalle-mesa-select')?.value;
    await cambiarEstadoReserva(id, null, { mesa_id: mesaId || null });
}

async function cambiarEstadoReserva(id, estado, extra = {}) {
    try {
        const payload = { ...extra };
        if (estado) payload.estado = estado;
        await sendData(`/api/negocios/${appState.negocioActivoId}/reservas/${id}`, payload, 'PATCH');
        mostrarNotificacion(`Reserva ${estado ? 'actualizada' : 'guardada'} ✓`, 'success');
        cerrarModal();
        cargarReservas();
    } catch (e) {
        mostrarNotificacion('Error al actualizar', 'error');
    }
}

function confirmarCancelar(id) {
    if (confirm('¿Cancelar esta reserva?')) cambiarEstadoReserva(id, 'cancelada');
}

function abrirModalNuevaReserva() {
    const fechaInput = document.getElementById('nr-fecha');
    if (fechaInput) fechaInput.value = fechaActual;
    const waLink = document.getElementById('wa-link-container');
    if (waLink) waLink.style.display = 'none';
    const modal = document.getElementById('modal-nueva-reserva');
    if (modal) modal.style.display = 'flex';
    cargarHorasDisponibles();
}

function cerrarModal() {
    const m1 = document.getElementById('modal-nueva-reserva');
    if (m1) m1.style.display = 'none';
    const m2 = document.getElementById('modal-detalle-reserva');
    if (m2) m2.style.display = 'none';
    const m3 = document.getElementById('modal-config-turnos');
    if (m3) m3.style.display = 'none';
}

async function cargarHorasDisponibles() {
    const fecha = document.getElementById('nr-fecha')?.value;
    if (!fecha) return;
    const select = document.getElementById('nr-hora');
    if (!select) return;
    
    select.innerHTML = `<option value="">Cargando...</option>`;
    try {
        const data = await fetchData(`/api/public/reservas/${appState.negocioActivoId}/disponibilidad?fecha=${fecha}`);
        select.innerHTML = `<option value="">— elegir horario —</option>`;
        (data.slots || []).forEach(slot => {
            const opt = document.createElement('option');
            opt.value = slot.hora;
            opt.innerText = `${slot.hora} (${slot.libres} libres)`;
            opt.disabled = !slot.disponible;
            select.appendChild(opt);
        });
        if ((data.slots || []).length === 0) select.innerHTML = `<option value="">Sin turnos disponibles</option>`;
    } catch (e) {
        select.innerHTML = `<option value="">Error al cargar</option>`;
    }
}

async function guardarReservaManual() {
    const nombre = document.getElementById('nr-nombre')?.value?.trim();
    const fecha = document.getElementById('nr-fecha')?.value;
    const hora = document.getElementById('nr-hora')?.value;
    const telefono = document.getElementById('nr-telefono')?.value?.trim();

    if (!nombre || !fecha || !hora) {
        mostrarNotificacion('Nombre, fecha y hora son obligatorios', 'error');
        return;
    }

    const payload = {
        nombre_cliente: nombre,
        telefono,
        email: document.getElementById('nr-email')?.value?.trim(),
        fecha_reserva: fecha,
        hora_reserva: hora,
        num_comensales: parseInt(document.getElementById('nr-comensales')?.value) || 2,
        mesa_id: document.getElementById('nr-mesa')?.value || null,
        notas: document.getElementById('nr-notas')?.value?.trim(),
        origen: document.getElementById('nr-origen')?.value || 'manual'
    };

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/reservas`, payload);
        mostrarNotificacion('¡Reserva creada exitosamente!', 'success');

        if (telefono) {
            const msg = encodeURIComponent(`Hola ${nombre.split(' ')[0]}! ✅ Tu reserva está confirmada para el ${fecha} a las ${hora} hs para ${payload.num_comensales} personas. ¡Te esperamos!`);
            const waLink = document.getElementById('wa-link');
            if (waLink) waLink.href = `https://wa.me/54${telefono.replace(/\D/g,'')}?text=${msg}`;
            const waContainer = document.getElementById('wa-link-container');
            if (waContainer) waContainer.style.display = 'block';
        }
        
        cargarReservas();
    } catch (e) {
        mostrarNotificacion('Error al crear reserva: ' + e.message, 'error');
    }
}

async function cargarMesasParaSelect() {
    try {
        mesasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/mesas`);
        const select = document.getElementById('nr-mesa');
        if (!select) return;
        select.innerHTML = `<option value="">— asignar después —</option>`;
        mesasCache.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.innerText = `Mesa ${m.numero} (${m.zona || 'Principal'}) — cap. ${m.capacidad || '?'}`;
            select.appendChild(opt);
        });
    } catch (e) { /* silencioso */ }
}

async function actualizarBadgePendientes() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/pendientes-count`);
        const badge = document.getElementById('badge-pendientes');
        if (!badge) return;
        const count = data.pendientes || 0;
        badge.innerText = count > 99 ? '+99' : count;
        if (count > 0) badge.classList.add('visible');
        else badge.classList.remove('visible');
    } catch (e) { /* silencioso */ }
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

async function abrirModalConfigTurnos() {
    const list = document.getElementById('turnos-config-list');
    if (!list) return;
    list.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">Cargando configuración...</td></tr>`;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/turnos`);
        
        // El backend devuelve un objeto { "0": {...}, "1": {...} }
        let html = '';
        DIAS_SEMANA.forEach((nombre, i) => {
            const t = data[i] || { activo: true, hora_inicio: "20:00", hora_fin: "23:30", intervalo_min: 30 };
            html += `
            <tr class="res-turn-row ${!t.activo ? 'inactive' : ''}" data-dia="${i}">
                <td class="day-name">${nombre}</td>
                <td>
                    <label class="res-switch">
                        <input type="checkbox" class="turn-activo" id="act-${i}" ${t.activo ? 'checked' : ''} onchange="this.closest('tr').classList.toggle('inactive', !this.checked)">
                        <span class="res-slider"></span>
                    </label>
                </td>
                <td><input type="time" class="res-input turn-inicio" value="${t.hora_inicio}"></td>
                <td><input type="time" class="res-input turn-fin" value="${t.hora_fin}"></td>
                <td><input type="number" class="res-input turn-intervalo" value="${t.intervalo_min}" min="5" step="5" style="width:60px;"></td>
            </tr>`;
        });
        list.innerHTML = html;
        document.getElementById('modal-config-turnos').style.display = 'flex';
    } catch (e) {
        mostrarNotificacion('Error al cargar turnos', 'error');
    }
}

function duplicarLunesATodos() {
    const firstRow = document.querySelector('.res-turn-row[data-dia="0"]');
    if (!firstRow) return;
    
    const activo = firstRow.querySelector('.turn-activo').checked;
    const inicio = firstRow.querySelector('.turn-inicio').value;
    const fin = firstRow.querySelector('.turn-fin').value;
    const intervalo = firstRow.querySelector('.turn-intervalo').value;

    document.querySelectorAll('.res-turn-row').forEach((row, i) => {
        if (i === 0) return; // No pisar el lunes a sí mismo
        row.querySelector('.turn-activo').checked = activo;
        row.querySelector('.turn-inicio').value = inicio;
        row.querySelector('.turn-fin').value = fin;
        row.querySelector('.turn-intervalo').value = intervalo;
        row.classList.toggle('inactive', !activo);
    });
    mostrarNotificacion('Configuración copiada a toda la semana', 'success');
}

async function guardarConfigTurnos() {
    const rows = document.querySelectorAll('.res-turn-row');
    const payload = [];
    
    rows.forEach(row => {
        payload.push({
            dia_semana: parseInt(row.dataset.dia),
            activo: row.querySelector('.turn-activo').checked,
            hora_inicio: row.querySelector('.turn-inicio').value,
            hora_fin: row.querySelector('.turn-fin').value,
            intervalo_min: parseInt(row.querySelector('.turn-intervalo').value)
        });
    });

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/reservas/turnos`, payload);
        mostrarNotificacion('Configuración de turnos guardada ✓', 'success');
        cerrarModal();
    } catch (e) {
        mostrarNotificacion('Error al guardar configuración', 'error');
    }
}
