// app/static/js/main.js
import { fetchData, sendData } from './api.js'; // Asegúrate de tener sendData
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
import { inicializarLogicaProveedores, borrarProveedor } from './modules/proveedores.js';
import { inicializarLogicaAjusteCaja } from './modules/ajuste_caja.js';
import { inicializarLogicaHistorialAjustes } from './modules/historial_ajustes.js';
import { inicializarLogicaPresupuestos } from './modules/presupuestos.js';
import { inicializarLogicaHistorialPresupuestos } from './modules/historial_presupuestos.js';
import { inicializarLogicaFactura } from './modules/factura.js';
import { mostrarNotificacion } from './modules/notifications.js'; // Importa la notificación
import { inicializarLogicaVerificador } from './modules/verificador.js';
import { inicializarLogicaPagosProveedores } from './modules/payments.js';


let onClienteCreadoCallback = null;

// --- CAMBIO AQUÍ: esAdmin() ahora incluye 'superadmin' ---
export function esAdmin() { 
    return appState.userRol === 'admin' || appState.userRol === 'superadmin';
}

// --- ESTADO GLOBAL ---
export const appState = {
    negocioActivoId: null,
    userRol: null
};

// --- Carga de CSS por Página ---
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
        fetch(link.href).then(res => {
            if (res.ok) document.head.appendChild(link);
            else console.warn(`Advertencia: No se encontró CSS opcional en ${link.href}`);
        });
    }
}

// --- Función Auxiliar (Limpia) ---
// Solo puebla los selectores, no toma decisiones de UI
async function poblarSelectorNegocios() {
    console.log("Iniciando poblarSelectorNegocios...");
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');
    
    // Lista de selectores a poblar
    const selectors = [mainSelector, homeSelector].filter(s => s != null); // Filtra los que no existen
    if (selectors.length === 0) {
         console.warn("No se encontraron selectores de negocio.");
         return;
    }

    try {
        const negocios = await fetchData('/api/negocios');
        console.log("Negocios recibidos del API:", negocios);

        // Lógica de preselección
        let idSeleccionado = null;
        if (negocios && negocios.length > 0) {
            idSeleccionado = negocios[0].id; // Default al primero
            const savedNegocioId = localStorage.getItem('negocioActivoId');
            if (savedNegocioId && negocios.some(n => String(n.id) === String(savedNegocioId))) {
                idSeleccionado = savedNegocioId;
            }
        }
        appState.negocioActivoId = idSeleccionado; // Establece el estado global
        if (idSeleccionado) localStorage.setItem('negocioActivoId', idSeleccionado);
        else localStorage.removeItem('negocioActivoId');

        // Llena todos los selectores encontrados
        selectors.forEach(selector => {
            while (selector.firstChild) selector.removeChild(selector.firstChild); // Limpia
            if (!negocios || negocios.length === 0) {
                selector.appendChild(new Option("No asignados", ""));
                return;
            }
            negocios.forEach(negocio => {
                selector.appendChild(new Option(negocio.nombre, negocio.id));
            });
            selector.value = idSeleccionado; // Preselecciona
        });
        
        console.log("Poblado finalizado. Negocio activo state:", appState.negocioActivoId);
    } catch (error) {
        console.error("Error en poblarSelectorNegocios:", error);
        mostrarNotificacion("Error al cargar negocios.", "error");
        selectors.forEach(selector => selector.innerHTML = '<option value="">Error</option>');
    }
}

