// app/static/js/main.js
// Ô£à ARCHIVO COMPLETO (Versi├│n 1.7.1 - DYNAMIC MODULES FIX) Ô£à

// --- 1. CONFIGURACI├ôN CENTRAL DE VERSI├ôN ---
export const APP_VERSION = "1.8.8";
// HISTORIAL DE VERSIONES:
// 1.7.1: Final Fix regarding cross-module cache mismatches: Dynamic imports between modules + modal visibility.
// 1.7.0: Critical Fix: Hoisting of confirmarReparto in hoja_ruta.js + module-safety.
// 1.6.9: Fix Hoja de Ruta: window. prefix en onclicks + globalizaci├│n inmediata.
// 1.6.8: Fix Modo Repartidor: position:fixed en hoja_ruta.css + display:flex en modal.
// 1.6.7: Corrected Modo Repartidor button binding and cable connections.
// 1.6.6: Fix Resto pre-bill formatting and auto-start guide.
// 1.6.5: Final contrast fixes on header buttons.
// 1.6.3: High contrast buttons and Config Guide.
// 1.6.2: Fix printing module and agent status.
// 1.6.1: Added test print logic.
// 1.6.0: Fix fetchData global and SW auto-update.
// 1.5.9: Fix cache-busting and enrollment security.
// 1.5.8: Renombrado de botÔö£Ôöén "Deshacer visita" a "Deshacer bajada" para mayor claridad.
// 1.5.3: Cambio de texto a "CONFIRMAR BAJADA" en app choferes.
// 1.5.2: CorrecciÔö£Ôöén bug visual de suma string ("0.00" + 2 = "0.002") en las cantidades originales.
window.APP_VERSION = APP_VERSION;
const v = `?v=${APP_VERSION}`;

// --- AUTO-LIMPIEZA DE CACHÔö£├½ LOCAL ---
window.chequearVersionApp = () => {
    const versionGuardada = localStorage.getItem('app_version');

    // Si la versiÔö£Ôöén del cÔö£Ôöédigo es nueva
    if (versionGuardada !== APP_VERSION) {
        console.warn(`Nueva versiÔö£Ôöén(${APP_VERSION}).Limpiando cachÔö£┬« local crÔö£┬ítica...`);
        localStorage.setItem('app_version', APP_VERSION);

        // Forzamos recarga si ya habÔö£┬ía entrado antes
        if (versionGuardada) {
            window.location.reload(true);
        }
    }
};

chequearVersionApp();

// --- 1.5. SANEAMIENTO DE SEGURIDAD (CRÔö£├¼TICO) ---
// Si por algÔö£Ôòæn motivo el formulario se enviÔö£Ôöé por GET, limpiamos la URL de inmediato
// para que las credenciales no queden en el historial del navegador.
(function sanearUrlSeguridad() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('password') || urlParams.has('email')) {
        console.error("├ö├£├í┬┤┬®├à [SEGURIDAD] Credenciales detectadas en la URL. Limpiando...");
        urlParams.delete('password');
        urlParams.delete('email');
        
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        
        // Reemplazamos el historial para que no quede rastro de la contraseÔö£ÔûÆa
        window.history.replaceState({}, '', newUrl);
        
        // Opcional: Mostrar aviso si el login.js ya cargÔö£Ôöé
        setTimeout(() => {
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion("Seguridad: Las credenciales en la URL fueron eliminadas.", "warning");
            }
        }, 1000);
    }
})();

