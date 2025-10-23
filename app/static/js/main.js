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

    // 1. Verifica si hay un rol
    if (appState.userRol) {
        console.log(`Aplicando visibilidad en inicializarModulo para rol: ${appState.userRol}`);
        
        // 2. Función auxiliar para mostrar/ocultar
        const setDisplay = (elements, shouldShow) => {
            if (elements && typeof elements.forEach === 'function') {
                elements.forEach(el => {
                    if (el && el.style) {
                        // Usamos 'flex' porque las app-card son flex
                        el.style.display = shouldShow ? 'flex' : 'none'; 
                    }
                });
            }
        };

        // 3. Aplica las reglas
        setDisplay( document.querySelectorAll('.admin-only'), (appState.userRol === 'admin' || appState.userRol === 'superadmin') );
        setDisplay( document.querySelectorAll('.superadmin-only'), (appState.userRol === 'superadmin') );
        setDisplay( document.querySelectorAll('.admin-operator-only'), (appState.userRol !== 'superadmin') );

        // 4. Lógica del selector del Home (si estamos en el home)
        if (page.includes('home.html')) {
            const homeSelectorWrapper = document.getElementById('home-business-selector-wrapper');
            if (homeSelectorWrapper) {
                if (appState.userRol !== 'superadmin') {
                   homeSelectorWrapper.classList.add('hide-element'); 
                } else {
                   homeSelectorWrapper.classList.remove('hide-element'); 
                }
            }
        }
    }

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
export async function actualizarUIAutenticacion() {
    console.log("--- Iniciando actualizarUIAutenticacion ---");

    // --- Declaraciones de Variables al Principio ---
    // Intentamos obtener el usuario actual
    const user = getCurrentUser();
    console.log("Usuario actual:", user);

    // Obtenemos referencias a los elementos principales de la UI
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar');
    const businessSelectorDropdown = document.getElementById('business-selector-dropdown');
    const businessDisplayName = document.getElementById('business-display-name');
    const activeBusinessNameDisplay = document.getElementById('active-business-name-display');

    // Oculta elementos por defecto antes de verificar el usuario
    if (mainNav) mainNav.style.display = 'none';
    if (businessSelectorBar) businessSelectorBar.style.display = 'none';
    // Oculta elementos basados en rol por defecto
    document.querySelectorAll('.admin-only, .superadmin-only, .admin-operator-only').forEach(el => {
        if (el && el.style) el.style.display = 'none';
    });

    // --- Lógica Principal: ¿Hay un usuario válido? ---
    if (user && user.nombre && user.rol) { // Verifica que el objeto user tenga las propiedades esperadas
        console.log("Usuario válido encontrado. Actualizando UI...");
        try {
            // Guarda el rol en el estado global
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol);

            // Muestra la barra de navegación principal y la barra de negocio
            if (mainNav) mainNav.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';

            // Configura el enlace de "Salir"
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
                 console.log("Configurado enlace 'Salir'.");
            } else { console.warn("Elemento 'auth-link' no encontrado."); }

            // --- Lógica de Visibilidad del Selector de Negocio ---
            console.log("Aplicando lógica selector negocio...");
            let negocios = []; // Variable para guardar los negocios cargados
            try {
                // Obtenemos los negocios ANTES de decidir qué mostrar
                negocios = await fetchData('/api/negocios');
                console.log("Negocios recibidos del API:", negocios);

                // Poblamos los selectores (principal y home, si existen)
                poblarSelectoresConDatos(negocios); // Llama a la función auxiliar

                // Decidimos qué mostrar DENTRO de la barra de negocio
                if (appState.userRol === 'superadmin') {
                    if (businessSelectorDropdown) {
                        businessSelectorDropdown.style.display = 'flex'; // Muestra dropdown
                        console.log("Mostrando dropdown para SuperAdmin");
                    } else { console.warn("businessSelectorDropdown no encontrado"); }
                    if (businessDisplayName) businessDisplayName.style.display = 'none'; // Oculta texto
                } else { // Admin u Operador
                    if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none'; // Oculta dropdown
                    if (businessDisplayName) {
                         businessDisplayName.style.display = 'flex'; // Muestra texto
                         console.log("Mostrando nombre negocio para Admin/Operador");
                         // Actualizamos el nombre mostrado
                         if (appState.negocioActivoId && activeBusinessNameDisplay) {
                             const negocioActual = negocios.find(n => String(n.id) === String(appState.negocioActivoId));
                             activeBusinessNameDisplay.textContent = negocioActual ? negocioActual.nombre : `ID ${appState.negocioActivoId}`;
                         } else if (activeBusinessNameDisplay) {
                             activeBusinessNameDisplay.textContent = "No asignado";
                         } else { console.warn("activeBusinessNameDisplay no encontrado."); }
                    } else { console.warn("businessDisplayName no encontrado"); }
                }
            } catch (error) {
                console.error("Error crítico al obtener o procesar negocios:", error);
                mostrarNotificacion("Error al cargar datos del negocio. Intente recargar.", "error");
                // Ocultar ambos elementos si falla la carga de negocios
                if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none';
                if (businessDisplayName) businessDisplayName.style.display = 'none';
            }
            // --- Fin Lógica Selector ---           
            console.log("Actualización de UI base completada.");

            // --- Carga de Contenido Inicial ---
            const requestedPage = window.location.hash.substring(1);
            const contentArea = document.getElementById('content-area');

            if (contentArea && contentArea.innerHTML.trim() === '' && !requestedPage) {
                console.log("Content area vacío y sin hash, cargando home.html por defecto...");
                loadContent(null, 'static/home.html');
            } else if (!requestedPage && contentArea && contentArea.innerHTML.trim() === '') {
                 console.log("Sin hash pero con contenido? Cargando home.html por si acaso..."); // Lógica de seguridad
                 loadContent(null, 'static/home.html');
            } else {
                 console.log(`Hash: #${requestedPage || 'ninguno'}. Contenido ${contentArea && contentArea.innerHTML.trim() !== '' ? 'existe' : 'vacío'}. No se fuerza carga.`);
            }
            // --- Fin Carga Contenido ---

        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error);
            logout(); // Cierra sesión si hay cualquier error grave
        }
    } else { // No hay usuario o el objeto user es inválido/incompleto
        console.log("Usuario NO válido o no encontrado. Redirigiendo a login...");
        appState.userRol = null;
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelectorBar) businessSelectorBar.style.display = 'none';

        // Redirige a login solo si NO estamos ya en la página de login
        if (!window.location.hash.includes('login')) {
             console.log("No estamos en login, cargando página de login...");
             // Asegúrate que loadContent exista antes de llamarla
             if (typeof loadContent === 'function') {
                 loadContent(null, 'static/login.html');
             } else {
                 console.error("La función loadContent no está disponible globalmente.");
                 // Fallback: Redirección dura si loadContent no funciona
                 window.location.href = '/#login';
             }
        } else {
             console.log("Ya estamos en login.");
        }
    }
     console.log("--- Fin actualizarUIAutenticacion ---");
}

