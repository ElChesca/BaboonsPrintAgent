// app/static/js/main.js
// ✨ ARCHIVO COMPLETO (Versión 1.2.2 - CON RESTAURACIÓN DE SESIÓN) ✨

// --- 1. CONFIGURACIÓN CENTRAL DE VERSIÓN ---
const APP_VERSION = "1.2.5"; // Actualizado para forzar recarga
const v = `?v=${APP_VERSION}`;

// --- AUTO-LIMPIEZA DE CACHÉ LOCAL ---
window.chequearVersionApp = () => {
    const versionGuardada = localStorage.getItem('app_version');
    
    // Si la versión del código es nueva
    if (versionGuardada !== APP_VERSION) {
        console.warn(`Nueva versión (${APP_VERSION}). Limpiando caché local crítica...`);
        localStorage.setItem('app_version', APP_VERSION);
        
        // Forzamos recarga si ya había entrado antes
        if (versionGuardada) {
            window.location.reload(true);
        }
    }
};

chequearVersionApp();

// --- 2. IMPORTACIONES ESTÁTICAS ---
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';
import { fetchData, sendData } from './api.js';
import { getCurrentUser, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';

// --- 3. FUNCIONES GLOBALES (para onclick) ---
import { borrarProveedor } from './modules/proveedores.js';
import { abrirModalEditarUsuario } from './modules/users.js';
import { mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { mostrarDetallesCaja } from './modules/reporte_caja.js';

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProveedor = borrarProveedor;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
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
    filtroProveedorId: null
};

// --- MAPA DE RUTAS (SEGURIDAD CAPA 1) ---
const APP_RUTAS = {
    'retail': [
        'home_retail', 'ventas', 'historial_ventas', 'historial_presupuestos',
        'reportes', 'reporte_caja', 'reporte_ganancias', 'historial_inventario',
        'inventario', 'clientes', 'dashboard', 'caja', 'factura', 'verificador',
        'historial_ingresos', 'ingresos', 'historial_ajustes', 'ajuste_caja',
        'presupuestos', 'inventario_movil', 'proveedores', 'payments', 
        'historial_pagos_proveedores', 'listas_precios', 'precios_especificos',
        'gastos', 'gastos_categorias', 'categorias', 'unidades_medida','club_puntos',
        'club_gestion','club_admin', 'crm_social'
    ],
    'consorcio': [
        'home_consorcio', 'reclamos', 'expensas', 'unidades', 'noticias'
    ],
    'comun': [
        'configuracion', 'usuarios', 'negocios'
    ]
};

// --- NUEVA FUNCIÓN UI ---
function actualizarUIporTipoApp() {
    const tipoApp = appState.negocioActivoTipo || 'retail';
    // console.log(`Actualizando UI para tipo de app: ${tipoApp}`);
    document.body.classList.remove('app-retail', 'app-consorcio');
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
        link.href = `static/css/${pageName}.css?v=${APP_VERSION}`; // Corrección aquí

        document.head.appendChild(link);
        link.onerror = () => {
             // console.warn(`Advertencia: No se encontró CSS opcional en ${link.href}`);
             link.remove();
        };
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
        } else {
            localStorage.removeItem('negocioActivoId');
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
                }
                selector.disabled = false;
            }
        });
        
    } catch (error) {
        console.error("Error en poblarSelectorNegocios:", error);
        mostrarNotificacion("Error al cargar negocios.", "error");
    }
}

