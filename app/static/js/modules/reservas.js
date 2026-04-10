// app/static/js/modules/reservas.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let reservasCache = [];
let mesasCache = [];
let sectoresCache = [];
let waConfig = { wa_template: null };
let filtroEstado = 'all';
let fechaActual = new Date().toISOString().split('T')[0];
let updateInterval = null;

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SECTORES = ["Salon", "Terraza", "VIP", "Barra", "Patio", "Entrepiso"];

export function inicializarReservas() {
    const input = document.getElementById('res-fecha-input');
    if (input) {
        input.value = fechaActual;
        actualizarFechaDisplay(fechaActual);
    }
    cargarReservas();
    cargarMesasParaSelect();
    cargarSectores();
    cargarWAConfig(); // Cargar config de WhatsApp al inicio
    
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(actualizarBadgePendientes, 30000);
    actualizarBadgePendientes();

    // Attach global functions to window
    window.cambiarFecha = cambiarFecha;
    window.cargarReservas = cargarReservas;
    window.filtrarEstado = filtrarEstado;
    window.verDetalleReserva = verDetalleReserva;
    window.asignarMesaReserva = asignarMesaReserva;
    window.cambiarEstadoReserva = cambiarEstadoReserva;
    window.confirmarCancelar = confirmarCancelar;
    window.abrirModalNuevaReserva = abrirModalNuevaReserva;
    window.editarReserva = editarReserva;
    window.eliminarReserva = eliminarReserva;
    window.cerrarModal = cerrarModal;
    window.guardarReservaManual = guardarReservaManual;
    window.compartirPortal = compartirPortal;
    window.abrirModalConfigGeneral = abrirModalConfigGeneral;
    window.guardarConfigGeneral = guardarConfigGeneral;
    window.switchConfigTab = switchConfigTab;
    
    document.addEventListener('keydown', handleEscapeKey);
    // delegación para cambios de fecha en form
    document.addEventListener('change', e => {
        if (e.target && e.target.id === 'nr-fecha') cargarHorasDisponibles();
    });
}

