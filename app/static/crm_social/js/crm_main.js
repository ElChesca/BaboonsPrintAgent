// Main JS for CRM Module - MultinegocioBaboons
import { fetchData, sendData } from '../../js/api.js';
import { showGlobalLoader, hideGlobalLoader } from '../../js/uiHelpers.js';
import { mostrarNotificacion } from '../../js/modules/notifications.js';

// Cargamos SortableJS dinámicamente si no está en el index
if (!document.querySelector('script[src*="Sortable.min.js"]')) {
    const scriptSortable = document.createElement('script');
    scriptSortable.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
    document.head.appendChild(scriptSortable);
}

let appState = {
    negocioId: localStorage.getItem('negocioActivoId') || '1'
};
let leadsCache = [];
let currentPage = 1;
const PAGE_SIZE = 500;

// Estados de filtros globales
let filtroActividadActual = null;
let filtroOrigenActual = null;

/**
 * INICIALIZACIÓN PRINCIPAL
 */
export async function inicializarCRM() {
    console.log("Inicializando CRM Module - Versión Enterprise...");
    appState.negocioId = localStorage.getItem('negocioActivoId');
    
    loadCRMStyles(); 
    await loadLeads();

    // --- 1. BUSCADOR EN TIEMPO REAL ---
    const searchInput = document.getElementById('crm-search');
    if (searchInput) {
        searchInput.addEventListener('input', _reaplicarTodosLosFiltros);
    }

    // --- 2. BOTONERA GLOBAL ---
    const newLeadBtn = document.getElementById('btn-nuevo-lead');
    if (newLeadBtn) newLeadBtn.addEventListener('click', openNewLeadModal);

    // --- 3. MODALES Y FORMULARIOS ---
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('crm-lead-modal').style.display = 'none';
        });
    });

    const leadForm = document.getElementById('crm-lead-form');
    if (leadForm) leadForm.onsubmit = handleLeadSubmit;

    // --- 4. FILTROS DE ACTIVIDAD (Delegación) ---
    const actFilters = document.getElementById('actividad-filters');
    if (actFilters) {
        actFilters.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-activity');
            if (!btn) return;

            const wasActive = btn.classList.contains('active');
            
            // Limpiar otros
            document.querySelectorAll('.filter-activity').forEach(b => {
                const type = b.dataset.act;
                b.classList.remove('active', 'btn-danger', 'btn-warning', 'btn-secondary');
                b.classList.add(type === 'vencido' ? 'btn-outline-danger' : 
                              type === 'hoy' ? 'btn-outline-warning' : 'btn-outline-secondary');
            });

            if (!wasActive) {
                btn.classList.add('active');
                btn.classList.remove('btn-outline-danger', 'btn-outline-warning', 'btn-outline-secondary');
                btn.classList.add(btn.dataset.act === 'vencido' ? 'btn-danger' : 
                                btn.dataset.act === 'hoy' ? 'btn-warning' : 'btn-secondary');
                filtroActividadActual = btn.dataset.act;
            } else {
                filtroActividadActual = null;
            }
            _reaplicarTodosLosFiltros();
        });
    }

    // --- 5. Init Sortable ---
    initSortable(['nuevo', 'contactado', 'interesado', 'ganado']);

    checkStatus();
}

