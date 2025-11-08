// app/static/js/main.js
// ✨ ARCHIVO COMPLETO Y CORREGIDO (Versión 1.1.0) ✨

// --- 1. CONFIGURACIÓN CENTRAL DE VERSIÓN ---
const APP_VERSION = "1.1.1";
const v = `?v=${APP_VERSION}`;

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

// --- appState MODIFICADO ---
export const appState = {
    negocioActivoId: null,
    negocioActivoTipo: null, // 'retail' o 'consorcio'
    negociosCache: [],      // Guardamos la lista completa de negocios
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
        'gastos', 'gastos_categorias', 'categorias', 'unidades_medida'
    ],
    'consorcio': [
        'home_consorcio', 
        'reclamos', 
        'expensas', 
        'unidades',
        'noticias'
    ],
    'comun': [
        'configuracion',
        'usuarios',
        'negocios'
    ]
};

// --- NUEVA FUNCIÓN ---
function actualizarUIporTipoApp() {
    const tipoApp = appState.negocioActivoTipo || 'retail';
    console.log(`Actualizando UI para tipo de app: ${tipoApp}`);
    
    document.body.classList.remove('app-retail', 'app-consorcio');
    // Añade la clase rol (como antes) y la clase app
    document.body.classList.add(`rol-${appState.userRol}`, `app-${tipoApp}`);
}

function loadPageCSS(pageName) {
    const existingStyle = document.getElementById('page-specific-style');
    if (existingStyle) existingStyle.remove();
    if (pageName) {
        const cssFile = `${pageName}.css${v}`;
        const link = document.createElement('link');
        link.id = 'page-specific-style';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `/static/css/${cssFile}`; 
        document.head.appendChild(link);
        link.onerror = () => {
             console.warn(`Advertencia: No se encontró CSS opcional en ${link.href}`);
             link.remove();
        };
    }
}

// --- poblarSelectorNegocios MODIFICADO ---
async function poblarSelectorNegocios() {
    console.log("Iniciando poblarSelectorNegocios...");
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
        console.log("Negocios recibidos del API:", negocios);

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
        
        console.log(`Negocio seleccionado: ${appState.negocioActivoId}, Tipo: ${appState.negocioActivoTipo}`);

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
        selectors.forEach(selector => {
            selector.innerHTML = '<option value="">Error</option>';
            selector.disabled = true;
        });
    }
}

// --- actualizarUIAutenticacion MODIFICADO ---
export async function actualizarUIAutenticacion() {
    showGlobalLoader();
    console.log("--- Iniciando actualizarUIAutenticacion ---");
    try {
        document.body.className = '';
        const user = getCurrentUser();
        console.log("Usuario actual (desde token):", user);
        const mainNav = document.querySelector('#main-nav');
        const authLink = document.getElementById('auth-link');
        const businessSelectorBar = document.getElementById('business-selector-bar');
        const header = document.querySelector('header');

        if (!mainNav || !authLink || !businessSelectorBar || !header) {
            console.error("Error crítico: Faltan elementos base de la UI.");
            return;
        }

        if (user && user.nombre && user.rol) {
            console.log("Usuario válido. Actualizando UI...");
            appState.userRol = user.rol;
            
            header.style.display = 'flex';
            mainNav.style.display = 'flex';
            businessSelectorBar.style.display = 'flex';
            authLink.textContent = `Salir (${user.nombre})`;
            const newAuthLink = authLink.cloneNode(true);
            newAuthLink.textContent = `Salir (${user.nombre})`;
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            newAuthLink.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
            
            await poblarSelectorNegocios(); // Setea ID y TIPO
            
            actualizarUIporTipoApp(); // Setea clases del <body>
            
            console.log("Selectores de negocio poblados y UI de app actualizada.");
            
            const requestedPage = window.location.hash.substring(1).split('?')[0];
            const contentArea = document.getElementById('content-area');

            if (!contentArea) {
                console.error("Error crítico: No se encontró #content-area.");
                return;
            }

            // ✨ LÓGICA DE HOME CORREGIDA (la que ya tenías)
            const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            let pageToLoad = requestedPage && requestedPage !== 'login' ? requestedPage : defaultHomePage;

            // SI LA PÁGINA SOLICITADA ES EL 'home' VIEJO O VACÍO, forzar al home por defecto
            if (pageToLoad === 'home' || pageToLoad === '') {
                pageToLoad = defaultHomePage;
            }

            console.log(`Página a cargar (después de validación de home): ${pageToLoad}`);

            const fullHash = window.location.hash.substring(1);
            const defaultHomeHtml = `${defaultHomePage}.html`;
            
            const pageUrlToLoad = `static/${pageToLoad}.html${fullHash.includes('?') ? '?' + fullHash.split('?')[1] : ''}`;
            
            console.log(`URL completa a cargar (corregida): ${pageUrlToLoad}`);
            
            if (pageToLoad === defaultHomePage && requestedPage !== defaultHomePage) {
                window.location.hash = pageToLoad;
            }
            
            await loadContent(null, pageUrlToLoad); // loadContent ahora validará la ruta

        } else {
            console.log("Usuario NO válido o no encontrado. Preparando UI para login...");
            appState.userRol = null;
            appState.negocioActivoId = null;
            appState.negocioActivoTipo = null;
            localStorage.removeItem('negocioActivoId');
            header.style.display = 'none';

            if (!window.location.hash.includes('login')) {
                await loadContent(null, 'static/login.html');
            } else {
                const pageUrl = `static/login.html${window.location.hash.split('?')[1] ? '?' + window.location.hash.split('?')[1] : ''}`;
                await inicializarModulo(pageUrl);
            }
        }
    } catch (error) {
        console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion:", error);
        logout();
    } finally {
        console.log("--- Fin actualizarUIAutenticacion (finally) ---");
        hideGlobalLoader();
    }
}

