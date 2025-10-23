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

export function abrirModalNuevoCliente(callback) {
    const modal = document.getElementById('modal-nuevo-cliente');
    if (modal) {
        onClienteCreadoCallback = callback;
        modal.style.display = 'flex';
        document.getElementById('form-nuevo-cliente').reset();
    }
}
// en static/js/main.js

// Función auxiliar (reemplaza la que tenías)
function poblarSelectoresConDatos(negocios) {
    console.log("Iniciando poblarSelectoresConDatos con:", negocios);
    const mainSelector = document.getElementById('selector-negocio');
    const homeSelector = document.getElementById('home-selector-negocio');

    const fillSelector = (selector, selectorName) => {
        if (!selector) {
            // console.log(`Selector ${selectorName} no encontrado.`);
            return; 
        }
        while (selector.firstChild) {
            selector.removeChild(selector.firstChild);
        }

        if (!negocios || negocios.length === 0) {
            selector.appendChild(new Option("No asignados", ""));
            return;
        }

        console.log(`Entrando al bucle forEach para ${selectorName}...`);
        negocios.forEach((negocio, index) => {
            if (negocio && typeof negocio.id !== 'undefined' && typeof negocio.nombre !== 'undefined') {
                const option = new Option(negocio.nombre, negocio.id);
                selector.appendChild(option);
            } else {
                 console.warn(`  Elemento inválido en negocios[${index}]:`, negocio);
            }
        });
        console.log(`Bucle forEach para ${selectorName} completado.`);

        // --- Lógica de Preselección ---
        let idSeleccionado = null;
        if (negocios.length > 0) {
            idSeleccionado = negocios[0].id;
            // Intenta usar el negocio guardado en appState si es válido
            if (appState.negocioActivoId && negocios.some(n => String(n.id) === String(appState.negocioActivoId))) {
                idSeleccionado = appState.negocioActivoId;
            } else {
                // Si no hay appState o no es válido, usa el primero y actualiza
                appState.negocioActivoId = idSeleccionado;
                localStorage.setItem('negocioActivoId', appState.negocioActivoId);
                console.log("Estableciendo negocio activo inicial a:", idSeleccionado);
            }
            selector.value = idSeleccionado;
            console.log(`Preseleccionado en ${selectorName}: ${idSeleccionado}`);
        } else {
             appState.negocioActivoId = null;
             localStorage.removeItem('negocioActivoId');
        }

        if (String(appState.negocioActivoId) !== String(idSeleccionado) && idSeleccionado !== null) {
             appState.negocioActivoId = idSeleccionado;
             localStorage.setItem('negocioActivoId', appState.negocioActivoId);
             console.log("Actualizando appState.negocioActivoId a:", idSeleccionado);
        }
    };

    fillSelector(mainSelector, 'mainSelector');
    fillSelector(homeSelector, 'homeSelector');
    console.log("Llenado de selectores finalizado. Negocio activo state:", appState.negocioActivoId);
}