// --- actualizarUIAutenticacion ---
export async function actualizarUIAutenticacion() {
    showGlobalLoader();
    try {
        document.body.className = '';
        const user = getCurrentUser();
        const mainNav = document.querySelector('#main-nav');
        const authLink = document.getElementById('auth-link');
        const businessSelectorBar = document.getElementById('business-selector-bar');
        const header = document.querySelector('header');

        if (!mainNav || !authLink || !businessSelectorBar || !header) {
            return;
        }

        if (user && user.nombre && user.rol) {
            appState.userRol = user.rol;
            
            header.style.display = 'flex';
            mainNav.style.display = 'flex';
            businessSelectorBar.style.display = 'flex';
            
            const newAuthLink = authLink.cloneNode(true);
            newAuthLink.textContent = `Salir (${user.nombre})`;
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            newAuthLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });
            
            await poblarSelectorNegocios(); 
            actualizarUIporTipoApp(); 
            
            const requestedPage = window.location.hash.substring(1).split('?')[0];
            
            // Lógica de Home Dinámico
            const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            let pageToLoad = (requestedPage && requestedPage !== 'login') ? requestedPage : defaultHomePage;
            
            if (pageToLoad === 'home' || pageToLoad === '') {
                pageToLoad = defaultHomePage;
            }
                
            // VALIDACIÓN DE SEGURIDAD
            const tipoAppActual = appState.negocioActivoTipo;
            if (tipoAppActual && pageToLoad !== 'login') {
                const rutasPermitidas = APP_RUTAS[tipoAppActual] || [];
                const rutasComunes = APP_RUTAS['comun'] || [];

                if (!rutasPermitidas.includes(pageToLoad) && !rutasComunes.includes(pageToLoad)) {
                    console.warn(`Redirección: Usuario '${tipoAppActual}' intentó cargar '${pageToLoad}'. Forzando home.`);
                    pageToLoad = defaultHomePage;
                }
            }
            
            if (requestedPage !== pageToLoad) {
                window.location.hash = pageToLoad;
            }

            const fullHash = window.location.hash.substring(1);
            const pageUrlToLoad = `static/${pageToLoad}.html${fullHash.includes('?') ? '?' + fullHash.split('?')[1] : ''}`;
            
            await loadContent(null, pageUrlToLoad);

        } else {
            appState.userRol = null;
            appState.negocioActivoId = null;
            appState.negocioActivoTipo = null;
            
            // 2. Ocultar Header inmediatamente
            if (header) header.style.display = 'none';

            // 3. LIMPIEZA VISUAL FORZADA (Esto arregla que se queden los iconos)
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.innerHTML = ''; // <--- BORRAMOS TODO EL HTML VIEJO AL INSTANTE
            }

            // 4. Forzamos la carga del Login limpio
            // Usamos un pequeño timeout para dar tiempo al navegador a procesar el cambio de hash
            setTimeout(() => {
                loadContent(null, 'static/login.html')
                    .catch(err => console.error("Error cargando login:", err));
            }, 50);    
        }
    } catch (error) {
        console.error("Fallo Auth UI:", error);
        logout();
    } finally {
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
        switch(pageName) {
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
                inicializarLogicaHistorialAjustes(); 
                break;
            case 'ajuste_caja': 
                const { inicializarLogicaAjusteCaja } = await import(`./modules/ajuste_caja.js${v}`);
                inicializarLogicaAjusteCaja(); 
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
            case 'home_retail':
                await poblarSelectorNegocios();
                break;
            case 'home_consorcio':
                const { inicializarLogicaHomeConsorcio } = await import(`./modules/home_consorcio.js${v}`);              
                inicializarLogicaHomeConsorcio();                
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

            default:
                console.warn(`No se encontró lógica de inicialización para: ${pageName}`);
        }
    } catch (error) {
        console.error(`Error módulo ${pageName}:`, error);
        mostrarNotificacion(`Error al cargar ${pageName}.`, 'error');
    }
}

