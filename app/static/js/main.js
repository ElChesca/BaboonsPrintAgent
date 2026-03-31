// app/static/js/main.js
// ✨ ARCHIVO COMPLETO (Versión 1.2.2 - CON RESTAURACIÓN DE SESIÓN) ✨

// --- 1. CONFIGURACIÓN CENTRAL DE VERSIÓN ---
export const APP_VERSION = "1.6.0";
// HISTORIAL DE VERSIONES:
// 1.6.0: Fix fetchData global and SW auto-update.
// 1.5.9: Fix cache-busting and enrollment security.
// 1.5.8: Renombrado de botón "Deshacer visita" a "Deshacer bajada" para mayor claridad.
// 1.5.3: Cambio de texto a "CONFIRMAR BAJADA" en app choferes.
// 1.5.2: Corrección bug visual de suma string ("0.00" + 2 = "0.002") en las cantidades originales.
window.APP_VERSION = APP_VERSION;
const v = `?v=${APP_VERSION}`;

// --- AUTO-LIMPIEZA DE CACHÉ LOCAL ---
window.chequearVersionApp = () => {
    const versionGuardada = localStorage.getItem('app_version');

    // Si la versión del código es nueva
    if (versionGuardada !== APP_VERSION) {
        console.warn(`Nueva versión(${APP_VERSION}).Limpiando caché local crítica...`);
        localStorage.setItem('app_version', APP_VERSION);

        // Forzamos recarga si ya había entrado antes
        if (versionGuardada) {
            window.location.reload(true);
        }
    }
};

chequearVersionApp();

// --- 1.5. SANEAMIENTO DE SEGURIDAD (CRÍTICO) ---
// Si por algún motivo el formulario se envió por GET, limpiamos la URL de inmediato
// para que las credenciales no queden en el historial del navegador.
(function sanearUrlSeguridad() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('password') || urlParams.has('email')) {
        console.error("⚠️ [SEGURIDAD] Credenciales detectadas en la URL. Limpiando...");
        urlParams.delete('password');
        urlParams.delete('email');
        
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        
        // Reemplazamos el historial para que no quede rastro de la contraseña
        window.history.replaceState({}, '', newUrl);
        
        // Opcional: Mostrar aviso si el login.js ya cargó
        setTimeout(() => {
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion("Seguridad: Las credenciales en la URL fueron eliminadas.", "warning");
            }
        }, 1000);
    }
})();

// --- 2. IMPORTACIONES ESTÁTICAS ---
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';
import { fetchData, sendData } from './api.js';
import { getCurrentUser, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';

// --- 2.5 EXPOSICIÓN GLOBAL (CRÍTICO PARA MÓDULOS LEGACY) ---
window.fetchData = fetchData;
window.sendData = sendData;

// --- 3. FUNCIONES GLOBALES (para onclick) ---
import { borrarProveedor } from './modules/proveedores.js';
import { abrirModalEditarUsuario } from './modules/users.js';
import { mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarPedidos } from './modules/pedidos.js';

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
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
        console.error("No se encontró '.nav-container' al hacer toggle.");
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
    filtroProveedorId: null,
    permissions: {}, // ✨ Permisos dinámicos cargados del backend
    subscriptionStatus: 'ok'
};
window.appState = appState;