function _reaplicarTodosLosFiltros() {
    const statusBadge = document.querySelector('.filtro-estado-badge.active');
    const statusActivo = statusBadge ? statusBadge.dataset.status : 'todos';
    const searchTerm = document.getElementById('crm-search')?.value.toLowerCase() || '';
    
    // 1. Mostrar/Ocultar Columnas según status
    const columnas = ['nuevo', 'contactado', 'interesado', 'ganado'];
    columnas.forEach(colId => {
        const colWrapper = document.getElementById(colId)?.closest('.col-12, .kanban-column');
        if (colWrapper) {
            colWrapper.style.display = (statusActivo === 'todos' || colId === statusActivo) ? 'block' : 'none';
        }
    });

    // 2. Filtrar Tarjetas dentro de columnas visibles
    document.querySelectorAll('.lead-card').forEach(card => {
        const leadId = card.dataset.id;
        const lead = leadsCache.find(l => l.id == leadId);
        if (!lead) return;

        let visible = true;
        
        // A. Filtro de búsqueda
        if (searchTerm) {
            const content = (lead.nombre + (lead.telefono || '') + (lead.notas || '')).toLowerCase();
            if (!content.includes(searchTerm)) visible = false;
        }

        // B. Filtro de Actividad
        if (visible && filtroActividadActual) {
            const actAttr = card.getAttribute('data-actividad') || 'ninguna';
            if (actAttr !== filtroActividadActual) visible = false;
        }

        // C. Filtro de Origen
        if (visible && filtroOrigenActual) {
             if (!(lead.origen || '').toLowerCase().includes(filtroOrigenActual.toLowerCase())) visible = false;
        }

        card.style.display = visible ? 'block' : 'none';
    });

    actualizarContadoresVisibles();
    actualizarBarraProgreso();
}

/**
 * CARGA Y RENDERIZADO
 */
export async function loadLeads() {
    showGlobalLoader();
    try {
        const payload = await fetchData(`/api/crm/leads?negocio_id=${appState.negocioId}&limit=${PAGE_SIZE}&page=${currentPage}`);
        leadsCache = payload && payload.data ? payload.data : (Array.isArray(payload) ? payload : []);

        renderKanban(leadsCache);
        // Sincronizar números de la UI
        actualizarContadoresVisibles();
        actualizarBarraProgreso();
        if (payload && payload.total !== undefined) {
            renderPagination(payload.total);
        } else {
            renderPagination(leadsCache.length);
        }

        // Activación dinámica de botones de filtro por origen
        const tieneReservas = leadsCache.some(l => (l.origen || '').toLowerCase().includes('reserva'));
        const tienePedidos = leadsCache.some(l => (l.origen || '').toLowerCase().includes('pedido'));
        
        const btnR = document.getElementById('filter-reserva');
        const btnP = document.getElementById('filter-pedido');
        if (btnR) btnR.classList.toggle('d-none', !tieneReservas);
        if (btnP) btnP.classList.toggle('d-none', !tienePedidos);
        
        const divider = document.getElementById('crm-divider-filters');
        if (divider) divider.style.display = (tieneReservas || tienePedidos) ? 'block' : 'none';

    } catch (error) {
        console.error("Error:", error);
        mostrarNotificacion("Error al obtener leads", "error");
    } finally {
        hideGlobalLoader();
    }
}