// --- loadContent ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    if (event) event.preventDefault();

    const pageParts = page.split('?');
    const pagePath = pageParts[0];
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : '';
    const pageName = pagePath.split('/').pop().replace('.html', '');
    
    // --- 🛡️ RESUCITACIÓN (RED DE SEGURIDAD SECUNDARIA) ---
    if (!appState.negocioActivoTipo) {
        const tipoGuardado = localStorage.getItem('tipo_negocio_activo'); 
        const idGuardado = localStorage.getItem('negocio_activo_id');
        if (tipoGuardado && tipoGuardado !== 'null' && tipoGuardado !== 'undefined') {
            appState.negocioActivoTipo = tipoGuardado;
            appState.negocioActivoId = idGuardado;
        }
    }

    const tipoAppActual = appState.negocioActivoTipo;
    
    // (DEBUG ALERT QUITADO PARA PRODUCCIÓN)

    if (tipoAppActual && pageName !== 'login') {
        const rutasPermitidas = APP_RUTAS[tipoAppActual] || [];
        const rutasComunes = APP_RUTAS['comun'] || [];

        if (!rutasPermitidas.includes(pageName) && !rutasComunes.includes(pageName)) {
            console.warn(`ACCESO DENEGADO: ${tipoAppActual} -> ${pageName}.`);
            mostrarNotificacion('Módulo no disponible para este tipo de negocio.', 'warning');
            const homePage = (tipoAppActual === 'consorcio') ? 'home_consorcio' : 'home_retail';
            window.location.replace(`#${homePage}`);
            loadContent(null, `static/${homePage}.html`, null, true);
            return;
        }
    }

    const targetHash = `#${pageName}`;
    const fullTargetHash = targetHash + queryString;
    const baseUrl = window.location.origin + window.location.pathname;
    const targetUrlBase = baseUrl + targetHash;
    const currentUrlBase = baseUrl + window.location.hash.split('?')[0];

    if (!fromHistory && currentUrlBase === targetUrlBase) {
        if(window.location.hash !== fullTargetHash) {
             history.pushState({ page: page }, '', fullTargetHash);
        }
        const navContainer = document.querySelector('.nav-container');
        if (navContainer && navContainer.classList.contains('is-active')) {
             navContainer.classList.remove('is-active');
        }
        return;
    }

    if (!fromHistory) {
        history.pushState({ page: page }, '', fullTargetHash);
    }

    loadPageCSS(pageName); 

    const header = document.querySelector('header');
    const isLoginPage = pageName === 'login';
    if (header) header.style.display = isLoginPage ? 'none' : 'flex';

    let pageToFetch = `${pagePath}?v=${APP_VERSION}`;
    if (pageName === 'crm_social') {
        pageToFetch = `static/crm_social/crm_social.html?v=${APP_VERSION}`;
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
            mostrarNotificacion(`Error al cargar ${pageName}.`, 'error');
            const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            window.location.hash = `#${defaultHomePage}`;
            loadPageCSS(null);
        });

     const navContainer = document.querySelector('.nav-container');
     if (window.innerWidth <= 900 && navContainer && navContainer.classList.contains('is-active')) {
         navContainer.classList.remove('is-active');
     }
}

export function abrirModalNuevoCliente(callback) { /* ... */ }

// --- TIMEOUT ---
const TIMEOUT_INACTIVIDAD = 15 * 60 * 1000;
let temporizadorInactividad;
function reiniciarTemporizador() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(() => {
        const user = getCurrentUser();
        if (user && !window.location.hash.includes('login')) {
            mostrarNotificacion("Sesión cerrada por inactividad.", "warning");
            logout(); 
        }
    }, TIMEOUT_INACTIVIDAD);
}
window.addEventListener('mousemove', reiniciarTemporizador);
window.addEventListener('keydown', reiniciarTemporizador);
window.addEventListener('click', reiniciarTemporizador);
window.addEventListener('touchstart', reiniciarTemporizador);

// --- LISTENERS FINALES ---
console.log("DOM Cargado. Configurando listeners iniciales...");
reiniciarTemporizador();

document.body.addEventListener('change', (e) => {
    if (e.target.id === 'selector-negocio') {
        const nuevoNegocioId = e.target.value;
        if (nuevoNegocioId) {
            appState.negocioActivoId = nuevoNegocioId;
            localStorage.setItem('negocioActivoId', nuevoNegocioId);
            const negocioSeleccionado = appState.negociosCache.find(n => String(n.id) === nuevoNegocioId);
            appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';
            actualizarUIporTipoApp();
            const homePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            loadContent(null, `static/${homePage}.html`);
        }
    }
});

window.addEventListener('popstate', (e) => {
    const currentHashPageName = window.location.hash.substring(1).split('?')[0];
    const pageFromState = e.state?.page;
    const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
    const defaultHomeHtml = `static/${defaultHomePage}.html`;

    if (pageFromState) {
        loadContent(null, pageFromState, null, true);
    } else if (!window.location.hash || currentHashPageName === 'home') {
        loadContent(null, defaultHomeHtml, null, true);
    } else if (currentHashPageName && currentHashPageName !== 'login'){
        const fullHash = window.location.hash.substring(1);
        const pageUrl = `static/${fullHash.split('?')[0]}.html${fullHash.includes('?') ? '?' + fullHash.split('?')[1] : ''}`;
        loadContent(null, pageUrl, null, true);
    }
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
    const tipo = localStorage.getItem('tipo_negocio_activo');
    const id = localStorage.getItem('negocio_activo_id');

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
        navigator.serviceWorker.register(`/service-worker.js${v}`).catch(() => {});
    });
}