// app/static/js/main.js
import { fetchData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
import { inicializarLogicaClientes } from './modules/clientes.js';
import { inicializarLogicaIngresos } from './modules/ingresos.js';
import { inicializarLogicaVentas } from './modules/sales.js';
import { inicializarLogicaUsuarios, abrirModalEditarUsuario } from './modules/users.js';
import { inicializarLogicaHistorial, mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
import { inicializarLogicaNegocios } from './modules/negocios.js';
import { inicializarLogicaHistorialVentas } from './modules/historial_ventas.js';
import { inicializarLogicaInventario, abrirModalEditarProducto, borrarProducto } from './modules/inventory.js';
import { inicializarLogicaCategorias, editarCategoria, borrarCategoria } from './modules/categorias.js';
import { inicializarLogicaReportes } from './modules/reportes.js';
import { inicializarLogicaDashboard } from './modules/dashboard.js';
import { inicializarLogicaCaja } from './modules/caja.js';
import { inicializarLogicaReporteCaja, mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarLogicaReporteGanancias } from './modules/reporte_ganancias.js';
import { inicializarLogicaProveedores, editarProveedor, borrarProveedor } from './modules/proveedores.js';
import { inicializarLogicaAjusteCaja } from './modules/ajuste_caja.js';
import { inicializarLogicaHistorialAjustes } from './modules/historial_ajustes.js';
import { inicializarLogicaPresupuestos } from './modules/presupuestos.js';
import { inicializarLogicaHistorialPresupuestos } from './modules/historial_presupuestos.js';
import { inicializarLogicaFactura } from './modules/factura.js';


let onClienteCreadoCallback = null;

// --- ESTADO GLOBAL ---
export const appState = {
    negocioActivoId: null,
    userRol: null
};

function loadPageCSS(pageName) {
    const existingStyle = document.getElementById('page-specific-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    if (pageName) {
        const cssFile = `${pageName}.css`;
        const link = document.createElement('link');
        link.id = 'page-specific-style';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `/static/css/${cssFile}`;
        fetch(link.href).then(res => {
            if (res.ok) {
                document.head.appendChild(link);
            } else {
                console.warn(`Advertencia: No se encontró el archivo CSS opcional en ${link.href}`);
            }
        });
    }
}

// --- FUNCIONES AUXILIARES ---
export function esAdmin() {
    return appState.userRol === 'admin';
}

async function inicializarModulo(page) {
    console.log(`inicializarModulo llamada con page = "${page}"`);
    if (!page) return;
    if (page.includes('inventario.html')) inicializarLogicaInventario();
    if (page.includes('login.html')) inicializarLogicaLogin();    
    if (page.includes('clientes.html')) inicializarLogicaClientes();
    if (page.includes('usuarios.html')) inicializarLogicaUsuarios();
    if (page.includes('categorias.html')) inicializarLogicaCategorias();
    if (page.includes('dashboard.html')) inicializarLogicaDashboard();
    if (page.includes('caja.html')) inicializarLogicaCaja();
    if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
    if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias();    
     
    if (page.includes('proveedores.html')) {        
        const { inicializarLogicaProveedores } = await import('./modules/proveedores.js');
        inicializarLogicaProveedores();
    }
    if (page.includes('reportes.html')) inicializarLogicaReportes();
    if (page.includes('factura.html')) inicializarLogicaFactura();
    if (page.includes('negocios.html')) {
        const { inicializarLogicaNegocios } = await import('./modules/negocios.js');
        inicializarLogicaNegocios();
    }  
    if (page.includes('home.html')) {        
        await poblarSelectorNegocios(); 
    }  
    if (page.includes('configuracion.html')) {        
        const { inicializarConfiguracion } = await import('./modules/configuracion.js');
        inicializarConfiguracion();
    }
    if (page.includes('listas_precios.html')) {
    const { inicializarGestionListasPrecios } = await import('./modules/listas_precios.js');
        inicializarGestionListasPrecios();
    }    
    if (page.includes('historial_ingresos.html')) {
        inicializarLogicaHistorial();
    } else if (page.includes('ingresos.html')) {
        inicializarLogicaIngresos();
    }
    if (page.includes('historial_ventas.html')) {
        inicializarLogicaHistorialVentas();
    } else if (page.includes('ventas.html')) {
        inicializarLogicaVentas();
    }
    if (page.includes('historial_ajustes.html')) {
        inicializarLogicaHistorialAjustes();
    } else if (page.includes('ajuste_caja.html')) {
        inicializarLogicaAjusteCaja();
    }
    if (page.includes('historial_presupuestos.html')) {
        inicializarLogicaHistorialPresupuestos();
    } else if (page.includes('presupuestos.html')) {
        inicializarLogicaPresupuestos();
    }
    if (page.includes('unidades_medida.html')) {
    const { inicializarLogicaUnidadesMedida } = await import('./modules/unidades_medida.js');
        inicializarLogicaUnidadesMedida();
    }
    if (page.includes('historial_inventario.html')) {
        const { inicializarHistorialInventario } = await import('./modules/historial_inventario.js');
        inicializarHistorialInventario();
    } 
    
    // ✨ CORRECCIÓN: Este IF va AFUERA, separado ✨
    if (page.includes('precios_especificos.html')) {
        console.log("Detectada página precios_especificos.html, intentando inicializar..."); 
        try {
            const { inicializarPreciosEspecificos } = await import('./modules/precios_especificos.js');
            inicializarPreciosEspecificos();
            console.log("inicializarPreciosEspecificos() llamada.");
        } catch (error) {
             console.error("Error al importar o inicializar precios_especificos.js:", error);
        }
    }
}

async function poblarSelectorNegocios() {
    console.log("Iniciando poblarSelectorNegocios...");
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');
    console.log("Main selector encontrado:", mainSelector ? 'Sí' : 'No');
    console.log("Home selector encontrado:", homeSelector ? 'Sí' : 'No');

    if (!mainSelector && !homeSelector) {
        console.warn("No se encontraron selectores de negocio.");
        return;
    }

    try {
        const negocios = await fetchData('/api/negocios');
        console.log("Negocios recibidos del API:", negocios);

        const fillSelector = (selector, selectorName) => {
            console.log(`Intentando llenar selector: ${selectorName}`);
            if (!selector) {
                console.log(`Selector ${selectorName} no encontrado.`);
                return;
            }
            // Limpiamos de forma segura
            while (selector.firstChild) {
                selector.removeChild(selector.firstChild);
            }

            if (!negocios || negocios.length === 0) {
                const option = new Option("No asignados", "");
                selector.appendChild(option);
                console.log(`No hay negocios para agregar a ${selectorName}.`);
                return;
            }

            console.log(`Entrando al bucle forEach para ${selectorName}...`);
            negocios.forEach((negocio, index) => {
                console.log(`  Procesando opción ${index + 1}: ${negocio.nombre} (ID: ${negocio.id})`);
                if (negocio && typeof negocio.id !== 'undefined' && typeof negocio.nombre !== 'undefined') {
                    // ✨ Usamos appendChild en lugar de innerHTML += ✨
                    const option = new Option(negocio.nombre, negocio.id);
                    selector.appendChild(option);
                } else {
                     console.warn(`  Elemento inválido en negocios[${index}]:`, negocio);
                }
            });
            console.log(`Bucle forEach para ${selectorName} completado.`);

            // --- Lógica de Preselección (sin cambios) ---
            let idSeleccionado = null;
            if (negocios.length > 0) {
                idSeleccionado = negocios[0].id;
                if (appState.negocioActivoId && negocios.some(n => n.id == appState.negocioActivoId)) {
                    idSeleccionado = appState.negocioActivoId;
                } else {
                    appState.negocioActivoId = idSeleccionado;
                    console.log("Estableciendo negocio activo inicial a:", idSeleccionado);
                }
                // Aseguramos que el valor exista antes de asignarlo
                if (Array.from(selector.options).some(opt => opt.value == idSeleccionado)) {
                     selector.value = idSeleccionado;
                     console.log(`Preseleccionado en ${selectorName}: ${idSeleccionado}`);
                } else {
                     console.warn(`ID ${idSeleccionado} no encontrado en las opciones de ${selectorName}, seleccionando el primero.`);
                     selector.selectedIndex = 0; // Selecciona la primera opción si la preselección falla
                     idSeleccionado = selector.value;
                     appState.negocioActivoId = idSeleccionado;
                }
            } else {
                 appState.negocioActivoId = null;
                 console.log("No hay negocios válidos para preseleccionar.");
            }

            if (String(appState.negocioActivoId) !== String(idSeleccionado)) {
                 appState.negocioActivoId = idSeleccionado;
                 console.log("Actualizando appState.negocioActivoId a:", idSeleccionado);
            }
        };

        fillSelector(mainSelector, 'mainSelector (#selector-negocio)');
        fillSelector(homeSelector, 'homeSelector (#home-selector-negocio)');

        console.log("Llenado de selectores finalizado. Negocio activo final:", appState.negocioActivoId);

    } catch (error) {
        console.error("Error en poblarSelectorNegocios:", error);
        // Llenar con opción de error
        const fillError = (selector) => {
            if(selector) selector.innerHTML = '<option value="">Error</option>';
        };
        fillError(mainSelector);
        fillError(homeSelector);
    }
}

// --- FUNCIÓN PRINCIPAL DE FLUJO (MODIFICADA) ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    
    if (event) event.preventDefault();
    
    if (!fromHistory) {
        history.pushState({ page: page }, '', `#${page.replace('static/', '').replace('.html', '')}`);
    }

    const pageName = page.split('/').pop().replace('.html', '');
    loadPageCSS(pageName);
    
    // ✨ LÓGICA DE VISIBILIDAD CORREGIDA ✨
    const header = document.querySelector('header'); // La barra de navegación principal
    const businessSelectorBar = document.getElementById('business-selector-bar'); // La barra de negocio secundaria


    if (page.includes('home.html')) {
        // Si estamos en el home, ocultamos el header y la barra de negocio.
        if (header) header.classList.add('hidden');
        if (businessSelectorBar) businessSelectorBar.classList.add('hidden');
    } else {
        // Si estamos en cualquier otra página, nos aseguramos de que sean visibles.
        if (header) header.classList.remove('hidden');
        if (businessSelectorBar) businessSelectorBar.style.display = 'flex'; // Usamos flex para que se vea bien
    }
    // --- FIN DE LA LÓGICA ---

    const token = localStorage.getItem('jwt_token');
    if (!token && !page.includes('login.html')) {
        actualizarUIAutenticacion();
        return;
    }
    
    document.querySelectorAll('nav a, .dropdown-content a').forEach(link => link.classList.remove('active'));
    if (clickedLink) {
        clickedLink.classList.add('active');
        const parentDropdown = clickedLink.closest('.dropdown');
        if (parentDropdown) {
            parentDropdown.querySelector('.dropbtn').classList.add('active');
        }
    }

    fetch(page)
        .then(response => response.ok ? response.text() : Promise.reject('Error al cargar la página.'))
        .then(html => {
            document.getElementById('content-area').innerHTML = html;
            console.log(`HTML cargado para ${page}. Justo antes de llamar a inicializarModulo...`);
            setTimeout(() => inicializarModulo(page), 0);
        })
        .catch(error => {
            console.error(error);
            loadPageCSS(null);
        });
}
// en static/js/main.js
// en static/js/main.js

export async function actualizarUIAutenticacion() {
    console.log("--- Iniciando actualizarUIAutenticacion ---");
    
    // --- Declaraciones de Variables al Principio ---
    const user = getCurrentUser();
    console.log("Usuario actual:", user); 
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar'); 
    const businessSelectorDropdown = document.getElementById('business-selector-dropdown');
    const businessDisplayName = document.getElementById('business-display-name'); 
    const activeBusinessNameDisplay = document.getElementById('active-business-name-display');

    if (user && user.nombre) {
        console.log("Usuario válido encontrado. Actualizando UI..."); 
        try {
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol);

            // Muestra barras (si existen)
            if (mainNav) mainNav.style.display = 'flex'; 
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex'; 

            // Configura enlace Salir
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
                 console.log("Configurado enlace 'Salir'."); 
            }

            // --- Lógica Visibilidad Selector Negocio ---
            console.log("Aplicando lógica selector negocio..."); 

            // SIEMPRE poblamos el selector primero para tener los datos listos
            // Es asíncrono, así que esperamos a que termine antes de continuar
            await poblarSelectorNegocios(); 
            console.log("Selector poblado o datos cargados.");

            if (appState.userRol === 'superadmin') {
                if (businessSelectorDropdown) {
                    businessSelectorDropdown.style.display = 'flex'; // Muestra dropdown para SuperAdmin
                    console.log("Mostrando dropdown para SuperAdmin");
                } else { console.warn("businessSelectorDropdown no encontrado"); }
                if (businessDisplayName) businessDisplayName.style.display = 'none'; // Oculta texto
            } else { // Admin u Operador
                if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none'; // Oculta dropdown
                if (businessDisplayName) {
                     businessDisplayName.style.display = 'flex'; // Muestra texto
                     console.log("Mostrando nombre negocio para Admin/Operador");
                     // Muestra nombre negocio
                     if (appState.negocioActivoId && activeBusinessNameDisplay) {
                         const selector = document.getElementById('selector-negocio');
                         const selectedOption = selector ? Array.from(selector.options).find(opt => opt.value == appState.negocioActivoId) : null;
                         if (selectedOption) {
                             activeBusinessNameDisplay.textContent = selectedOption.text;
                             console.log("Nombre encontrado:", selectedOption.text); 
                         } else { 
                             activeBusinessNameDisplay.textContent = `ID ${appState.negocioActivoId}`; 
                             console.warn("No se encontró el nombre del negocio en el selector poblado."); 
                         }
                     } else if (activeBusinessNameDisplay) { 
                         activeBusinessNameDisplay.textContent = "No asignado"; 
                         console.log("No hay negocio activo o elemento display no encontrado."); 
                     }
                } else { console.warn("businessDisplayName no encontrado"); }
            }
            // --- Fin Lógica Selector ---

            // --- Lógica de Visibilidad por Roles (Usando Clases CSS - COMPLETA) ---
            console.log("Aplicando visibilidad por roles..."); 
            const setDisplay = (elements, shouldShow) => {
                if (elements && typeof elements.forEach === 'function') {
                    elements.forEach(el => {
                        if (el && el.style) {
                            // Usamos flex aquí también por consistencia con la barra y otros elementos
                            el.style.display = shouldShow ? 'flex' : 'none'; // Puedes cambiar 'flex' a 'block' si causa problemas de layout
                        } else { console.warn("Elemento inválido:", el); }
                    });
                } else { console.warn("Resultado inesperado querySelectorAll:", elements); }
            };

            // Aplica la lógica para cada clase
            setDisplay( document.querySelectorAll('.admin-only'), (appState.userRol === 'admin' || appState.userRol === 'superadmin') );
            setDisplay( document.querySelectorAll('.superadmin-only'), (appState.userRol === 'superadmin') );
            setDisplay( document.querySelectorAll('.admin-operator-only'), (appState.userRol !== 'superadmin') );
            // --- Fin Lógica Roles ---

            // Lógica para ocultar selector del HOME si NO es SuperAdmin
             const homeSelectorWrapper = document.getElementById('home-business-selector-wrapper');
              if (homeSelectorWrapper) {
                  // Usamos la clase CSS 'hide-element' que definimos antes
                  if (appState.userRol !== 'superadmin') {
                     homeSelectorWrapper.classList.add('hide-element'); 
                     console.log("Ocultando selector home para no SuperAdmin.");
                  } else {
                     homeSelectorWrapper.classList.remove('hide-element'); 
                     console.log("Mostrando selector home para SuperAdmin.");
                  }
              }
            
            console.log("Actualización de UI base completada.");

            // --- Carga de Contenido Inicial ---
            const requestedPage = window.location.hash.substring(1); 
            const contentArea = document.getElementById('content-area'); // Verifica si hay contenido
            
            // Si NO hay hash O el hash es 'home' Y el área está vacía, carga home.html
            if ((!requestedPage || requestedPage === 'home') && contentArea && contentArea.innerHTML.trim() === '') { 
                console.log("Cargando home.html por defecto...");
                loadContent(null, 'static/home.html'); 
            } else if (requestedPage && requestedPage !== 'home') {
                 console.log(`Hash encontrado: #${requestedPage}. Dejando que loadContent maneje la ruta si es necesario.`);
                 // Si tu sistema de routing no se activa solo con el hash, podrías necesitar forzarlo:
                 // loadContent(null, `static/${requestedPage}.html`);
            } else {
                 console.log("Ya hay contenido cargado o estamos en home, no se fuerza recarga.");
            }
            // --- Fin Carga Contenido ---

        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error); 
            logout(); // Cierra sesión si hay cualquier error grave
        }
    } else { // No hay usuario
        console.log("Usuario NO válido o no encontrado. Redirigiendo a login..."); 
        appState.userRol = null;
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelectorBar) businessSelectorBar.style.display = 'none';
        if (!window.location.hash.includes('login')) {
             console.log("No estamos en login, cargando página de login...");
             loadContent(null, 'static/login.html');
        } else {
             console.log("Ya estamos en login.");
        }
    }
     console.log("--- Fin actualizarUIAutenticacion ---"); 
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('selector-negocio').addEventListener('change', (e) => {
        appState.negocioActivoId = e.target.value;
        const linkActivo = document.querySelector('nav a.active, .dropdown-content a.active');
        if (linkActivo) {
            const pageFile = linkActivo.getAttribute('onclick').match(/'(.*?)'/)[1];
            loadContent(null, pageFile, linkActivo);
        }
    });
     // ✨ AÑADIDO: Listener para el nuevo selector del Home
    // Usamos 'document.body.addEventListener' porque el selector del home no siempre existe.
    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'home-selector-negocio') {
            appState.negocioActivoId = e.target.value;
            // En el home, simplemente recargamos el home para que los datos se actualicen.
            const homeLink = document.querySelector('a[onclick*="home.html"]');
            loadContent(null, 'static/home.html', homeLink);
        }
    });
    window.addEventListener('authChange', actualizarUIAutenticacion);

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navContainer = document.querySelector('.nav-container');
    if (hamburgerBtn && navContainer) {
        hamburgerBtn.addEventListener('click', () => navContainer.classList.toggle('is-active'));
        navContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') navContainer.classList.remove('is-active');
        });
    }
     // ✨ NUEVO LISTENER: Se activa cuando el usuario usa el botón "Atrás" del navegador.
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
            // Cargamos la página guardada en el historial, marcándola con 'fromHistory = true'
            loadContent(null, e.state.page, null, true);
        }
    });
    // ✨ LA CORRECCIÓN CLAVE: Esta es la llamada inicial que pone todo en marcha.
    actualizarUIAutenticacion();
});

export function abrirModalNuevoCliente(callback) {
    const modal = document.getElementById('modal-nuevo-cliente');
    if (modal) {
        onClienteCreadoCallback = callback;
        modal.style.display = 'flex';
        document.getElementById('form-nuevo-cliente').reset();
    }
}

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProducto = borrarProducto;
window.abrirModalEditarProducto = abrirModalEditarProducto;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.editarCategoria = editarCategoria;
window.borrarCategoria = borrarCategoria;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.editarProveedor = editarProveedor;
window.borrarProveedor = borrarProveedor;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;