function renderKanban(leads) {
    const estados = ['nuevo', 'contactado', 'interesado', 'ganado'];
    const wrapper = document.getElementById('kanban-wrapper');
    if (!wrapper) return;
    
    // 0. Asegurar que las columnas existen en el DOM
    estados.forEach(est => {
        let col = document.getElementById(est);
        if (!col) {
            const colTitle = est.charAt(0).toUpperCase() + est.slice(1);
            const colDiv = document.createElement('div');
            colDiv.className = 'kanban-column animate__animated animate__fadeInUp';
            colDiv.innerHTML = `
                <div class="column-header d-flex justify-content-between align-items-center mb-3">
                    <h5 class="fw-bold mb-0 text-dark">${colTitle}</h5>
                    <span class="badge bg-light text-dark rounded-pill shadow-sm" id="count-${est}">0</span>
                </div>
                <div class="kanban-cards-container flex-grow-1" id="${est}" style="min-height: 200px;"></div>
            `;
            wrapper.appendChild(colDiv);
        }
    });

    const hoy = new Date();
    const tresDiasEnMs = 3 * 24 * 60 * 60 * 1000;

    // Limpiar contenedores
    estados.forEach(est => {
        const target = document.getElementById(est);
        if (target) target.innerHTML = '';
    });

    // --- 1. Generar Filtros de Estado Dinámicos ---
    const filterContainer = document.getElementById('estado-filters');
    if (filterContainer) {
        const currentActive = document.querySelector('.filtro-estado-badge.active')?.dataset.status || 'todos';
        filterContainer.innerHTML = `<span class="badge rounded-pill px-3 py-2 cursor-pointer filtro-estado-badge ${currentActive === 'todos' ? 'bg-primary active' : 'bg-light text-dark border'}" data-status="todos">Todos</span>`;
        
        estados.forEach(est => {
            const count = leads.filter(l => l.estado.toLowerCase() === est).length;
            const isActive = currentActive === est;
            filterContainer.innerHTML += `
                <span class="badge rounded-pill px-3 py-2 cursor-pointer filtro-estado-badge ${isActive ? 'bg-primary active' : 'bg-light text-dark border'}" data-status="${est}">
                    ${est.charAt(0).toUpperCase() + est.slice(1)} (${count})
                </span>`;
        });

        // Event Listeners para badges de estado
        filterContainer.querySelectorAll('.filtro-estado-badge').forEach(b => {
            b.addEventListener('click', () => {
                filterContainer.querySelectorAll('.filtro-estado-badge').forEach(x => {
                    x.classList.remove('bg-primary', 'active');
                    x.classList.add('bg-light', 'text-dark', 'border');
                });
                b.classList.remove('bg-light', 'text-dark', 'border');
                b.classList.add('bg-primary', 'active');
                _reaplicarTodosLosFiltros();
            });
        });
    }

    // --- 2. Generar Filtros de Origen Dinámicos ---
    const origenContainer = document.getElementById('origen-filters');
    if (origenContainer) {
        const orígenes = [...new Set(leads.map(l => l.origen || 'Manual'))];
        const currentOrigen = filtroOrigenActual;
        
        origenContainer.innerHTML = '';
        orígenes.forEach(ori => {
            const isActive = currentOrigen === ori;
            origenContainer.innerHTML += `
                <button class="btn btn-sm rounded-pill px-3 filter-origin-btn ${isActive ? 'btn-primary active' : 'btn-outline-primary'}" data-origin="${ori}">
                    ${ori}
                </button>`;
        });

        origenContainer.querySelectorAll('.filter-origin-btn').forEach(b => {
           b.addEventListener('click', () => {
               const wasActive = b.classList.contains('active');
               
               origenContainer.querySelectorAll('.filter-origin-btn').forEach(x => {
                   x.classList.remove('active', 'btn-primary');
                   x.classList.add('btn-outline-primary');
               });

               if (!wasActive) {
                   b.classList.add('active', 'btn-primary');
                   b.classList.remove('btn-outline-primary');
                   filtroOrigenActual = b.dataset.origin;
               } else {
                   filtroOrigenActual = null;
               }
               _reaplicarTodosLosFiltros();
           });
        });
    }

    leads.forEach(lead => {
        const estadoLead = lead.estado.toLowerCase();
        const contenedor = document.getElementById(estadoLead);
        if (contenedor) {
            const card = document.createElement('div');
            const esReserva = lead.origen === 'Reserva' || lead.origen === 'reserva';
            card.className = `lead-card p-3 mb-2 shadow-sm border-start border-4 bg-white animate__animated animate__fadeIn ${esReserva ? 'lead-card-reserva' : ''}`;
            card.style.borderLeftColor = getEstadoColor(estadoLead);
            card.dataset.id = lead.id;
            card.setAttribute('data-origen', lead.origen || '');
            card.setAttribute('data-ultima-actividad', lead.fecha_creacion);

            const fechaLead = new Date(lead.fecha_creacion);
            let alertaFrio = (hoy - fechaLead > tresDiasEnMs && estadoLead !== 'ganado') 
                ? `<div class="text-danger small fw-bold mt-1"><i class="fa fa-fire-extinguisher"></i> ¡Lead Frío!</div>` : '';

            // Icono especial si es Reserva
            const iconoReserva = esReserva ? '<i class="fa fa-calendar-check text-primary me-2 animate__animated animate__heartBeat animate__infinite" title="Viene de RESERVA"></i>' : '';

            // Lógica de Actividad (El Reloj de Odoo)
            let relojHtml = '';
            if (lead.proxima_accion_fecha) {
                const fechaAccion = new Date(lead.proxima_accion_fecha);
                const soloFechaAccion = new Date(fechaAccion.getFullYear(), fechaAccion.getMonth(), fechaAccion.getDate());
                const soloHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
                
                let colorReloj = 'text-success'; // Futuro
                let tituloReloj = `Próxima: ${lead.proxima_accion_tipo} (${fechaAccion.toLocaleDateString()})`;
                let dataAct = 'futuro';
                
                if (soloFechaAccion < soloHoy) {
                    colorReloj = 'text-danger animate__animated animate__flash animate__infinite'; // Vencido
                    tituloReloj = `VENCIDO: ${lead.proxima_accion_tipo} (${fechaAccion.toLocaleDateString()})`;
                    dataAct = 'vencido';
                } else if (soloFechaAccion.getTime() === soloHoy.getTime()) {
                    colorReloj = 'text-warning'; // Hoy
                    tituloReloj = `HOY: ${lead.proxima_accion_tipo}`;
                    dataAct = 'hoy';
                }
                relojHtml = `<div class="ms-2" title="${tituloReloj}"><i class="fa fa-clock ${colorReloj}"></i></div>`;
                card.setAttribute('data-actividad', dataAct);
                card.setAttribute('data-fecha-accion', lead.proxima_accion_fecha);
            } else {
                relojHtml = `<div class="ms-2 text-muted opacity-25" title="Sin actividad programada"><i class="fa fa-clock"></i></div>`;
                card.setAttribute('data-actividad', 'ninguna');
                card.setAttribute('data-fecha-accion', 'null');
            }

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center">
                        ${iconoReserva}
                        <strong class="text-dark">${lead.nombre}</strong>
                        ${relojHtml}
                    </div>
                    <div class="d-flex gap-2">
                        <a href="https://wa.me/${lead.telefono?.replace(/\D/g,'')}" target="_blank" class="text-success"><i class="fab fa-whatsapp"></i></a>
                        <button class="btn-edit-lead btn btn-link btn-sm p-0 text-muted"><i class="fa fa-edit"></i></button>
                        <button class="btn-archive-lead btn btn-link btn-sm p-0 text-danger"><i class="fa fa-trash-alt"></i></button>
                    </div>
                </div>
                ${alertaFrio}
                <div class="small text-muted mt-2"><i class="fa fa-phone me-1"></i>${lead.telefono || '-'}</div>
                <div class="mt-2"><textarea class="form-control form-control-sm border-0 bg-light quick-note" placeholder="Nota rápida...">${lead.notas || ''}</textarea></div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${esReserva ? 'bg-primary' : 'bg-light text-secondary'} border small">${lead.origen}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">${fechaLead.toLocaleDateString()}</small>
                </div>`;

            // Listeners de la tarjeta
            card.querySelector('.btn-edit-lead').onclick = () => abrirEdicion(lead);
            card.querySelector('.btn-archive-lead').onclick = () => archivarLead(lead.id, lead.nombre);
            card.querySelector('.quick-note').onblur = (e) => guardarNotaRapida(lead.id, e.target.value);

            contenedor.appendChild(card);
        }
    });

    initSortable(estados);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const start = Math.min((currentPage-1)*PAGE_SIZE+1, total);
    const end   = Math.min(currentPage*PAGE_SIZE, total);
    
    const info = document.getElementById('crm-pag-info');
    if (info) info.textContent = total ? `Mostrando ${start}–${end} de ${total}` : '';
    
    const container = document.getElementById('crm-pag-buttons');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    
    let html = `<button class="crm-pag-btn" ${currentPage===1?'disabled':''} onclick="window.__crmKanbanPage(${currentPage-1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i=1; i<=totalPages; i++) {
        if (totalPages<=7 || i===1 || i===totalPages || Math.abs(i-currentPage)<=1) {
            html += `<button class="crm-pag-btn${i===currentPage?' active':''}" onclick="window.__crmKanbanPage(${i})">${i}</button>`;
        } else if (Math.abs(i-currentPage)===2) { html += '<span class="text-muted px-1">…</span>'; }
    }
    html += `<button class="crm-pag-btn" ${currentPage===totalPages?'disabled':''} onclick="window.__crmKanbanPage(${currentPage+1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

window.__crmKanbanPage = p => {
    currentPage = p;
    loadLeads();
};

/**
 * LÓGICA DE CONTADORES (La que no estaba andando)
 */
function actualizarContadoresVisibles() {
    const estados = ['nuevo', 'contactado', 'interesado', 'ganado'];
    let totalGeneral = 0;
    
    estados.forEach(est => {
        const col = document.getElementById(est);
        if (col) {
            // Contamos solo los visibles (display !== none)
            const count = Array.from(col.querySelectorAll('.lead-card'))
                               .filter(c => c.style.display !== 'none').length;
            
            const badge = document.getElementById(`count-${est}`);
            if (badge) badge.textContent = count;
            totalGeneral += count;
        }
    });
    
    // El número grande del Dashboard
    const mainMetric = document.getElementById('stat-total');
    if (mainMetric) mainMetric.textContent = leadsCache.length;

    // Métricas de Detalles
    const leadsVisibles = Array.from(document.querySelectorAll('.lead-card')).filter(c => c.style.display !== 'none');
    const hoy = new Date();
    const soloHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    
    const frios = leadsVisibles.filter(c => {
        const ultimaAct = new Date(c.getAttribute('data-ultima-actividad') || 0);
        return (hoy - ultimaAct) > (3 * 24 * 60 * 60 * 1000);
    }).length;

    const vencidos = leadsVisibles.filter(c => {
        const faStr = c.getAttribute('data-fecha-accion');
        if (!faStr || faStr === 'null') return false;
        const fa = new Date(faStr);
        const soloFa = new Date(fa.getFullYear(), fa.getMonth(), fa.getDate()).getTime();
        return soloFa < soloHoy;
    }).length;

    const reservas = leadsVisibles.filter(c => c.classList.contains('lead-card-reserva')).length;
    const meta = leadsVisibles.filter(c => ['whatsapp', 'instagram', 'facebook'].includes((c.getAttribute('data-origen') || '').toLowerCase())).length;

    if (document.getElementById('detail-frios')) document.getElementById('detail-frios').textContent = frios;
    if (document.getElementById('detail-vencidos')) document.getElementById('detail-vencidos').textContent = vencidos;
    if (document.getElementById('detail-reservas')) document.getElementById('detail-reservas').textContent = reservas;
    if (document.getElementById('detail-meta')) document.getElementById('detail-meta').textContent = meta;
}

function actualizarBarraProgreso() {
    const total = Array.from(document.querySelectorAll('.lead-card')).filter(c => c.style.display !== 'none').length;
    const ganados = Array.from(document.querySelectorAll('#ganado .lead-card')).filter(c => c.style.display !== 'none').length;
    
    const porcentaje = total > 0 ? Math.round((ganados / total) * 100) : 0;
    
    const barra = document.getElementById('crm-progreso-barra');
    const texto = document.getElementById('progreso-texto');
    if (barra) barra.style.width = `${porcentaje}%`;
    if (texto) texto.textContent = `${porcentaje}% de Éxito`;
}

/**
 * FUNCIONES DE MODAL (¡Restaurada!)
 */
function openNewLeadModal() {
    const modal = document.getElementById('crm-lead-modal');
    if (!modal) return;
    document.getElementById('crm-lead-form').reset();
    document.getElementById('lead-id').value = '';
    document.getElementById('lead-actividad-tipo').value = '';
    document.getElementById('lead-actividad-fecha').value = '';
    document.getElementById('crm-modal-title').textContent = 'Nuevo Lead';
    modal.style.display = 'flex';
}

/**
 * PERSISTENCIA Y DRAG & DROP
 */
function initSortable(estados) {
    estados.forEach(est => {
        const el = document.getElementById(est);
        if (el && typeof Sortable !== 'undefined') {
            new Sortable(el, {
                group: 'kanban',
                animation: 150,
                onEnd: async (evt) => {
                    await actualizarEstadoLead(evt.item.dataset.id, evt.to.id);
                    actualizarContadoresVisibles();
                    actualizarBarraProgreso();
                }
            });
        }
    });
}

async function handleLeadSubmit(e) {
    e.preventDefault();
    
    try {
        const id = document.getElementById('lead-id').value;
        
        // Obtenemos los elementos de forma segura
        const elNombre = document.getElementById('lead-nombre');
        const elEmail = document.getElementById('lead-email'); // Si no lo usas más, quítalo de aquí
        const elTelef = document.getElementById('lead-telefono');
        const elOrigen = document.getElementById('lead-origen');
        const elEstado = document.getElementById('lead-estado');
        const elNotas = document.getElementById('lead-notas');

        const payload = {
            negocio_id: appState.negocioId,
            nombre: elNombre ? elNombre.value : '',
            telefono: elTelef ? elTelef.value : '',
            origen: elOrigen ? elOrigen.value : 'Manual',
            estado: elEstado ? elEstado.value : 'nuevo',
            notas: elNotas ? elNotas.value : '',
            proxima_accion_tipo: document.getElementById('lead-actividad-tipo').value,
            proxima_accion_fecha: document.getElementById('lead-actividad-fecha').value
        };

        const url = id ? `/api/crm/leads/${id}` : '/api/crm/leads';
        const method = id ? 'PUT' : 'POST';

        showGlobalLoader();
        await sendData(url, payload, method);
        
        mostrarNotificacion(id ? "Lead actualizado" : "Nuevo lead creado", "success");
        document.getElementById('crm-lead-modal').style.display = 'none';
        
        await loadLeads(); // Recarga el Kanban y limpia el caché
    } catch (error) {
        console.error("Error en handleLeadSubmit:", error);
        mostrarNotificacion("Error al procesar el formulario", "error");
    } finally {
        hideGlobalLoader();
    }
}

async function guardarNotaRapida(id, nota) {
    try {
        await fetchData(`/api/crm/leads/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ notas: nota })
        });
        mostrarNotificacion("Nota guardada", "success");
    } catch (e) { console.error(e); }
}