export async function checkSubscriptionStatus() {
    if (!appState.negocioActivoId || appState.negocioActivoId === '') return;

    try {
        // Usamos fetchData para que maneje el token automáticamente y sea más limpio
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/suscripcion-status`, { silent: true });

        const banner = document.getElementById('subscription-banner');
        if (!banner) return;

        if (data.status === 'blocked') {
            appState.subscriptionStatus = 'blocked';
            // Bloqueo total, el checkSubscriptionStatus se llama después de fetchAppPermissions
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
        console.warn("No se pudo verificar el estado de suscripción:", error.message);
    }
}

// ✨ NUEVA FUNCIÓN: Ocultar todo el ERP si está bloqueado
function aplicarBloqueoPorMora(mensajeLocal) {
    if (appState.userRol === 'superadmin') {
        const banner = document.getElementById('subscription-banner');
        if (banner) {
            banner.style.display = 'block';
            banner.style.backgroundColor = '#dc3545';
            banner.style.color = 'white';
            banner.innerHTML = `<strong>⚠️ ESTE NEGOCIO ESTÁ BLOQUEADO POR MORA.</strong> (Tú puedes verlo por ser Superadmin)`;
        }
        return;
    }

    // Ocultar elementos de navegación
    const header = document.querySelector('header');
    const mainNav = document.getElementById('main-nav');
    const businessSelectorBar = document.getElementById('business-selector-bar');
    const contentArea = document.getElementById('content-area');

    if (mainNav) mainNav.style.display = 'none';

    // Inyectar pantalla de bloqueo
    if (contentArea) {
        contentArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 70vh; text-align: center; font-family: sans-serif; padding: 20px;">
                <h1 style="color: #dc3545; font-size: 3rem; margin-bottom: 20px;">⚠️ Acceso Suspendido</h1>
                <p style="font-size: 1.5rem; color: #333; max-width: 600px;">
                    ${mensajeLocal || 'El acceso a este sistema ha sido suspendido por falta de pago.'}
                </p>
                <p style="font-size: 1.2rem; color: #666; margin-top: 20px;">
                    Por favor, comuníquese con la administración para regularizar su situación.
                </p>
            </div>
        `;
    }
}

// --- MAPA DE RUTAS (YA NO SE USA APP_RUTAS CONSTANTE) ---
// La constante APP_RUTAS se ha eliminado en favor de appState.permissions

// Mapa de excepciones para rutas que no están en la raíz de static/
const PATH_MAP = {
    'login': 'static/login_secure.html', // ✨ Redirigir login estándar a la versión segura
    'rentals_dashboard': 'static/rentals/rentals_dashboard.html',
    'rentals_units': 'static/rentals/rentals_units.html',
    'rentals_contracts': 'static/rentals/rentals_contracts.html',
    'crm_social': 'static/crm_social/crm_social.html',
    'admin_apps': 'static/admin_apps.html' // ✨ Nueva ruta admin
};

// --- NUEVA FUNCIÓN UI ---
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
        if (pageName === 'login') cssPath = 'login_secure'; // ✨ Evitar 404 si el hash es #login
        
        link.href = `static/css/${cssPath}.css?v=${APP_VERSION}`;

        // Caso especial para rentals si tuvieran CSS específico en su carpeta (opcional)
        // Caso especial: Evitar cargar CSS específicos si no existen
        if (pageName.startsWith('rentals_') || pageName === 'crm_social') {
            return;
        }

        document.head.appendChild(link);
        link.onerror = () => {
            // console.warn(`Advertencia: No se encontró CSS opcional en ${ link.href } `);
            link.remove();
        };
    }
}

/**
 * ✨ FILTRA DINÁMICAMENTE EL MENÚ DE NAVEGACIÓN
 * Oculta los enlaces a módulos para los que el usuario no tiene permiso explícito.
 */
function actualizarVisibilidadMenu() {
    const user = getCurrentUser();
    if (!user) return;

    // Los superadmins siempre ven todo
    if (user.rol === 'superadmin') {
        document.querySelectorAll('#main-nav a, #main-nav .dropdown').forEach(el => el.style.display = '');
        return;
    }

    const tipoAppActual = appState.negocioActivoTipo || 'retail';
    const perms = appState.permissions[tipoAppActual] || [];
    const permsComun = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios'];

    console.log(`🔍[Menu] Aplicando filtros para ${tipoAppActual}.Permisos: `, perms);

    // 1. Filtrar enlaces directos
    document.querySelectorAll('#main-nav > a[href^="#"]').forEach(link => {
        const pageName = link.getAttribute('href').substring(1);
        if (pageName === 'home' || pageName === '') return;

        const esHomeDelNegocio =
            (tipoAppActual === 'retail' && pageName === 'home_retail') ||
            (tipoAppActual === 'consorcio' && pageName === 'home_consorcio') ||
            (tipoAppActual === 'distribuidora' && pageName === 'home_distribuidora') ||
            (tipoAppActual === 'rentals' && pageName === 'rentals_dashboard');

        const tienePermiso = perms.includes(pageName) || permsComun.includes(pageName) || esHomeDelNegocio;

        if (!tienePermiso && !link.classList.contains('superadmin-only')) {
            link.style.display = 'none';
        } else {
            link.style.display = '';
        }
    });

    // 2. Filtrar Dropdowns
    document.querySelectorAll('#main-nav .dropdown').forEach(dropdown => {
        const subLinks = dropdown.querySelectorAll('.dropdown-content a[href^="#"]');
        let algunSubPermitido = false;

        subLinks.forEach(subLink => {
            const pageName = subLink.getAttribute('href').substring(1);
            const tienePermiso = perms.includes(pageName) || permsComun.includes(pageName);

            if (!tienePermiso) {
                subLink.style.display = 'none';
            } else {
                subLink.style.display = '';
                algunSubPermitido = true;
            }
        });
        dropdown.style.display = algunSubPermitido ? '' : 'none';
    });
}

