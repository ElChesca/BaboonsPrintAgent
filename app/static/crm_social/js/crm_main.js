// Main JS for CRM Module
import { fetchData, sendData } from '../../js/api.js';
import { showGlobalLoader, hideGlobalLoader } from '../../js/uiHelpers.js';
import { mostrarNotificacion } from '../../js/modules/notifications.js';
const scriptSortable = document.createElement('script');
scriptSortable.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
document.head.appendChild(scriptSortable);

let appState = {
    negocioId: localStorage.getItem('negocioActivoId') || '1'
};
let leadsCache = []; // Para no pedir a la API cada vez que filtramos


export async function inicializarCRM() {
    console.log("Inicializando CRM Module...");
    appState.negocioId = localStorage.getItem('negocioActivoId');

    // 1. Corregimos la carga de estilos (para eliminar el error 404)
    loadCRMStyles(); 

    // 2. Cargamos los datos inmediatamente
    await loadLeads();

    const refreshBtn = document.getElementById('crm-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
             checkStatus();
             loadLeadsStats();
             if(document.getElementById('crm-leads-view').style.display !== 'none') {
                 loadLeads();
             }
        });
    }

    // Wiring up Leads view
    const leadsCard = document.getElementById('crm-card-leads');
    if (leadsCard) leadsCard.addEventListener('click', showLeadsView);

    const newLeadBtn = document.getElementById('crm-new-lead-btn');
    if (newLeadBtn) newLeadBtn.addEventListener('click', openNewLeadModal);

    // Modal Close
    document.querySelectorAll('.crm-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('crm-lead-modal').style.display = 'none';
        });
    });

    // Form Submit
    const leadForm = document.getElementById('crm-lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', handleLeadSubmit);
    }
    // Listener para los botones de filtro
    document.querySelectorAll('#crm-filter-group .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            
            // Estética de botones
            document.querySelectorAll('#crm-filter-group .btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Lógica de columnas: Si es 'todos' muestra todo, si no, oculta el resto
            const columnas = ['nuevo', 'contactado', 'interesado', 'ganado'];
            columnas.forEach(colId => {
                const colContenedor = document.getElementById(colId).closest('.col-12');
                if (status === 'todos' || colId === status) {
                    colContenedor.style.display = 'block';
                } else {
                    colContenedor.style.display = 'none';
                }
            });
        });
    });
    await checkStatus();
    await loadLeadsStats();
}

function loadCRMStyles() {
    const cssId = 'crm-module-styles';
    if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        // CAMBIAMOS LA RUTA A LA REAL:
        link.href = '/static/crm_social/css/crm_styles.css'; 
        document.head.appendChild(link);
    }
}

async function checkStatus() {
    const statusEl = document.getElementById('crm-status');
    if (statusEl) statusEl.textContent = 'Verificando API...';

    try {
        const response = await fetchData('/api/crm/status');
        console.log('CRM API Status:', response);
        if (statusEl) statusEl.textContent = `Online (v${response.version})`;
    } catch (error) {
        console.error('Error checking CRM status:', error);
        if (statusEl) statusEl.textContent = 'Error de conexión';
    }
}

async function loadLeadsStats() {
    try {
        const data = await fetchData(`/api/crm/leads/stats?negocio_id=${appState.negocioId}`);
        const el = document.getElementById('crm-leads-metric');
        if (el) el.textContent = data.total;
    } catch (error) {
        console.error("Error loading leads stats:", error);
    }
}

function showLeadsView() {
    // Hide welcome/placeholder
    const placeholder = document.getElementById('crm-welcome-msg');
    if (placeholder) placeholder.style.display = 'none';

    // Show view
    const view = document.getElementById('crm-leads-view');
    if (view) view.style.display = 'block';

    loadLeads();
}

export async function loadLeads() {
    showGlobalLoader();
    try {
        // Cargamos los datos desde tu API
        leadsCache = await fetchData(`/api/crm/leads?negocio_id=${appState.negocioId}`);
        renderKanban(leadsCache);
    } catch (error) {
        console.error("Error cargando leads:", error);
        mostrarNotificacion("Error al obtener leads", "error");
    } finally {
        hideGlobalLoader();
    }
}

function openNewLeadModal() {
    const modal = document.getElementById('crm-lead-modal');
    document.getElementById('crm-lead-form').reset();
    document.getElementById('lead-id').value = '';
    document.getElementById('crm-modal-title').textContent = 'Nuevo Lead';
    modal.style.display = 'flex';
}