async function archivarLead(id, nombre) {
    if (!confirm(`¿Archivar a ${nombre}?`)) return;
    try {
        await fetchData(`/api/crm/leads/${id}`, { method: 'DELETE' });
        mostrarNotificacion("Lead archivado", "warning");
        await loadLeads();
    } catch (e) { console.error(e); }
}

/**
 * UTILS
 */
function getEstadoColor(est) {
    const colors = { 'nuevo': '#0dcaf0', 'contactado': '#ffc107', 'interesado': '#0d6efd', 'ganado': '#198754' };
    return colors[est] || '#ccc';
}

function loadCRMStyles() {
    const linkId = 'crm-module-styles';
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = '/static/crm_social/css/crm_styles.css';
        document.head.appendChild(link);
    }
}

async function checkStatus() {
    try {
        const response = await fetchData('/api/crm/status');
        const statusEl = document.getElementById('crm-status');
        if (statusEl) statusEl.textContent = `Online (v${response.version})`;
    } catch (e) { console.log("Status Offline"); }
}

async function abrirEdicion(lead) {
    const modal = document.getElementById('crm-lead-modal');
    document.getElementById('crm-modal-title').textContent = 'Editar Lead';
    
    document.getElementById('lead-id').value = lead.id;
    document.getElementById('lead-nombre').value = lead.nombre;
    document.getElementById('lead-telefono').value = lead.telefono || '';
    document.getElementById('lead-origen').value = lead.origen;
    document.getElementById('lead-estado').value = lead.estado;
    document.getElementById('lead-notas').value = lead.notas || '';
    
    // Actividades
    document.getElementById('lead-actividad-tipo').value = lead.proxima_accion_tipo || '';
    if (lead.proxima_accion_fecha) {
        document.getElementById('lead-actividad-fecha').value = lead.proxima_accion_fecha.split(' ')[0];
    } else {
        document.getElementById('lead-actividad-fecha').value = '';
    }
    
    // Agregamos un contenedor para la línea de tiempo en el HTML del modal si no existe
    let timelineContainer = document.getElementById('crm-lead-timeline');
    if (!timelineContainer) {
        timelineContainer = document.createElement('div');
        timelineContainer.id = 'crm-lead-timeline';
        timelineContainer.className = 'mt-4 border-top pt-3';
        document.getElementById('crm-lead-form').appendChild(timelineContainer);
    }
    
    timelineContainer.innerHTML = '<small class="text-muted">Cargando historial...</small>';

    try {
        const historial = await fetchData(`/api/crm/leads/${lead.id}/historial`);
        timelineContainer.innerHTML = '<h6 class="small fw-bold mb-4 text-muted text-uppercase" style="letter-spacing: 0.05em;">Bitácora de Eventos</h6>';
        
        if (historial.length === 0) {
            timelineContainer.innerHTML += '<div class="text-center py-5 opacity-50"><i class="fa fa-history mb-2 fs-3"></i><p class="small">Sin actividad registrada aún</p></div>';
        }

        historial.forEach(h => {
            const item = document.createElement('div');
            item.className = 'timeline-item animate__animated animate__fadeInRight';
            
            // Mapeo selectivo de iconos
            let icon = 'fa-arrow-right';
            if (h.tipo_accion.toLowerCase().includes('reserva')) icon = 'fa-calendar-check';
            if (h.tipo_accion.toLowerCase().includes('nota')) icon = 'fa-comment-dots';
            if (h.tipo_accion.toLowerCase().includes('cambio')) icon = 'fa-exchange-alt';
            if (h.tipo_accion.toLowerCase().includes('venta')) icon = 'fa-shopping-cart';

            item.innerHTML = `
                <span class="timeline-date"><i class="fa ${icon} me-1 x-small"></i> ${h.fecha}</span>
                <div class="timeline-content shadow-sm">
                    <strong class="d-block x-small text-primary mb-1">${h.tipo_accion.toUpperCase()}</strong>
                    <span class="d-block">${h.descripcion}</span>
                </div>
            `;
            timelineContainer.appendChild(item);
        });
    } catch (e) {
        timelineContainer.innerHTML = '<div class="alert alert-soft-danger small">Error al cargar historial</div>';
    }

    modal.style.display = 'flex';
}

// Función de Automatización: Celebración de Venta 🎉
function dispararCelebracion() {
    // Si tenés canvas-confetti (opcional) o un efecto simple:
    mostrarNotificacion("¡FELICITACIONES! Venta cerrada con éxito 🥂", "success");
    
    // Podemos hacer que el fondo del Kanban brille un momento
    const colGanado = document.getElementById('ganado');
    colGanado.classList.add('animate__animated', 'animate__flash');
    setTimeout(() => colGanado.classList.remove('animate__animated', 'animate__flash'), 2000);
}

// Actualizamos la función de cambio de estado para que sea "inteligente"
async function actualizarEstadoLead(id, nuevoEstado) {
    try {
        await fetchData(`/api/crm/leads/${id}`, { 
            method: 'PATCH', 
            body: JSON.stringify({ estado: nuevoEstado }) 
        });

        // Automatización: Si el nuevo estado es 'ganado', celebramos
        if (nuevoEstado === 'ganado') {
            dispararCelebracion();
        }

        mostrarNotificacion("Estado sincronizado y registrado en historial", "success");
    } catch (e) { console.error(e); }
}