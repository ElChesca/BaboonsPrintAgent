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
                else if (btnEl.innerText.includes('Pagos')) currentType = 'pagos';
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
        currentBusinessConfig = await fetchData(`/api/negocios/${negocioId}/modulos-config`);
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

            // Lógica de estado
            const hoy = new Date();
            const mesActual = hoy.getMonth() + 1;
            const anioActual = hoy.getFullYear();

            let badgeClass = 'bg-danger';
            let statusText = 'Vencido';

            if (!neg.suscripcion_activa) {
                badgeClass = 'bg-secondary';
                statusText = 'No Enforzado';
            } else if (neg.ultimo_anio > anioActual || (neg.ultimo_anio === anioActual && neg.ultimo_mes >= mesActual)) {
                badgeClass = 'bg-success';
                statusText = 'Al día';
            } else if (hoy.getDate() <= 10 && neg.ultimo_anio === anioActual && neg.ultimo_mes === mesActual - 1) {
                badgeClass = 'bg-warning text-dark';
                statusText = 'Pendiente (Anticipado)';
            }

            const deudaStyle = neg.deuda_acumulada > 0 ? 'color: #dc3545; font-weight: bold;' : 'color: #28a745;';
            const mesesTexto = neg.meses_adeudados > 0 ? `<br><small class="text-muted">(${neg.meses_adeudados} meses)</small>` : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${neg.nombre}</strong></td>
                <td>$${neg.cuota_mensual || 0}</td>
                <td style="${deudaStyle}">$${neg.deuda_acumulada || 0}${mesesTexto}</td>
                <td>${ultimoMes}</td>
                <td>${fecha}</td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-success" onclick="registrarPagoSuscripcion(${neg.id}, '${neg.nombre}', ${neg.cuota_mensual || 0})">
                            <i class="bi bi-cash-stack"></i> Registrar Pago...
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="verHistorialPagos(${neg.id}, '${neg.nombre}')">
                            <i class="bi bi-clock-history"></i> Historial
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
