/**
 * crm_meta.js — Módulo CRM Meta (WhatsApp / Instagram / Facebook)
 * ERP Multinegocio Baboons
 *
 * Estructura: panel izquierdo (lista de contactos) | panel derecho (chat)
 * Usa appState.negocioActivoId para todas las peticiones.
 */

'use strict';

// ─── Estado local del módulo ──────────────────────────────────────────────────
const CrmMeta = {
    leadSeleccionado:    null,
    mensajes:            [],
    contactos:           [],
    pollingInterval:     null,
    POLLING_MS:          10000,
};

// ─── Inicialización ───────────────────────────────────────────────────────────

export function initCrmMeta() {
    if (!window.appState || !appState.negocioActivoId) {
        console.warn('[CRM Meta] appState.negocioActivoId no disponible.');
        return;
    }
    // Actualizar URL del webhook en el modal de configuración
    const webhookUrlEl = document.getElementById('crm-webhook-url');
    if (webhookUrlEl) {
        webhookUrlEl.textContent = `${window.location.origin}/api/webhooks/meta`;
    }
    _bindEventListeners();
    cargarContactos();
    verificarConfigMeta();
}

function _bindEventListeners() {
    // Buscar contacto
    const inputBuscar = document.getElementById('crm-buscar');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', _filtrarContactos);
    }

    // Filtro por plataforma
    const selectPlataforma = document.getElementById('crm-plataforma');
    if (selectPlataforma) {
        selectPlataforma.addEventListener('change', cargarContactos);
    }

    // Enviar mensaje con Enter (sin Shift)
    const textarea = document.getElementById('crm-input-mensaje');
    if (textarea) {
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
            }
        });
    }

    // Botón enviar
    document.getElementById('crm-btn-enviar')?.addEventListener('click', enviarMensaje);

    // Botón configurar
    document.getElementById('crm-btn-config')?.addEventListener('click', abrirModalConfig);

    // Guardar config
    document.getElementById('crm-config-form')?.addEventListener('submit', guardarConfigMeta);

    // Cerrar modal config
    document.getElementById('crm-modal-config-close')?.addEventListener('click', cerrarModalConfig);
    document.getElementById('crm-modal-config-overlay')?.addEventListener('click', cerrarModalConfig);

    // Botón refresh manual
    document.getElementById('crm-btn-refresh')?.addEventListener('click', () => {
        cargarContactos();
        if (CrmMeta.contactoSeleccionado) {
            cargarChat(CrmMeta.contactoSeleccionado);
        }
    });
}

// ─── Contactos ────────────────────────────────────────────────────────────────