async function cargarWAConfig() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/config`);
        waConfig = data;
    } catch (e) { console.error("Error loading WA config", e); }
}

function switchConfigTab(tab) {
    console.log("📂 Cambiando tab configuración a:", tab);
    document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.config-tab-content').forEach(c => c.style.display = 'none');
    
    // Buscar el botón que tiene el onclick que contiene el nombre del tab
    const activeBtn = Array.from(document.querySelectorAll('.config-tab')).find(b => b.getAttribute('onclick')?.includes(tab));
    if (activeBtn) activeBtn.classList.add('active');
    
    const content = document.getElementById(`tab-config-${tab}`);
    if (content) content.style.display = 'block';
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') cerrarModal();
}

function cambiarFecha(delta) {
    const d = new Date(fechaActual + 'T12:00:00');
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

    const lista = filtroEstado === 'all' ? reservasCache : reservasCache.filter(r => r.estado === filtroEstado);

    document.getElementById('stat-total-reservas').innerText = lista.length;
    document.getElementById('stat-total-pax').innerText = lista.reduce((s, r) => s + parseInt(r.num_comensales || 0), 0);
    document.getElementById('stat-pendientes').innerText = reservasCache.filter(r => r.estado === 'pendiente').length;

    if (lista.length === 0) {
        container.innerHTML = `
        <div class="res-empty">
          <i class="fas fa-calendar-times"></i>
          <p style="font-size:1.1rem; font-weight:700; color:#64748b;">No hay reservas para esta fecha</p>
          <button class="btn-res-primary" style="margin-top:12px;" onclick="window.abrirModalNuevaReserva()">+ Nueva Reserva</button>
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
    const mesa = r.mesa_numero ? `Mesa ${r.mesa_numero}` : 'Sin mesa';
    return `
      <div class="res-card ${r.estado}" onclick="window.verDetalleReserva(${r.id})">
        <div class="res-card-hora">${r.hora_reserva}</div>
        <div class="res-card-info">
          <h3>${nombre}</h3>
          <div class="res-card-meta">
            <span><i class="fas fa-users"></i> ${r.num_comensales} pax</span>
            <span><i class="fas fa-chair"></i> ${mesa}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${r.sector_preferido || 'Salon'}</span>
            <span title="${r.origen}">${icon}</span>
          </div>
        </div>
        <div class="res-card-right">
          <span class="res-estado-badge badge-${r.estado}">${r.estado}</span>
          <span class="res-pax-icon"><i class="fas fa-chevron-right"></i></span>
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

    const waMsg = getWhatsAppLink(r);

    content.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="res-detail-item"><label>Cliente</label><p>${nombre}</p></div>
        <div class="res-detail-item"><label>Fecha/Hora</label><p>${r.fecha_reserva} • ${r.hora_reserva} hs</p></div>
        <div class="res-detail-item"><label>Pax / Sector</label><p>${r.num_comensales} personas • ${r.sector_preferido || 'Salon'}</p></div>
        <div class="res-detail-item"><label>Teléfono</label><p>${r.telefono || '—'}</p></div>
        <div class="res-detail-item"><label>Cumpleaños</label><p>${r.fecha_nacimiento || '—'}</p></div>
        <div class="res-detail-item"><label>Estado</label><p><span class="res-estado-badge badge-${r.estado}">${r.estado}</span></p></div>
        ${r.notas ? `<div style="grid-column:1/-1;"><label>Notas</label><p style="font-style:italic;">"${r.notas}"</p></div>` : ''}
        
        <div style="grid-column:1/-1;">
            <label>Asignar Mesa</label>
            <select id="detalle-mesa-select" class="res-input">
                <option value="">— sin asignar —</option>
                ${mesasCache.map(m => `<option value="${m.id}" ${r.mesa_id == m.id ? 'selected' : ''}>Mesa ${m.numero} (${m.zona || 'Principal'})</option>`).join('')}
            </select>
        </div>
      </div>
      ${r.telefono ? `
        <div class="wa-link-box" style="margin-top:20px;">
          <p class="wa-link-label"><i class="fab fa-whatsapp"></i> Acción de WhatsApp</p>
          <a href="${waMsg}" target="_blank" class="wa-link-btn">
            <i class="fab fa-whatsapp"></i> Enviar Mensaje de Confirmación
          </a>
        </div>` : ''}`;

    actions.innerHTML = `
      <div class="res-modal-actions-grid">
        <div class="res-actions-main">
            <button class="btn-res-secondary btn-danger-soft" onclick="window.eliminarReserva(${r.id})" title="Eliminar de la base de datos">
                <i class="fas fa-trash-alt"></i> Eliminar
            </button>
            <div style="flex:1"></div>
            <button class="btn-res-secondary" onclick="window.cerrarModal()">Cerrar</button>
            <button class="btn-res-primary btn-edit-res" onclick="window.editarReserva(${r.id})">
                <i class="fas fa-edit"></i> Editar Todo
            </button>
        </div>
        
        <div class="res-actions-status">
            <button class="btn-res-status btn-status-card" onclick="window.generarTarjetaDigital(${r.id})" title="Generar imagen para enviar">
                <i class="fas fa-id-card"></i> Tarjeta
            </button>
            
            ${r.estado === 'pendiente' ? `
                <button class="btn-res-status btn-status-confirm" onclick="window.cambiarEstadoReserva(${r.id},'confirmada')">
                    <i class="fas fa-check"></i> Confirmar
                </button>` : ''}
            
            ${r.estado !== 'cancelada' ? `
                <button class="btn-res-status btn-status-table" onclick="window.asignarMesaReserva(${r.id})">
                    <i class="fas fa-chair"></i> Guardar Mesa
                </button>` : ''}
            
            ${r.estado === 'confirmada' ? `
                <button class="btn-res-status btn-status-complete" onclick="window.cambiarEstadoReserva(${r.id},'completada')">
                    <i class="fas fa-flag-checkered"></i> Completar
                </button>` : ''}
            
            ${r.estado !== 'cancelada' ? `
                <button class="btn-res-status btn-status-cancel" onclick="window.confirmarCancelar(${r.id})">
                    <i class="fas fa-times"></i> Cancelar
                </button>` : ''}
        </div>
      </div>`;

    document.getElementById('modal-detalle-reserva').style.display = 'flex';
    
    // Cargar bitácora
    cargarBitacora(r.id);
}

