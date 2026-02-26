/* app/static/js/modules/admin_apps.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let allModules = [];
let currentPermissions = {};
let currentBusinessConfig = [];
let currentType = 'retail';
let isBusinessMode = false;

export async function inicializarAdminApps() {
    if (appState.userRol !== 'superadmin') {
        mostrarNotificacion('Acceso denegado: Se requiere rol Superadmin', 'error');
        window.location.hash = '#home';
        return;
    }

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.onclick = (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            const btnEl = e.target;
            btnEl.classList.add('active');

            isBusinessMode = btnEl.getAttribute('data-type') === 'business';

            if (isBusinessMode) {
                currentType = 'negocio';
                document.getElementById('negocio-selector-container').style.display = 'block';
            } else {
                document.getElementById('negocio-selector-container').style.display = 'none';
                if (btnEl.innerText.includes('Retail')) currentType = 'retail';
                else if (btnEl.innerText.includes('Consorcio')) currentType = 'consorcio';
                else if (btnEl.innerText.includes('Rentals')) currentType = 'rentals';
                else if (btnEl.innerText.includes('Distribuidora')) currentType = 'distribuidora';
            }
            cambiarTabAdmin(currentType);
        };
    });

    const negocioSelector = document.getElementById('admin-negocio-selector');
    if (negocioSelector) {
        negocioSelector.onchange = async () => {
            await cargarConfiguracionNegocio(negocioSelector.value);
            renderModules();
        };
    }

    const form = document.getElementById('permissions-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await guardarPermisos();
        };
    }

    window.cambiarTabAdmin = cambiarTabAdmin;
    window.recargarPermisos = cargarDatosIniciales;

    await cargarDatosIniciales();
}

async function cargarDatosIniciales() {
    const loading = document.getElementById('loading-permissions');
    const content = document.getElementById('permissions-content');
    loading.style.display = 'block';
    content.style.display = 'none';

    try {
        // 1. Cargar catálogo de módulos
        allModules = await fetchData('/api/admin/modules');

        // 2. Cargar permisos globales actuales
        currentPermissions = await fetchData('/api/admin/permissions');

        // 3. Poblar selector de negocios si no está poblado
        const selector = document.getElementById('admin-negocio-selector');
        if (selector && selector.options.length === 0) {
            const negocios = await fetchData('/api/negocios');
            negocios.forEach(n => {
                const opt = document.createElement('option');
                opt.value = n.id;
                opt.textContent = `${n.nombre} (${n.tipo_app})`;
                selector.appendChild(opt);
            });

            if (negocios.length > 0) {
                await cargarConfiguracionNegocio(negocios[0].id);
            }
        }

        renderModules();
        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error("Error cargando admin data:", error);
        mostrarNotificacion("Error al cargar configuración", "error");
        loading.innerHTML = '<p class="text-danger">Error de conexión.</p>';
    }
}

async function cargarConfiguracionNegocio(negocioId) {
    try {
        currentBusinessConfig = await fetchData(`/api/negocios/${negocioId}/modulos-config`);
    } catch (err) {
        currentBusinessConfig = [];
    }
}

function cambiarTabAdmin(type) {
    const title = document.getElementById('current-type-title');
    if (isBusinessMode) {
        const selector = document.getElementById('admin-negocio-selector');
        const nombreNegocio = selector.options[selector.selectedIndex]?.text || '';
        title.innerText = `Configuración Específica: ${nombreNegocio}`;
    } else {
        title.innerText = `Configurando: ${capitalize(type)}`;
    }
    renderModules();
}

function renderModules() {
    const container = document.getElementById('modules-list-container');
    container.innerHTML = '';

    // Agrupar por categoría
    const categories = {};
    allModules.forEach(m => {
        const cat = m.category || 'Otros';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(m);
    });

    const orderedKeys = Object.keys(categories).sort();

    let activeModules = [];
    let businessAllowList = [];

    if (isBusinessMode) {
        // En modo negocio, solo mostramos los módulos que SU TIPO permite
        const selector = document.getElementById('admin-negocio-selector');
        const negocioId = selector.value;
        const negocio = (appState.negociosCache || []).find(n => String(n.id) === String(negocioId));
        const tipoNegocio = negocio ? negocio.tipo_app : 'retail';

        businessAllowList = currentPermissions[tipoNegocio] || [];

        // Desactivados explícitamente
        const inactiveOnBusiness = currentBusinessConfig
            .filter(c => c.is_active === false)
            .map(c => c.module_code);

        // Marcados como checked si NO están en la lista de inactivos
        activeModules = businessAllowList.filter(m => !inactiveOnBusiness.includes(m));
    } else {
        activeModules = currentPermissions[currentType] || [];
    }

    orderedKeys.forEach(cat => {
        // Filtrar módulos si estamos en modo negocio para mostrar solo los relevantes
        let modulesToShow = categories[cat];
        if (isBusinessMode) {
            modulesToShow = modulesToShow.filter(m => businessAllowList.includes(m.code));
        }

        if (modulesToShow.length === 0) return;

        const col = document.createElement('div');
        col.className = 'col-md-4 module-group';

        let html = `<div class="module-group-title">${cat}</div>`;

        modulesToShow.forEach(mod => {
            const isChecked = activeModules.includes(mod.code) ? 'checked' : '';
            html += `
                <label class="module-check-item">
                    <input type="checkbox" name="modules" value="${mod.code}" ${isChecked}>
                    <span>${mod.name}</span>
                </label>
            `;
        });

        col.innerHTML = html;
        container.appendChild(col);
    });
}

async function guardarPermisos() {
    if (isBusinessMode) {
        await guardarConfiguracionNegocio();
    } else {
        await guardarPermisosTipo();
    }
}

async function guardarPermisosTipo() {
    const checkboxes = document.querySelectorAll('input[name="modules"]:checked');
    const selectedModules = Array.from(checkboxes).map(cb => cb.value);

    try {
        await sendData('/api/admin/permissions', {
            business_type: currentType,
            modules: selectedModules
        }, 'POST');

        mostrarNotificacion(`Permisos actualizados para ${currentType}`, 'success');
        currentPermissions[currentType] = selectedModules;
    } catch (error) {
        mostrarNotificacion("Error al guardar cambios", "error");
    }
}

async function guardarConfiguracionNegocio() {
    const selector = document.getElementById('admin-negocio-selector');
    const negocioId = selector.value;

    // Obtenemos todos los checkboxes (marcados y no marcados) para saber qué se deshabilitó
    const allChecks = document.querySelectorAll('input[name="modules"]');
    const configs = Array.from(allChecks).map(cb => ({
        module_code: cb.value,
        is_active: cb.checked
    }));

    try {
        await sendData(`/api/negocios/${negocioId}/modulos-config`, { configs }, 'POST');
        mostrarNotificacion("Configuración del negocio actualizada", "success");
        // Forzar actualización de appState local si estamos en ese negocio
        if (String(appState.negocioActivoId) === String(negocioId)) {
            window.location.reload(); // Recargar para aplicar cambios de visibilidad
        }
    } catch (error) {
        mostrarNotificacion("Error al guardar configuración", "error");
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
