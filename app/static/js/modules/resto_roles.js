/* app/static/js/modules/resto_roles.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let rolesPermisos = {}; // { 'mozo': ['resto_mozo', ...], 'cocinero': [...] }
let rolesExtraData = {}; // { 'mozo': { station: 'none', home: 'resto_mozo' } }

const ROLES_BASE = ['mozo', 'cocinero', 'barman', 'dolce', 'adicionista', 'cajero', 'bachero'];

export async function inicializarRestoRoles() {
    console.log("🛡️ Módulo de Roles Restó Inicializado");

    // Bind UI
    const btnNuevo = document.getElementById('btn-nuevo-rol');
    const btnCerrar = document.getElementById('btn-cerrar-modal-rol');
    const btnCancelar = document.getElementById('btn-cancelar-rol');
    const form = document.getElementById('form-rol-resto');

    if (btnNuevo) btnNuevo.onclick = () => abrirModalRol();
    if (btnCerrar) btnCerrar.onclick = () => cerrarModalRol();
    if (btnCancelar) btnCancelar.onclick = () => cerrarModalRol();
    if (form) form.onsubmit = guardarConfigRol;
    
    // Color Picker Logic
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.color-option').forEach(o => {
                o.classList.remove('active');
                o.style.boxShadow = '0 0 0 1px #eee';
            });
            opt.classList.add('active');
            opt.style.boxShadow = `0 0 0 2px ${opt.dataset.color}, 0 0 0 4px #fff`;
        };
    });

    await cargarConfigs();
}

async function cargarConfigs() {
    const negId = appState.negocioActivoId;
    if (!negId) return;

    try {
        // 1. Cargar permisos de la tabla oficial (Admin Routes)
        const promesas = ROLES_BASE.map(async (rol) => {
            try {
                const modules = await fetchData(`/api/admin/negocios/${negId}/permisos-rol/${rol}`);
                rolesPermisos[rol] = modules || [];
            } catch (e) {
                rolesPermisos[rol] = [];
            }
        });

        // 2. Cargar extras (estación, home) desde configuraciones generales
        const configs = await fetchData(`/api/negocios/${negId}/configuraciones`);
        const extraMap = {};
        Object.entries(configs).forEach(([clave, valor]) => {
            if (clave.startsWith('resto_role_extra_')) {
                const rol = clave.replace('resto_role_extra_', '');
                try { 
                    extraMap[rol] = JSON.parse(valor);
                } catch(e) { }
            }
        });
        rolesExtraData = extraMap;

        await Promise.all(promesas);
        renderizarTablaRoles();

    } catch (error) {
        console.error("Error al cargar roles:", error);
        mostrarNotificacion("Error al cargar configuración de roles", "error");
    }
}

function renderizarTablaRoles() {
    const tbody = document.querySelector('#tabla-roles-resto tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    ROLES_BASE.forEach(rol => {
        const modules = rolesPermisos[rol] || [];
        const extra = rolesExtraData[rol] || { station: 'none', home: (rol === 'mozo' ? 'resto_mozo' : 'resto_cocina') };
        
        const tr = document.createElement('tr');
        tr.style.verticalAlign = 'middle';
        tr.innerHTML = `
            <td style="padding-left: 25px;">
                <div class="fw-800 text-uppercase" style="letter-spacing: 0.5px;">${rol}</div>
            </td>
            <td>
                <span class="badge px-3 py-2" style="background: ${extra.themeColor || 'var(--primary-color)'}; font-weight: 700;">
                    <i class="fas ${extra.station === 'bar' ? 'fa-cocktail' : (extra.station === 'dolce' ? 'fa-birthday-cake' : 'fa-fire')} me-1"></i>
                    ${extra.station === 'none' ? 'Sin Monitor' : extra.station.toUpperCase()}
                </span>
            </td>
            <td>
                <div class="d-flex flex-wrap gap-1">
                    ${modules.length > 0 
                        ? modules.slice(0, 3).map(m => `<span class="badge bg-light text-dark border small">${m}</span>`).join('') + (modules.length > 3 ? '...' : '')
                        : '<span class="text-muted small">Sin módulos</span>'}
                </div>
            </td>
            <td>
                <span class="text-muted small"><i class="fas fa-home me-1"></i> ${extra.home || '-'}</span>
            </td>
            <td style="text-align: right; padding-right: 25px;">
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.editarConfigRol('${rol}')">
                    <i class="fas fa-cog me-1"></i> Configurar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function abrirModalRol(rol = null) {
    const modal = document.getElementById('modal-rol-resto');
    if (!modal) return;

    document.getElementById('form-rol-resto').reset();
    document.getElementById('rol-id').value = rol || '';
    document.getElementById('rol-nombre').value = rol || '';
    document.getElementById('rol-nombre').readOnly = !!rol; // Los base no se cambian nombre por ahora
    
    // Si editamos, cargar checkboxes
    if (rol) {
        const modules = rolesPermisos[rol] || [];
        const extra = rolesExtraData[rol] || { station: 'none', home: 'resto_mozo' };

        document.getElementById('rol-estacion').value = extra.station || 'none';
        document.getElementById('rol-home').value = extra.home || 'resto_mozo';

        const checks = document.querySelectorAll('#modulos-checklist input');
        checks.forEach(chk => {
            chk.checked = modules.includes(chk.value);
        });

        // Seleccionar color
        const savedColor = extra.themeColor || '#f0883e';
        document.querySelectorAll('.color-option').forEach(opt => {
            if (opt.dataset.color === savedColor) {
                opt.click();
            }
        });
    }

    modal.style.display = 'flex';
}
window.editarConfigRol = (rol) => abrirModalRol(rol);

export function cerrarModalRol() {
    const modal = document.getElementById('modal-rol-resto');
    if (modal) modal.style.display = 'none';
}

async function guardarConfigRol(e) {
    e.preventDefault();
    const rol = document.getElementById('rol-id').value || document.getElementById('rol-nombre').value.toLowerCase();
    const negId = appState.negocioActivoId;

    const modules = Array.from(document.querySelectorAll('#modulos-checklist input:checked')).map(i => i.value);
    const activeColor = document.querySelector('.color-option.active');
    const extra = {
        station: document.getElementById('rol-estacion').value,
        home: document.getElementById('rol-home').value,
        themeColor: activeColor ? activeColor.dataset.color : '#f0883e'
    };

    try {
        // 1. Guardar módulos en tabla oficial
        await sendData(`/api/admin/negocios/${negId}/permisos-rol/${rol}`, { modules }, 'POST');

        // 2. Guardar extras en configuraciones
        const activeColor = document.querySelector('.color-option.active');
        const themeColor = activeColor ? activeColor.dataset.color : '#f0883e';
        
        const payload = {};
        payload[`resto_role_extra_${rol}`] = JSON.stringify(extra);
        
        // ✨ También guardamos este color como el color oficial de la ESTACIÓN para que impacte en el monitor
        if (extra.station && extra.station !== 'none') {
            payload[`resto_station_color_${extra.station}`] = themeColor;
        }

        await sendData(`/api/negocios/${negId}/configuraciones`, payload, 'POST');

        mostrarNotificacion(`Configuración de ${rol} guardada`, 'success');
        cerrarModalRol();
        await cargarConfigs();

    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al guardar configuración", "error");
    }
}