// --- 2. IMPORTACIONES ESTÔö£├╝TICAS ---
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';
import { fetchData, sendData } from './api.js';
import { getCurrentUser, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';
import { ERP_REGISTRY } from './modules/erp_registry.js';

// --- 2.5 EXPOSICIÔö£├┤N GLOBAL (CRÔö£├¼TICO PARA MÔö£├┤DULOS LEGACY) ---
window.fetchData = fetchData;
window.sendData = sendData;
window.ERP_REGISTRY = ERP_REGISTRY;

// --- 3. FUNCIONES GLOBALES (para onclick) ---
import { borrarProveedor } from './modules/proveedores.js';
import { abrirModalEditarUsuario } from './modules/users.js';
import { mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarPedidos } from './modules/pedidos.js';

// --- EXPOSICIÔö£├┤N DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProveedor = borrarProveedor;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.logout = logout;
window.mostrarNotificacion = mostrarNotificacion;
export function toggleMenu() {
    const navContainer = document.querySelector('.nav-container');
    if (navContainer) {
        navContainer.classList.toggle('is-active');
    } else {
        console.error("No se encontrÔö£Ôöé '.nav-container' al hacer toggle.");
    }
}
window.toggleMenu = toggleMenu;

let onClienteCreadoCallback = null;

export function esAdmin() {
    return appState.userRol === 'admin' || appState.userRol === 'superadmin';
}

// --- appState ---
export const appState = {
    negocioActivoId: null,
    negocioActivoTipo: null, // 'retail' o 'consorcio'
    negociosCache: [],
    userRol: null,
    userId: null, 
    userEspecialidad: null, // Ô£¿ Especialidad (mozo, cocinero, etc)
    filtroProveedorId: null,
    permissions: {}, // ­ƒøí´©Å Permisos din├ímicos cargados del backend
    subscriptionStatus: 'ok'
};
window.appState = appState;

export async function checkSubscriptionStatus() {
    if (!appState.negocioActivoId || appState.negocioActivoId === '') return;

    try {
        // Usamos fetchData para que maneje el token automÔö£├¡ticamente y sea mÔö£├¡s limpio
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/suscripcion-status`, { silent: true });

        const banner = document.getElementById('subscription-banner');
        if (!banner) return;

        if (data.status === 'blocked') {
            appState.subscriptionStatus = 'blocked';
            // Bloqueo total, el checkSubscriptionStatus se llama despuÔö£┬«s de fetchAppPermissions
            // pero podemos limpiar la UI ahora.
            aplicarBloqueoPorMora(data.mensaje);
        } else if (data.status === 'overdue') {
            banner.style.display = 'block';
            banner.style.backgroundColor = '#ff4444';
            banner.style.color = 'white';
            banner.innerText = data.mensaje;
        } else if (data.status === 'pending') {
            banner.style.display = 'block';
            banner.style.backgroundColor = '#ff9800';
            banner.style.color = 'white';
            banner.innerText = data.mensaje;
        } else {
            banner.style.display = 'none';
        }
    } catch (error) {
        // Si hay error (ej. 401), simplemente no mostramos el banner
        const banner = document.getElementById('subscription-banner');
        if (banner) banner.style.display = 'none';
        console.warn("No se pudo verificar el estado de suscripciÔö£Ôöén:", error.message);
    }
}

// ├ö┬ú┬┐ NUEVA FUNCIÔö£├┤N: Ocultar todo el ERP si estÔö£├¡ bloqueado
function aplicarBloqueoPorMora(mensajeLocal) {
    if (appState.userRol === 'superadmin') {
        const banner = document.getElementById('subscription-banner');
        if (banner) {
            banner.style.display = 'block';
            banner.style.backgroundColor = '#dc3545';
            banner.style.color = 'white';
            banner.innerHTML = `<strong>├ö├£├í┬┤┬®├à ESTE NEGOCIO ESTÔö£├╝ BLOQUEADO POR MORA.</strong> (TÔö£Ôòæ puedes verlo por ser Superadmin)`;
        }
        return;
    }

    // Ocultar elementos de navegaciÔö£Ôöén
    const header = document.querySelector('header');
    const mainNav = document.getElementById('main-nav');
    const businessSelectorBar = document.getElementById('business-selector-bar');
    const contentArea = document.getElementById('content-area');

    if (mainNav) mainNav.style.display = 'none';

    // Inyectar pantalla de bloqueo
    if (contentArea) {
        contentArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 70vh; text-align: center; font-family: sans-serif; padding: 20px;">
                <h1 style="color: #dc3545; font-size: 3rem; margin-bottom: 20px;">├ö├£├í┬┤┬®├à Acceso Suspendido</h1>
                <p style="font-size: 1.5rem; color: #333; max-width: 600px;">
                    ${mensajeLocal || 'El acceso a este sistema ha sido suspendido por falta de pago.'}
                </p>
                <p style="font-size: 1.2rem; color: #666; margin-top: 20px;">
                    Por favor, comunÔö£┬íquese con la administraciÔö£Ôöén para regularizar su situaciÔö£Ôöén.
                </p>
            </div>
        `;
    }
}

// --- MAPA DE RUTAS (YA NO SE USA APP_RUTAS CONSTANTE) ---
// La constante APP_RUTAS se ha eliminado en favor de appState.permissions

// Mapa de excepciones para rutas que no estÔö£├¡n en la raÔö£┬íz de static/
const PATH_MAP = {
    'login': 'static/login_secure.html', // Ô£à Redirigir login est├índar a la versi├│n segura
    'rentals_dashboard': 'static/rentals/rentals_dashboard.html',
    'rentals_units': 'static/rentals/rentals_units.html',
    'rentals_contracts': 'static/rentals/rentals_contracts.html',
    'crm_social': 'static/crm_social/crm_social.html',
    'crm_contactos': 'static/crm_social/crm_contactos.html',
    'admin_apps': 'static/admin_apps.html' // Ô£à Nueva ruta admin
};

// --- NUEVA FUNCIÔö£├┤N UI ---
function actualizarUIporTipoApp() {
    const tipoApp = appState.negocioActivoTipo || 'retail';
    document.body.classList.remove('app-retail', 'app-consorcio', 'app-rentals', 'app-distribuidora', 'app-resto');
    document.body.classList.add(`rol-${appState.userRol}`, `app-${tipoApp}`);
}

function loadPageCSS(pageName) {
    const existingStyle = document.getElementById('page-specific-style');
    if (existingStyle) existingStyle.remove();
    if (pageName) {
        const link = document.createElement('link');
        link.id = 'page-specific-style';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        let cssPath = pageName;
        if (pageName === 'login') cssPath = 'login_secure'; // ├ö┬ú┬┐ Evitar 404 si el hash es #login
        
        link.href = `static/css/${cssPath}.css?v=${APP_VERSION}`;

        // Caso especial para rentals si tuvieran CSS especÔö£┬ífico en su carpeta (opcional)
        // Caso especial: Evitar cargar CSS espec├¡ficos si no existen
        if (pageName.startsWith('rentals_') || pageName === 'crm_social' || pageName === 'crm_contactos') {
            return;
        }

        document.head.appendChild(link);
        link.onerror = () => {
            // console.warn(`Advertencia: No se encontrÔö£Ôöé CSS opcional en ${ link.href } `);
            link.remove();
        };
    }
}

function generarNavbarDinamico() {
    const navContainer = document.getElementById('nav-modules-container');
    if (!navContainer || !window.appState) return;

    navContainer.innerHTML = '';
    const tipoApp = appState.negocioActivoTipo || 'retail';
    const perms = appState.permissions[tipoApp] || [];
    const permsComun = appState.permissions['comun'] || [];
    const isSuper = appState.userRol === 'superadmin';

    // Ô£¿ BOT├ôN DE INICIO (Siempre presente)
    let homePage = `home_${tipoApp}`;
    if (tipoApp === 'rentals') homePage = 'rentals_dashboard';
    if (tipoApp === 'consorcio') homePage = 'home_consorcio';

    const homeLink = document.createElement('a');
    homeLink.href = `#${homePage}`;
    homeLink.className = 'nav-link-home';
    homeLink.innerHTML = '­ƒÅá Inicio';
    homeLink.onclick = (e) => loadContent(e, `static/${homePage}.html`, homeLink);
    navContainer.appendChild(homeLink);

    // 1. Agrupar mÔö£Ôöédulos por categorÔö£┬ía
    const categories = {
        'operaciones': { label: 'Operaciones', items: [] },
        'administrativo': { label: 'Administraci├│n', items: [] },
        'reportes': { label: 'Reportes', items: [] },
        'reglas': { label: 'Configuraci├│n', items: [] }
    };

    Object.entries(ERP_REGISTRY).forEach(([code, meta]) => {
        const tienePermiso = isSuper || perms.includes(code) || permsComun.includes(code);
        if (tienePermiso && categories[meta.category]) {
            categories[meta.category].items.push({ code, ...meta });
        }
    });

    // 2. Renderizar Dropdowns
    Object.values(categories).forEach(cat => {
        if (cat.items.length === 0) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        
        let dropdownHtml = `
            <button class="dropbtn">${cat.label} <i class="fa fa-caret-down"></i></button>
            <div class="dropdown-content">
        `;

        cat.items.forEach(item => {
            dropdownHtml += `<a href="#${item.code}" onclick="loadContent(event, '${item.path}', this)">${item.label}</a>`;
        });

        dropdownHtml += `</div>`;
        dropdown.innerHTML = dropdownHtml;
        navContainer.appendChild(dropdown);
    });

    // 3. Agregar Links Especiales (siempre visibles o con l├│gica extra)
    if (isSuper) {
        const adminLink = document.createElement('a');
        adminLink.href = "#admin_apps";
        adminLink.className = "nav-accent";
        adminLink.onclick = (e) => loadContent(e, 'static/admin_apps.html', adminLink);
        adminLink.innerHTML = '<i class="fas fa-tools me-1"></i> Admin Apps';
        navContainer.appendChild(adminLink);
    }
}

function actualizarVisibilidadMenu() {
    // Ahora actualizarVisibilidadMenu genera el men├║ desde cero
    generarNavbarDinamico();
    
    // Fallback para filtros legacy si quedara alg├║n link hardcodeado en index.html
    const user = getCurrentUser();
    if (!user) return;
    if (user.rol === 'superadmin') {
        document.querySelectorAll('#main-nav > a, #main-nav .dropdown').forEach(el => el.style.display = '');
        return;
    }
}

/**
 * ­ƒÄ¿ RENDERIZA DIN├üMICAMENTE EL DASHBOARD (TARJETAS)
 * Oculta las tarjetas que apuntan a m├│dulos sin permiso y construye las necesarias.
 */
function filtrarTarjetasDashboards() {
    const grids = document.querySelectorAll('.app-grid[data-category]');
    if (grids.length === 0) return;

    const tipoAppActual = appState.negocioActivoTipo || 'retail';
    const perms = appState.permissions[tipoAppActual] || [];
    const permsComun = appState.permissions['comun'] || [];
    const isSuper = appState.userRol === 'superadmin';

    console.log(`­ƒÄ¿ [Dashboard] Renderizando para ${tipoAppActual}. Permisos:`, perms);

    grids.forEach(grid => {
        grid.innerHTML = '';
        const category = grid.dataset.category;

        Object.entries(ERP_REGISTRY).forEach(([code, meta]) => {
            const tienePermiso = isSuper || perms.includes(code) || permsComun.includes(code);
            if (meta.category === category && tienePermiso) {
                const card = document.createElement('div');
                card.className = 'app-card';
                card.onclick = (e) => loadContent(e, meta.path, card);
                card.innerHTML = `
                    <img src="${meta.icon}" class="app-icon" onerror="this.src='static/img/icons/configuracion.png'">
                    <span class="app-name">${meta.label}</span>
                `;
                grid.appendChild(card);
            }
        });
    });
}

window.filtrarTarjetasDashboards = filtrarTarjetasDashboards;

// ├ö┬ú┬┐ NUEVA FUNCIÔö£├┤N: Verificar estado de caja GLOBALMENTE (para validaciones en otros mÔö£Ôöédulos)
export async function checkGlobalCashRegisterState() {
    if (!appState.negocioActivoId) return;

    try {
        // Usamos el endpoint existente que devuelve el estado
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta' && data.sesion) {
            appState.cajaSesionIdActiva = data.sesion.id;
            // console.log(`├ö┬ú├á Caja Abierta detectada.SesiÔö£Ôöén ID: ${ appState.cajaSesionIdActiva } `);
        } else {
            appState.cajaSesionIdActiva = null;
            // console.log("├ö├ñÔòú┬┤┬®├à Caja Cerrada o sin sesiÔö£Ôöén activa.");
        }
    } catch (error) {
        console.warn("No se pudo verificar el estado global de la caja:", error);
        appState.cajaSesionIdActiva = null;
    }
}