// ✨ --- INICIALIZADOR DE MÓDULOS MODIFICADO --- ✨
async function inicializarModulo(page) {
    console.log(`inicializarModulo llamada con page = "${page}"`);
    if (!page) {
        console.warn("inicializarModulo llamado sin página.");
        return;
    }

    const pageName = page.split('/').pop().replace('.html', '').split('?')[0];
    console.log(`Inicializando módulo: ${pageName}`);

    if (window.currentChartInstance) {
        window.currentChartInstance.destroy();
        window.currentChartInstance = null;
    }

    try {
        switch(pageName) {
            case 'inventario': 
                const { 
                    inicializarLogicaInventario, 
                    abrirModalEditarProducto, 
                    borrarProducto, 
                    changeProductPage 
                } = await import(`./modules/inventory.js${v}`);
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

            // ✨ CORRECCIÓN: 'home' ELIMINADO
            
            // ✨ CASOS DE HOME ACTUALIZADOS
            case 'home_retail':
                console.log("Módulo Home (Retail) detectado.");
                await poblarSelectorNegocios();
                break;
            
           case 'home_consorcio':
                // 1. Importamos la lógica del nuevo portal
                const { inicializarLogicaHomeConsorcio } = await import(`./modules/home_consorcio.js${v}`);              
                // 2. Ejecutamos el inicializador
                inicializarLogicaHomeConsorcio();                
                // (Ya no necesitamos poblarSelectorNegocios aquí,
                //  porque la lógica de inicialización lo hará)
                break;            
            
            // ✨ CASOS DE CONSORCIO (NUEVOS)
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
                // 1. Importamos las funciones necesarias
                const { 
                    inicializarLogicaExpensas,
                    verDetallePeriodo,
                    volverALista,
                    emitirPeriodo,
                    abrirModalPago,
                    anularExpensa
                } = await import(`./modules/expensas.js${v}`);                
                // 2. Exponemos las funciones 'onclick' al window
                window.verDetallePeriodo = verDetallePeriodo;
                window.volverALista = volverALista;
                window.emitirPeriodo = emitirPeriodo;
                window.abrirModalPago = abrirModalPago;  
                window.anularExpensa = anularExpensa;              
                // 3. Ejecutamos el inicializador
                inicializarLogicaExpensas();
                break;

            default:
                console.warn(`No se encontró lógica de inicialización para el módulo: ${pageName}`);
        }
        console.log(`Módulo ${pageName} inicializado.`);
    } catch (error) {
        console.error(`Error al cargar dinámicamente el módulo ${pageName}:`, error);
        mostrarNotificacion(`Error fatal al cargar la sección ${pageName}.`, 'error');
    }
}