// --- Función Principal REESTRUCTURADA ---
export async function actualizarUIAutenticacion() {
    console.log("--- Iniciando actualizarUIAutenticacion ---");
    
    // --- Declaraciones de Variables ---
    const user = getCurrentUser();
    console.log("Usuario actual:", user); 
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelectorBar = document.getElementById('business-selector-bar'); 
    const businessSelectorDropdown = document.getElementById('business-selector-dropdown');
    const businessDisplayName = document.getElementById('business-display-name'); 
    const activeBusinessNameDisplay = document.getElementById('active-business-name-display');

    // Oculta elementos por defecto
    if (mainNav) mainNav.style.display = 'none';
    if (businessSelectorBar) businessSelectorBar.style.display = 'none';
    document.querySelectorAll('.admin-only, .superadmin-only, .admin-operator-only').forEach(el => {
        if (el && el.style) el.style.display = 'none';
    });


    // --- Lógica Principal: ¿Hay usuario? ---
    if (user && user.nombre && user.rol) {
        console.log("Usuario válido. Actualizando UI...");
        try {
            appState.userRol = user.rol;
            console.log("Rol asignado:", appState.userRol);

            // Muestra nav y enlace Salir
            if (mainNav) mainNav.style.display = 'flex'; 
            if (authLink) {
                 authLink.innerHTML = `Salir (${user.nombre})`;
                 authLink.onclick = (e) => { e.preventDefault(); logout(); };
                 console.log("Configurado enlace 'Salir'."); 
            }

            // --- Carga de Negocios y Lógica del Selector ---
            console.log("Aplicando lógica selector negocio..."); 
            let negocios = [];
            try {
                // 1. Carga los negocios (el backend ya filtra por rol)
                negocios = await fetchData('/api/negocios');
                console.log("Negocios recibidos del API:", negocios);

                // 2. Puebla los selectores con los datos recibidos
                poblarSelectoresConDatos(negocios); 
                
                // 3. Muestra la barra
                if (businessSelectorBar) businessSelectorBar.style.display = 'flex';

                // 4. Decide qué mostrar DENTRO de la barra
                if (appState.userRol === 'superadmin') {
                    if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'flex'; // Muestra dropdown
                    if (businessDisplayName) businessDisplayName.style.display = 'none'; // Oculta texto
                    console.log("Mostrando dropdown para SuperAdmin");
                } else { // Admin u Operador
                    if (businessSelectorDropdown) businessSelectorDropdown.style.display = 'none'; // Oculta dropdown
                    if (businessDisplayName) businessDisplayName.style.display = 'flex'; // Muestra texto
                    console.log("Mostrando nombre negocio para Admin/Operador");
                    
                    // 5. Actualiza el nombre del negocio (ahora sí tiene los datos)
                    if (appState.negocioActivoId && activeBusinessNameDisplay) {
                        const negocioActual = negocios.find(n => String(n.id) === String(appState.negocioActivoId));
                        activeBusinessNameDisplay.textContent = negocioActual ? negocioActual.nombre : "No asignado";
                    } else if (activeBusinessNameDisplay) {
                        activeBusinessNameDisplay.textContent = "No asignado";
                    }
                }
            } catch (error) {
                console.error("Error al obtener o procesar negocios:", error);
                mostrarNotificacion("Error al cargar datos del negocio.", "error");
            }
            // --- Fin Lógica Selector ---

            // --- Lógica de Visibilidad por Roles (se ejecuta después) ---
            console.log("Aplicando visibilidad por roles..."); 
            const setDisplay = (elements, shouldShow) => {
                if (elements && typeof elements.forEach === 'function') {
                    elements.forEach(el => {
                        if (el && el.style) {
                            el.style.display = shouldShow ? 'flex' : 'none'; 
                        }
                    });
                }
            };
            setDisplay( document.querySelectorAll('.admin-only'), (appState.userRol === 'admin' || appState.userRol === 'superadmin') );
            setDisplay( document.querySelectorAll('.superadmin-only'), (appState.userRol === 'superadmin') );
            setDisplay( document.querySelectorAll('.admin-operator-only'), (appState.userRol !== 'superadmin') );
            // --- Fin Lógica Roles ---

            // Lógica selector home
            const homeSelectorWrapper = document.getElementById('home-business-selector-wrapper');
             if (homeSelectorWrapper) {
                 if (appState.userRol !== 'superadmin') {
                    homeSelectorWrapper.classList.add('hide-element'); 
                 } else {
                    homeSelectorWrapper.classList.remove('hide-element'); 
                 }
             }
            
            console.log("Actualización de UI base completada.");

            // --- Carga de Contenido Inicial ---
            const requestedPage = window.location.hash.substring(1); 
            const contentArea = document.getElementById('content-area');
            if (contentArea && contentArea.innerHTML.trim() === '' && !requestedPage) {
                console.log("Cargando home.html por defecto...");
                loadContent(null, 'static/home.html'); 
            } else {
                 console.log("Ya hay contenido o un hash, no se fuerza carga de home.");
            }

        } catch (error) {
            console.error("Fallo DENTRO del bloque try de actualizarUIAutenticacion. Cerrando sesión.", error); 
            logout(); 
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