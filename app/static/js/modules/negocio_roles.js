/* app/static/js/modules/negocio_roles.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let rolesPermisos = {};
let allAvailableModules = [];

const ROLES_POR_TIPO = {
    'distribuidora': ['admin', 'vendedor', 'administrativo', 'repartidor', 'driver', 'gerente'],
    'retail': ['admin', 'vendedor', 'administrativo', 'cajero', 'gerente'],
    'resto': ['mozo', 'cocinero', 'barman', 'dolce', 'adicionista', 'cajero'],
    'consorcio': ['administrador', 'empleado', 'gerente']
};

export async function inicializarNegocioRoles() {
    console.log("🛡️ Módulo de Roles General Inicializado");

    const btnCerrar = document.getElementById('btn-cerrar-modal-rol');
    const btnCancelar = document.getElementById('btn-cancelar-rol');
    const form = document.getElementById('form-rol-negocio');
    const searchInput = document.getElementById('rol-module-search');

    if (btnCerrar) btnCerrar.onclick = () => cerrarModalRol();
    if (btnCancelar) btnCancelar.onclick = () => cerrarModalRol();
    if (form) form.onsubmit = guardarConfigRol;
    if (searchInput) {
        searchInput.oninput = () => filtrarModulos(searchInput.value);
    }
    
    await cargarDatos();
}

async function cargarDatos() {
    const negId = appState.negocioActivoId;
    const tipoNegocio = appState.negocioActivoTipo || 'retail';
    if (!negId) return;

    try {
        // 1. Cargar catálogo de módulos disponibles para este tipo de negocio
        const permsGlobal = await fetchData('/api/admin/permissions');
        allAvailableModules = permsGlobal[tipoNegocio] || [];

        // 2. Cargar permisos actuales para cada rol
        const roles = ROLES_POR_TIPO[tipoNegocio] || ROLES_POR_TIPO['retail'];
        
        const promesas = roles.map(async (rol) => {
            try {
                const modules = await fetchData(`/api/admin/negocios/${negId}/permisos-rol/${rol}`);
                rolesPermisos[rol] = modules || [];
            } catch (e) {
                rolesPermisos[rol] = [];
            }
        });

        await Promise.all(promesas);
        renderizarTablaRoles(roles);
        renderizarChecklistModulos();

    } catch (error) {
        console.error("Error al cargar roles:", error);
        mostrarNotificacion("Error al cargar configuración", "error");
    }
}

function renderizarTablaRoles(roles) {
    const tbody = document.querySelector('#tabla-roles-negocio tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    roles.forEach(rol => {
        const modules = rolesPermisos[rol] || [];
        
        const tr = document.createElement('tr');
        tr.style.verticalAlign = 'middle';
        tr.innerHTML = `
            <td style="padding-left: 25px;">
                <div class="fw-bold text-uppercase" style="letter-spacing: 0.5px; color: #1e293b;">${rol}</div>
            </td>
            <td>
                <div class="d-flex flex-wrap gap-1">
                    ${modules.length > 0 
                        ? modules.slice(0, 5).map(m => `<span class="badge bg-light text-dark border small">${m}</span>`).join('') + (modules.length > 5 ? `<span class="badge bg-primary-subtle text-primary border small">+${modules.length - 5}</span>` : '')
                        : '<span class="text-muted small">Sin permisos específicos (usa seguridad estándar)</span>'}
                </div>
            </td>
            <td style="text-align: right; padding-right: 25px;">
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.editarConfigRolNegocio('${rol}')">
                    <i class="fas fa-edit me-1"></i> Editar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarChecklistModulos() {
    const container = document.getElementById('modulos-checklist-negocio');
    if (!container) return;
    container.innerHTML = '';

    allAvailableModules.sort().forEach(modCode => {
        if (!modCode) return;
        const registry = window.ERP_REGISTRY ? window.ERP_REGISTRY[modCode] : null;
        const label = (registry && registry.label) ? registry.label : modCode;
        const icon = (registry && registry.icon) ? registry.icon : 'static/img/icons/configuracion.png';

        const col = document.createElement('div');
        col.className = 'col-md-4 col-sm-6 module-card-item';
        col.dataset.code = modCode;
        col.dataset.label = String(label).toLowerCase();
        
        col.innerHTML = `
            <div class="module-item-check d-flex align-items-center gap-2" onclick="window.toggleModuleCheck(this)">
                <input type="checkbox" class="form-check-input d-none" value="${modCode}">
                <img src="${icon}" style="width: 24px; height: 24px; object-fit: contain;">
                <div style="font-size: 0.85rem; line-height: 1.1;">
                    <div class="fw-bold">${label}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${modCode}</div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

window.toggleModuleCheck = (el) => {
    const input = el.querySelector('input');
    input.checked = !input.checked;
    el.classList.toggle('active', input.checked);
};

function filtrarModulos(term) {
    term = term.toLowerCase();
    document.querySelectorAll('.module-card-item').forEach(el => {
        const match = el.dataset.code.includes(term) || el.dataset.label.includes(term);
        el.style.display = match ? 'block' : 'none';
    });
}

window.editarConfigRolNegocio = (rol) => {
    const modal = document.getElementById('modal-rol-negocio');
    if (!modal) return;

    document.getElementById('modal-rol-titulo').textContent = `Permisos para: ${rol.toUpperCase()}`;
    document.getElementById('rol-id').value = rol;

    const modules = rolesPermisos[rol] || [];
    const checks = document.querySelectorAll('#modulos-checklist-negocio input');
    
    checks.forEach(chk => {
        chk.checked = modules.includes(chk.value);
        chk.closest('.module-item-check').classList.toggle('active', chk.checked);
    });

    modal.style.display = 'flex';
};

function cerrarModalRol() {
    const modal = document.getElementById('modal-rol-negocio');
    if (modal) modal.style.display = 'none';
}

async function guardarConfigRol(e) {
    e.preventDefault();
    const rol = document.getElementById('rol-id').value;
    const negId = appState.negocioActivoId;

    const modules = Array.from(document.querySelectorAll('#modulos-checklist-negocio input:checked')).map(i => i.value);

    try {
        await sendData(`/api/admin/negocios/${negId}/permisos-rol/${rol}`, { modules }, 'POST');
        mostrarNotificacion(`Permisos de ${rol} actualizados`, 'success');
        cerrarModalRol();
        await cargarDatos();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al guardar permisos", "error");
    }
}