async function cargarBitacora(id) {
    const list = document.getElementById('bitacora-lista');
    if (!list) return;
    list.innerHTML = '<p style="font-size:0.8rem; color:#94a3b8;">Cargando historial...</p>';
    
    try {
        const logs = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/${id}/bitacora`);
        if (!logs || logs.length === 0) {
            list.innerHTML = '<p style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No hay cambios registrados.</p>';
            return;
        }
        
        list.innerHTML = logs.map(log => {
            const dateStr = new Date(log.fecha).toLocaleString('es-AR', { 
                day: '2-digit', month: '2-digit', year: '2-digit', 
                hour: '2-digit', minute: '2-digit' 
            });
            return `
                <div class="bit-item">
                    <div class="bit-meta">
                        <span class="bit-user">${log.usuario_nombre || 'Sistema'}</span>
                        <span>${dateStr}hs</span>
                    </div>
                    <div class="bit-action">${log.accion}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = '<p style="color:#ef4444; font-size:0.8rem;">No se pudo cargar la bitácora.</p>';
    }
}

function getWhatsAppLink(r) {
    const nombreFull = r.nombre_cliente || `${r.cliente_nombre_reg || ''} ${r.cliente_apellido || ''}`.trim();
    const nombre = nombreFull.split(' ')[0];
    const negocioObj = appState.negociosCache.find(n => String(n.id) === String(appState.negocioActivoId));
    const negocio = negocioObj ? negocioObj.nombre : 'el local';
    
    let template = waConfig.wa_template || "¡Hola {nombre}! ✅ Tu reserva en {negocio} está confirmada para el {fecha} a las {hora} hs para {pax} personas. ¡Te esperamos!";
    
    let msg = template
        .replace(/{nombre}/g, nombre)
        .replace(/{negocio}/g, negocio)
        .replace(/{fecha}/g, r.fecha_reserva)
        .replace(/{hora}/g, r.hora_reserva)
        .replace(/{pax}/g, r.num_comensales)
        .replace(/{sector}/g, r.sector_preferido || 'Salón');
        
    return `https://wa.me/54${(r.telefono || '').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
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
        mostrarNotificacion('Reserva actualizada ✓', 'success');
        cerrarModal();
        cargarReservas();
    } catch (e) { mostrarNotificacion('Error al actualizar', 'error'); }
}

function confirmarCancelar(id) {
    if (confirm('¿Cancelar esta reserva?')) cambiarEstadoReserva(id, 'cancelada');
}

async function eliminarReserva(id) {
    if (!confirm('🚨 ¡ATENCIÓN!\n¿Estás seguro que deseas eliminar esta reserva definitivamente?\n\nEsta acción quitará el registro de la base de datos y es irreversible.')) return;
    try {
        await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Reserva eliminada definitivamente', 'success');
        cerrarModal();
        cargarReservas();
    } catch (e) {
        mostrarNotificacion('Error al eliminar', 'error');
    }
}

let editingReservaId = null;

function abrirModalNuevaReserva() {
    editingReservaId = null;
    const title = document.querySelector('#modal-nueva-reserva .res-modal-header h2');
    if (title) title.innerHTML = '<i class="fas fa-calendar-plus"></i> Nueva Reserva Manual';
    
    document.getElementById('nr-nombre').value = '';
    document.getElementById('nr-telefono').value = '';
    document.getElementById('nr-email').value = '';
    document.getElementById('nr-cumpleanios').value = '';
    document.getElementById('nr-fecha').value = fechaActual;
    document.getElementById('nr-comensales').value = 2;
    document.getElementById('nr-notas').value = '';
    document.getElementById('nr-origen').value = 'manual';
    document.getElementById('nr-estado').value = 'confirmada';
    
    document.getElementById('wa-link-container').style.display = 'none';
    
    const secSelect = document.getElementById('nr-sector');
    if (secSelect) {
        secSelect.innerHTML = sectoresCache.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }
    
    document.getElementById('modal-nueva-reserva').style.display = 'flex';
    cargarHorasDisponibles();
}

async function editarReserva(id) {
    const r = reservasCache.find(x => x.id === id);
    if (!r) return;
    
    // Cerramos el modal de detalles primero para que no quede debajo
    cerrarModal();
    
    editingReservaId = r.id;
    const title = document.querySelector('#modal-nueva-reserva .res-modal-header h2');
    if (title) title.innerHTML = '<i class="fas fa-edit"></i> Editar Reserva';

    document.getElementById('nr-nombre').value = r.nombre_cliente || '';
    document.getElementById('nr-telefono').value = r.telefono || '';
    document.getElementById('nr-email').value = r.email || '';
    document.getElementById('nr-cumpleanios').value = r.fecha_nacimiento || '';
    document.getElementById('nr-fecha').value = r.fecha_reserva;
    document.getElementById('nr-comensales').value = r.num_comensales;
    document.getElementById('nr-notas').value = r.notas || '';
    document.getElementById('nr-origen').value = r.origen || 'manual';
    document.getElementById('nr-estado').value = r.estado;
    document.getElementById('nr-mesa').value = r.mesa_id || '';
    
    document.getElementById('wa-link-container').style.display = 'none';
    
    const secSelect = document.getElementById('nr-sector');
    if (secSelect) {
        secSelect.innerHTML = sectoresCache.map(s => `<option value="${s.nombre}" ${r.sector_preferido === s.nombre ? 'selected' : ''}>${s.nombre}</option>`).join('');
    }
    
    document.getElementById('modal-nueva-reserva').style.display = 'flex';
    
    // Cargar horas y pre-setear la de la reserva
    await cargarHorasDisponibles();
    document.getElementById('nr-hora').value = r.hora_reserva;
}

function cerrarModal() {
    document.querySelectorAll('.res-modal-overlay').forEach(m => m.style.display = 'none');
}

async function cargarHorasDisponibles() {
    const fecha = document.getElementById('nr-fecha')?.value;
    const select = document.getElementById('nr-hora');
    if (!fecha || !select) return;
    
    select.innerHTML = `<option value="">Cargando...</option>`;
    try {
        const data = await fetchData(`/api/public/reservas/${appState.negocioActivoId}/disponibilidad?fecha=${fecha}`);
        select.innerHTML = (data.slots || []).length > 0 ? `<option value="">— elegir horario —</option>` : `<option value="">Sin turnos</option>`;
        data.slots.forEach(slot => {
            const opt = document.createElement('option');
            opt.value = slot.hora;
            opt.innerText = `${slot.hora} (${slot.libres} libres)`;
            opt.disabled = !slot.disponible;
            select.appendChild(opt);
        });
    } catch (e) { select.innerHTML = `<option value="">Error carga</option>`; }
}

async function guardarReservaManual() {
    const nombre = document.getElementById('nr-nombre')?.value?.trim();
    const fecha = document.getElementById('nr-fecha')?.value;
    const hora = document.getElementById('nr-hora')?.value;
    const telefono = document.getElementById('nr-telefono')?.value?.trim();

    if (!nombre || !fecha || !hora) {
        mostrarNotificacion('Nombre, fecha y hora obligatorios', 'error');
        return;
    }

    const payload = {
        nombre_cliente: nombre,
        telefono,
        email: document.getElementById('nr-email')?.value,
        fecha_nacimiento: document.getElementById('nr-cumpleanios')?.value || null,
        sector_preferido: document.getElementById('nr-sector')?.value,
        fecha_reserva: fecha,
        hora_reserva: hora,
        num_comensales: parseInt(document.getElementById('nr-comensales').value) || 2,
        mesa_id: document.getElementById('nr-mesa').value || null,
        notas: document.getElementById('nr-notas').value,
        origen: document.getElementById('nr-origen').value,
        estado: document.getElementById('nr-estado').value || 'confirmada'
    };

    try {
        let res;
        if (editingReservaId) {
            res = await sendData(`/api/negocios/${appState.negocioActivoId}/reservas/${editingReservaId}`, payload, 'PATCH');
            mostrarNotificacion('¡Reserva actualizada!', 'success');
            cerrarModal();
        } else {
            res = await sendData(`/api/negocios/${appState.negocioActivoId}/reservas`, payload);
            mostrarNotificacion('¡Reserva creada!', 'success');
        }
        
        if (telefono && !editingReservaId) {
            const link = getWhatsAppLink({ ...payload, id: res.id });
            const btn = document.getElementById('wa-link');
            if (btn) btn.href = link;
            document.getElementById('wa-link-container').style.display = 'block';
        }
        cargarReservas();
    } catch (e) { mostrarNotificacion('Error: ' + e.message, 'error'); }
}

async function cargarMesasParaSelect() {
    try {
        mesasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/mesas`);
        const select = document.getElementById('nr-mesa');
        if (!select) return;
        select.innerHTML = `<option value="">— asignar después —</option>` + 
            mesasCache.map(m => `<option value="${m.id}">Mesa ${m.numero} (${m.zona || 'Salon'})</option>`).join('');
    } catch (e) {}
}

