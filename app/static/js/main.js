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
// static/js/main.js

// ... (tus imports de siempre van aquí arriba) ...

// --- FUNCIÓN AUXILIAR DE VISIBILIDAD ---
function aplicarVisibilidadPorRoles() {
    if (!appState.userRol) {
        console.warn("aplicarVisibilidadPorRoles: No hay rol de usuario.");
        // Oculta todo si no hay rol
        document.querySelectorAll('.admin-only, .superadmin-only, .admin-operator-only').forEach(el => {
            if (el && el.style) el.style.display = 'none';
        });
        return;
    }
    console.log(`Aplicando visibilidad para rol: ${appState.userRol}`);
    
    const setDisplay = (elements, shouldShow) => {
        if (elements && elements.forEach) {
            elements.forEach(el => {
                if (el && el.style) {
                    el.style.display = shouldShow ? 'flex' : 'none'; // 'flex' es mejor para las tarjetas
                }
            });
        }
    };

    setDisplay( document.querySelectorAll('.admin-only'), (appState.userRol === 'admin' || appState.userRol === 'superadmin') );
    setDisplay( document.querySelectorAll('.superadmin-only'), (appState.userRol === 'superadmin') );
    setDisplay( document.querySelectorAll('.admin-operator-only'), (appState.userRol !== 'superadmin') );
    
    // Lógica del selector del Home (si existe en la página actual)
    const homeSelectorWrapper = document.getElementById('home-business-selector-wrapper');
     if (homeSelectorWrapper) {
         if (appState.userRol !== 'superadmin') {
            homeSelectorWrapper.classList.add('hide-element'); 
         } else {
            homeSelectorWrapper.classList.remove('hide-element'); 
         }
     }
}

// --- FUNCIÓN AUXILIAR PARA POBLAR SELECTORES ---
function poblarSelectoresConDatos(negocios) {
    console.log("Iniciando poblarSelectoresConDatos con:", negocios);
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');

    const fillSelector = (selector, selectorName) => {
        if (!selector) return; 
        while (selector.firstChild) selector.removeChild(selector.firstChild);

        if (!negocios || negocios.length === 0) {
            selector.appendChild(new Option("No asignados", ""));
            return;
        }

        console.log(`Poblando selector: ${selectorName}`);
        negocios.forEach((negocio) => {
            if (negocio && typeof negocio.id !== 'undefined' && typeof negocio.nombre !== 'undefined') {
                selector.appendChild(new Option(negocio.nombre, negocio.id));
            }
        });

        // --- Lógica de Preselección ---
        let idSeleccionado = negocios[0].id; // Default al primero
        const savedNegocioId = localStorage.getItem('negocioActivoId');
        
        if (savedNegocioId && negocios.some(n => String(n.id) === String(savedNegocioId))) {
            idSeleccionado = savedNegocioId;
        } else {
            appState.negocioActivoId = idSeleccionado;
            localStorage.setItem('negocioActivoId', appState.negocioActivoId);
        }
        
        selector.value = idSeleccionado;
        if (String(appState.negocioActivoId) !== String(idSeleccionado)) {
             appState.negocioActivoId = idSeleccionado;
             localStorage.setItem('negocioActivoId', appState.negocioActivoId);
        }
    };

    fillSelector(mainSelector, 'mainSelector');
    fillSelector(homeSelector, 'homeSelector');
    
    if (!appState.negocioActivoId && negocios && negocios.length > 0) {
         appState.negocioActivoId = negocios[0].id;
         localStorage.setItem('negocioActivoId', appState.negocioActivoId);
    } else if (!negocios || negocios.length === 0) {
         appState.negocioActivoId = null;
         localStorage.removeItem('negocioActivoId');
    }
    
    console.log("Poblado finalizado. Negocio activo state:", appState.negocioActivoId);
}