async function cargarContactos() {
    const negocioId   = appState.negocioActivoId;
    const plataforma  = document.getElementById('crm-plataforma')?.value || '';
    const params      = plataforma ? `?plataforma=${plataforma}` : '';

    try {
        const res  = await fetch(`/api/negocios/${negocioId}/crm/contactos${params}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
        });
        if (!res.ok) throw new Error(await res.text());
        CrmMeta.contactos = await res.json();
        _renderListaContactos(CrmMeta.contactos);
    } catch (err) {
        console.error('[CRM Meta] cargarContactos:', err);
        _showToast('Error al cargar contactos', 'error');
    }
}

function _renderListaContactos(contactos) {
    const lista = document.getElementById('crm-lista-contactos');
    if (!lista) return;

    if (!contactos.length) {
        lista.innerHTML = `
            <div class="crm-empty">
                <span style="font-size:2rem;">💬</span>
                <p>Sin conversaciones aún</p>
                <small>Los mensajes de WhatsApp, Instagram y Facebook aparecerán aquí</small>
            </div>`;
        return;
    }

    lista.innerHTML = contactos.map(c => {
        const iniciales = _getIniciales(c.nombre || c.telefono || '?');
        const badge     = c.no_leidos > 0 ? `<span class="crm-badge">${c.no_leidos}</span>` : '';
        const activo    = CrmMeta.contactoSeleccionado === c.id ? 'crm-contacto-item--activo' : '';
        const iconPlatf = _iconPlataforma(c.plataforma_origen);
        const preview   = c.ultimo_mensaje ? _truncar(c.ultimo_mensaje, 45) : '<em>Sin mensajes</em>';
        const tiempo    = c.actualizado_en ? _tiempoRelativo(c.actualizado_en) : '';

        return `
        <div class="crm-contacto-item ${activo}" data-id="${c.id}" data-telefono="${c.telefono || ''}" onclick="seleccionarContacto(${c.id})">
            <div class="crm-avatar">${iniciales}</div>
            <div class="crm-contacto-info">
                <div class="crm-contacto-header">
                    <span class="crm-contacto-nombre">${c.nombre || c.telefono || 'Desconocido'}</span>
                    <span class="crm-contacto-tiempo">${tiempo}</span>
                </div>
                <div class="crm-contacto-preview">
                    <span class="crm-plataforma-icon">${iconPlatf}</span>
                    ${preview}
                </div>
            </div>
            ${badge}
        </div>`;
    }).join('');
}

function _filtrarContactos() {
    const query = (document.getElementById('crm-buscar')?.value || '').toLowerCase().trim();
    if (!query) {
        _renderListaContactos(CrmMeta.contactos);
        return;
    }
    const filtrados = CrmMeta.contactos.filter(c =>
        (c.nombre || '').toLowerCase().includes(query) ||
        (c.telefono || '').includes(query)
    );
    _renderListaContactos(filtrados);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function seleccionarContacto(leadId) {
    console.log('[CRM Meta] Seleccionando lead:', leadId);
    CrmMeta.leadSeleccionado = leadId;

    // Resaltar en la lista
    document.querySelectorAll('.crm-contacto-item').forEach(el => {
        el.classList.toggle('crm-contacto-item--activo', parseInt(el.dataset.id) === leadId);
    });

    // Buscar datos del contacto
    const contacto = CrmMeta.contactos.find(c => c.id === leadId);
    if (contacto) {
        document.getElementById('crm-chat-nombre').textContent = contacto.nombre || contacto.telefono || 'Desconocido';
        document.getElementById('crm-chat-subtitulo').textContent = `${_iconPlataforma(contacto.plataforma_origen)} ${contacto.plataforma_origen} · ${contacto.telefono || ''}`;
    }

    // Habilitar input
    const inputMensaje = document.getElementById('crm-input-mensaje');
    const btnEnviar    = document.getElementById('crm-btn-enviar');
    if (inputMensaje) inputMensaje.disabled  = false;
    if (btnEnviar)    btnEnviar.disabled     = false;

    // Mostrar panel de chat
    document.getElementById('crm-panel-chat').classList.remove('crm-panel-chat--oculto');
    document.getElementById('crm-placeholder').classList.add('crm-panel-hidden');

    await cargarChat(leadId);
    _iniciarPolling();
}

async function cargarChat(leadId) {
    const negocioId = appState.negocioActivoId;
    try {
        const res = await fetch(`/api/negocios/${negocioId}/crm/chat/${leadId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
        });
        if (!res.ok) throw new Error(await res.text());
        CrmMeta.mensajes = await res.json();
        _renderMensajes(CrmMeta.mensajes);

        // Actualizar badge de no leídos en la lista local
        const contacto = CrmMeta.contactos.find(c => c.id === leadId);
        if (contacto) {
            contacto.no_leidos = 0;
            _renderListaContactos(CrmMeta.contactos);
            seleccionarContacto(leadId); // Re-aplicar activo
        }
    } catch (err) {
        console.error('[CRM Meta] cargarChat:', err);
        _showToast('Error al cargar el chat', 'error');
    }
}

