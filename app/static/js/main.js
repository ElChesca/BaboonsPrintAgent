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
    // 1. Buscamos ambos posibles selectores.
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');
    
    // 2. Decidimos cuál usar. El del Home tiene prioridad si existe.
    const selectorNegocio = homeSelector || mainSelector;

    if (!selectorNegocio) return; // Si no hay ningún selector en la página, no hacemos nada.

    try {
        const negocios = await fetchData('/api/negocios');
        console.log("Negocios recibidos del API:", negocios);
        selectorNegocio.innerHTML = '';
        if (!negocios || negocios.length === 0) {
            selectorNegocio.innerHTML = '<option value="">No hay negocios asignados</option>';
            return;
        }
        negocios.forEach(negocio => {
            const option = new Option(negocio.nombre, negocio.id);
            selectorNegocio.appendChild(option);
        });
        
        let idSeleccionado = negocios[0].id;
        if (appState.negocioActivoId && negocios.some(n => n.id == appState.negocioActivoId)) {
            idSeleccionado = appState.negocioActivoId;
        }
        
        selectorNegocio.value = idSeleccionado;
        
        // 3. Sincronizamos el estado de la aplicación con el valor del selector.
        // Esto es importante para la primera carga.
        if (appState.negocioActivoId !== idSeleccionado) {
            appState.negocioActivoId = idSeleccionado;
            // Disparamos el evento 'change' para que la página se recargue si es necesario.
            selectorNegocio.dispatchEvent(new Event('change'));
        } else {
             appState.negocioActivoId = idSeleccionado;
        }
        
    } catch (error) {
        selectorNegocio.innerHTML = '<option value="">Error al cargar</option>';
        throw error;
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
    console.log("--- Iniciando actualizarUIAutenticacion ---"); // LOG 1
    
    // --- Declaraciones de Variables al Principio ---
    const user = getCurrentUser();
    console.log("Usuario actual:", user); // LOG 2
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar');
    const businessSelectorDropdown = document.getElementById('business-selector-dropdown');
    const businessDisplayName = document.getElementById('business-display-name');
    const activeBusinessNameDisplay = document.getElementById('active-business-name-display');

    if (user && user.nombre) {
        console.log("Usuario válido encontrado. Actualizando UI..."); // LOG 3
        try {
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol); // LOG 4

            // Muestra barras (si existen)
            if (mainNav) { mainNav.style.display = 'flex'; console.log("Mostrando nav principal."); } // LOG 5
            if (businessSelectorBar) { businessSelectorBar.style.display = 'flex'; console.log("Mostrando barra de negocio."); } // LOG 6

            // Configura enlace Salir
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
                 console.log("Configurado enlace 'Salir'."); // LOG 7
            }

            // --- Lógica Visibilidad Selector Negocio ---
            console.log("Aplicando lógica de visibilidad del selector de negocio..."); // LOG 8

            if (appState.userRol === 'superadmin') {
                if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'flex';
                if (businessDisplayName) businessDisplayName.style.display = 'none';
                console.log("Es SuperAdmin, poblando selector..."); // LOG 9
                await poblarSelectorNegocios(); // Poblar para SuperAdmin
                console.log("Selector poblado."); // LOG 10
            } else { // Admin u Operador
                if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none';
                if (businessDisplayName) businessDisplayName.style.display = 'flex';
                console.log("No es SuperAdmin, mostrando nombre de negocio..."); // LOG 11

                if (appState.negocioActivoId && activeBusinessNameDisplay) {
                     const selector = document.getElementById('selector-negocio');
                     // Aseguramos que poblarSelectorNegocios se ejecute ANTES para tener las opciones
                     // Si no es superadmin, igual necesitamos los datos para mostrar el nombre.
                     // Considera llamar a poblarSelectorNegocios() siempre ANTES de este bloque if/else.
                     // (Moviendo la llamada fuera y antes) - Por ahora lo dejamos así para ver si llega.
                     console.log("Intentando obtener nombre de negocio activo ID:", appState.negocioActivoId); // LOG 12
                     const selectedOption = selector ? Array.from(selector.options).find(opt => opt.value == appState.negocioActivoId) : null;
                     if (selectedOption) {
                         activeBusinessNameDisplay.textContent = selectedOption.text;
                         console.log("Nombre encontrado:", selectedOption.text); // LOG 13
                     } else {
                         activeBusinessNameDisplay.textContent = `ID ${appState.negocioActivoId}`;
                         console.warn("No se encontró el nombre del negocio en el selector poblado."); // LOG 14
                     }
                 } else if (activeBusinessNameDisplay) {
                     activeBusinessNameDisplay.textContent = "No asignado";
                     console.log("No hay negocio activo o elemento display no encontrado."); // LOG 15
                 }
            }
            // --- Fin Lógica Selector ---

            // Muestra/oculta elementos .admin-only y .superadmin-only
            console.log("Aplicando visibilidad por roles..."); // LOG 16
            
            // Función auxiliar para manejar la visibilidad
            const setDisplay = (elements, shouldShow) => {
                if (elements && typeof elements.forEach === 'function') { // Verifica si es una NodeList válida
                    elements.forEach(el => {
                        if (el && el.style) { // Verifica si el elemento y su 'style' existen
                            el.style.display = shouldShow ? 'block' : 'none';
                        } else {
                            console.warn("Elemento inválido encontrado:", el);
                        }
                    });
                } else {
                     console.warn("Resultado inesperado de querySelectorAll:", elements);
                }
            };
            // Aplica la lógica para cada clase
            setDisplay(
                document.querySelectorAll('.admin-only'), 
                (appState.userRol === 'admin' || appState.userRol === 'superadmin')
            );
            setDisplay(
                document.querySelectorAll('.superadmin-only'), 
                (appState.userRol === 'superadmin')
            );
            setDisplay(
                document.querySelectorAll('.admin-operator-only'), 
                (appState.userRol !== 'superadmin')
            );

             // Lógica para ocultar selector del HOME si NO es SuperAdmin
             const homeSelectorWrapper = document.getElementById('home-business-selector-wrapper');
              if (homeSelectorWrapper) { /* ... tu lógica add/remove hide-element ... */ }
            
            console.log("Actualización de UI completada."); // LOG 17

            // ✨ CARGA INICIAL DEL CONTENIDO (SI NO HAY NADA CARGADO) ✨
            // Si después de todo esto, el content-area está vacío, carga el home por defecto
            const contentArea = document.getElementById('content-area');
            if (contentArea && contentArea.innerHTML.trim() === '' && !window.location.hash) {
                 console.log("Content area vacío, cargando home por defecto..."); // LOG 18
                 loadContent(null, 'static/home.html'); 
            }


        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error); // LOG DE ERROR GRAVE
            logout();
        }
    } else { // No hay usuario
        console.log("Usuario NO válido o no encontrado. Redirigiendo a login..."); // LOG SIN USUARIO
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
     console.log("--- Fin actualizarUIAutenticacion ---"); // LOG FINAL
}

// ... (El resto de tu main.js)

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