// --- FUNCIÓN PRINCIPAL DE AUTENTICACIÓN ---
export async function actualizarUIAutenticacion() {
    console.log("--- Iniciando actualizarUIAutenticacion ---");
    const user = getCurrentUser();
    console.log("Usuario actual:", user);
    
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar');
    const businessSelectorDropdown = document.getElementById('business-selector-dropdown');
    const businessDisplayName = document.getElementById('business-display-name');
    const activeBusinessNameDisplay = document.getElementById('active-business-name-display');

    // Oculta todo por defecto
    if (mainNav) mainNav.style.display = 'none';
    if (businessSelectorBar) businessSelectorBar.style.display = 'none';
    document.querySelectorAll('.admin-only, .superadmin-only, .admin-operator-only').forEach(el => {
        if (el && el.style) el.style.display = 'none';
    });

    if (user && user.nombre && user.rol) {
        console.log("Usuario válido. Actualizando UI...");
        try {
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol);

            if (mainNav) mainNav.style.display = 'flex';
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
            }

            let negocios = [];
            try {
                negocios = await fetchData('/api/negocios');
                console.log("Negocios recibidos del API:", negocios);
                poblarSelectoresConDatos(negocios);
                
                if (businessSelectorBar) businessSelectorBar.style.display = 'flex';

                if (appState.userRol === 'superadmin') {
                    if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'flex';
                    if (businessDisplayName) businessDisplayName.style.display = 'none';
                } else {
                    if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none';
                    if (businessDisplayName) businessDisplayName.style.display = 'flex';
                    if (appState.negocioActivoId && activeBusinessNameDisplay) {
                        const negocioActual = negocios.find(n => String(n.id) === String(appState.negocioActivoId));
                        activeBusinessNameDisplay.textContent = negocioActual ? negocioActual.nombre : "No asignado";
                    } else if (activeBusinessNameDisplay) {
                        activeBusinessNameDisplay.textContent = "No asignado";
                    }
                }
            } catch (error) {
                console.error("Error al obtener o procesar negocios:", error);
                // No llamamos a mostrarNotificacion aquí porque puede que aún no esté cargada
            }
            
            console.log("Actualización de UI base completada.");

            const requestedPage = window.location.hash.substring(1);
            const contentArea = document.getElementById('content-area');
            if (contentArea && (contentArea.innerHTML.trim() === '' || !requestedPage)) {
                console.log("Cargando home.html por defecto...");
                loadContent(null, 'static/home.html');
            } else {
                 console.log("Ya hay contenido o un hash, no se fuerza carga de home.");
                 aplicarVisibilidadPorRoles(); // Aplica visibilidad al contenido ya cargado
            }

        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error);
            logout();
        }
    } else {
        console.log("Usuario NO válido o no encontrado. Redirigiendo a login...");
        appState.userRol = null;
        if (!window.location.hash.includes('login')) {
             console.log("No estamos en login, cargando página de login...");
             loadContent(null, 'static/login.html');
        } else {
             console.log("Ya estamos en login.");
        }
    }
     console.log("--- Fin actualizarUIAutenticacion ---");
}
// --- FUNCIONES AUXILIARES ---
export function esAdmin() {
    return appState.userRol === 'admin';
}

// --- Función de Inicialización de Módulos ---
async function inicializarModulo(page) {
    console.log(`inicializarModulo llamada con page = "${page}"`);
    if (!page) return;

    // ✨ APLICA VISIBILIDAD CADA VEZ QUE SE CARGA UN MÓDULO ✨
    aplicarVisibilidadPorRoles(); 

    // --- El resto de tus IFs para cada página ---
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
    if (page.includes('precios_especificos.html')) {
        const { inicializarPreciosEspecificos } = await import('./modules/precios_especificos.js');
        inicializarPreciosEspecificos();
    }
    if (page.includes('home.html')) {
        console.log("Módulo Home inicializado.");
        // Ya no necesita hacer nada especial, todo se maneja en 'aplicarVisibilidadPorRoles' y 'actualizarUIAutenticacion'
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