// --- poblarSelectorNegocios ---
async function poblarSelectorNegocios() {
    // console.log("Iniciando poblarSelectorNegocios...");
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');
    const selectors = [mainSelector, homeSelector].filter(s => s != null);

    if (selectors.length === 0) return;

    selectors.forEach(s => {
        s.innerHTML = '<option value="">Cargando...</option>';
        s.disabled = true;
    });

    try {
        const negocios = await fetchData(`/api/negocios`);
        if (!Array.isArray(negocios)) {
            console.error("fetchData('/api/negocios') no devolviÔö£Ôöé un array:", negocios);
            throw new Error("Datos de negocios invÔö£├¡lidos.");
        }
        appState.negociosCache = negocios;

        let idSeleccionado = null;
        if (negocios && negocios.length > 0) {
            idSeleccionado = negocios[0].id;
            const savedNegocioId = localStorage.getItem('negocioActivoId');
            if (savedNegocioId && negocios.some(n => String(n.id) === String(savedNegocioId))) {
                idSeleccionado = savedNegocioId;
            }
        }
        appState.negocioActivoId = idSeleccionado ? String(idSeleccionado) : null;

        const negocioSeleccionado = negocios.find(n => String(n.id) === appState.negocioActivoId);
        appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';

        if (appState.negocioActivoId) {
            localStorage.setItem('negocioActivoId', appState.negocioActivoId);
            localStorage.setItem('negocioActivoTipo', appState.negocioActivoTipo);
        } else {
            localStorage.removeItem('negocioActivoId');
            localStorage.removeItem('negocioActivoTipo');
        }

        selectors.forEach(selector => {
            selector.innerHTML = '';
            if (!negocios || negocios.length === 0) {
                selector.appendChild(new Option("No asignados", ""));
                selector.disabled = true;
            } else {
                negocios.forEach(negocio => {
                    selector.appendChild(new Option(negocio.nombre, negocio.id));
                });

                if (appState.negocioActivoId) {
                    selector.value = appState.negocioActivoId;
                } else if (negocios.length > 0) {
                    selector.value = negocios[0].id;
                    appState.negocioActivoId = String(negocios[0].id);
                    appState.negocioActivoTipo = negocios[0].tipo_app;
                    localStorage.setItem('negocioActivoId', appState.negocioActivoId);
                    localStorage.setItem('negocioActivoTipo', appState.negocioActivoTipo);
                }
                selector.disabled = false;
            }
        });

        // ├ö┬ú┬┐ Verificar suscripciÔö£Ôöén al cambiar de negocio
        checkSubscriptionStatus();

    } catch (error) {
        console.error("Error en poblarSelectorNegocios:", error);
        mostrarNotificacion("Error al cargar negocios.", "error");
    }
}

// --- fetchAppPermissions ---
export async function fetchAppPermissions() {
    const topBar = document.getElementById('top-bar');
    const body = document.body;
    const navContainer = document.getElementById('main-nav');
    const mainContent = document.getElementById('content-area');
    const header = document.querySelector('header');
    const businessSelectorBar = document.getElementById('business-selector-bar');

    try {
        const user = getCurrentUser();

        if (user) {
            // El usuario estÔö£├¡ logueado
            if (body) body.classList.remove('login-page'); // <--- REQUISITO VITAL PARA CENTRADO
            navContainer?.classList.remove('hidden');
            topBar?.classList.remove('hidden');
            mainContent?.classList.remove('full-width');
            
            if (navContainer) navContainer.style.display = 'flex';
            if (header) header.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';
        }

        // 1. Cargar permisos globales por tipo de negocio
        const perms = await fetchData('/api/admin/permissions');
        appState.permissions = perms;

        // 2. Cargar configuraciÔö£Ôöén especÔö£┬ífica del negocio activo (exclusiones)
        if (appState.negocioActivoId) {
            try {
                const businessConfigs = await fetchData(`/api/admin/negocios/${appState.negocioActivoId}/modulos-config`);
                const inactiveModules = (businessConfigs || [])
                    .filter(c => c.is_active === false)
                    .map(c => c.module_code);

                if (inactiveModules.length > 0) {
                    console.log(`┬¡ãÆ├£┬¢ Aplicando exclusiones por negocio (${appState.negocioActivoId}):`, inactiveModules);
                    // Filtrar en todos los tipos de negocio
                    Object.keys(appState.permissions).forEach(type => {
                        appState.permissions[type] = appState.permissions[type].filter(m => !inactiveModules.includes(m));
                    });
                }
            } catch (err) {
                console.warn("No se pudo cargar la configuraciÔö£Ôöén de mÔö£Ôöédulos por negocio.");
            }
        }

        // 3. Si es VENDEDOR, cargar permisos especÔö£┬íficos del negocio activo
        if (user && user.rol === 'vendedor' && appState.negocioActivoId) {
            try {
                const vendedorPerms = await fetchData(`/api/negocios/${appState.negocioActivoId}/permisos-rol/vendedor`);
                if (vendedorPerms) {
                    const tipoActual = appState.negocioActivoTipo || 'distribuidora';
                    // Fusionamos con los permisos especÔö£┬íficos (asegurando que el home estÔö£┬« siempre)
                    const modules = new Set(vendedorPerms || []);

                    // Asegurar Homes base (Red de seguridad)
                    modules.add('home_retail');
                    modules.add('home_consorcio');
                    modules.add('home_distribuidora');
                    modules.add('rentals_dashboard');

                    appState.permissions[tipoActual] = Array.from(modules);
                    console.log(`┬¡ãÆ├Â├ë Permisos dinÔö£├¡micos aplicados para Vendedor en negocio ${appState.negocioActivoId}`);
                }
            } catch (err) {
                console.warn("No se pudieron cargar permisos especÔö£┬íficos de vendedor, usando defaults.");
            }
        }
    } catch (error) {
        console.error("Error cargando permisos:", error);
        // Fallback de emergencia
        appState.permissions = {
            'retail': ['home_retail', 'ventas_nueva', 'tablero_control', 'cobro_ctacte'],
            'distribuidora': ['home_distribuidora', 'vendedores', 'hoja_ruta', 'pedidos', 'mapa_clientes', 'logistica', 'ventas_nueva', 'clientes_gestion', 'presupuestos', 'caja_control', 'productos', 'proveedores', 'gastos', 'ingresos_mercaderia', 'unidades_medida', 'historial_inventario', 'historial_presupuestos', 'historial_ajustes', 'historial_pagos_proveedores', 'historial_ingresos', 'cobro_ctacte']
        };
    }
}

