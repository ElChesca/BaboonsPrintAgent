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
    
    // Botón template (Saludo)
    document.getElementById('crm-btn-template')?.addEventListener('click', () => {
        enviarMensaje(CrmMeta.leadSeleccionado, 'hello_world');
    });

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
        const esPendiente = c.ultimo_tipo_emisor === 'cliente';
        const badgeHtml = esPendiente ? '<span class="status-badge-pending" title="Falta responder"></span>' : '';

        return `
        <div class="crm-contacto-item ${activo}" data-id="${c.id}" data-telefono="${c.telefono || ''}" onclick="seleccionarContacto(${c.id})">
            <div class="crm-avatar ${esPendiente ? 'pulse-avatar' : ''}">
                ${iniciales}
                ${badgeHtml}
            </div>
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
        const elNombre = document.getElementById('crm-chat-nombre');
        const elSub    = document.getElementById('crm-chat-subtitulo');
        if (elNombre) elNombre.textContent = contacto.nombre || contacto.telefono || 'Desconocido';
        if (elSub)    elSub.textContent    = `${_iconPlataforma(contacto.plataforma_origen)} ${contacto.plataforma_origen} · ${contacto.telefono || ''}`;
    }

    // Habilitar input
    const inputMensaje = document.getElementById('crm-input-mensaje');
    const btnEnviar    = document.getElementById('crm-btn-enviar');
    const btnTemplate  = document.getElementById('crm-btn-template');
    if (inputMensaje) inputMensaje.disabled  = false;
    if (btnEnviar)    btnEnviar.disabled     = false;
    if (btnTemplate)  btnTemplate.disabled   = false;

    // Mostrar panel de chat
    const panelChat   = document.getElementById('crm-panel-chat');
    const placeholder = document.getElementById('crm-placeholder');
    if (panelChat)   panelChat.classList.remove('crm-panel-chat--oculto');
    if (placeholder) placeholder.classList.add('crm-panel-hidden');

    try {
        await cargarChat(leadId);
        _renderFichaLead(contacto);
        _iniciarPolling();
    } catch (err) {
        console.error('[CRM Meta] Error al cargar chat:', err);
    }
}

function _renderFichaLead(contacto) {
    const details = document.getElementById('crm-lead-details');
    if (!details || !contacto) return;

    details.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div>
                <label style="font-size: .7rem; color: #999; display:block;">FECHA INGRESO</label>
                <span style="font-size: .85rem; font-weight:600;">${_tiempoRelativo(contacto.creado_en)}</span>
            </div>
            <div>
                <label style="font-size: .7rem; color: #999; display:block;">TELÉFONO</label>
                <span style="font-size: .85rem; font-weight:600;">${contacto.telefono || 'Sin datos'}</span>
            </div>
            <div>
                <label style="font-size: .7rem; color: #999; display:block;">ETIQUETA</label>
                <span class="badge ${contacto.etiqueta === 'vip' ? 'bg-warning' : 'bg-light text-dark'}" style="font-size: .7rem;">
                    ${contacto.etiqueta || 'Lead'}
                </span>
            </div>
        </div>
    `;

    // Cargar historial comercial real
    _cargarHistorialConsolidado(contacto.id);
}