async function handleLeadSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('lead-nombre').value;
    const email = document.getElementById('lead-email').value;
    const telefono = document.getElementById('lead-telefono').value;
    const origen = document.getElementById('lead-origen').value;
    const estado = document.getElementById('lead-estado').value;
    const notas = document.getElementById('lead-notas').value;
    const id = document.getElementById('lead-id').value;

    const payload = {
        negocio_id: appState.negocioId,
        nombre, email, telefono, origen, estado, notas
    };

    showGlobalLoader();
    try {
        let url = '/api/crm/leads';
        let method = 'POST';

        if (id) {
            // Update logic (not implemented fully in frontend for edit click yet, but backend ready)
            url = `/api/crm/leads/${id}`;
            method = 'PUT';
        }

        await sendData(url, payload, method);
        mostrarNotificacion("Lead guardado correctamente", "success");
        document.getElementById('crm-lead-modal').style.display = 'none';
        loadLeads();
        loadLeadsStats();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error guardando lead", "error");
    } finally {
        hideGlobalLoader();
    }
}

// 1. Agrega esta función al final de tu archivo crm_main.js
function abrirEdicion(lead) {
    const modal = document.getElementById('crm-lead-modal');
    if (!modal) return;

    // Llenamos los campos del formulario con los datos del lead
    document.getElementById('crm-modal-title').textContent = 'Editar Lead';
    document.getElementById('lead-id').value = lead.id;
    document.getElementById('lead-nombre').value = lead.nombre;
    document.getElementById('lead-email').value = lead.email || '';
    document.getElementById('lead-telefono').value = lead.telefono || '';
    document.getElementById('lead-origen').value = lead.origen;
    document.getElementById('lead-estado').value = lead.estado;
    document.getElementById('lead-notas').value = lead.notas || '';

    // Mostramos el modal
    modal.style.display = 'flex';
}

// 2. En la función renderLeadsTable, asegúrate de que el listener esté así:
function renderLeadsTable(leads) {
    const tbody = document.querySelector('#crm-leads-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${lead.nombre}</strong></td>
            <td>${lead.email || '-'}</td>
            <td>${lead.telefono || '-'}</td>
            <td><span class="badge badge-${lead.estado.toLowerCase()}">${lead.estado}</span></td>
            <td>${lead.origen}</td>
            <td>${new Date(lead.fecha_creacion).toLocaleDateString()}</td>
            <td>
                <button class="crm-btn-edit" title="Editar">✏️</button>
                <button class="crm-btn-delete" style="background:none; border:none; cursor:pointer;" title="Eliminar">🗑️</button>
            </td>
        `;
        
        // El truco para evitar el ReferenceError es asignar el evento directamente al nodo
        const editBtn = tr.querySelector('.crm-btn-edit');
        editBtn.addEventListener('click', () => abrirEdicion(lead));

        const deleteBtn = tr.querySelector('.crm-btn-delete');
        deleteBtn.onclick = async () => {
            if (confirm(`¿Estás seguro de eliminar a ${lead.nombre}?`)) {
                try {
                    await fetchData(`/api/crm/leads/${lead.id}`, { method: 'DELETE' });
                    mostrarNotificacion("Lead eliminado", "success");
                    loadLeads(); // Recargamos la lista
                } catch (error) {
                    mostrarNotificacion("Error al eliminar", "error");
                }
            }
        };
        
        tbody.appendChild(tr);
    });
}

function filtrarLeads(status) {
    if (status === 'todos') {
        renderLeadsTable(leadsCache);
    } else {
        const filtrados = leadsCache.filter(l => l.estado.toLowerCase() === status.toLowerCase());
        renderLeadsTable(filtrados);
    }
}
function renderKanban(leads) {
    const estados = ['nuevo', 'contactado', 'interesado', 'ganado'];
    const hoy = new Date();
    const tresDiasEnMs = 3 * 24 * 60 * 60 * 1000;
    
    // 1. Limpiamos las columnas y reseteamos contadores
    estados.forEach(est => {
        const col = document.getElementById(est);
        if (col) col.innerHTML = '';
        const badge = document.getElementById(`count-${est}`);
        if (badge) badge.textContent = '0';
    });

    // 2. Inyectamos las tarjetas
    leads.forEach(lead => {
        const estadoLead = lead.estado.toLowerCase();
        const contenedor = document.getElementById(estadoLead);
        
        if (contenedor) {
            const card = document.createElement('div');
            // Estilos base de la tarjeta
            card.className = 'lead-card p-3 mb-2 shadow-sm border-start border-4 bg-white animate__animated animate__fadeIn';
            card.style.borderLeftColor = getEstadoColor(estadoLead);
            card.dataset.id = lead.id;

            // Lógica de Lead Frío (Semáforo)
            const fechaLead = new Date(lead.fecha_creacion);
            let alertaFrioHtml = '';
            if ((hoy - fechaLead) > tresDiasEnMs && estadoLead !== 'ganado') {
                card.classList.add('border-danger'); 
                alertaFrioHtml = `
                    <div class="text-danger small fw-bold mt-1 animate__animated animate__pulse animate__infinite">
                        <i class="fa fa-fire-extinguisher"></i> ¡Lead Frío!
                    </div>`;
            }

            // Inyección del HTML estructural
            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <strong class="text-dark">${lead.nombre}</strong>
                    <div class="d-flex gap-2">
                        <a href="https://wa.me/${lead.telefono?.replace(/\D/g,'')}" target="_blank" class="text-success" title="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                        <button class="btn-edit-lead btn btn-link btn-sm p-0 text-muted" title="Editar">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="btn-archive-lead btn btn-link btn-sm p-0 text-danger" title="Archivar">
                            <i class="fa fa-trash-alt"></i>
                        </button>
                    </div>
                </div>

                ${alertaFrioHtml}

                <div class="small text-muted mt-2">
                    <i class="fa fa-phone me-1"></i>${lead.telefono || '-'}
                </div>

                <div class="mt-2">
                    <textarea class="form-control form-control-sm border-0 bg-light quick-note" 
                              placeholder="Nota rápida..." 
                              >${lead.notas || ''}</textarea>
                </div>

                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge bg-light text-secondary border small">${lead.origen}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">${new Date(lead.fecha_creacion).toLocaleDateString()}</small>
                </div>
            `;

            // --- ASIGNACIÓN DE EVENTOS (Directo al nodo para evitar ReferenceError) ---
            
            // Botón Editar
            card.querySelector('.btn-edit-lead').onclick = () => {
                abrirEdicion(lead);
            };

            // Botón Archivar/Eliminar
            card.querySelector('.btn-archive-lead').onclick = async () => {
                if (confirm(`¿Archivar a ${lead.nombre}?`)) {
                    try {
                        await fetchData(`/api/crm/leads/${lead.id}`, { method: 'DELETE' });
                        mostrarNotificacion("Lead archivado", "success");
                        loadLeads();
                    } catch (error) {
                        mostrarNotificacion("Error al archivar", "error");
                    }
                }
            };

            // Guardado automático de notas al perder el foco (onblur)
            card.querySelector('.quick-note').onblur = (e) => {
                guardarNotaRapida(lead.id, e.target.value);
            };

            contenedor.appendChild(card);

            // Actualizar contador visual
            const badge = document.getElementById(`count-${estadoLead}`);
            if (badge) badge.textContent = parseInt(badge.textContent) + 1;
        }
    });

    // 3. Inicializar SortableJS (Drag & Drop)
    estados.forEach(est => {
        const el = document.getElementById(est);
        if (el && typeof Sortable !== 'undefined') {
            new Sortable(el, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'bg-light',
                onEnd: (evt) => {
                    const leadId = evt.item.dataset.id;
                    const nuevoEstado = evt.to.id;
                    actualizarEstadoLead(leadId, nuevoEstado);
                }
            });
        }
    });
}