async function actualizarBadgePendientes() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/pendientes-count`);
        const badge = document.getElementById('badge-pendientes');
        if (badge) {
            badge.innerText = data.pendientes || 0;
            badge.style.display = data.pendientes > 0 ? 'inline-block' : 'none';
        }
    } catch (e) {}
}

async function cargarSectores() {
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/sectores`);
        sectoresCache = data || [];
    } catch (e) { console.error("Error al cargar sectores", e); }
}

// --- CONFIGURACIÓN GENERAL (NUEVO GESTOR DE BLOQUES) ---

let turnosTemporales = []; // Estado local para el gestor de bloques

async function abrirModalConfigGeneral() {
    const list = document.getElementById('lista-bloques-horarios');
    const waInput = document.getElementById('wa-template-input');
    if (!list) return;
    
    list.innerHTML = `<p style="text-align:center;padding:20px;">Cargando configuración...</p>`;
    document.getElementById('modal-config-general').style.display = 'flex';
    switchConfigTab('turnos');

    try {
        const [turnosData, configData] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/turnos`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/config`)
        ]);
        
        waConfig = configData;
        if (waInput) waInput.value = configData.wa_template || '';
        
        const selAviso = document.getElementById('config-aviso-min');
        if (selAviso) selAviso.value = configData.aviso_apertura_min || 60;

        const inputAntelacion = document.getElementById('config-antelacion-dias');
        if (inputAntelacion) inputAntelacion.value = configData.antelacion_minima_dias || 0;

        // Cargar link público
        const publicLinkInput = document.getElementById('res-public-link-input');
        if (publicLinkInput) {
            publicLinkInput.value = configData.reserva_token 
                ? `${window.location.origin}/reservas?t=${configData.reserva_token}`
                : `${window.location.origin}/reservas?id=${appState.negocioActivoId}`;
        }

        // Convertir data del servidor a nuestro array plano de bloques
        turnosTemporales = [];
        Object.keys(turnosData).forEach(dia => {
            if (Array.isArray(turnosData[dia])) {
                turnosData[dia].forEach(t => {
                    turnosTemporales.push({
                        dia_semana: parseInt(dia),
                        hora_inicio: t.hora_inicio,
                        hora_fin: t.hora_fin,
                        intervalo_min: t.intervalo_min || 30
                    });
                });
            }
        });

        renderizarListaTurnos();
    } catch (e) { 
        console.error("[Reservas] Error al cargar:", e);
        mostrarNotificacion('Error al cargar configuración', 'error'); 
    }
}

