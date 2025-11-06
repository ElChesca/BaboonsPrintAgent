// app/static/js/main.js
// ✨ ========================================================================
// ✨ 1. CONFIGURACIÓN CENTRAL DE VERSIÓN
// ✨ ========================================================================
const APP_VERSION = "1.0.9";
const v = `?v=${APP_VERSION}`;
// ==========================================================================

// --- ✨ 2. IMPORTACIONES ESTÁTICAS (Núcleo de la App) ---
// ✨ ¡CORREGIDO! Estos 'import' deben ser strings fijos, sin la variable '${v}'.
// ✨ El navegador maneja el cache-busting de estos módulos principales
// ✨ a través de la carga del propio main.js (que sí tiene el ?v=).
import { showGlobalLoader, hideGlobalLoader } from '/static/js/uiHelpers.js';
import { fetchData, sendData } from './api.js';
import { getCurrentUser, logout } from './modules/auth.js';
import { mostrarNotificacion } from './modules/notifications.js';


// --- ✨ 3. FUNCIONES GLOBALES (para onclick) ---
// ✨ ¡CORREGIDO! Estos también deben ser strings fijos.
import { borrarProveedor } from './modules/proveedores.js';
import { abrirModalEditarUsuario } from './modules/users.js';
import { mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { mostrarDetallesCaja } from './modules/reporte_caja.js';

// --- EXPOSICIÓN DE FUNCIONES GLOBALES (Sin cambios) ---
window.loadContent = loadContent; // Esencial
window.borrarProveedor = borrarProveedor;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
export function toggleMenu() {
    console.log("¡Clic en Menú Hamburguesa Detectado!"); 
    const navContainer = document.querySelector('.nav-container');
    if (navContainer) {
        navContainer.classList.toggle('is-active');
    } else {
        console.error("No se encontró '.nav-container' al hacer toggle.");
    }
}
window.toggleMenu = toggleMenu; // ✨ ¡LA EXPONEMOS!

let onClienteCreadoCallback = null;

export function esAdmin() {
    return appState.userRol === 'admin' || appState.userRol === 'superadmin';
}

export const appState = {
    negocioActivoId: null,
    negocioActivoTipo: null, // 'retail' o 'consorcio'
    userRol: null,
    filtroProveedorId: null
};
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
        // (Iremos añadiendo las nuevas páginas aquí)
    ],
    'comun': [
        'configuracion',
        'usuarios',
        'negocios' // (Solo superadmin, pero la ruta es común)
    ]
};
// ✨ --- NUEVA FUNCIÓN --- ✨
// Actualiza la UI (clases del body) según el tipo de app del negocio activo
function actualizarUIporTipoApp() {
    const tipoApp = appState.negocioActivoTipo || 'retail'; // Default a retail
    console.log(`Actualizando UI para tipo de app: ${tipoApp}`);
    
    document.body.classList.remove('app-retail', 'app-consorcio');
    document.body.classList.add(`app-${tipoApp}`);
}