/**
 * ✨ FILTRA DINÁMICAMENTE LAS TARJETAS (APPS) EN LOS DASHBOARDS
 * Oculta las tarjetas que apuntan a módulos sin permiso.
 */
function filtrarTarjetasDashboards() {
    const user = getCurrentUser();
    if (!user || user.rol === 'superadmin') return;

    const tipoAppActual = appState.negocioActivoTipo || 'retail';
    const perms = appState.permissions[tipoAppActual] || [];
    const permsComun = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios'];

    const cards = document.querySelectorAll('.app-card[onclick*="loadContent"]');
    if (cards.length === 0) return;

    console.log(`🔍[Dash] Filtrando ${cards.length} tarjetas para ${tipoAppActual} `);

    cards.forEach(card => {
        const onclickAttr = card.getAttribute('onclick');
        // Regex mejorada: busca cualquier .html dentro de comillas
        const match = onclickAttr.match(/['"]([^'"]+)\.html['"]/);
        if (match && match[1]) {
            const fullPath = match[1];
            const pageName = fullPath.split('/').pop();

            const esHome = pageName.startsWith('home_') || pageName === 'rentals_dashboard';
            const tienePermiso = perms.includes(pageName) || permsComun.includes(pageName) || esHome;

            if (!tienePermiso) {
                card.style.display = 'none';
            } else {
                card.style.display = '';
            }
        }
    });
}