// --- loadContent MODIFICADO (CON SEGURIDAD CAPA 1) ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    console.log(`loadContent llamado para: ${page}, desde historial: ${fromHistory}`);
    if (event) event.preventDefault();

    const pageParts = page.split('?');
    const pagePath = pageParts[0];
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : '';
    const pageName = pagePath.split('/').pop().replace('.html', '');
    
    // VALIDACIÓN (CAPA 1)
    const tipoAppActual = appState.negocioActivoTipo;
    
    if (tipoAppActual && pageName !== 'login') {
        const rutasPermitidas = APP_RUTAS[tipoAppActual] || [];
        const rutasComunes = APP_RUTAS['comun'] || [];

        if (!rutasPermitidas.includes(pageName) && !rutasComunes.includes(pageName)) {
            console.warn(`ACCESO DENEGADO (Frontend): Usuario '${tipoAppActual}' intentó acceder a ruta '${pageName}'. Redirigiendo...`);
            mostrarNotificacion('Módulo no disponible para este tipo de negocio.', 'warning');
            
            const homePage = (tipoAppActual === 'consorcio') ? 'home_consorcio' : 'home_retail';
            
            window.location.replace(`#${homePage}`);
            
            // Forzamos la carga del home
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
        console.log(`Ya estamos en ${targetHash}, no se recarga HTML.`);
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

    const pageToFetch = `${pagePath}${v}`;

    fetch(pageToFetch)
        .then(response => {
            if (!response.ok) {
                // Si falla al cargar (ej. home_retail.html no existe)
                if (pageName === 'home_retail' || pageName === 'home_consorcio') {
                    throw new Error(`Error 404: El archivo ${pageName}.html no existe.`);
                }
                throw new Error(`Error ${response.status} al cargar ${pageToFetch}`);
            }
            return response.text();
        })
        .then(html => {
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.innerHTML = html;
                console.log(`HTML cargado para ${pageToFetch}. Llamando a inicializarModulo...`);
                requestAnimationFrame(() => {
                    // El código para marcar el link 'active' no cambia
                    document.querySelectorAll('#main-nav a, #main-nav .dropbtn').forEach(link => link.classList.remove('active'));
                    const linkSelectorOnClick = `#main-nav a[onclick*="'${pagePath}'"]`;
                    const linkSelectorHref = `#main-nav a[href$="${targetHash}"]`;
                    let linkToActivate = document.querySelector(linkSelectorOnClick) || document.querySelector(linkSelectorHref);

                    if (linkToActivate) {
                        linkToActivate.classList.add('active');
                         const parentDropdown = linkToActivate.closest('.dropdown');
                        if (parentDropdown) parentDropdown.querySelector('.dropbtn')?.classList.add('active');
                    } else {
                         console.warn(`No se encontró link activo para ${pageName} usando selectores: ${linkSelectorOnClick}, ${linkSelectorHref}`);
                    }
                    // ✨ --- ¡AQUÍ ESTÁ LA CORRECCIÓN! --- ✨
                    // Damos un "tick" (0ms) al navegador DESPUÉS del frame
                    // para asegurar que el HTML esté 100% "dibujado" en el DOM.
                    setTimeout(() => {
                        inicializarModulo(page).catch(err => {
                             console.error(`Error durante inicializarModulo para ${page}:`, err);
                             mostrarNotificacion(`Error al inicializar la sección ${pageName}.`, 'error');
                        });
                    }, 0); // Un retraso de 0ms es suficiente.
                });
            } else {
                console.error("Error crítico: No se encontró #content-area.");
            }
        })
        .catch(error => {
            console.error("Error en loadContent fetch:", error);
            mostrarNotificacion(`No se pudo cargar la página ${pageName}.`, 'error');
            
            const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            window.location.hash = `#${defaultHomePage}`;
            loadPageCSS(null);
        });

     const navContainer = document.querySelector('.nav-container');
     if (window.innerWidth <= 900 && navContainer && navContainer.classList.contains('is-active')) {
         navContainer.classList.remove('is-active');
     }
}

export function abrirModalNuevoCliente(callback) { /* ... (sin cambios) ... */ }

// --- 6. TEMPORIZADOR DE INACTIVIDAD ---
// ... (sin cambios)
const TIMEOUT_INACTIVIDAD = 15 * 60 * 1000;
let temporizadorInactividad;
function reiniciarTemporizador() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(() => {
        const user = getCurrentUser();
        if (user && !window.location.hash.includes('login')) {
            console.log("Inactividad detectada. Deslogueando...");
            mostrarNotificacion("Sesión cerrada por inactividad.", "warning");
            logout(); 
        }
    }, TIMEOUT_INACTIVIDAD);
}
window.addEventListener('mousemove', reiniciarTemporizador);
window.addEventListener('keydown', reiniciarTemporizador);
window.addEventListener('scroll', reiniciarTemporizador);
window.addEventListener('click', reiniciarTemporizador);
window.addEventListener('touchstart', reiniciarTemporizador);