function loadPageCSS(pageName) {
    const existingStyle = document.getElementById('page-specific-style');
    if (existingStyle) existingStyle.remove();
    if (pageName) {
        // ✨ El CSS sí es dinámico, por lo que SÍ usa 'v'
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
        // 1. Obtenemos negocios (ahora con {id, nombre, tipo_app})
        const negocios = await fetchData(`/api/negocios`);
        appState.negociosCache = negocios; // Guardamos en caché
        console.log("Negocios recibidos del API:", negocios);

        // 2. Lógica para ID seleccionado (sin cambios)
        let idSeleccionado = null;
        if (negocios && negocios.length > 0) {
            idSeleccionado = negocios[0].id;
            const savedNegocioId = localStorage.getItem('negocioActivoId');
            if (savedNegocioId && negocios.some(n => String(n.id) === String(savedNegocioId))) {
                idSeleccionado = savedNegocioId;
            }
        }
        appState.negocioActivoId = idSeleccionado ? String(idSeleccionado) : null;

        // 3. ✨ GUARDAMOS EL TIPO DE APP ACTIVO ✨
        const negocioSeleccionado = negocios.find(n => String(n.id) === appState.negocioActivoId);
        appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';
        
        console.log(`Negocio seleccionado: ${appState.negocioActivoId}, Tipo: ${appState.negocioActivoTipo}`);

        if (appState.negocioActivoId) {
            localStorage.setItem('negocioActivoId', appState.negocioActivoId);
        } else {
            localStorage.removeItem('negocioActivoId');
        }

        // 4. Poblamos los <select> (sin cambios)
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
                    // ... (lógica de fallback si no hay guardado)
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
            console.log("Rol asignado al estado:", appState.userRol);
            document.body.classList.add('rol-' + user.rol);
            console.log("Clase de rol añadida al body:", 'rol-' + user.rol);
            header.style.display = 'flex';
            mainNav.style.display = 'flex';
            businessSelectorBar.style.display = 'flex';
            authLink.textContent = `Salir (${user.nombre})`;
            const newAuthLink = authLink.cloneNode(true);
            newAuthLink.textContent = `Salir (${user.nombre})`;
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            newAuthLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("Logout iniciado por clic.");
                logout();
            });
            console.log("Configurado enlace 'Salir'.");
            await poblarSelectorNegocios();
            actualizarUIporTipoApp();
            console.log("Selectores de negocio poblados.");
            console.log("Actualización de UI base completada.");

            const requestedPage = window.location.hash.substring(1).split('?')[0];
            const contentArea = document.getElementById('content-area');

            if (!contentArea) {
                console.error("Error crítico: No se encontró #content-area.");
                return;
            }

           const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            let pageToLoad = requestedPage && requestedPage !== 'login' ? requestedPage : defaultHomePage;

            // SI LA PÁGINA SOLICITADA ES EL 'home' VIEJO O VACÍO, forzar al home por defecto
            if (pageToLoad === 'home' || pageToLoad === '') {
                pageToLoad = defaultHomePage;
            }
            console.log(`Página a cargar (después de validación de home): ${pageToLoad}`);

            const fullHash = window.location.hash.substring(1);
            const defaultHomeHtml = `${defaultHomePage}.html`;    

            const pageUrlToLoad = `static/${fullHash.split('?')[0] ? fullHash.split('?')[0] + '.html' : defaultHomeHtml}${fullHash.includes('?') ? '?' + fullHash.split('?')[1] : ''}`;            
            console.log(`URL completa a cargar: ${pageUrlToLoad}`);
            // SI cambiamos el home (ej. de #home a #home_consorcio), actualizamos el hash
            if (pageToLoad === defaultHomePage && requestedPage !== defaultHomePage) {
                window.location.hash = pageToLoad;
            }
            await loadContent(null, pageUrlToLoad);

        } else {
            console.log("Usuario NO válido o no encontrado. Preparando UI para login...");
            appState.userRol = null;
            appState.negocioActivoId = null;
            localStorage.removeItem('negocioActivoId');
            header.style.display = 'none';

            if (!window.location.hash.includes('login')) {
                console.log("No estamos en #login, cargando página de login...");
                await loadContent(null, 'static/login.html');
            } else {
                console.log("Ya estamos en #login.");
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

// ✨ ========================================================================
// ✨ 5. INICIALIZADOR DE MÓDULOS (Ahora Asíncrono y Dinámico)
// ✨ ========================================================================
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

    // ✨ Aquí SÍ usamos la variable 'v' con template literals (backticks `)
    // ✨ porque es un import() DINÁMICO.
    try {
        switch(pageName) {
            case 'inventario': 
                // 1. Importamos todo lo necesario del módulo
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
            
            case 'home_retail': // RENOMBRADO DE 'home'
                console.log("Módulo Home (Retail) detectado.");
                await poblarSelectorNegocios();
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
            case 'categorias':
                const { inicializarLogicaCategorias, editarCategoria, borrarCategoria } = await import(`./modules/categorias.js${v}`);
                // 2. ✨ AHORA las exponemos al 'window' (AQUÍ ESTÁ LA MAGIA)
                window.editarCategoria = editarCategoria;
                window.borrarCategoria = borrarCategoria;
                // 3. Finalmente, inicializamos la lógica
                inicializarLogicaCategorias();
                break;

            case 'unidades':
                // 1. Importamos las funciones necesarias
                const { 
                    inicializarLogicaUnidades, 
                    abrirModalUnidad, 
                    borrarUnidad 
                } = await import(`./modules/unidades.js${v}`);                
                // 2. Exponemos las funciones 'onclick' al window
                window.abrirModalUnidad = abrirModalUnidad;
                window.borrarUnidad = borrarUnidad;                
                // 3. Ejecutamos el inicializador
                inicializarLogicaUnidades();
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

// ✨ --- loadContent MODIFICADO (CON SEGURIDAD CAPA 1) --- ✨
export function loadContent(event, page, clickedLink, fromHistory = false) {
    console.log(`loadContent llamado para: ${page}, desde historial: ${fromHistory}`);
    if (event) event.preventDefault();

    const pageParts = page.split('?');
    const pagePath = pageParts[0];
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : '';
    
    // Obtenemos el nombre base de la página (ej: "inventario")
    const pageName = pagePath.split('/').pop().replace('.html', '');
    
    // ✨ --- INICIO DE LA VALIDACIÓN (CAPA 1) --- ✨
    const tipoAppActual = appState.negocioActivoTipo; // Ej: 'consorcio'
    
    // Si ya sabemos el tipo de app (no es el login)
    if (tipoAppActual && pageName !== 'login') {
        const rutasPermitidas = APP_RUTAS[tipoAppActual] || [];
        const rutasComunes = APP_RUTAS['comun'] || [];

        // Si la página NO está en las permitidas de esa app Y TAMPOCO en las comunes
        if (!rutasPermitidas.includes(pageName) && !rutasComunes.includes(pageName)) {
            
            console.warn(`ACCESO DENEGADO (Frontend): Usuario '${tipoAppActual}' intentó acceder a ruta '${pageName}'. Redirigiendo...`);
            mostrarNotificacion('Módulo no disponible para este tipo de negocio.', 'warning');
            
            // Lo mandamos a su página de inicio correspondiente
            const homePage = (tipoAppActual === 'consorcio') ? 'home_consorcio' : 'home_retail';
            
            // Usamos location.replace para no ensuciar el historial del navegador
            window.location.replace(`#${homePage}`);
            
            // Forzamos la carga del home
            loadContent(null, `static/${homePage}.html`, null, true);
            
            return; // Detenemos la ejecución
        }
    }
    // ✨ --- FIN DE LA VALIDACIÓN --- ✨

    const targetHash = `#${pageName}`;
    const fullTargetHash = targetHash + queryString;

    const baseUrl = window.location.origin + window.location.pathname;
    const targetUrlBase = baseUrl + targetHash;
    const currentUrlBase = baseUrl + window.location.hash.split('?')[0];

    // ... (resto de la lógica de 'no recargar si ya estamos' sin cambios) ...
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

                    inicializarModulo(page).catch(err => {
                         console.error(`Error durante inicializarModulo para ${page}:`, err);
                         mostrarNotificacion(`Error al inicializar la sección ${pageName}.`, 'error');
                    });
                });
            } else {
                console.error("Error crítico: No se encontró #content-area.");
            }
        })
        .catch(error => {
            console.error("Error en loadContent fetch:", error);
            mostrarNotificacion(`No se pudo cargar la página ${pageName}.`, 'error');
            // ✨ MODIFICADO: Redirige al home por defecto (que podría ser el de consorcio)
            const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            window.location.hash = `#${defaultHomePage}`;
            loadPageCSS(null);
        });

     const navContainer = document.querySelector('.nav-container');
     if (window.innerWidth <= 900 && navContainer && navContainer.classList.contains('is-active')) {
         navContainer.classList.remove('is-active');
     }
}