function _renderMensajes(mensajes) {
    const contenedor = document.getElementById('crm-chat-mensajes');
    if (!contenedor) return;

    if (!mensajes.length) {
        contenedor.innerHTML = `
            <div class="crm-chat-vacio">
                <span style="font-size:2.5rem">💬</span>
                <p>Sin mensajes en esta conversación</p>
            </div>`;
        return;
    }

    contenedor.innerHTML = mensajes.map(m => {
        const esAgente  = m.tipo_emisor === 'agente' || m.tipo_emisor === 'bot';
        const clase     = esAgente ? 'crm-burbuja crm-burbuja--agente' : 'crm-burbuja crm-burbuja--cliente';
        const hora      = _formatHora(m.fecha);
        const iconEmisor = m.tipo_emisor === 'bot' ? '🤖' : (esAgente ? '👤' : '');

        return `
        <div class="${clase}">
            <div class="crm-burbuja-texto">${_escaparHTML(m.mensaje || '')}</div>
            <div class="crm-burbuja-meta">${iconEmisor} ${hora}</div>
        </div>`;
    }).join('');

    // Scroll al último mensaje
    contenedor.scrollTop = contenedor.scrollHeight;
}

// ─── Enviar Mensaje ───────────────────────────────────────────────────────────

export async function enviarMensaje() {
    console.log('[CRM Meta] Intento de envío. Lead activo:', CrmMeta.leadSeleccionado);
    
    if (!CrmMeta.leadSeleccionado) {
        console.error('[CRM Meta] No se puede enviar: leadSeleccionado es NULL');
        _showToast('Por favor, selecciona un contacto primero.', 'warn');
        return;
    }

    const input   = document.getElementById('crm-input-mensaje');
    const btnEnv  = document.getElementById('crm-btn-enviar');
    const mensaje = (input?.value || '').trim();

    console.log('[CRM Meta] Mensaje a enviar:', mensaje);
    if (!mensaje) {
        console.warn('[CRM Meta] Mensaje vacío, abortando.');
        return;
    }

    input.disabled  = true;
    btnEnv.disabled = true;
    btnEnv.textContent = '⏳';

    try {
        const res = await fetch(`/api/negocios/${appState.negocioActivoId}/crm/enviar`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
            },
            body: JSON.stringify({
                lead_id: CrmMeta.leadSeleccionado,
                mensaje: mensaje
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al enviar');

        input.value = '';
        await cargarChat(CrmMeta.leadSeleccionado);
    } catch (err) {
        console.error('[CRM Meta] enviarMensaje:', err);
        _showToast(err.message || 'Error al enviar el mensaje', 'error');
    } finally {
        input.disabled  = false;
        btnEnv.disabled = false;
        btnEnv.textContent = 'Enviar';
        input.focus();
    }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

function _iniciarPolling() {
    _detenerPolling();
    CrmMeta.pollingInterval = setInterval(() => {
        if (CrmMeta.leadSeleccionado) {
            cargarChat(CrmMeta.leadSeleccionado);
        }
        cargarContactos();
    }, CrmMeta.POLLING_MS);
}

function _detenerPolling() {
    if (CrmMeta.pollingInterval) {
        clearInterval(CrmMeta.pollingInterval);
        CrmMeta.pollingInterval = null;
    }
}

// ─── Configuración Meta ───────────────────────────────────────────────────────

async function verificarConfigMeta() {
    const negocioId = appState.negocioActivoId;
    try {
        const res = await fetch(`/api/negocios/${negocioId}/crm/meta-config`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
        });
        const config = await res.json();
        const badge  = document.getElementById('crm-badge-config');
        if (badge) {
            if (config && config.activo) {
                badge.textContent   = '● Conectado';
                badge.className     = 'crm-badge-estado crm-badge-estado--ok';
            } else {
                badge.textContent   = '● Sin configurar';
                badge.className     = 'crm-badge-estado crm-badge-estado--warn';
            }
        }

        // Pre-llenar modal si ya hay config
        if (config) {
            document.getElementById('crm-cfg-phone-id').value  = config.phone_number_id || '';
            document.getElementById('crm-cfg-verify').value    = config.verify_token || '';
            document.getElementById('crm-cfg-waba').value      = config.waba_id || '';
            // access_token no se pre-llena por seguridad
        }
    } catch (err) {
        console.warn('[CRM Meta] verificarConfigMeta:', err);
    }
}

export function abrirModalConfig() {
    document.getElementById('crm-modal-config').style.display = 'flex';
}

export function cerrarModalConfig() {
    document.getElementById('crm-modal-config').style.display = 'none';
}

async function guardarConfigMeta(e) {
    e.preventDefault();
    const negocioId  = appState.negocioActivoId;
    const btnGuardar = document.getElementById('crm-cfg-btn-guardar');

    const payload = {
        phone_number_id: document.getElementById('crm-cfg-phone-id').value.trim(),
        access_token:    document.getElementById('crm-cfg-token').value.trim(),
        verify_token:    document.getElementById('crm-cfg-verify').value.trim(),
        waba_id:         document.getElementById('crm-cfg-waba').value.trim(),
    };

    if (!payload.phone_number_id || !payload.access_token || !payload.verify_token) {
        _showToast('Completa todos los campos requeridos', 'error');
        return;
    }

    btnGuardar.disabled    = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const res = await fetch(`/api/negocios/${negocioId}/crm/meta-config`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar');

        _showToast('Configuración guardada correctamente ✅', 'success');
        cerrarModalConfig();
        verificarConfigMeta();
    } catch (err) {
        _showToast(err.message || 'Error al guardar la configuración', 'error');
    } finally {
        btnGuardar.disabled    = false;
        btnGuardar.textContent = 'Guardar';
    }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function _getIniciales(nombre) {
    const partes = (nombre || '').trim().split(' ').filter(Boolean);
    if (!partes.length) return '?';
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function _iconPlataforma(plataforma) {
    const mapa = {
        whatsapp:  '📱',
        instagram: '📸',
        facebook:  '🔵',
    };
    return mapa[(plataforma || '').toLowerCase()] || '💬';
}

function _truncar(texto, max) {
    return texto && texto.length > max ? texto.substring(0, max) + '…' : texto;
}

function _tiempoRelativo(fechaStr) {
    try {
        const ahora  = new Date();
        const fecha  = new Date(fechaStr);
        const diffMs = ahora - fecha;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1)  return 'ahora';
        if (diffMin < 60) return `${diffMin}m`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24)   return `${diffH}h`;
        const diffD = Math.floor(diffH / 24);
        return `${diffD}d`;
    } catch {
        return '';
    }
}

function _formatHora(fechaStr) {
    try {
        return new Date(fechaStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function _escaparHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

function _showToast(mensaje, tipo = 'info') {
    // Usamos la función global de Baboons si está disponible
    if (window.showNotification) {
        window.showNotification(mensaje, tipo);
        return;
    }
    // Fallback simple
    const div = document.createElement('div');
    div.textContent = mensaje;
    div.style.cssText = `
        position:fixed; bottom:20px; right:20px; z-index:9999;
        background:${tipo === 'error' ? '#e74c3c' : '#27ae60'};
        color:#fff; padding:12px 20px; border-radius:8px;
        font-size:.9rem; box-shadow:0 4px 12px rgba(0,0,0,.2);
        animation: fadeIn .3s ease;
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
}

// ─── Limpieza al salir del módulo ─────────────────────────────────────────────
window.addEventListener('beforeunload', _detenerPolling);

// ─── Exposición global ────────────────────────────────────────────────────────
window.initCrmMeta         = initCrmMeta;
window.seleccionarContacto = seleccionarContacto;
window.enviarMensaje       = enviarMensaje;
window.abrirModalConfig    = abrirModalConfig;
window.cerrarModalConfig   = cerrarModalConfig;