// --- 7. LISTENERS GLOBALES ---
console.log("DOM Cargado. Configurando listeners iniciales...");

reiniciarTemporizador();

// ✨ LISTENER DE CAMBIO DE NEGOCIO (CORREGIDO)
document.body.addEventListener('change', (e) => {
    if (e.target.id === 'selector-negocio') {
        console.log("Cambio de negocio en selector principal.");
        const nuevoNegocioId = e.target.value;
        
        if (nuevoNegocioId) {
            appState.negocioActivoId = nuevoNegocioId;
            localStorage.setItem('negocioActivoId', nuevoNegocioId);
            
            const negocioSeleccionado = appState.negociosCache.find(n => String(n.id) === nuevoNegocioId);
            appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';
            
            console.log(`Negocio activo actualizado a: ${nuevoNegocioId}, Tipo: ${appState.negocioActivoTipo}`);
            
            actualizarUIporTipoApp(); // Actualiza menús
            
            // Carga el "home" de ESE tipo de negocio
            const homePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            loadContent(null, `static/${homePage}.html`);

        } else if (!nuevoNegocioId) {
            console.warn("Se seleccionó 'No asignados' o valor inválido.");
            const contentArea = document.getElementById('content-area');
            if(contentArea) contentArea.innerHTML = '<p style="text-align: center; margin-top: 50px;">Por favor, seleccione un negocio activo.</p>';
            appState.negocioActivoId = null;
            appState.negocioActivoTipo = null;
            localStorage.removeItem('negocioActivoId');
            actualizarUIporTipoApp();
        }
    }
});

// ✨ LISTENER DE 'POPSTATE' (CORREGIDO)
window.addEventListener('popstate', (e) => {
    console.log("Evento popstate detectado:", e.state);
    const currentHashPageName = window.location.hash.substring(1).split('?')[0];
    const pageFromState = e.state?.page;

    // Lógica de home por defecto (basada en el tipo de app)
    const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
    const defaultHomeHtml = `static/${defaultHomePage}.html`;

    if (pageFromState) {
        console.log(`Cargando página desde historial: ${pageFromState}`);
        loadContent(null, pageFromState, null, true);
    } else if (!window.location.hash || currentHashPageName === 'home' || currentHashPageName === 'home_retail' || currentHashPageName === 'home_consorcio') {
        console.log("URL base o #home detectada, cargando home por defecto.");
        loadContent(null, defaultHomeHtml, null, true); // <-- CORREGIDO
    } else if (currentHashPageName && currentHashPageName !== 'login'){
        console.log(`Hash ${currentHashPageName} sin estado detectado, cargando página.`);
        const fullHash = window.location.hash.substring(1);
        const pageUrl = `static/${fullHash.split('?')[0]}.html${fullHash.includes('?') ? '?' + fullHash.split('?')[1] : ''}`;
        loadContent(null, pageUrl, null, true);
    } else {
        console.log("Popstate sin estado relevante o ya en login.");
    }
});

window.addEventListener('authChange', () => {
    console.log("Evento authChange detectado. Ejecutando actualizarUIAutenticacion...");
    actualizarUIAutenticacion();
});

const hamburgerBtn = document.getElementById('hamburger-btn');
const navContainer = document.querySelector('.nav-container');
if (hamburgerBtn && navContainer) {
    hamburgerBtn.addEventListener('click', () => {
        navContainer.classList.toggle('is-active');
    });
} else {
    console.warn("Botón hamburguesa o contenedor de navegación no encontrados.");
}

console.log("Llamando a actualizarUIAutenticacion por primera vez...");
actualizarUIAutenticacion();

// --- 8. REGISTRO DEL SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`/service-worker.js${v}`) 
          .then((registration) => {
            console.log('¡Service Worker registrado con éxito! Alcance:', registration.scope);
          })
          .catch((error) => {
            console.error('Falló el registro del Service Worker:', error);
          });
    });
} else {
    console.warn("Service Workers no soportados en este navegador.");
}