// --- actualizarUIAutenticacion ---
let estaActualizandoAuth = false; // Bloqueo de concurrencia
export async function actualizarUIAutenticacion() {
    if (estaActualizandoAuth) {
        console.warn("actualizarUIAutenticacion ya en curso. Ignorando llamada duplicada.");
        return;
    }
    estaActualizandoAuth = true;
    showGlobalLoader();
    try {
        document.body.className = '';
        const user = getCurrentUser();
        const mainNav = document.querySelector('#main-nav');
        const authLink = document.getElementById('auth-link');
        const businessSelectorBar = document.getElementById('business-selector-bar');
        const header = document.querySelector('header');

        if (!mainNav || !authLink || !businessSelectorBar || !header) {
            hideGlobalLoader(); // Asegurar hide
            return;
        }

        if (user && user.nombre && user.rol) {
            // ├ö┬ú├á USUARIO LOGUEADO: Limpiar estado de login
            document.body.classList.remove('login-page');
            document.body.style.overflow = 'auto'; // Restaurar scroll
            
            appState.userRol = user.rol;
            appState.userId = user.id; // Ô£¿ Guardar ID de usuario
            appState.userEspecialidad = user.especialidad; // Ô£¿ Capturar especialidad (mozo, etc)
            
            if (header) header.style.display = 'flex';
            if (mainNav) mainNav.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';

            const newAuthLink = authLink.cloneNode(true);
            newAuthLink.textContent = `Salir (${user.nombre})`;
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            newAuthLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });

            // ├ö┬ú┬┐ CARGAR NEGOCIOS PRIMERO (Para tener el ID activo)
            await poblarSelectorNegocios();

            // ├ö┬ú┬┐ VERIFICAR ESTADO DE CAJA (CRÔö£├¼TICO PARA VALIDACIONES)
            await checkGlobalCashRegisterState();

            // ├ö┬ú┬┐ LUEGO CARGAR PERMISOS (Que depende del ID activo)
            await fetchAppPermissions();

            // ├ö┬ú┬┐ CONFIGURAR TIMER DE INACTIVIDAD
            const { setupInactivityTimer } = await import(`./modules/auth.js${v}`);
            setupInactivityTimer();

            // ├ö┬ú┬┐ LIMPIEZA PREVENTIVA: Si estamos logueados, el login-page-wrapper DEBE morir.
            const contentArea = document.getElementById('content-area');
            if (contentArea && contentArea.querySelector('.login-page-wrapper')) {
                contentArea.innerHTML = '';
            }

            actualizarUIporTipoApp();
            actualizarVisibilidadMenu(); // ├ö┬ú┬┐ Filtrar navbar segÔö£Ôòæn permisos

            // ├ö┬ú┬┐ BLOQUEO POR MORA
            if (appState.subscriptionStatus === 'blocked' && appState.userRol !== 'superadmin') {
                return; // La funciÔö£Ôöén aplicarBloqueoPorMora ya se encargÔö£Ôöé de dibujar la pantalla
            }

            const requestedPage = window.location.hash.substring(1).split('?')[0];

            // LÔö£Ôöégica de Home DinÔö£├¡mico
            let defaultHomePage = 'home_retail';
            if (appState.negocioActivoTipo === 'consorcio') defaultHomePage = 'home_consorcio';
            if (appState.negocioActivoTipo === 'rentals') defaultHomePage = 'rentals_dashboard';
            if (appState.negocioActivoTipo === 'distribuidora') defaultHomePage = 'home_distribuidora';
            if (appState.negocioActivoTipo === 'resto') defaultHomePage = 'home_resto';
            
            // Ô£¿ L├ôGICA MOZO / PERSONAL RESTO (App Mode)
            const esPersonalResto = (appState.userRol === 'vendedor' && appState.userEspecialidad && ['mozo', 'cocinero', 'barman', 'bachero'].includes(appState.userEspecialidad));
            if (esPersonalResto || appState.userRol === 'mozo') {
                // Si es mozo, va directo al Sal├│n Digital. Si es cocinero, al monitor de cocina.
                if (appState.userEspecialidad === 'cocinero') {
                    defaultHomePage = 'resto_cocina';
                } else if (appState.userEspecialidad === 'barman') {
                    defaultHomePage = 'resto_cocina'; // El monitor de cocina filtra por destino
                } else {
                    defaultHomePage = 'resto_mozo';
                }

                if (mainNav) mainNav.style.display = 'none';
                if (businessSelectorBar) businessSelectorBar.style.display = 'none';
                document.body.classList.add('app-mozo-mode');
            }

            // ├ö┬ú┬┐ LÔö£├┤GICA CHOFER
            if (appState.userRol === 'chofer') {
                defaultHomePage = 'home_chofer';
                if (mainNav) mainNav.style.display = 'none';
                if (businessSelectorBar) businessSelectorBar.style.display = 'none';
                // Cambiar el body para estilos extra si es necesario
                document.body.classList.add('app-chofer-mode');
            }

            let pageToLoad = (requestedPage && requestedPage !== 'login') ? requestedPage : defaultHomePage;

            if (pageToLoad === 'home' || pageToLoad === '') {
                pageToLoad = defaultHomePage;
            }

            // ├ö┬ú┬┐ REDIRECCIÔö£├┤N FORZADA: Si estÔö£├¡ en una home de otro tipo de negocio, mandarlo a la suya
            const esCualquierHome = (pageToLoad === 'home_retail' || pageToLoad === 'home_consorcio' || pageToLoad === 'home_distribuidora' || pageToLoad === 'rentals_dashboard' || pageToLoad === 'home_chofer' || pageToLoad === 'home_resto');
            if (esCualquierHome && pageToLoad !== defaultHomePage) {
                console.warn(`Redirigiendo de ${pageToLoad} a ${defaultHomePage} por inconsistencia de tipo de negocio o rol.`);
                pageToLoad = defaultHomePage;
            }

            // VALIDACION DE SEGURIDAD CON PERMISOS DINAMICOS
            const tipoAppActual = appState.negocioActivoTipo;
            if (tipoAppActual && pageToLoad !== 'login' && pageToLoad !== 'admin_apps' && appState.userRol !== 'chofer') {
                const rutasPermitidas = appState.permissions[tipoAppActual] || [];
                const rutasComunes = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios']; // Fallback comun
                const esHomeDelNegocio = (pageToLoad === 'home_retail' || pageToLoad === 'home_consorcio' || pageToLoad === 'home_distribuidora' || pageToLoad === 'rentals_dashboard' || pageToLoad === 'home_chofer' || pageToLoad === 'home_resto');

                // Si es superadmin, acceso total a admin_apps, pero validamos modulos de negocio igual
                if (!esHomeDelNegocio && !rutasPermitidas.includes(pageToLoad) && !rutasComunes.includes(pageToLoad)) {
                    // Check especial para admin_apps ya manejado arriba
                    console.warn(`Acceso no autorizado: Usuario '${tipoAppActual}' intento cargar '${pageToLoad}'.`);
                    // NO forzamos redireccion a home aqui para evitar bucles si la home tambien esta bloqueada.
                    // Dejamos que loadContent maneje el error y muestre la pantalla de Acceso Denegado.
                    // pageToLoad = defaultHomePage;
                }
            }

            if (requestedPage !== pageToLoad) {
                window.location.hash = pageToLoad;
                // ├ö┬ú┬┐ FIX: Si el hash ya cambiÔö£Ôöé pero popstate estÔö£├¡ bloqueado por estaActualizandoAuth,
                // forzamos la carga manual aquÔö£┬í para que el login desaparezca.
                const cleanHash = pageToLoad.split('?')[0];
                const queryString = pageToLoad.includes('?') ? '?' + pageToLoad.split('?')[1] : '';
                const pageUrlToLoad = (PATH_MAP[cleanHash] || `static/${cleanHash}.html`) + queryString;
                await loadContent(null, pageUrlToLoad, null, true);
            } else {
                const fullHash = window.location.hash.substring(1);
                const cleanHash = fullHash.split('?')[0];
                const queryString = fullHash.includes('?') ? '?' + fullHash.split('?')[1] : '';

                const pageUrlToLoad = (PATH_MAP[cleanHash] || `static/${cleanHash}.html`) + queryString;
                await loadContent(null, pageUrlToLoad, null, true);
            }

        } else {
            appState.userRol = null;
            appState.negocioActivoId = null;
            appState.negocioActivoTipo = null;
            appState.permissions = {}; // Clear permissions
            
            // ┬¡ãÆ├Â├å SEGURIDAD: SI ESTAMOS EN EL LOGIN, CERRAR SESIÔö£├┤N SIEMPRE
            if (window.location.hash === '#login' || window.location.hash === '') {
                // No llamamos a logout() recursivamente para evitar bucles si logout redirige a #login
                // Solo limpiamos el token si existe.
                if (localStorage.getItem('jwt_token')) {
                    console.warn("SesiÔö£Ôöén activa detectada en pÔö£├¡gina de login. Limpiando para seguridad.");
                    localStorage.removeItem('jwt_token');
                }
            }
            
            // 2. Ocultar Header inmediatamente
            if (header) header.style.display = 'none';
            mainNav.style.display = 'none';
            businessSelectorBar.style.display = 'none';
            document.body.classList.add('login-page');

            // 3. LIMPIEZA VISUAL FORZADA (Esto arregla que se queden los iconos)
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.innerHTML = ''; // <--- BORRAMOS TODO EL HTML VIEJO AL INSTANTE
            }

            // 4. Forzamos la carga del Login limpio
            // Usamos un pequeÔö£ÔûÆo timeout para dar tiempo al navegador a procesar el cambio de hash
            setTimeout(() => {
                // Pasamos true en el 4to argumento para forzar la carga del HTML
                // aunque el hash ya sea #login
                // ├ö┬ú┬┐ CACHE BUSTER RENAMED: Agregamos timestamp para asegurar que cargue la versiÔö£Ôöén sin el link inseguro
                const loginUrlWithCacheBuster = `static/login_secure.html?v=${Date.now()}`;
                loadContent(null, loginUrlWithCacheBuster, null, true)
                    .catch(err => console.error("Error cargando login:", err));
            }, 100);
        }
    } catch (error) {
        console.error("Fallo Auth UI:", error);
        logout();
    } finally {
        estaActualizandoAuth = false;
        hideGlobalLoader();
    }
}