// --- FUNCIÓN PRINCIPAL DE AUTENTICACIÓN (Restaurada) ---
export async function actualizarUIAutenticacion() {
    console.log("--- Iniciando actualizarUIAutenticacion ---");
    // --- CAMBIO AQUÍ: Limpiamos las clases de rol del body ANTES de hacer nada ---
    document.body.className = '';

    const user = getCurrentUser(); // Esto decodifica el token
    console.log("Usuario actual:", user);

    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar');

    if (user && user.nombre && user.rol) {
        console.log("Usuario válido. Actualizando UI...");
        try {
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol);
            
            // --- CAMBIO AQUÍ: Añadimos la clase del rol al body ---
            // Esto permite que el CSS (Sección 3) controle la visibilidad
            document.body.classList.add('rol-' + user.rol); // ej: "rol-admin", "rol-superadmin"

            if (mainNav) mainNav.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
                 console.log("Configurado enlace 'Salir'.");
            }
            
            // Carga los negocios (el backend filtra por rol)
            await poblarSelectorNegocios();
            console.log("Datos de negocio cargados.");

            // --- CAMBIO AQUÍ: ¡BORRAMOS la lógica de visibilidad de JS! ---
            // Ya no necesitamos esto, el CSS lo hace automáticamente.
            // document.querySelectorAll('.admin-only').forEach(el => { ... });
            console.log("Visibilidad por roles ahora controlada por CSS.");

            console.log("Actualización de UI base completada.");

            const requestedPage = window.location.hash.substring(1);
            const contentArea = document.getElementById('content-area');
            if (contentArea && (contentArea.innerHTML.trim() === '' || !requestedPage)) {
                console.log("Cargando home.html por defecto...");
                loadContent(null, 'static/home.html');
            } else if (requestedPage) {
                 console.log(`Hash #${requestedPage} detectado, cargando contenido...`);
                 loadContent(null, `static/${requestedPage}.html`);
            }

        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error);
            logout();
        }
    } else {
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

// --- FUNCIÓN DE INICIALIZACIÓN DE MÓDULOS (Restaurada) ---
async function inicializarModulo(page) {
    console.log(`inicializarModulo llamada con page = "${page}"`);
    if (!page) return;

    // --- CAMBIO AQUÍ: ¡BORRAMOS la lógica de visibilidad de JS! ---
    // El CSS en index.html (Sección 3 y 7) se encarga de esto globalmente.
    // if (appState.userRol) { ... }

    // --- IFs para cada página ---
    if (page.includes('inventario.html')) inicializarLogicaInventario();
    if (page.includes('login.html')) inicializarLogicaLogin();
    if (page.includes('clientes.html')) inicializarLogicaClientes();
    if (page.includes('usuarios.html')) inicializarLogicaUsuarios();
    if (page.includes('categorias.html')) inicializarLogicaCategorias();
    if (page.includes('dashboard.html')) inicializarLogicaDashboard();
    if (page.includes('caja.html')) inicializarLogicaCaja();
    if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
    if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias(); 
    if (page.includes('reportes.html')) inicializarLogicaReportes();
    if (page.includes('factura.html')) inicializarLogicaFactura();
    if (page.includes('verificador.html')) inicializarLogicaVerificador();    
    if (page.includes('payments.html')) inicializarLogicaPagosProveedores(); 

    if (page.includes('historial_ingresos.html')) inicializarLogicaHistorial();
    else if (page.includes('ingresos.html')) inicializarLogicaIngresos();
    if (page.includes('historial_ventas.html')) inicializarLogicaHistorialVentas();
    else if (page.includes('ventas.html')) inicializarLogicaVentas();
    if (page.includes('historial_ajustes.html')) inicializarLogicaHistorialAjustes();
    else if (page.includes('ajuste_caja.html')) inicializarLogicaAjusteCaja();
    if (page.includes('historial_presupuestos.html')) inicializarLogicaHistorialPresupuestos();
    else if (page.includes('presupuestos.html')) inicializarLogicaPresupuestos();
    if (page.includes('home.html')) {
        console.log("Módulo Home inicializado.");
        await poblarSelectorNegocios(); // Vuelve a poblar el selector del home
    }
    


    // --- Tus importaciones dinámicas ---
    if (page.includes('proveedores.html')) { 
        const { inicializarLogicaProveedores } = await import('./modules/proveedores.js');
        inicializarLogicaProveedores();
    }
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
    if (page.includes('unidades_medida.html')) {
        const { inicializarLogicaUnidadesMedida } = await import('./modules/unidades_medida.js');
        inicializarLogicaUnidadesMedida();
    }
    if (page.includes('historial_inventario.html')) {
        const { inicializarHistorialInventario } = await import('./modules/historial_inventario.js');
        inicializarHistorialInventario();
    }
    if (page.includes('precios_especificos.html')) {
        const { inicializarPreciosEspecificos } = await import('./modules/precios_especificos.js');
        inicializarPreciosEspecificos();
    }
}

// --- FUNCIÓN loadContent (CON LÓGICA DE HEADER/BARRA DE NEGOCIO CORREGIDA) ---
export function loadContent(event, page, clickedLink, fromHistory = false) {
    if (event) event.preventDefault();
    if (!fromHistory) {
        history.pushState({ page: page }, '', `#${page.replace('static/', '').replace('.html', '')}`);
    }
    const pageName = page.split('/').pop().replace('.html', '');
    loadPageCSS(pageName);
    
    const header = document.querySelector('header');
    const businessSelectorBar = document.getElementById('business-selector-bar');

    // Lógica de visibilidad de la CÁSCARA
    if (page.includes('login.html')) {
        // Si vamos al login, OCULTAMOS el header y la barra
        if (header) header.style.display = 'none';
        if (businessSelectorBar) businessSelectorBar.style.display = 'none';
    } else {
        // Si vamos a CUALQUIER OTRA PÁGINA, mostramos el header y la barra
        // (El JS en actualizarUIAutenticacion() ya se encarga de esto, pero 
        // esta es una buena redundancia por si acaso)
        if (getCurrentUser()) {
            if (header) header.style.display = 'flex';
            if (businessSelectorBar) businessSelectorBar.style.display = 'flex';
        }
    }

    const token = localStorage.getItem('jwt_token');
    if (!token && !page.includes('login.html')) {
        actualizarUIAutenticacion(); // Esto nos redirigirá al login
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

// --- ABRIR MODAL CLIENTE (COMPLETA) ---
export function abrirModalNuevoCliente(callback) {
    const modal = document.getElementById('modal-nuevo-cliente');
    if (modal) {
        onClienteCreadoCallback = callback;
        modal.style.display = 'flex';
        const form = document.getElementById('form-nuevo-cliente');
        if (form) form.reset();
    }
}

// --- INICIALIZACIÓN Y LISTENERS GLOBALES ---
document.addEventListener('DOMContentLoaded', () => {
    // Listener para el selector de negocio principal
    const mainSelector = document.getElementById('selector-negocio');
    if (mainSelector) {
        mainSelector.addEventListener('change', (e) => {
            console.log("Cambio de negocio en selector principal.");
            appState.negocioActivoId = e.target.value;
            localStorage.setItem('negocioActivoId', e.target.value); // Guarda la selección
            // Vuelve a cargar la página/módulo actual para refrescar los datos
            const currentPage = window.location.hash.substring(1) || 'home';
            loadContent(null, `static/${currentPage}.html`);
        });
    }

    // Listener para el selector del home (delegación de eventos)
    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'home-selector-negocio') {
            console.log("Cambio de negocio en selector del home.");
            appState.negocioActivoId = e.target.value;
            localStorage.setItem('negocioActivoId', e.target.value);
            // Recarga el home
            loadContent(null, 'static/home.html');
        }
    });

    window.addEventListener('authChange', actualizarUIAutenticacion);
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
             loadContent(null, e.state.page, null, true);
        }
    });
    
    // --- Lógica para el botón Hamburguesa (MEJORADA) ---
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navContainer = document.querySelector('.nav-container');

    if (hamburgerBtn && navContainer) {
        // 1. Alterna el menú al tocar la hamburguesa
        hamburgerBtn.addEventListener('click', () => {
            navContainer.classList.toggle('is-active');
        });

        // 2. Cierra el menú inteligentemente al tocar un enlace
        navContainer.addEventListener('click', (e) => {
            // Solo nos interesa si el clic fue en un <a>
            if (e.target.tagName !== 'A') {
                return;
            }

            // Comprobamos si el <a> es el TÍTULO de un dropdown
            // (En tu HTML, los títulos de dropdown tienen la clase 'dropbtn')
            const isDropdownToggle = e.target.classList.contains('dropbtn');

            // Si NO es un toggle de dropdown, es un enlace final
            // (como Home, Iniciar Sesión, etc.)
            // En ese caso, SÍ cerramos el menú.
            if (!isDropdownToggle) {
                navContainer.classList.remove('is-active');
            }
            
            // Si SÍ es un toggle, no hacemos nada y dejamos que el CSS
            // muestre/oculte el submenú.
        });
    }
        
    
    actualizarUIAutenticacion(); // Esta es la llamada inicial que arranca todo


    // --- ¡NUEVO BLOQUE PARA REGISTRAR EL SERVICE WORKER! ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((registration) => {
            console.log('¡Service Worker registrado con éxito! Alcance:', registration.scope);
          })
          .catch((error) => {
            console.log('Falló el registro del Service Worker:', error);
          });
      });
    }
    // --- FIN DEL NUEVO BLOQUE ---

});

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProducto = borrarProducto;
window.abrirModalEditarProducto = abrirModalEditarProducto;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.editarCategoria = editarCategoria;
window.borrarCategoria = borrarCategoria;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.borrarProveedor = borrarProveedor;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;