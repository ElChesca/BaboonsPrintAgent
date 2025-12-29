// Main JS for CRM Module
import { fetchData } from '../../js/api.js';
import { showGlobalLoader, hideGlobalLoader } from '../../js/uiHelpers.js';

export async function inicializarCRM() {
    console.log("Inicializando CRM Module...");

    // Load CSS manually since main.js might not pick it up from subfolder
    loadCRMStyles();

    const refreshBtn = document.getElementById('crm-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', checkStatus);
    }

    await checkStatus();
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
