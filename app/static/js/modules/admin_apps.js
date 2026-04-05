/* app/static/js/modules/admin_apps.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let allModules = [];
let currentPermissions = {};
let currentBusinessConfig = [];
let currentType = 'retail';
let isBusinessMode = false;
let modalesSuscripcionInicializados = false;

export async function inicializarAdminApps() {
    if (appState.userRol !== 'superadmin') {
        mostrarNotificacion('Acceso denegado: Se requiere rol Superadmin', 'error');
        window.location.hash = '#home';
        return;
    }

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active'));
            const btnEl = e.currentTarget;
            btnEl.classList.add('active');

            let type = btnEl.getAttribute('data-type');
            
            // Sincronizar estados globales
            isBusinessMode = (type === 'business');
            currentType = (type === 'business') ? 'negocio' : type;

            const toolsBar = document.getElementById('admin-tools-bar');
            if (toolsBar) toolsBar.style.setProperty('display', 'flex', 'important');

            if (isBusinessMode) {
                document.getElementById('negocio-selector-container').style.display = 'flex';
            } else {
                document.getElementById('negocio-selector-container').style.display = 'none';
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

    // Inicializar listeners de nuevos modales
    inicializarModalesSuscripcion();

    await cargarDatosIniciales();
}

function inicializarModalesSuscripcion() {
    if (modalesSuscripcionInicializados) return;

    const formPago = document.getElementById('form-registrar-pago');
    if (formPago) {
        formPago.onsubmit = async (e) => {
            e.preventDefault();
            await confirmarRegistroPago();
        };
    }

    // Poblar meses y años en el selector
    const selectMes = document.getElementById('reg-pago-mes');
    const selectAnio = document.getElementById('reg-pago-anio');
    if (selectMes && selectAnio) {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        meses.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i + 1;
            opt.textContent = m;
            selectMes.appendChild(opt);
        });

        const anioActual = new Date().getFullYear();
        for (let a = anioActual - 1; a <= anioActual + 1; a++) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            selectAnio.appendChild(opt);
        }
    }

    modalesSuscripcionInicializados = true;
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
        currentBusinessConfig = await fetchData(`/api/admin/negocios/${negocioId}/modulos-config`);
    } catch (err) {
        currentBusinessConfig = [];
    }
}

async function cargarPagosSuscripciones() {
    try {
        const data = await fetchData('/api/admin/suscripciones');
        const tbody = document.querySelector('#tabla-suscripciones tbody');
        tbody.innerHTML = '';

        data.forEach(neg => {
            const fecha = neg.fecha_ultimo_pago ? new Date(neg.fecha_ultimo_pago).toLocaleDateString() : 'N/A';
            const ultimoMes = neg.ultimo_mes ? `${neg.ultimo_mes}/${neg.ultimo_anio}` : 'Ninguno';

            // Lógica de estado Premium
            const hoy = new Date();
            const mesActual = hoy.getMonth() + 1;
            const anioActual = hoy.getFullYear();

            let statusClass = 'status-danger';
            let statusText = 'VENCIDO';

            if (!neg.suscripcion_activa) {
                statusClass = 'status-muted';
                statusText = 'LIBRE';
            } else if (neg.ultimo_anio > anioActual || (neg.ultimo_anio === anioActual && neg.ultimo_mes >= mesActual)) {
                statusClass = 'status-success';
                statusText = 'AL DÍA';
            } else if (hoy.getDate() <= 10 && neg.ultimo_anio === anioActual && neg.ultimo_mes === mesActual - 1) {
                statusClass = 'status-warning';
                statusText = 'PENDIENTE';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-light">${neg.nombre}</div>
                    <div class="text-muted small">${neg.tipo_app || 'ERP'}</div>
                </td>
                <td><span class="text-accent fw-bold">$${neg.cuota_mensual || 0}</span></td>
                <td>
                    <div class="${neg.deuda_acumulada > 0 ? 'text-danger fw-bold' : 'text-success'}">$${neg.deuda_acumulada || 0}</div>
                    ${neg.meses_adeudados > 0 ? `<div class="text-muted" style="font-size: 10px;">${neg.meses_adeudados} meses</div>` : ''}
                </td>
                <td>
                    <div class="text-light">${ultimoMes}</div>
                    <div class="text-muted small">${fecha}</div>
                </td>
                <td><span class="premium-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-glass-primary py-1 px-3" style="font-size: 11px;" onclick="registrarPagoSuscripcion(${neg.id}, '${neg.nombre}', ${neg.cuota_mensual || 0})">
                            PAGAR
                        </button>
                        <button class="btn btn-sm btn-glass-secondary py-1 px-2" style="font-size: 11px;" onclick="verHistorialPagos(${neg.id}, '${neg.nombre}')">
                            <i class="fas fa-history"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error cargando pagos:", error);
    }
}

window.registrarPagoSuscripcion = async (id, nombre, cuota) => {
    document.getElementById('reg-pago-negocio-id').value = id;
    document.getElementById('reg-pago-negocio-nombre').value = nombre;
    document.getElementById('reg-pago-monto').value = cuota || 0;

    const hoy = new Date();
    document.getElementById('reg-pago-mes').value = hoy.getMonth() + 1;
    document.getElementById('reg-pago-anio').value = hoy.getFullYear();

    const modalEl = document.getElementById('modalRegistrarPago');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function confirmarRegistroPago() {
    const id = document.getElementById('reg-pago-negocio-id').value;
    const mes = document.getElementById('reg-pago-mes').value;
    const anio = document.getElementById('reg-pago-anio').value;
    const monto = document.getElementById('reg-pago-monto').value;

    try {
        await sendData('/api/admin/suscripciones/registrar-pago', {
            negocio_id: id,
            mes: parseInt(mes),
            anio: parseInt(anio),
            monto: parseFloat(monto)
        });

        mostrarNotificacion("Pago registrado correctamente", "success");

        const modalEl = document.getElementById('modalRegistrarPago');
        bootstrap.Modal.getInstance(modalEl)?.hide();

        await cargarPagosSuscripciones();
    } catch (error) {
        mostrarNotificacion("Error al registrar pago", "error");
    }
}

window.verHistorialPagos = async (id, nombre) => {
    try {
        const pagos = await fetchData(`/api/admin/negocios/${id}/pagos-historial`);

        document.getElementById('historial-negocio-nombre').textContent = `Historial de Pagos: ${nombre}`;
        const tbody = document.getElementById('tbody-historial-pagos');
        tbody.innerHTML = '';

        if (pagos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay pagos registrados</td></tr>';
        } else {
            pagos.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.mes}/${p.anio}</td>
                    <td>$${p.monto}</td>
                    <td>${new Date(p.fecha_registro).toLocaleString()}</td>
                    <td>${p.registrador || 'Desconocido'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        const modalEl = document.getElementById('modalHistorialPagos');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modal.show();

    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al cargar historial", "error");
    }
}

function cambiarTabAdmin(type) {
    const title = document.getElementById('current-type-title');
    const contentPermissions = document.getElementById('permissions-content');
    const contentPagos = document.getElementById('pagos-content');

    if (type === 'pagos') {
        contentPermissions.style.display = 'none';
        contentPagos.style.display = 'block';
        cargarPagosSuscripciones();
        return;
    }

    contentPermissions.style.display = 'block';
    contentPagos.style.display = 'none';

    if (isBusinessMode) {
        const selector = document.getElementById('admin-negocio-selector');
        const nombreNegocio = selector.options[selector.selectedIndex]?.text || 'Cargando...';
        title.innerText = `📦 Configuración Específica: ${nombreNegocio}`;
    } else {
        const labels = {
            'retail': 'Retail / Comercio',
            'resto': 'Restó / Gastronomía',
            'distribuidora': 'Distribuidora / Logística',
            'consorcio': 'Consorcio / Administración',
            'rentals': 'Rentals / Alquileres'
        };
        const label = labels[type] || capitalize(type);
        title.innerText = `⚙️ Configurando Perfil: ${label}`;
    }
    renderModules();
}

function renderModules() {
    const container = document.getElementById('modules-list-container');
    if (!container) return;
    
    const searchTerm = document.getElementById('admin-module-search')?.value.toLowerCase() || '';
    container.innerHTML = '';

    if (allModules.length === 0) {
        container.innerHTML = '<div class="col-12 text-center p-5 text-muted">No hay módulos registrados.</div>';
        return;
    }

    // 1. Determinar qué módulos están activos actualmente según el contexto
    let activeModules = [];
    let businessAllowList = [];

    if (isBusinessMode) {
        const selector = document.getElementById('admin-negocio-selector');
        const negocioId = selector.value;
        const negocio = (appState.negociosCache || []).find(n => String(n.id) === String(negocioId));
        const tipoNegocio = negocio ? (negocio.tipo_app || 'retail') : 'retail';

        businessAllowList = currentPermissions[tipoNegocio] || [];
        const inactiveOnBusiness = currentBusinessConfig
            .filter(c => c.is_active === false)
            .map(c => c.module_code);

        activeModules = businessAllowList.filter(m => !inactiveOnBusiness.includes(m));
    } else {
        activeModules = currentPermissions[currentType] || [];
    }

    // 2. Filtrar y Agrupar por categoría
    const categories = {};
    allModules.forEach(m => {
        // Filtro de búsqueda
        if (searchTerm && !m.name.toLowerCase().includes(searchTerm) && !m.code.toLowerCase().includes(searchTerm)) {
            return;
        }

        // Si estamos en modo negocio, solo mostramos los que el TIPO permite
        if (isBusinessMode && !businessAllowList.includes(m.code)) {
            return;
        }

        const cat = m.category || 'Otros';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(m);
    });

    const orderedKeys = Object.keys(categories).sort();

    if (orderedKeys.length === 0) {
        container.innerHTML = '<div class="col-12 text-center p-5 text-muted">No se encontraron módulos que coincidan con la búsqueda.</div>';
        return;
    }

    // 3. Renderizar cada categoría en una premium card
    orderedKeys.forEach(cat => {
        const modulesToShow = categories[cat];
        const col = document.createElement('div');
        col.className = 'col';

        let html = `
            <div class="glass-card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-2">
                        <h6 class="m-0 fw-bold text-accent">${cat.toUpperCase()}</h6>
                        <div class="d-flex gap-2">
                             <span class="text-info small cursor-pointer" onclick="toggleCategory('${cat}', true)">M</span>
                             <span class="text-danger small cursor-pointer" onclick="toggleCategory('${cat}', false)">D</span>
                        </div>
                    </div>
                    <div class="module-items-list">
        `;

        modulesToShow.forEach(mod => {
            const isChecked = activeModules.includes(mod.code) ? 'checked' : '';
            const registryEntry = window.ERP_REGISTRY ? window.ERP_REGISTRY[mod.code] : null;
            const iconHtml = registryEntry ? `<img src="${registryEntry.icon}" style="width: 18px; margin-right: 8px; opacity: 0.8;">` : '';

            html += `
                <div class="module-item d-flex align-items-center justify-content-between py-2 px-1 rounded hover-bg-dark">
                    <div class="d-flex align-items-center overflow-hidden">
                        ${iconHtml}
                        <label class="form-check-label text-truncate" for="mod-${mod.code}" style="cursor: pointer; font-size: 13px;">
                            ${mod.name}
                            <div class="text-muted" style="font-size: 10px; opacity: 0.6;">${mod.code}</div>
                        </label>
                    </div>
                    <div class="form-check form-switch m-0">
                        <input class="form-check-input module-checkbox" type="checkbox" name="modules" 
                               data-category="${cat}" value="${mod.code}" id="mod-${mod.code}" ${isChecked}>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        col.innerHTML = html;
        container.appendChild(col);
    });

    window.toggleCategory = (category, state) => {
        const checks = document.querySelectorAll(`.module-checkbox[data-category="${category}"]`);
        checks.forEach(c => c.checked = state);
    };

    window.toggleAllChecks = (state) => {
        const checks = document.querySelectorAll('.module-checkbox');
        checks.forEach(c => c.checked = state);
    };
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
        await sendData(`/api/admin/negocios/${negocioId}/modulos-config`, { configs }, 'POST');
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