// Función para obtener colores de las columnas
function getEstadoColor(estado) {
    const colors = { 
        'nuevo': '#0dcaf0', 
        'contactado': '#ffc107', 
        'interesado': '#0d6efd', 
        'ganado': '#198754' 
    };
    return colors[estado] || '#ced4da';
}


async function actualizarEstadoLead(leadId, nuevoEstado) {
    try {
        const response = await fetchData(`/api/crm/leads/${leadId}`, {
            method: 'PATCH', // O PUT según tu API
            body: JSON.stringify({ estado: nuevoEstado })
        });
        
        if (response.success) {
            mostrarNotificacion(`Lead actualizado a ${nuevoEstado.toUpperCase()}`, "success");
            // Opcional: recargar contadores
        }
    } catch (error) {
        mostrarNotificacion("Error al mover el lead", "error");
    }
}

document.getElementById('crm-search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const todasLasCards = document.querySelectorAll('.lead-card');
    
    todasLasCards.forEach(card => {
        const nombre = card.querySelector('strong').textContent.toLowerCase();
        card.style.display = nombre.includes(term) ? 'block' : 'none';
    });
});

// Función para Archivar (Baja lógica)
async function archivarLead(id) {
    if (!confirm("¿Deseas archivar este lead?")) return;
    try {
        await fetchData(`/api/crm/leads/${id}`, { method: 'DELETE' });
        mostrarNotificacion("Lead archivado", "success");
        loadLeads(); // Recargar Kanban
    } catch (e) {
        mostrarNotificacion("Error al archivar", "error");
    }
}

// Función para Notas Rápidas
async function guardarNotaRapida(id, nota) {
    if (!nota) return; // No enviar si está vacío
    try {
        await fetchData(`/api/crm/leads/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notas: nota })
        });
        mostrarNotificacion("Nota guardada", "success");
    } catch (e) {
        console.error("Error al guardar nota:", e);
        mostrarNotificacion("Error al guardar nota", "error");
    }
}