export function abrirModalNuevoCliente(callback) {
    const modal = document.getElementById('modal-nuevo-cliente');
    const form = document.getElementById('form-nuevo-cliente');
    if (modal) {
         onClienteCreadoCallback = callback;
         if (form) form.reset();
         modal.style.display = 'flex';
    } else {
         console.error("Modal #modal-nuevo-cliente no encontrado.");
    }
}


// ✨ ========================================================================
// ✨ 6. TEMPORIZADOR DE INACTIVIDAD
// ✨ ========================================================================
const TIMEOUT_INACTIVIDAD = 15 * 60 * 1000; // 15 minutos
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
// ==========================================================================

console.log("DOM Cargado. Configurando listeners iniciales...");

    // ✨ 7. INICIA EL TEMPORIZADOR POR PRIMERA VEZ
    reiniciarTemporizador();

document.body.addEventListener('change', (e) => {
         if (e.target.id === 'selector-negocio') {
             console.log("Cambio de negocio en selector principal.");
             const nuevoNegocioId = e.target.value;
             if (nuevoNegocioId) {
            appState.negocioActivoId = nuevoNegocioId;
            localStorage.setItem('negocioActivoId', nuevoNegocioId);
            
            // ✨ LÓGICA DE CAMBIO DE APP MODIFICADA ✨
            const negocioSeleccionado = appState.negociosCache.find(n => String(n.id) === nuevoNegocioId);
            appState.negocioActivoTipo = negocioSeleccionado ? negocioSeleccionado.tipo_app : 'retail';
            
            console.log(`Negocio activo actualizado a: ${nuevoNegocioId}, Tipo: ${appState.negocioActivoTipo}`);
            
            // Actualizamos la UI (menús)
            actualizarUIporTipoApp();
            
            // Cargamos el "home" correspondiente a ESE tipo de negocio
            const homePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
            loadContent(null, `static/${homePage}.html`);

            } else if (!nuevoNegocioId) {
                console.warn("Se seleccionó 'No asignados' o valor inválido.");
                const contentArea = document.getElementById('content-area');
                if(contentArea) contentArea.innerHTML = '<p style="text-align: center; margin-top: 50px;">Por favor, seleccione un negocio activo.</p>';
                appState.negocioActivoId = null;
                appState.negocioActivoTipo = null;
                localStorage.removeItem('negocioActivoId');
                actualizarUIporTipoApp(); // Limpia la UI
            }
         }
    });

window.addEventListener('popstate', (e) => {
    console.log("Evento popstate detectado:", e.state);
    const currentHashPageName = window.location.hash.substring(1).split('?')[0];
    const pageFromState = e.state?.page;
    const defaultHomePage = appState.negocioActivoTipo === 'consorcio' ? 'home_consorcio' : 'home_retail';
    const defaultHomeHtml = `static/${defaultHomePage}.html`;

    if (pageFromState) {
        console.log(`Cargando página desde historial: ${pageFromState}`);
        loadContent(null, pageFromState, null, true);
    } else if (!window.location.hash || currentHashPageName === 'home' || currentHashPageName === 'home_retail' || currentHashPageName === 'home_consorcio') {
        console.log("URL base o #home detectada, cargando home por defecto.");
        loadContent(null, defaultHomeHtml, null, true);
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


// ✨ 8. REGISTRO DEL SERVICE WORKER (Con versionado)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
    // ✨ El SW SÍ usa 'v' para forzar la actualización
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