// ✨ NUEVA FUNCIÓN: Verificar estado de caja GLOBALMENTE (para validaciones en otros módulos)
export async function checkGlobalCashRegisterState() {
    if (!appState.negocioActivoId) return;

    try {
        // Usamos el endpoint existente que devuelve el estado
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta' && data.sesion) {
            appState.cajaSesionIdActiva = data.sesion.id;
            // console.log(`✅ Caja Abierta detectada.Sesión ID: ${ appState.cajaSesionIdActiva } `);
        } else {
            appState.cajaSesionIdActiva = null;
            // console.log("ℹ️ Caja Cerrada o sin sesión activa.");
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
            console.error("fetchData('/api/negocios') no devolvió un array:", negocios);
            throw new Error("Datos de negocios inválidos.");
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

        // ✨ Verificar suscripción al cambiar de negocio
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
            // El usuario está logueado
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

        // 2. Cargar configuración específica del negocio activo (exclusiones)
        if (appState.negocioActivoId) {
            try {
                const businessConfigs = await fetchData(`/api/admin/negocios/${appState.negocioActivoId}/modulos-config`);
                const inactiveModules = (businessConfigs || [])
                    .filter(c => c.is_active === false)
                    .map(c => c.module_code);

                if (inactiveModules.length > 0) {
                    console.log(`🚫 Aplicando exclusiones por negocio (${appState.negocioActivoId}):`, inactiveModules);
                    // Filtrar en todos los tipos de negocio
                    Object.keys(appState.permissions).forEach(type => {
                        appState.permissions[type] = appState.permissions[type].filter(m => !inactiveModules.includes(m));
                    });
                }
            } catch (err) {
                console.warn("No se pudo cargar la configuración de módulos por negocio.");
            }
        }

        // 3. Si es VENDEDOR, cargar permisos específicos del negocio activo
        if (user && user.rol === 'vendedor' && appState.negocioActivoId) {
            try {
                const vendedorPerms = await fetchData(`/api/negocios/${appState.negocioActivoId}/permisos-rol/vendedor`);
                if (vendedorPerms) {
                    const tipoActual = appState.negocioActivoTipo || 'distribuidora';
                    // Fusionamos con los permisos específicos (asegurando que el home esté siempre)
                    const modules = new Set(vendedorPerms || []);

                    // Asegurar Homes base (Red de seguridad)
                    modules.add('home_retail');
                    modules.add('home_consorcio');
                    modules.add('home_distribuidora');
                    modules.add('rentals_dashboard');

                    appState.permissions[tipoActual] = Array.from(modules);
                    console.log(`🔐 Permisos dinámicos aplicados para Vendedor en negocio ${appState.negocioActivoId}`);
                }
            } catch (err) {
                console.warn("No se pudieron cargar permisos específicos de vendedor, usando defaults.");
            }
        }
    } catch (error) {
        console.error("Error cargando permisos:", error);
        // Fallback de emergencia
        appState.permissions = {
            'retail': ['home_retail', 'ventas', 'dashboard'],
            'distribuidora': ['home_distribuidora', 'vendedores', 'hoja_ruta', 'pedidos', 'mapa_clientes', 'ventas', 'clientes', 'presupuestos', 'caja', 'inventario', 'proveedores', 'gastos', 'ingresos', 'unidades_medida', 'historial_inventario', 'historial_presupuestos', 'historial_ajustes', 'historial_pagos_proveedores', 'historial_ingresos']
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
            // ✅ USUARIO LOGUEADO: Limpiar estado de login
            document.body.classList.remove('login-page');
            document.body.style.overflow = 'auto'; // Restaurar scroll
            
            appState.userRol = user.rol;
            
            if (header) header.style.display = 'flex';
            if (mainNav) mainNav.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';

            const newAuthLink = authLink.cloneNode(true);
            newAuthLink.textContent = `Salir (${user.nombre})`;
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            newAuthLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });

            // ✨ CARGAR NEGOCIOS PRIMERO (Para tener el ID activo)
            await poblarSelectorNegocios();

            // ✨ VERIFICAR ESTADO DE CAJA (CRÍTICO PARA VALIDACIONES)
            await checkGlobalCashRegisterState();

            // ✨ LUEGO CARGAR PERMISOS (Que depende del ID activo)
            await fetchAppPermissions();

            // ✨ CONFIGURAR TIMER DE INACTIVIDAD
            const { setupInactivityTimer } = await import(`./modules/auth.js${v}`);
            setupInactivityTimer();

            // ✨ LIMPIEZA PREVENTIVA: Si estamos logueados, el login-page-wrapper DEBE morir.
            const contentArea = document.getElementById('content-area');
            if (contentArea && contentArea.querySelector('.login-page-wrapper')) {
                contentArea.innerHTML = '';
            }

            actualizarUIporTipoApp();
            actualizarVisibilidadMenu(); // ✨ Filtrar navbar según permisos

            // ✨ BLOQUEO POR MORA
            if (appState.subscriptionStatus === 'blocked' && appState.userRol !== 'superadmin') {
                return; // La función aplicarBloqueoPorMora ya se encargó de dibujar la pantalla
            }

            const requestedPage = window.location.hash.substring(1).split('?')[0];

            // Lógica de Home Dinámico
            let defaultHomePage = 'home_retail';
            if (appState.negocioActivoTipo === 'consorcio') defaultHomePage = 'home_consorcio';
            if (appState.negocioActivoTipo === 'rentals') defaultHomePage = 'rentals_dashboard';
            if (appState.negocioActivoTipo === 'distribuidora') defaultHomePage = 'home_distribuidora';
            if (appState.negocioActivoTipo === 'resto') defaultHomePage = 'home_resto';

            // ✨ LÓGICA CHOFER
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

            // ✨ REDIRECCIÓN FORZADA: Si está en una home de otro tipo de negocio, mandarlo a la suya
            const esCualquierHome = (pageToLoad === 'home_retail' || pageToLoad === 'home_consorcio' || pageToLoad === 'home_distribuidora' || pageToLoad === 'rentals_dashboard' || pageToLoad === 'home_chofer' || pageToLoad === 'home_resto');
            if (esCualquierHome && pageToLoad !== defaultHomePage) {
                console.warn(`Redirigiendo de ${pageToLoad} a ${defaultHomePage} por inconsistencia de tipo de negocio o rol.`);
                pageToLoad = defaultHomePage;
            }

            // VALIDACIÓN DE SEGURIDAD CON PERMISOS DINÁMICOS
            const tipoAppActual = appState.negocioActivoTipo;
            if (tipoAppActual && pageToLoad !== 'login' && pageToLoad !== 'admin_apps' && appState.userRol !== 'chofer') {
                const rutasPermitidas = appState.permissions[tipoAppActual] || [];
                const rutasComunes = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios']; // Fallback comun

                // Si es superadmin, acceso total a admin_apps, pero validamos módulos de negocio igual
                if (!rutasPermitidas.includes(pageToLoad) && !rutasComunes.includes(pageToLoad)) {
                    // Check especial para admin_apps ya manejado arriba
                    console.warn(`Acceso no autorizado: Usuario '${tipoAppActual}' intentó cargar '${pageToLoad}'.`);
                    // NO forzamos redirección a home aquí para evitar bucles si la home también está bloqueada.
                    // Dejamos que loadContent maneje el error y muestre la pantalla de "Acceso Denegado".
                    // pageToLoad = defaultHomePage; 
                }
            }

            if (requestedPage !== pageToLoad) {
                window.location.hash = pageToLoad;
                // ✨ FIX: Si el hash ya cambió pero popstate está bloqueado por estaActualizandoAuth,
                // forzamos la carga manual aquí para que el login desaparezca.
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
            
            // 🔒 SEGURIDAD: SI ESTAMOS EN EL LOGIN, CERRAR SESIÓN SIEMPRE
            if (window.location.hash === '#login' || window.location.hash === '') {
                // No llamamos a logout() recursivamente para evitar bucles si logout redirige a #login
                // Solo limpiamos el token si existe.
                if (localStorage.getItem('jwt_token')) {
                    console.warn("Sesión activa detectada en página de login. Limpiando para seguridad.");
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
            // Usamos un pequeño timeout para dar tiempo al navegador a procesar el cambio de hash
            setTimeout(() => {
                // Pasamos true en el 4to argumento para forzar la carga del HTML
                // aunque el hash ya sea #login
                // ✨ CACHE BUSTER RENAMED: Agregamos timestamp para asegurar que cargue la versión sin el link inseguro
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

// --- INICIALIZADOR DE MÓDULOS ---
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
            case 'home_retail':
            case 'home_resto':
            case 'home_consorcio':
            case 'home_distribuidora':
            case 'rentals_dashboard':
                // Dashboards estáticos, el filtrado de tarjetas se maneja en loadContent
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

            case 'bancos':
                const { Bancos } = await import(`./modules/bancos.js${v}`);
                Bancos.init(appState.negocioActivoId, localStorage.getItem('token'));
                break;

            default:
                console.warn(`No se encontró lógica de inicialización para: ${pageName}`);
        }
    } catch (error) {
        console.error(`Error módulo ${pageName}:`, error);
        mostrarNotificacion(`Error al cargar ${pageName}.`, 'error');
    }
}

/* --- LOOP PROTECTION SYSTEM --- */
const LOOP_LIMIT = 5; // Máximo de navegaciones permitidas
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
        console.error("🔥 BUCLE DETECTADO. DETENIENDO EJECUCIÓN 🔥");
        document.body.innerHTML = `
            <div style="padding:50px; text-align:center; color:#721c24; background:#f8d7da; font-family:sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <h1 style="font-size: 3rem;">⚠️ SISTEMA DETENIDO ⚠️</h1>
                <h3 style="margin-bottom: 2rem;">Se ha detectado un bucle infinito de redirecciones.</h3>
                <button onclick="sessionStorage.clear(); window.location.href='/#login'; window.location.reload();" 
                        style="padding:15px 30px; font-size:18px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ♻️ REINICIAR SISTEMA (Borrar Caché)
                </button>
            </div>
        `;
        throw new Error("Loop Protection Triggered: Execution Halted.");
    }
}

// --- loadContent ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    checkLoopProtection(); // <--- PROTECCIÓN ACTIVADA

    if (event) event.preventDefault();

    const pageParts = page.split('?');
    const pagePath = pageParts[0];
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : '';
    const pageName = pagePath.split('/').pop().replace('.html', '');

    // --- 🛡️ RESUCITACIÓN (RED DE SEGURIDAD SECUNDARIA) ---
    if (!appState.negocioActivoTipo) {
        const tipoGuardado = localStorage.getItem('negocioActivoTipo');
        const idGuardado = localStorage.getItem('negocioActivoId');
        if (tipoGuardado && tipoGuardado !== 'null' && tipoGuardado !== 'undefined') {
            appState.negocioActivoTipo = tipoGuardado;
            appState.negocioActivoId = idGuardado;
        }
    }

    const tipoAppActual = appState.negocioActivoTipo;

    // (DEBUG ALERT QUITADO PARA PRODUCCIÓN)

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

        if (isChoferRouteBlocked || (appState.userRol !== 'chofer' && !rutasPermitidas.includes(pageName) && !rutasComunes.includes(pageName) && !esHomeDelNegocio)) {
            console.warn(`ACCESO DENEGADO: ${tipoAppActual} -> ${pageName}.`);

            // Renderizar Pantalla de Error Estática (Detiene el bucle/parpadeo)
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                const defaultHome = (tipoAppActual === 'consorcio' ? 'home_consorcio' :
                    tipoAppActual === 'rentals' ? 'rentals_dashboard' :
                        tipoAppActual === 'distribuidora' ? 'home_distribuidora' : 
                            tipoAppActual === 'resto' ? 'home_resto' : 'home_retail');

                contentArea.innerHTML = `
                    <div class="container text-center" style="margin-top: 50px;">
                        <h1 class="text-danger">🚫 Acceso Denegado</h1>
                        <p class="lead">No tienes permisos para acceder al módulo <strong>${pageName}</strong>.</p>
                        <div class="alert alert-warning">
                            Tu tipo de negocio es detectado como: <strong>${tipoAppActual}</strong>
                        </div>
                        <hr>
                        <div class="text-start mx-auto" style="max-width: 600px; background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace;">
                            <strong>Debug Info:</strong><br>
                            - Rol: ${appState.userRol}<br>
                            - Permisos para '${tipoAppActual}': ${(appState.permissions[tipoAppActual] || []).join(', ')}
                        </div>
                        <br><br>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn btn-primary" onclick="window.location.hash='#${defaultHome}'; window.location.reload();">🏠 Volver al Inicio</button>
                            <button class="btn btn-secondary" onclick="window.location.reload()">🔄 Reintentar</button>
                            <button class="btn btn-danger" onclick="logout()">🔒 Cerrar Sesión</button>
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
                if (pageName === 'home_retail' || pageName === 'home_consorcio') {
                    throw new Error(`Error 404: Archivo ${pageName} no existe.`);
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

                    // ✨ FILTRAR TARJETAS EN DASHBOARDS (Si aplica)
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
                console.error("Fallo crítico en página de inicio. Deteniendo para evitar bucle.");
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
 * ✨ LÓGICA DE MODAL DE NUEVO CLIENTE "AL VUELO"
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
                <h3 style="margin-bottom: 20px;">👤 Registro Rápido de Cliente</h3>
                <form id="form-cliente-quick">
                    <div class="form-group">
                        <label>Nombre Completo:</label>
                        <input type="text" id="quick-cliente-nombre" required placeholder="Ej. Juan Pérez">
                    </div>
                    <div class="form-group">
                        <label>DNI / CUIT:</label>
                        <input type="text" id="quick-cliente-dni" placeholder="Sin puntos ni guiones">
                    </div>
                    <div class="form-group">
                        <label>Teléfono:</label>
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
            mostrarNotificacion('Cliente creado con éxito', 'success');
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

            // Re-fetch permisos si es un rol con permisos dinámicos (Vendedor)
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
    if (estaActualizandoAuth) return; // ✨ No navegar si estamos re-autenticando
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

// --- 🛡️🛡️ RESTAURACIÓN DE SESIÓN GLOBAL (AQUÍ ES DONDE SUCEDE LA MAGIA) 🛡️🛡️ ---
// Esta función se ejecuta YA, antes de que nada más pase.
const restaurarSesionGlobal = () => {
    const tipo = localStorage.getItem('negocioActivoTipo');
    const id = localStorage.getItem('negocioActivoId');

    if (tipo && tipo !== 'null' && tipo !== 'undefined') {
        console.log(`♻️ [Global] Restaurando sesión al inicio: ${tipo}`);
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
            // ✨ Escuchar si hay una actualización de SW
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nuevo SW instalado y listo. Recargar.
                        console.log("🚀 Nueva versión detectada. Recargando...");
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