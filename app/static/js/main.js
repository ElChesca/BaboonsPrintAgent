// app/static/js/main.js
import { fetchData, sendData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
import { borrarProveedor, inicializarLogicaProveedores } from './modules/proveedores.js';
import { inicializarLogicaClientes } from './modules/clientes.js';
import { inicializarLogicaIngresos } from './modules/ingresos.js';
import { inicializarLogicaVentas } from './modules/sales.js';
import { inicializarLogicaUsuarios, abrirModalEditarUsuario } from './modules/users.js';
import { inicializarLogicaHistorial as inicializarLogicaHistorialIngresos, mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { inicializarLogicaNegocios } from './modules/negocios.js';
import { inicializarLogicaHistorialVentas } from './modules/historial_ventas.js';
import { inicializarLogicaInventario, abrirModalEditarProducto, borrarProducto } from './modules/inventory.js';
import { inicializarLogicaCategorias, editarCategoria, borrarCategoria } from './modules/categorias.js';
import { inicializarLogicaReportes } from './modules/reportes.js';
import { inicializarLogicaDashboard } from './modules/dashboard.js';
import { inicializarLogicaCaja } from './modules/caja.js';
import { inicializarLogicaReporteCaja, mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarLogicaReporteGanancias } from './modules/reporte_ganancias.js';
import { inicializarLogicaAjusteCaja } from './modules/ajuste_caja.js';
import { inicializarLogicaHistorialAjustes } from './modules/historial_ajustes.js';
import { inicializarLogicaPresupuestos } from './modules/presupuestos.js';
import { inicializarLogicaHistorialPresupuestos } from './modules/historial_presupuestos.js';
import { inicializarLogicaFactura } from './modules/factura.js';
import { mostrarNotificacion } from './modules/notifications.js';
import { inicializarLogicaVerificador } from './modules/verificador.js';
// --- CAMBIO AQUÍ: Nombre del archivo corregido ---
import { inicializarLogicaPagosProveedores } from './modules/payments.js';
import { inicializarLogicaHistorialPagosProveedores } from './modules/historial_pagos_proveedores.js';


let onClienteCreadoCallback = null;

export function esAdmin() {
    return appState.userRol === 'admin' || appState.userRol === 'superadmin';
}

export const appState = {
    negocioActivoId: null,
    userRol: null,
    filtroProveedorId: null
};

function loadPageCSS(pageName) {
    const existingStyle = document.getElementById('page-specific-style');
    if (existingStyle) existingStyle.remove();
    if (pageName) {
        const cssFile = `${pageName}.css`;
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
    if (selectors.length === 0) {
         console.warn("No se encontraron selectores de negocio.");
         return;
    }

    selectors.forEach(selector => {
        selector.innerHTML = '<option value="">Cargando...</option>';
        selector.disabled = true;
    });

    try {
        const negocios = await fetchData('/api/negocios');
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

        if (appState.negocioActivoId) {
             localStorage.setItem('negocioActivoId', appState.negocioActivoId);
        } else {
             localStorage.removeItem('negocioActivoId');
             console.warn("No hay negocio activo o seleccionado.");
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
                 if (appState.negocioActivoId && negocios.some(n => String(n.id) === appState.negocioActivoId)) {
                    selector.value = appState.negocioActivoId;
                 } else if (negocios.length > 0) {
                     selector.value = negocios[0].id;
                     appState.negocioActivoId = String(negocios[0].id);
                     localStorage.setItem('negocioActivoId', appState.negocioActivoId);
                 }
                 selector.disabled = false;
            }
        });

        console.log("Poblado finalizado. Negocio activo state:", appState.negocioActivoId);
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
    console.log("--- Iniciando actualizarUIAutenticacion ---");
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
        try {
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
            console.log("Selectores de negocio poblados.");

            console.log("Actualización de UI base completada.");

            const requestedPage = window.location.hash.substring(1).split('?')[0];
            const contentArea = document.getElementById('content-area');

            if (!contentArea) {
                 console.error("Error crítico: No se encontró #content-area.");
                 return;
            }

            const pageToLoad = requestedPage && requestedPage !== 'login' ? requestedPage : 'home';
            console.log(`Intentando cargar página inicial: ${pageToLoad}`);
            // Pasamos la URL completa (con query params si existen) a loadContent
            const fullHash = window.location.hash.substring(1);
            const pageUrlToLoad = `static/${fullHash || 'home.html'}`; 
            await loadContent(null, pageUrlToLoad);


        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion:", error);
            logout();
        }
    } else {
        console.log("Usuario NO válido o no encontrado. Preparando UI para login...");
        appState.userRol = null;
        appState.negocioActivoId = null;
        localStorage.removeItem('negocioActivoId');

        header.style.display = 'none';

        if (!window.location.hash.includes('login')) {
             console.log("No estamos en #login, cargando página de login...");
             loadContent(null, 'static/login.html');
        } else {
             console.log("Ya estamos en #login.");
             inicializarModulo('static/login.html');
        }
    }
     console.log("--- Fin actualizarUIAutenticacion ---");
}

async function inicializarModulo(page) {
    console.log(`inicializarModulo llamada con page = "${page}"`);
    if (!page) {
        console.warn("inicializarModulo llamado sin página.");
        return;
    }

    const pageName = page.split('/').pop().replace('.html', '').split('?')[0];
    console.log(`Inicializando módulo: ${pageName}`);

    // Limpiar gráficos anteriores (ejemplo)
    if (window.currentChartInstance) {
        window.currentChartInstance.destroy();
        window.currentChartInstance = null;
    }

    // --- CAMBIO AQUÍ: Nombre del case corregido ---
    switch(pageName) {
        case 'inventario': inicializarLogicaInventario(); break;
        case 'login': inicializarLogicaLogin(); break;
        case 'clientes': inicializarLogicaClientes(); break;
        case 'usuarios': inicializarLogicaUsuarios(); break;
        case 'categorias': inicializarLogicaCategorias(); break;
        case 'dashboard': inicializarLogicaDashboard(); break;
        case 'caja': inicializarLogicaCaja(); break;
        case 'reporte_caja': inicializarLogicaReporteCaja(); break;
        case 'reporte_ganancias': inicializarLogicaReporteGanancias(); break;
        case 'reportes': inicializarLogicaReportes(); break;
        case 'factura': inicializarLogicaFactura(); break;
        case 'verificador': inicializarLogicaVerificador(); break;
        case 'historial_ingresos': inicializarLogicaHistorialIngresos(); break;
        case 'ingresos': inicializarLogicaIngresos(); break;
        case 'historial_ventas': inicializarLogicaHistorialVentas(); break;
        case 'ventas': inicializarLogicaVentas(); break;
        case 'historial_ajustes': inicializarLogicaHistorialAjustes(); break;
        case 'ajuste_caja': inicializarLogicaAjusteCaja(); break;
        case 'historial_presupuestos': inicializarLogicaHistorialPresupuestos(); break;
        case 'presupuestos': inicializarLogicaPresupuestos(); break;
        case 'historial_pagos_proveedores': inicializarLogicaHistorialPagosProveedores(); break
        
        case 'home':
            console.log("Módulo Home detectado.");
            await poblarSelectorNegocios();
            break;
        case 'proveedores': inicializarLogicaProveedores(); break;


        case 'negocios': inicializarLogicaNegocios(); break;
        // Usamos 'payments' como nombre de módulo (igual que el archivo .js)
        case 'payments': inicializarLogicaPagosProveedores(); break; 
        case 'configuracion':
            const { inicializarConfiguracion } = await import('./modules/configuracion.js');
            inicializarConfiguracion();
            break;
        case 'listas_precios':
            const { inicializarGestionListasPrecios } = await import('./modules/listas_precios.js');
            inicializarGestionListasPrecios();
            break;
        case 'unidades_medida':
            const { inicializarLogicaUnidadesMedida } = await import('./modules/unidades_medida.js');
            inicializarLogicaUnidadesMedida();
            break;
         case 'historial_inventario':
             const { inicializarHistorialInventario } = await import('./modules/historial_inventario.js');
             inicializarHistorialInventario();
             break;
         case 'precios_especificos':
             const { inicializarPreciosEspecificos } = await import('./modules/precios_especificos.js');
             inicializarPreciosEspecificos();
             break;
        default:
            console.warn(`No se encontró lógica de inicialización para el módulo: ${pageName}`);
    }
     console.log(`Módulo ${pageName} inicializado.`);
}

export function loadContent(event, page, clickedLink, fromHistory = false) {
     console.log(`loadContent llamado para: ${page}, desde historial: ${fromHistory}`);
    if (event) event.preventDefault();

    // --- Mantenemos la lógica de separar nombre y query params ---
    const pageParts = page.split('?');
    const pagePath = pageParts[0]; // Ej: static/proveedores.html
    const queryString = pageParts.length > 1 ? `?${pageParts[1]}` : ''; // Ej: ?proveedor=5
    const pageName = pagePath.split('/').pop().replace('.html', ''); // Ej: proveedores
    const targetHash = `#${pageName}`; // Ej: #proveedores
    const fullTargetHash = targetHash + queryString; // Ej: #proveedores?proveedor=5

    const baseUrl = window.location.origin + window.location.pathname; 
    const targetUrlBase = baseUrl + targetHash; // URL sin query para comparar
    const currentUrlBase = baseUrl + window.location.hash.split('?')[0]; // URL actual sin query

    // Evitar recargar si la URL base + hash limpio ya es la actual
    if (!fromHistory && currentUrlBase === targetUrlBase) {
         console.log(`Ya estamos en ${targetHash}, no se recarga HTML.`);
         // Actualizar hash solo si los query params cambiaron
         if(window.location.hash !== fullTargetHash) {
            history.pushState({ page: page }, '', fullTargetHash); // Pushear con query params
            // Si solo cambió el query param, podríamos querer re-inicializar el módulo
            // inicializarModulo(page).catch(err => console.error...); // Descomentar si es necesario
         }
         const navContainer = document.querySelector('.nav-container');
         if (navContainer && navContainer.classList.contains('is-active')) {
             navContainer.classList.remove('is-active');
         }
         return;
    }

    if (!fromHistory) {
        history.pushState({ page: page }, '', fullTargetHash); // Usar hash completo
    }

    loadPageCSS(pageName); // CSS por nombre limpio

    const header = document.querySelector('header');
    const isLoginPage = pageName === 'login';
    if (header) header.style.display = isLoginPage ? 'none' : 'flex';

    const pageToFetch = pagePath; // Fetch usando el path limpio

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
                     // Marcar link activo (usando pageName limpio)
                     document.querySelectorAll('#main-nav a, #main-nav .dropbtn').forEach(link => link.classList.remove('active'));
                     const linkSelector = `#main-nav a[onclick*="'static/${pageName}.html'"]`;
                     const linkToActivate = document.querySelector(linkSelector);
                     if (linkToActivate) {
                         linkToActivate.classList.add('active');
                          const parentDropdown = linkToActivate.closest('.dropdown');
                         if (parentDropdown) parentDropdown.querySelector('.dropbtn')?.classList.add('active');
                     } else {
                          console.warn(`No se encontró link activo para selector: ${linkSelector}`);
                     }

                     // Inicializar el módulo (usando la página *original* con query params)
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
            window.location.hash = '#home';
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

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Configurando listeners iniciales...");

    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'selector-negocio') {
            console.log("Cambio de negocio en selector principal.");
            const nuevoNegocioId = e.target.value;
            if (nuevoNegocioId && appState.negocioActivoId !== nuevoNegocioId) {
                 appState.negocioActivoId = nuevoNegocioId;
                 localStorage.setItem('negocioActivoId', nuevoNegocioId);
                 console.log("Negocio activo actualizado a:", nuevoNegocioId);
                 const currentPage = window.location.hash.substring(1).split('?')[0] || 'home';
                 console.log(`Recargando módulo actual: ${currentPage}`);
                 loadContent(null, `static/${currentPage}.html`);
            } else if (!nuevoNegocioId) {
                 console.warn("Se seleccionó 'No asignados' o valor inválido.");
                 const contentArea = document.getElementById('content-area');
                 if(contentArea) contentArea.innerHTML = '<p style="text-align: center; margin-top: 50px;">Por favor, seleccione un negocio activo.</p>';
                 appState.negocioActivoId = null;
                 localStorage.removeItem('negocioActivoId');
            }
        }
    });

    window.addEventListener('popstate', (e) => {
        console.log("Evento popstate detectado:", e.state);
        const currentHashPageName = window.location.hash.substring(1).split('?')[0];
        const pageFromState = e.state?.page; 

        if (pageFromState) {
             console.log(`Cargando página desde historial: ${pageFromState}`);
             loadContent(null, pageFromState, null, true);
        } else if (!window.location.hash || currentHashPageName === 'home') {
             console.log("URL base o #home detectada, cargando home desde popstate.");
             loadContent(null, 'static/home.html', null, true);
        } else if (currentHashPageName && currentHashPageName !== 'login'){
            console.log(`Hash ${currentHashPageName} sin estado detectado, cargando página.`);
            loadContent(null, `static/${currentHashPageName}.html`, null, true);
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


    // Registro Service Worker (PWA)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
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

});

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent; // Esencial
window.borrarProveedor = borrarProveedor; // Mantenido

// Exponer las otras que SÍ se usan en onclicks de otros módulos HTML
window.borrarProducto = borrarProducto;
window.abrirModalEditarProducto = abrirModalEditarProducto;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.editarCategoria = editarCategoria;
window.borrarCategoria = borrarCategoria;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;