// --- INICIALIZADOR DE MÔö£├┤DULOS ---
async function inicializarModulo(page) {
    if (!page) return;

    const pageName = page.split('/').pop().replace('.html', '').split('?')[0];

    if (window.currentChartInstance) {
        window.currentChartInstance.destroy();
        window.currentChartInstance = null;
    }

    try {
        switch (pageName) {
            case 'inventario':
                const { inicializarLogicaInventario, abrirModalEditarProducto, borrarProducto, changeProductPage } = await import(`./modules/inventory.js${v}`);
                window.abrirModalEditarProducto = abrirModalEditarProducto;
                window.borrarProducto = borrarProducto;
                window.changeProductPage = changeProductPage;
                inicializarLogicaInventario();
                break;
            case 'categorias':
                const { inicializarLogicaCategorias, editarCategoria, borrarCategoria } = await import(`./modules/categorias.js${v}`);
                window.editarCategoria = editarCategoria;
                window.borrarCategoria = borrarCategoria;
                inicializarLogicaCategorias();
                break;
            case 'login':
            case 'login_secure':
                const { inicializarLogicaLogin } = await import(`./modules/auth.js${v}`);
                inicializarLogicaLogin();
                break;
            case 'clientes':
                const { inicializarLogicaClientes } = await import(`./modules/clientes.js${v}`);
                inicializarLogicaClientes();
                break;
            case 'usuarios':
                const { inicializarLogicaUsuarios } = await import(`./modules/users.js${v}`);
                inicializarLogicaUsuarios();
                break;
            case 'dashboard':
                const { inicializarLogicaDashboard } = await import(`./modules/dashboard.js${v}`);
                inicializarLogicaDashboard();
                break;
            case 'caja':
                const { inicializarLogicaCaja } = await import(`./modules/caja.js${v}`);
                inicializarLogicaCaja();
                break;
            case 'reporte_caja':
                const { inicializarLogicaReporteCaja } = await import(`./modules/reporte_caja.js${v}`);
                inicializarLogicaReporteCaja();
                break;
            case 'reporte_ganancias':
                const { inicializarLogicaReporteGanancias } = await import(`./modules/reporte_ganancias.js${v}`);
                inicializarLogicaReporteGanancias();
                break;
            case 'reportes':
                const { inicializarLogicaReportes } = await import(`./modules/reportes.js${v}`);
                inicializarLogicaReportes();
                break;
            case 'factura':
                const { inicializarLogicaFactura } = await import(`./modules/factura.js${v}`);
                inicializarLogicaFactura();
                break;
            case 'verificador':
                const { inicializarLogicaVerificador } = await import(`./modules/verificador.js${v}`);
                inicializarLogicaVerificador();
                break;
            case 'historial_ingresos':
                const { inicializarLogicaHistorialIngresos } = await import(`./modules/historial_ingresos.js${v}`);
                inicializarLogicaHistorialIngresos();
                break;
            case 'ingresos':
                const { inicializarLogicaIngresos } = await import(`./modules/ingresos.js${v}`);
                inicializarLogicaIngresos();
                break;
            case 'historial_ventas':
                const { inicializarLogicaHistorialVentas } = await import(`./modules/historial_ventas.js${v}`);
                inicializarLogicaHistorialVentas();
                break;
            case 'ventas':
                const { inicializarLogicaVentas } = await import(`./modules/sales.js${v}`);
                inicializarLogicaVentas();
                break;
            case 'historial_ajustes':
                const { inicializarLogicaHistorialAjustes } = await import(`./modules/historial_ajustes.js${v}`);
                await inicializarLogicaHistorialAjustes();
                break;
            case 'eventos':
                const { inicializarEventos } = await import(`./modules/eventos_admin.js${v}`);
                await inicializarEventos();
                break;
            case 'ajuste_caja':
                const { inicializarLogicaAjusteCaja } = await import(`./modules/ajuste_caja.js${v}`);
                inicializarLogicaAjusteCaja();
                break;
            case 'pos':
                const { inicializarLogicaPOS } = await import(`./modules/pos.js${v}`);
                inicializarLogicaPOS();
                break;
            case 'historial_presupuestos':
                const { inicializarLogicaHistorialPresupuestos } = await import(`./modules/historial_presupuestos.js${v}`);
                inicializarLogicaHistorialPresupuestos();
                break;
            case 'presupuestos':
                const { inicializarLogicaPresupuestos } = await import(`./modules/presupuestos.js${v}`);
                inicializarLogicaPresupuestos();
                break;
            case 'inventario_movil':
                const { inicializarLogicaInventarioMovil } = await import(`./modules/inventario_movil_main.js${v}`);
                inicializarLogicaInventarioMovil();
                break;
            case 'proveedores':
                const { inicializarLogicaProveedores } = await import(`./modules/proveedores.js${v}`);
                inicializarLogicaProveedores();
                break;
            case 'negocios':
                const { inicializarLogicaNegocios } = await import(`./modules/negocios.js${v}`);
                inicializarLogicaNegocios();
                break;
            case 'payments':
                const { inicializarLogicaPagosProveedores } = await import(`./modules/payments.js${v}`);
                inicializarLogicaPagosProveedores();
                break;
            case 'historial_pagos_proveedores':
                const { inicializarLogicaHistorialPagosProveedores } = await import(`./modules/historial_pagos_proveedores.js${v}`);
                inicializarLogicaHistorialPagosProveedores();
                break;
            case 'cobro_ctacte':
                const { inicializarCobroCtaCte } = await import(`./modules/cobro_ctacte.js${v}`);
                inicializarCobroCtaCte();
                break;
            case 'empleados':
                const { inicializarLogicaEmpleados } = await import(`./modules/empleados.js${v}`);
                inicializarLogicaEmpleados();
                break;
            case 'configuracion':
                const { inicializarConfiguracion } = await import(`./modules/configuracion.js${v}`);
                inicializarConfiguracion();
                break;
            case 'listas_precios':
                const { inicializarGestionListasPrecios } = await import(`./modules/listas_precios.js${v}`);
                inicializarGestionListasPrecios();
                break;
            case 'unidades_medida':
                const { inicializarLogicaUnidadesMedida } = await import(`./modules/unidades_medida.js${v}`);
                inicializarLogicaUnidadesMedida();
                break;
            case 'historial_inventario':
                const { inicializarHistorialInventario } = await import(`./modules/historial_inventario.js${v}`);
                inicializarHistorialInventario();
                break;
            case 'orden_compra':
                const { inicializarOC } = await import(`./modules/orden_compra.js${v}`);
                inicializarOC();
                break;
            case 'precios_especificos':
                const { inicializarPreciosEspecificos } = await import(`./modules/precios_especificos.js${v}`);
                inicializarPreciosEspecificos();
                break;
            case 'gastos':
                const { inicializarGastos } = await import(`./modules/gastos.js${v}`);
                inicializarGastos();
                break;
            case 'gastos_categorias':
                const { inicializarCategoriasGasto } = await import(`./modules/gastos_categorias.js${v}`);
                inicializarCategoriasGasto();
                break;
            case 'club_puntos':
                const { inicializarLogicaClubPuntos } = await import(`./modules/club_puntos.js${v}`);
                inicializarLogicaClubPuntos();
                break;
            case 'club_gestion':
                const { inicializarLogicaGestionClub, abrirModalPremio, borrarPremio } = await import(`./modules/club_gestion.js${v}`);
                inicializarLogicaGestionClub();
                break;
            case 'unidades':
                const { inicializarLogicaUnidades, abrirModalUnidad, borrarUnidad } = await import(`./modules/unidades.js${v}`);
                window.abrirModalUnidad = abrirModalUnidad;
                window.borrarUnidad = borrarUnidad;
                inicializarLogicaUnidades();
                break;
            case 'reclamos':
                const { inicializarLogicaReclamos, abrirModalReclamo, borrarReclamo } = await import(`./modules/reclamos.js${v}`);
                window.abrirModalReclamo = abrirModalReclamo;
                window.borrarReclamo = borrarReclamo;
                inicializarLogicaReclamos();
                break;
            case 'expensas':
                const { inicializarLogicaExpensas, verDetallePeriodo, volverALista, emitirPeriodo, abrirModalPago, anularExpensa } = await import(`./modules/expensas.js${v}`);
                window.verDetallePeriodo = verDetallePeriodo;
                window.volverALista = volverALista;
                window.emitirPeriodo = emitirPeriodo;
                window.abrirModalPago = abrirModalPago;
                window.anularExpensa = anularExpensa;
                inicializarLogicaExpensas();
                break;
            case 'noticias':
                const { inicializarLogicaNoticias, abrirModalNoticia, borrarNoticia } = await import(`./modules/noticias.js${v}`);
                window.abrirModalNoticia = abrirModalNoticia;
                window.borrarNoticia = borrarNoticia;
                inicializarLogicaNoticias();
                break;
            case 'crm_social':
                const { inicializarCRM } = await import(`../crm_social/js/crm_main.js${v}`);
                inicializarCRM();
                break;
            case 'crm_contactos':
                const { inicializarCRMContactos } = await import(`./modules/crm_contactos.js${v}`);
                inicializarCRMContactos();
                break;
            case 'home_retail':
            case 'home_resto':
            case 'home_consorcio':
            case 'home_distribuidora':
            case 'rentals_dashboard':
                // Dashboards estÔö£├¡ticos, el filtrado de tarjetas se maneja en loadContent
                break;
            case 'home_chofer':
                const { inicializarHomeChofer } = await import(`./modules/home_chofer.js${v}`);
                inicializarHomeChofer();
                break;
            case 'vendedores':
                const { inicializarVendedores } = await import(`./modules/vendedores.js${v}`);
                inicializarVendedores();
                break;
            case 'hoja_ruta':
                const { inicializarHojaRuta } = await import(`./modules/hoja_ruta.js${v}`);
                inicializarHojaRuta();
                break;
            case 'logistica':
                const { inicializarLogistica } = await import(`./modules/logistica.js${v}`);
                inicializarLogistica();
                break;
            case 'pedidos':
                const { inicializarPedidos } = await import(`./modules/pedidos.js${v}`);
                inicializarPedidos();
                break;
            case 'mapa_clientes':
                const { inicializarMapaClientes } = await import(`./modules/mapa_clientes.js${v}`);
                inicializarMapaClientes();
                break;
            case 'reservas':
                const { inicializarReservas } = await import(`./modules/reservas.js${v}`);
                inicializarReservas();
                break;
            case 'mesas':
                const { inicializarMesas, abrirModalMesa, cerrarModalMesa, editarMesa, eliminarMesa } = await import(`./modules/mesas.js${v}`);
                window.abrirModalMesa = abrirModalMesa;
                window.cerrarModalMesa = cerrarModalMesa;
                window.editarMesa = editarMesa;
                window.eliminarMesa = eliminarMesa;
                inicializarMesas();
                break;
            case 'mozos':
                const { inicializarLogicaMozos, abrirModalMozo, cerrarModalMozo, editarMozo, eliminarMozo } = await import(`./modules/mozos.js${v}`);
                window.abrirModalMozo = abrirModalMozo;
                window.cerrarModalMozo = cerrarModalMozo;
                window.editarMozo = editarMozo;
                window.eliminarMozo = eliminarMozo;
                inicializarLogicaMozos();
                break;

            case 'resto_menu':
                const { inicializarRestoMenu } = await import(`./modules/resto_menu.js${v}`);
                inicializarRestoMenu();
                break;

            case 'resto_mozo':
                const { inicializarRestoMozo } = await import(`./modules/resto_mozo.js${v}`);
                inicializarRestoMozo();
                break;

            case 'resto_cocina':
                const { inicializarRestoCocina } = await import(`./modules/resto_cocina.js${v}`);
                inicializarRestoCocina();
                break;

            case 'resto_caja':
                const { inicializarRestoCaja } = await import(`./modules/resto_caja.js${v}`);
                inicializarRestoCaja();
                break;

            case 'resto_stats':
                const { inicializarRestoStats } = await import(`./modules/resto_stats.js${v}`);
                inicializarRestoStats();
                break;
            case 'resto_impresoras':
                const { inicializarRestoImpresoras } = await import(`./modules/resto_impresoras.js${v}`);
                inicializarRestoImpresoras();
                break;
            case 'admin_apps':
                const { inicializarAdminApps } = await import(`./modules/admin_apps.js${v}`);
                inicializarAdminApps();
                break;
            case 'agente_facturacion':
                const { inicializarAgenteFacturacion } = await import(`./modules/agente_facturacion.js${v}`);
                inicializarAgenteFacturacion();
                break;
            case 'tickets':
                const { inicializarTickets } = await import(`./modules/tickets.js${v}`);
                inicializarTickets();
                break;
            case 'rentals_dashboard':
            case 'rentals_units':
            case 'rentals_contracts':
                const { inicializarRentals } = await import(`../rentals/js/rentals.js${v}`);
                inicializarRentals(pageName);
                break;

            default:
                console.warn(`No se encontr├│ l├│gica de inicializaci├│n para: ${pageName}`);
        }
    } catch (error) {
        console.error(`Error mÔö£Ôöédulo ${pageName}:`, error);
        mostrarNotificacion(`Error al cargar ${pageName}.`, 'error');
    }
}