function poblarSelectoresConDatos(negocios) {
    console.log("Iniciando poblarSelectoresConDatos con:", negocios);
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');

    const fillSelector = (selector, selectorName) => {
        if (!selector) {
            // console.log(`Selector ${selectorName} no encontrado.`); // Log opcional
            return; // No intentar llenar si no existe
        }
        // Limpiamos de forma segura
        while (selector.firstChild) {
            selector.removeChild(selector.firstChild);
        }

        if (!negocios || negocios.length === 0) {
            selector.appendChild(new Option("No asignados", ""));
            return;
        }

        let negocioEncontrado = false;
        negocios.forEach((negocio) => {
            if (negocio && typeof negocio.id !== 'undefined' && typeof negocio.nombre !== 'undefined') {
                const option = new Option(negocio.nombre, negocio.id);
                selector.appendChild(option);
                // Marca si el negocio activo está en la lista
                if (String(negocio.id) === String(appState.negocioActivoId)) {
                    negocioEncontrado = true;
                }
            }
        });

        // Preselección Lógica
        if (appState.negocioActivoId && negocioEncontrado) {
            selector.value = appState.negocioActivoId; // Selecciona el activo si existe
        } else if (negocios.length > 0) {
            // Si no hay activo o el activo no está en la lista, selecciona el primero y actualiza estado
            selector.selectedIndex = 0;
            appState.negocioActivoId = selector.value;
            localStorage.setItem('negocioActivoId', appState.negocioActivoId); // Guarda el nuevo activo
            console.log("Estableciendo/Actualizando negocio activo a:", appState.negocioActivoId);
        } else {
             appState.negocioActivoId = null; // No hay negocios
             localStorage.removeItem('negocioActivoId');
        }
         console.log(`Selector ${selectorName} poblado. Valor final: ${selector.value}`);
    };

    fillSelector(mainSelector, 'mainSelector');
    fillSelector(homeSelector, 'homeSelector');
    console.log("Poblado de selectores finalizado. Negocio activo state:", appState.negocioActivoId);
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