async function _cargarHistorialConsolidado(leadId) {
    const historyDiv = document.getElementById('crm-lead-history');
    if (!historyDiv) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/crm/lead-historial/${leadId}`);
        
        let html = '';
        
        // Render Reservas
        if (data.reservas && data.reservas.length > 0) {
            html += '<div style="margin-top:10px; font-weight:700; font-size:.7rem; color:#4f46e5;">RESERVAS</div>';
            data.reservas.forEach(r => {
                html += `
                    <div class="crm-history-item ${r.estado === 'completada' ? 'status-done' : 'status-pending'}">
                        Reserva: ${r.fecha_reserva} (${r.hora_reserva}hs)
                        <span class="crm-history-meta">${r.num_comensales} pax - ${r.estado}</span>
                    </div>
                `;
            });
        }

        // Render Ventas
        if (data.ventas && data.ventas.length > 0) {
            html += '<div style="margin-top:10px; font-weight:700; font-size:.7rem; color:#25d366;">VENTAS</div>';
            data.ventas.forEach(v => {
                html += `
                    <div class="crm-history-item status-done">
                        Compra: $${parseFloat(v.total).toLocaleString('es-AR')}
                        <span class="crm-history-meta">${v.fecha.split('T')[0]} - ${v.metodo_pago}</span>
                    </div>
                `;
            });
        }

        // Render Presupuestos
        if (data.presupuestos && data.presupuestos.length > 0) {
            html += '<div style="margin-top:10px; font-weight:700; font-size:.7rem; color:#f1c40f;">PRESUPUESTOS</div>';
            data.presupuestos.forEach(p => {
                html += `
                    <div class="crm-history-item status-pending">
                        Presupuesto: $${parseFloat(p.total).toLocaleString('es-AR')}
                        <span class="crm-history-meta">${(p.fecha || '').split('T')[0]} - Tipo ${p.tipo_comprobante}</span>
                    </div>
                `;
            });
        }

        if (!html) {
            html = '<p style="font-size: .75rem; color: #aaa; font-style: italic;">Sin actividad comercial registrada</p>';
        }

        historyDiv.innerHTML = html;

    } catch (err) {
        console.error('Error cargando historial consolidado:', err);
        historyDiv.innerHTML = '<p style="font-size:.7rem; color:red;">Error al cargar historial</p>';
    }
}

// ─── Funciones de Integración (Globales) ───

window.crmCrearReserva = function() {
    const contacto = CrmMeta.contactos.find(c => c.id === CrmMeta.leadSeleccionado);
    if (!contacto) return _showToast('Seleccioná un lead primero', 'warn');
    
    // Guardamos en sessionStorage para que el módulo de reservas lo levante
    const leadData = {
        nombre: contacto.nombre || '',
        telefono: contacto.telefono || '',
        origen: 'whatsapp'
    };
    sessionStorage.setItem('temp_lead_reserva', JSON.stringify(leadData));
    
    // Navegamos a Reservas
    window.location.hash = '#reservas';
};

window.crmCrearVenta = function() {
    const contacto = CrmMeta.contactos.find(c => c.id === CrmMeta.leadSeleccionado);
    if (!contacto) return _showToast('Seleccioná un lead primero', 'warn');
    
    sessionStorage.setItem('temp_lead_venta', JSON.stringify({
        nombre: contacto.nombre || '',
        telefono: contacto.telefono || ''
    }));
    
    window.location.hash = '#ventas_nueva';
};

window.crmCrearPresupuesto = function() {
    const contacto = CrmMeta.contactos.find(c => c.id === CrmMeta.leadSeleccionado);
    if (!contacto) return _showToast('Seleccioná un lead primero', 'warn');
    
    sessionStorage.setItem('temp_lead_presupuesto', JSON.stringify({
        nombre: contacto.nombre || '',
        telefono: contacto.telefono || ''
    }));
    
    window.location.hash = '#presupuestos';
};

async function cargarChat(leadId) {
    const negocioId = appState.negocioActivoId;
    try {
        const res = await fetch(`/api/negocios/${negocioId}/crm/chat/${leadId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
        });
        if (!res.ok) throw new Error(await res.text());
        CrmMeta.mensajes = await res.json();
        _renderMensajes(CrmMeta.mensajes);

        const contacto = CrmMeta.contactos.find(c => c.id === leadId);
        if (contacto) {
            contacto.no_leidos = 0;
            _renderListaContactos(CrmMeta.contactos);
            // Ya no llamamos a seleccionarContacto aquí para evitar el bucle.
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

export async function enviarMensaje(leadId = null, templateName = null) {
    // Si el primer argumento es un Evento (clic), lo ignoramos y usamos el estado global
    if (leadId instanceof Event) leadId = null;
    
    // Si no viene leadId, usamos el seleccionado
    const finalLeadId = leadId || CrmMeta.leadSeleccionado;
    const esTemplate = (typeof templateName === 'string');

    console.log('[CRM Meta] Intento de envío. Lead activo:', finalLeadId, 'Template:', templateName);
    
    if (!finalLeadId) {
        _showToast('Por favor, selecciona un contacto primero.', 'warn');
        return;
    }

    const input   = document.getElementById('crm-input-mensaje');
    const mensaje = (input?.value || '').trim();

    if (!mensaje && !esTemplate) {
        return;
    }

    try {
        const payload = {
            lead_id: finalLeadId,
            mensaje: esTemplate ? null : mensaje,
            template: esTemplate ? templateName : null
        };

        const res = await fetch(`/api/negocios/${appState.negocioActivoId}/crm/enviar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            console.error('[CRM Meta] Error detallado del servidor:', data);
            throw new Error(data.error || 'Error al enviar');
        }

        if (input) {
            input.value = '';
            input.focus();
        }
        _showToast('Mensaje enviado ✅', 'success');
        await cargarChat(finalLeadId);

    } catch (err) {
        console.error('[CRM Meta] enviarMensaje:', err);
        _showToast(err.message || 'Error al enviar el mensaje', 'error');
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
        
        const msgInputArea = document.querySelector('.meta-input-area');
        if (msgInputArea && !document.getElementById('quick-replies')) {
            const repliesDiv = document.createElement('div');
            repliesDiv.id = 'quick-replies';
            repliesDiv.className = 'quick-replies-container';
            
            const phrases = [
                { label: '👋 Saludo', text: '/hola' }, // El slash disparará el template si es necesario
                { label: '⏳ En un momento', text: 'En un momento te atendemos, muchas gracias por esperar.' },
                { label: '📍 Ubicación', text: 'Nuestra ubicación es: [Dirección de Baboons]' },
                { label: '💰 Precios/Catálogo', text: 'Te adjunto la información de nuestros servicios y precios.' },
                { label: '✅ Listo', text: 'Perfecto, ¡muchas gracias!' }
            ];

            repliesDiv.innerHTML = phrases.map(p => `
                <button class="quick-reply-btn" data-text="${p.text}">${p.label}</button>
            `).join('');

            msgInputArea.prepend(repliesDiv);

            // Listener para los botones
            repliesDiv.querySelectorAll('.quick-reply-btn').forEach(btn => {
                btn.onclick = () => {
                    const text = btn.getAttribute('data-text');
                    if (text === '/hola') {
                        enviarMensaje(null, 'hello_world'); // Caso especial: usar template
                    } else {
                        const input = document.getElementById('meta-msg-input');
                        if (input) {
                            input.value = text;
                            input.focus();
                        }
                    }
                };
            });
        }

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
