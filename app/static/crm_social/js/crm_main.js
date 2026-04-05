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

/**
 * INICIALIZACIÓN PRINCIPAL
 */
export async function inicializarCRM() {
    console.log("Inicializando CRM Module - Versión Enterprise...");
    appState.negocioId = localStorage.getItem('negocioActivoId');
    
    // Carga de estilos
    loadCRMStyles(); 

    // Carga inicial de datos
    await loadLeads();

    // --- 1. FILTROS DE COLUMNA ---
    const filterButtons = document.querySelectorAll('#crm-filter-group .btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const columnas = ['nuevo', 'contactado', 'interesado', 'ganado'];
            columnas.forEach(colId => {
                const colWrapper = document.getElementById(colId)?.closest('.col-12');
                if (colWrapper) {
                    colWrapper.style.display = (status === 'todos' || colId === status) ? 'block' : 'none';
                }
            });
        });
    });

    // --- 2. BUSCADOR EN TIEMPO REAL (Recalcula contadores) ---
    const searchInput = document.getElementById('crm-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.lead-card').forEach(card => {
                const nombre = card.querySelector('strong').textContent.toLowerCase();
                const visible = nombre.includes(term) || card.innerText.toLowerCase().includes(term);
                card.style.display = visible ? 'block' : 'none';
            });
            actualizarContadoresVisibles();
            actualizarBarraProgreso();
        });
    }

    // --- 3. BOTONERA GLOBAL ---
    const refreshBtn = document.getElementById('crm-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadLeads();
            mostrarNotificacion("Datos actualizados", "info");
        });
    }

    const newLeadBtn = document.getElementById('crm-new-lead-btn');
    if (newLeadBtn) newLeadBtn.addEventListener('click', openNewLeadModal);

    // --- 4. MODALES Y FORMULARIOS ---
    document.querySelectorAll('.crm-close-modal, .close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('crm-lead-modal').style.display = 'none';
        });
    });

    const leadForm = document.getElementById('crm-lead-form');
    if (leadForm) leadForm.onsubmit = handleLeadSubmit;

    checkStatus();
}

/**
 * CARGA Y RENDERIZADO
 */
export async function loadLeads() {
    showGlobalLoader();
    try {
        const payload = await fetchData(`/api/crm/leads?negocio_id=${appState.negocioId}&limit=500`); // Kanban loads more leads at once
        leadsCache = payload && payload.data ? payload.data : (Array.isArray(payload) ? payload : []);
        renderKanban(leadsCache);
        // Sincronizar números de la UI
        actualizarContadoresVisibles();
        actualizarBarraProgreso();
    } catch (error) {
        console.error("Error:", error);
        mostrarNotificacion("Error al obtener leads", "error");
    } finally {
        hideGlobalLoader();
    }
}

function renderKanban(leads) {
    const estados = ['nuevo', 'contactado', 'interesado', 'ganado'];
    const hoy = new Date();
    const tresDiasEnMs = 3 * 24 * 60 * 60 * 1000;

    estados.forEach(est => {
        const col = document.getElementById(est);
        if (col) col.innerHTML = '';
    });

    leads.forEach(lead => {
        const estadoLead = lead.estado.toLowerCase();
        const contenedor = document.getElementById(estadoLead);
        if (contenedor) {
            const card = document.createElement('div');
            card.className = 'lead-card p-3 mb-2 shadow-sm border-start border-4 bg-white animate__animated animate__fadeIn';
            card.style.borderLeftColor = getEstadoColor(estadoLead);
            card.dataset.id = lead.id;

            const fechaLead = new Date(lead.fecha_creacion);
            let alertaFrio = (hoy - fechaLead > tresDiasEnMs && estadoLead !== 'ganado') 
                ? `<div class="text-danger small fw-bold mt-1"><i class="fa fa-fire-extinguisher"></i> ¡Lead Frío!</div>` : '';

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <strong class="text-dark">${lead.nombre}</strong>
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
                    <span class="badge bg-light text-secondary border small">${lead.origen}</span>
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
    const mainMetric = document.getElementById('crm-leads-metric');
    if (mainMetric) mainMetric.textContent = totalGeneral;
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
            notas: elNotas ? elNotas.value : ''
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
    // ... (completar campos como ya tenías) ...
    
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
        timelineContainer.innerHTML = '<h6 class="small fw-bold mb-3">Historial de Actividad</h6>';
        
        historial.forEach(h => {
            const item = document.createElement('div');
            item.className = 'd-flex mb-2 small';
            item.innerHTML = `
                <div class="text-muted me-2" style="min-width: 70px;">${h.fecha}</div>
                <div>
                    <span class="badge bg-light text-dark border-0 p-0 me-1">${h.tipo_accion.toUpperCase()}:</span>
                    <span class="text-secondary">${h.descripcion}</span>
                </div>
            `;
            timelineContainer.appendChild(item);
        });
    } catch (e) {
        timelineContainer.innerHTML = '';
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