/* --- LOOP PROTECTION SYSTEM --- */
const LOOP_LIMIT = 5; // MÔö£├¡ximo de navegaciones permitidas
const LOOP_TIME_WINDOW = 3000; // en 3 segundos

function checkLoopProtection() {
    const now = Date.now();
    let history = [];
    try {
        history = JSON.parse(sessionStorage.getItem('nav_history') || '[]');
    } catch (e) { history = []; }

    // Limpiar entradas viejas
    history = history.filter(t => now - t < LOOP_TIME_WINDOW);
    history.push(now);
    sessionStorage.setItem('nav_history', JSON.stringify(history));

    if (history.length > LOOP_LIMIT) {
        console.error("┬¡ãÆ├Â├æ BUCLE DETECTADO. DETENIENDO EJECUCIÔö£├┤N ┬¡ãÆ├Â├æ");
        document.body.innerHTML = `
            <div style="padding:50px; text-align:center; color:#721c24; background:#f8d7da; font-family:sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <h1 style="font-size: 3rem;">├ö├£├í┬┤┬®├à SISTEMA DETENIDO ├ö├£├í┬┤┬®├à</h1>
                <h3 style="margin-bottom: 2rem;">Se ha detectado un bucle infinito de redirecciones.</h3>
                <button onclick="sessionStorage.clear(); window.location.href='/#login'; window.location.reload();" 
                        style="padding:15px 30px; font-size:18px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ├ö├ûÔòù┬┤┬®├à REINICIAR SISTEMA (Borrar CachÔö£┬«)
                </button>
            </div>
        `;
        throw new Error("Loop Protection Triggered: Execution Halted.");
    }
}

/**
 * ­ƒöì REVERSO DE MAPPING (Ruta -> Key de Permiso)
 * Busca en el ERP_REGISTRY qu├® permiso corresponde a un archivo f├¡sico.
 */
