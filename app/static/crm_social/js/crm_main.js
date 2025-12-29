// Main JS for CRM Module
import { fetchData, sendData } from '../../js/api.js';
import { showGlobalLoader, hideGlobalLoader } from '../../js/uiHelpers.js';
import { mostrarNotificacion } from '../../js/modules/notifications.js';

let appState = {
    negocioId: localStorage.getItem('negocioActivoId') || '1'
};

export async function inicializarCRM() {
    console.log("Inicializando CRM Module...");
    appState.negocioId = localStorage.getItem('negocioActivoId');

    // Load CSS manually since main.js might not pick it up from subfolder
    loadCRMStyles();

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

    await checkStatus();
    await loadLeadsStats();
}

function loadCRMStyles() {
    const cssId = 'crm-module-styles';
    if (!document.getElementById(cssId)) {
        const head  = document.getElementsByTagName('head')[0];
        const link  = document.createElement('link');
        link.id   = cssId;
        link.rel  = 'stylesheet';
        link.type = 'text/css';
        link.href = '/static/crm_social/css/crm_styles.css';
        link.media = 'all';
        head.appendChild(link);
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

async function loadLeads() {
    showGlobalLoader();
    try {
        const leads = await fetchData(`/api/crm/leads?negocio_id=${appState.negocioId}`);
        renderLeadsTable(leads);
    } catch (error) {
        mostrarNotificacion("Error cargando leads", "error");
    } finally {
        hideGlobalLoader();
    }
}

function renderLeadsTable(leads) {
    const tbody = document.querySelector('#crm-leads-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay leads registrados.</td></tr>';
        return;
    }

    leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lead.nombre}</td>
            <td>${lead.email || '-'}</td>
            <td>${lead.telefono || '-'}</td>
            <td><span class="badge badge-${lead.estado}">${lead.estado}</span></td>
            <td>${lead.origen}</td>
            <td>${new Date(lead.fecha_creacion).toLocaleDateString()}</td>
            <td>
                <button onclick="console.log('Edit ${lead.id}')">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