function renderizarListaTurnos() {
    const container = document.getElementById('lista-bloques-horarios');
    if (!container) return;

    if (turnosTemporales.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px; color:#64748b; font-style:italic; grid-column: 1 / -1;">No hay turnos configurados aún. ¡Agregá el primero arriba!</p>`;
        return;
    }

    // Ordenar por día (0-Lunes a 6-Domingo) y luego por hora de inicio
    turnosTemporales.sort((a, b) => (a.dia_semana - b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio));

    container.innerHTML = turnosTemporales.map((t, index) => `
        <div class="res-bloque-card">
            <div class="res-bloque-info">
                <span class="res-bloque-dia">${DIAS_SEMANA[t.dia_semana]}</span>
                <span class="res-bloque-horas">${t.hora_inicio} a ${t.hora_fin}</span>
                <span class="res-bloque-int">Intervalo: ${t.intervalo_min} min</span>
            </div>
            <button class="btn-remove-bloque" onclick="window.eliminarTurnoBloque(${index})" title="Eliminar este bloque">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function agregarBloqueTurno() {
    const diaVal = document.getElementById('new-turno-dia').value;
    const inicio = document.getElementById('new-turno-inicio').value;
    const fin = document.getElementById('new-turno-fin').value;
    const intervalo = parseInt(document.getElementById('new-turno-int').value);

    if (!inicio || !fin || !intervalo) {
        mostrarNotificacion('Completá todos los campos del nuevo turno', 'warning');
        return;
    }

    const diasAAgregar = diaVal === 'all' ? [0,1,2,3,4,5,6] : [parseInt(diaVal)];

    diasAAgregar.forEach(d => {
        turnosTemporales.push({
            dia_semana: d,
            hora_inicio: inicio,
            hora_fin: fin,
            intervalo_min: intervalo
        });
    });

    renderizarListaTurnos();
    mostrarNotificacion('Turno añadido a la lista exitosamente', 'success');
}

function eliminarTurnoBloque(index) {
    turnosTemporales.splice(index, 1);
    renderizarListaTurnos();
}

async function guardarConfigGeneral() {
    const configPayload = {
        wa_template: document.getElementById('wa-template-input').value,
        aviso_apertura_min: parseInt(document.getElementById('config-aviso-min').value) || 60,
        antelacion_minima_dias: parseInt(document.getElementById('config-antelacion-dias').value) || 0
    };

    try {
        await Promise.all([
            sendData(`/api/negocios/${appState.negocioActivoId}/reservas/turnos`, turnosTemporales),
            sendData(`/api/negocios/${appState.negocioActivoId}/reservas/config`, configPayload)
        ]);
        if (waConfig) {
            waConfig.wa_template = configPayload.wa_template;
            waConfig.aviso_apertura_min = configPayload.aviso_apertura_min;
        }
        mostrarNotificacion('¡Configuración guardada correctamente! ✓', 'success');
        cerrarModal();
    } catch (e) { 
        console.error("[Reservas] Error al guardar:", e);
        mostrarNotificacion('Error al guardar la configuración', 'error'); 
    }
}

function compartirPortal() {
    const input = document.getElementById('res-public-link-input');
    const url = input ? input.value : `${window.location.origin}/reservas?id=${appState.negocioActivoId}`;
    navigator.clipboard.writeText(url);
    mostrarNotificacion('Link del portal copiado al portapapeles 📋', 'success');
}

// --- TARJETA DIGITAL (NUEVO) ---

let currentCardImage = null;

async function generarTarjetaDigital(id) {
    const r = reservasCache.find(x => x.id === id);
    if (!r) return;
    
    // Población de template
    const biz = appState.negociosCache.find(n => String(n.id) === String(appState.negocioActivoId));
    const nombreFull = r.nombre_cliente || `${r.cliente_nombre_reg || ''} ${r.cliente_apellido || ''}`.trim();
    
    document.getElementById('card-client-name').innerText = nombreFull.toUpperCase();
    document.getElementById('card-hora').innerText = (r.hora_reserva || '20:00').substring(0,5) + ' HS';
    
    // Formatear fecha DD/MM
    let fechaDisplay = r.fecha_reserva;
    try {
        const partsF = r.fecha_reserva.split('-');
        if(partsF.length === 3) fechaDisplay = `${partsF[2]}/${partsF[1]}`;
    } catch(e) {}
    document.getElementById('card-fecha').innerText = fechaDisplay;

    document.getElementById('card-pax').innerText = r.num_comensales + ' PERSONAS';
    document.getElementById('card-address').innerText = biz ? (biz.direccion || '') : '';

    const modal = document.getElementById('modal-reserva-digital');
    const preview = document.getElementById('res-card-preview-container');
    
    modal.style.display = 'flex';
    preview.innerHTML = `<div class="res-loading"><i class="fas fa-spinner fa-spin"></i> Generando Tarjeta...</div>`;

    setTimeout(async () => {
        try {
            const template = document.getElementById('res-card-template');
            
            // Forzar carga de todas las imágenes en el template (logo y trama)
            const images = template.querySelectorAll('img');
            const promises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(res => { img.onload = res; img.onerror = res; });
            });

            // También esperar a que la fuente esté lista si es posible
            await document.fonts.ready;
            await Promise.all(promises);

            const canvas = await html2canvas(template, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false,
                onclone: (doc) => {
                    // Asegurar visibilidad en el clon
                    const el = doc.getElementById('res-card-template');
                    if (el) el.style.position = 'relative';
                }
            });
            currentCardImage = canvas.toDataURL("image/png");
            preview.innerHTML = '';
            const img = document.createElement('img');
            img.src = currentCardImage;
            img.className = 'res-card-img-preview';
            img.style.maxWidth = '100%';
            img.style.borderRadius = '12px';
            img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            preview.appendChild(img);
        } catch (e) {
            console.error("[Tarjeta] Error:", e);
            preview.innerHTML = `<p style="color:red;">Error al generar imagen de la tarjeta.</p>`;
        }
    }, 800);
}

async function compartirTarjeta() {
    if (!currentCardImage) return;
    try {
        const blob = await (await fetch(currentCardImage)).blob();
        const file = new File([blob], 'reserva_vitaclub.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Confirmación de Reserva',
                text: '¡Tu mesa está lista!'
            });
        } else {
            descargarTarjeta();
            mostrarNotificacion("Tu navegador no soporta compartir archivos. Se descargó la imagen.", "info");
        }
    } catch (e) {
        console.error("[Share Error]", e);
        descargarTarjeta();
    }
}

function descargarTarjeta() {
    if (!currentCardImage) return;
    const link = document.createElement('a');
    link.download = 'TarjetaReserva.png';
    link.href = currentCardImage;
    link.click();
}

// --- EXPOSICIÓN GLOBAL ---
window.abrirModalConfigGeneral = abrirModalConfigGeneral;
window.agregarBloqueTurno = agregarBloqueTurno;
window.eliminarTurnoBloque = eliminarTurnoBloque;
window.guardarConfigGeneral = guardarConfigGeneral;
window.compartirPortal = compartirPortal;
window.generarTarjetaDigital = generarTarjetaDigital;
window.compartirTarjeta = compartirTarjeta;
window.descargarTarjeta = descargarTarjeta;