function getRegistryKeyByPath(pageName) {
    const fullPath = `static/${pageName}.html`;
    for (const [key, config] of Object.entries(ERP_REGISTRY)) {
        if (config.path === fullPath) return key;
    }
    return pageName; // Si no est├í en el registro, devolvemos el original
}

// --- loadContent ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    checkLoopProtection(); // <--- PROTECCIÔö£├┤N ACTIVADA

    if (event) event.preventDefault();

    const pageParts = page.split('?');
    const pagePath = pageParts[0];
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : '';
    const pageName = pagePath.split('/').pop().replace('.html', '');

    // --- ┬¡ãÆ├©├¡┬┤┬®├à RESUCITACIÔö£├┤N (RED DE SEGURIDAD SECUNDARIA) ---
    if (!appState.negocioActivoTipo) {
        const tipoGuardado = localStorage.getItem('negocioActivoTipo');
        const idGuardado = localStorage.getItem('negocioActivoId');
        if (tipoGuardado && tipoGuardado !== 'null' && tipoGuardado !== 'undefined') {
            appState.negocioActivoTipo = tipoGuardado;
            appState.negocioActivoId = idGuardado;
        }
    }

    const tipoAppActual = appState.negocioActivoTipo;

    // (DEBUG ALERT QUITADO PARA PRODUCCIÔö£├┤N)

    if (tipoAppActual && pageName !== 'login' && pageName !== 'admin_apps' && pageName !== 'agente_facturacion' && appState.userRol !== 'superadmin') {
        const rutasPermitidas = appState.permissions[tipoAppActual] || [];
        const rutasComunes = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios']; // Fallback comun

        const esHomeDelNegocio = (pageName === 'home_retail' || pageName === 'home_consorcio' || pageName === 'home_distribuidora' || pageName === 'rentals_dashboard' || pageName === 'home_chofer' || pageName === 'home_resto');

        // Si es superadmin tiene acceso a todo, pero igual respetamos la UI del negocio
        // Pero admin_apps fue excluido arriba. Choferes solo acceden a home_chofer.
        if (appState.userRol === 'chofer' && pageName !== 'home_chofer') {
            return Promise.resolve(); // Silently block or redirect
        }

        const isChoferRouteBlocked = (appState.userRol !== 'chofer' && pageName === 'home_chofer');

        // ­ƒøí´©Å REGLA DE PERMISOS DIN├üMICA
        const permissionKey = getRegistryKeyByPath(pageName);
        const hasPermission = rutasPermitidas.includes(permissionKey) || rutasComunes.includes(permissionKey) || esHomeDelNegocio;

        if (isChoferRouteBlocked || (appState.userRol !== 'chofer' && !hasPermission)) {
            console.warn(`ACCESO DENEGADO: ${tipoAppActual} -> ${pageName} (Key: ${permissionKey}).`);

            // Renderizar Pantalla de Error Est├ítica (Detiene el bucle/parpadeo)
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                const defaultHome = (tipoAppActual === 'consorcio' ? 'home_consorcio' :
                    tipoAppActual === 'rentals' ? 'rentals_dashboard' :
                        tipoAppActual === 'distribuidora' ? 'home_distribuidora' : 
                            tipoAppActual === 'resto' ? 'home_resto' : 'home_retail');

                contentArea.innerHTML = `
                    <div class="container text-center" style="margin-top: 50px;">
                        <h1 class="text-danger">­ƒÜ½ Acceso Denegado</h1>
                        <p class="lead">No tienes permisos para acceder al m├│dulo <strong>${pageName}</strong>.</p>
                        <div class="alert alert-warning">
                            Tu tipo de negocio es detectado como: <strong>${tipoAppActual}</strong>
                        </div>
                        <hr>
                        <div class="text-start mx-auto" style="max-width: 600px; background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace;">
                            <strong>Debug Info:</strong><br>
                            - Rol: ${appState.userRol}<br>
                            - Permisos para '${tipoAppActual}': ${(appState.permissions[tipoAppActual] || []).join(', ')}<br>
                            - Requerido: ${permissionKey}
                        </div>
                        <br><br>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn btn-primary" onclick="window.location.hash='#${defaultHome}'; window.location.reload();">­ƒÅá Volver al Inicio</button>
                            <button class="btn btn-secondary" onclick="window.location.reload()">­ƒöä Reintentar</button>
                            <button class="btn btn-danger" onclick="logout()">­ƒöÆ Cerrar Sesi├│n</button>
                        </div>
                    </div>
                `;
            }
            return Promise.resolve();
        }
    }

    const targetHash = `#${pageName}`;
    const fullTargetHash = targetHash + queryString;
    const baseUrl = window.location.origin + window.location.pathname;
    const targetUrlBase = baseUrl + targetHash;
    const currentUrlBase = baseUrl + window.location.hash.split('?')[0];

    if (!fromHistory && currentUrlBase === targetUrlBase) {
        if (window.location.hash !== fullTargetHash) {
            history.pushState({ page: page }, '', fullTargetHash);
        }
        const navContainer = document.querySelector('.nav-container');
        if (navContainer && navContainer.classList.contains('is-active')) {
            navContainer.classList.remove('is-active');
        }
        return Promise.resolve();
    }

    if (!fromHistory) {
        history.pushState({ page: page }, '', fullTargetHash);
    }

    loadPageCSS(pageName);

    const header = document.querySelector('header');
    const isLoginPage = pageName === 'login' || pageName === 'login_secure';
    if (header) header.style.display = isLoginPage ? 'none' : 'flex';

    let pageToFetch = `${pagePath}?v=${APP_VERSION}`;
    if (pageName === 'crm_social') {
        pageToFetch = `static/crm_social/crm_social.html?v=${APP_VERSION}`;
    } else if (pageName.startsWith('rentals_')) {
        pageToFetch = `static/rentals/${pageName}.html?v=${APP_VERSION}`;
    }

    return fetch(pageToFetch)

        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'M├│dulo en Mantenimiento',
                        text: `El archivo correspondiente a "${page}" no se encuentra disponible moment├íneamente. Por favor, contacta a soporte.`,
                        confirmButtonColor: '#4f46e5'
                    });
                    throw new Error(`404: Modulo ${page} no encontrado f├¡sicamente.`);
                }
                throw new Error(`Error ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.innerHTML = html;
                requestAnimationFrame(() => {
                    document.querySelectorAll('#main-nav a, #main-nav .dropbtn').forEach(link => link.classList.remove('active'));
                    const linkSelectorOnClick = `#main-nav a[onclick*="'${pagePath}'"]`;
                    const linkSelectorHref = `#main-nav a[href$="${targetHash}"]`;
                    let linkToActivate = document.querySelector(linkSelectorOnClick) || document.querySelector(linkSelectorHref);

                    if (linkToActivate) {
                        linkToActivate.classList.add('active');
                        const parentDropdown = linkToActivate.closest('.dropdown');
                        if (parentDropdown) parentDropdown.querySelector('.dropbtn')?.classList.add('active');
                    }

                    // ├ö┬ú┬┐ FILTRAR TARJETAS EN DASHBOARDS (Si aplica)
                    filtrarTarjetasDashboards();

                    setTimeout(() => {
                        inicializarModulo(page).catch(err => {
                            console.error(`Error init modulo ${page}:`, err);
                        });
                    }, 0);
                });
            }
        })
        .catch(error => {
            console.error("Error loadContent:", error);
            const currentHash = window.location.hash.substring(1).split('?')[0];

            let defaultHomePage = 'home_retail';
            if (appState.negocioActivoTipo === 'consorcio') defaultHomePage = 'home_consorcio';
            if (appState.negocioActivoTipo === 'rentals') defaultHomePage = 'rentals_dashboard';
            if (appState.negocioActivoTipo === 'distribuidora') defaultHomePage = 'home_distribuidora';
            if (appState.negocioActivoTipo === 'resto') defaultHomePage = 'home_resto';
            if (appState.userRol === 'chofer') defaultHomePage = 'home_chofer';

            // SI LA PAGINA QUE FALLO FUE EL HOME PROPIO, NO REDIRIGIR A EL (Break loop)
            if (currentHash === defaultHomePage || pageName === defaultHomePage) {
                console.error("Fallo crÔö£┬ítico en pÔö£├¡gina de inicio. Deteniendo para evitar bucle.");
                mostrarNotificacion(`Error fatal: No se puede cargar ${pageName}.`, 'error');
                return;
            }

            mostrarNotificacion(`Error al cargar ${pageName}. Redirigiendo a inicio...`, 'error');
            window.location.hash = `#${defaultHomePage}`;
        });

    const navContainer = document.querySelector('.nav-container');
    if (window.innerWidth <= 900 && navContainer && navContainer.classList.contains('is-active')) {
        navContainer.classList.remove('is-active');
    }
}

/**
 * ├ö┬ú┬┐ LÔö£├┤GICA DE MODAL DE NUEVO CLIENTE "AL VUELO"
 * Permite crear un cliente desde cualquier parte del sistema sin salir de la vista actual.
 */
export async function abrirModalNuevoCliente(callback) {
    // 1. Crear el overlay del modal si no existe
    let modal = document.getElementById('modal-nuevo-cliente-quick');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-nuevo-cliente-quick';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3 style="margin-bottom: 20px;">┬¡ãÆ├ª├▒ Registro RÔö£├¡pido de Cliente</h3>
                <form id="form-cliente-quick">
                    <div class="form-group">
                        <label>Nombre Completo:</label>
                        <input type="text" id="quick-cliente-nombre" required placeholder="Ej. Juan PÔö£┬«rez">
                    </div>
                    <div class="form-group">
                        <label>DNI / CUIT:</label>
                        <input type="text" id="quick-cliente-dni" placeholder="Sin puntos ni guiones">
                    </div>
                    <div class="form-group">
                        <label>TelÔö£┬«fono:</label>
                        <input type="text" id="quick-cliente-tel">
                    </div>
                    <div class="form-actions" style="margin-top: 20px; display: flex; gap: 10px;">
                        <button type="submit" class="btn-primary" style="flex: 1;">Guardar Cliente</button>
                        <button type="button" id="btn-cancelar-quick-cliente" class="btn-secondary">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    const form = document.getElementById('form-cliente-quick');
    const btnCancelar = document.getElementById('btn-cancelar-quick-cliente');

    // Limpiar formulario al abrir
    form.reset();

    const cerrarModal = () => { modal.style.display = 'none'; };

    btnCancelar.onclick = cerrarModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            nombre: document.getElementById('quick-cliente-nombre').value,
            dni: document.getElementById('quick-cliente-dni').value,
            telefono: document.getElementById('quick-cliente-tel').value,
            tipo_cliente: 'Individuo',
            posicion_iva: 'Consumidor Final',
            condicion_venta: 'Contado'
        };

        try {
            showGlobalLoader();
            const response = await sendData(`/api/negocios/${appState.negocioActivoId}/clientes`, payload);
            mostrarNotificacion('Cliente creado con Ôö£┬«xito', 'success');
            cerrarModal();
            if (callback) {
                // El backend devuelve {message: ..., id: ...}
                callback({ id: response.id, nombre: payload.nombre });
            }
        } catch (error) {
            console.error("Error creando cliente quick:", error);
            mostrarNotificacion(error.message || 'Error al crear cliente', 'error');
        } finally {
            hideGlobalLoader();
        }
    };
}

// --- LISTENERS FINALES ---
console.log("DOM Cargado. Configurando listeners iniciales...");

document.body.addEventListener('change', async (e) => {
    if (e.target.id === 'selector-negocio') {
        const nuevoNegocioId = e.target.value;
        if (nuevoNegocioId) {
            appState.negocioActivoId = nuevoNegocioId;
            localStorage.setItem('negocioActivoId', nuevoNegocioId);
            const negocioSeleccionado = appState.negociosCache.find(n => String(n.id) === nuevoNegocioId);
            appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';
            localStorage.setItem('negocioActivoTipo', appState.negocioActivoTipo);

            // Re-fetch permisos si es un rol con permisos dinÔö£├¡micos (Vendedor)
            const user = getCurrentUser();
            if (user && user.rol === 'vendedor') {
                await fetchAppPermissions();
            }

            actualizarUIporTipoApp();

            let homePage = 'home_retail';
            if (appState.negocioActivoTipo === 'consorcio') homePage = 'home_consorcio';
            if (appState.negocioActivoTipo === 'rentals') homePage = 'rentals_dashboard';
            if (appState.negocioActivoTipo === 'distribuidora') homePage = 'home_distribuidora';
            if (appState.negocioActivoTipo === 'resto') homePage = 'home_resto';

            const homePageUrl = PATH_MAP[homePage] || `static/${homePage}.html`;
            loadContent(null, homePageUrl);
        }
    }
});



window.addEventListener('popstate', (e) => {
    if (estaActualizandoAuth) return; // ├ö┬ú┬┐ No navegar si estamos re-autenticando
    const currentHashFull = window.location.hash.substring(1);
    const cleanHash = currentHashFull.split('?')[0];
    const queryString = currentHashFull.includes('?') ? '?' + currentHashFull.split('?')[1] : '';

    let defaultHomePage = 'home_retail';
    if (appState.negocioActivoTipo === 'consorcio') defaultHomePage = 'home_consorcio';
    if (appState.negocioActivoTipo === 'rentals') defaultHomePage = 'rentals_dashboard';
    if (appState.negocioActivoTipo === 'distribuidora') defaultHomePage = 'home_distribuidora';
    if (appState.negocioActivoTipo === 'resto') defaultHomePage = 'home_resto';
    if (appState.userRol === 'chofer') defaultHomePage = 'home_chofer';

    const pageToLoad = cleanHash || defaultHomePage;
    const pageUrl = (PATH_MAP[pageToLoad] || `static/${pageToLoad}.html`) + queryString;

    loadContent(null, pageUrl, null, true);
});

window.addEventListener('authChange', () => {
    actualizarUIAutenticacion();
});

const hamburgerBtn = document.getElementById('hamburger-btn');
const navContainer2 = document.querySelector('.nav-container');
if (hamburgerBtn && navContainer2) {
    hamburgerBtn.addEventListener('click', () => {
        navContainer2.classList.toggle('is-active');
    });
}

// --- ┬¡ãÆ├©├¡┬┤┬®├à┬¡ãÆ├©├¡┬┤┬®├à RESTAURACIÔö£├┤N DE SESIÔö£├┤N GLOBAL (AQUÔö£├¼ ES DONDE SUCEDE LA MAGIA) ┬¡ãÆ├©├¡┬┤┬®├à┬¡ãÆ├©├¡┬┤┬®├à ---
// Esta funciÔö£Ôöén se ejecuta YA, antes de que nada mÔö£├¡s pase.
const restaurarSesionGlobal = () => {
    const tipo = localStorage.getItem('negocioActivoTipo');
    const id = localStorage.getItem('negocioActivoId');

    if (tipo && tipo !== 'null' && tipo !== 'undefined') {
        console.log(`├ö├ûÔòù┬┤┬®├à [Global] Restaurando sesiÔö£Ôöén al inicio: ${tipo}`);
        appState.negocioActivoTipo = tipo;
        appState.negocioActivoId = id;
    }
};
restaurarSesionGlobal();
// --------------------------------------------------------------------------------

console.log("Llamando a actualizarUIAutenticacion por primera vez...");
actualizarUIAutenticacion();

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`/service-worker.js${v}`).then(reg => {
            // ├ö┬ú┬┐ Escuchar si hay una actualizaciÔö£Ôöén de SW
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nuevo SW instalado y listo. Recargar.
                        console.log("┬¡ãÆ├£├ç Nueva versiÔö£Ôöén detectada. Recargando...");
                        if (window.mostrarNotificacion) {
                            window.mostrarNotificacion("Actualizando sistema...", "info");
                        }
                        setTimeout(() => window.location.reload(), 1500);
                    }
                };
            };
        }).catch(() => { });
    });
}

