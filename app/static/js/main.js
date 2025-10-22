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
    if (page.includes('negocios.html')) inicializarLogicaNegocios();
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
   console.log(`Verificando if para 'precios_especificos.html'. Valor de page: "${page}"`);
    if (page.includes('precios_especificos.html')) {
        console.log("Detectada página precios_especificos.html, intentando inicializar..."); // <-- Añadí este log
        try {
            const { inicializarPreciosEspecificos } = await import('./modules/precios_especificos.js');
            inicializarPreciosEspecificos();
            console.log("inicializarPreciosEspecificos() llamada."); // <-- Añadí este log
        } catch (error) {
             console.error("Error al importar o inicializar precios_especificos.js:", error); // <-- Añadí este log
        }
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


export async function actualizarUIAutenticacion() {
    const user = getCurrentUser();
    const mainNav = document.querySelector('header nav');
    const authLink = document.getElementById('auth-link');
    const businessSelector = document.getElementById('business-selector-bar');

    if (user && user.nombre) {
        try {
            appState.userRol = user.rol;
            if (mainNav) mainNav.style.display = 'flex';
            if (businessSelector) businessSelector.style.display = 'flex';
            if (authLink) {
                authLink.innerHTML = `Salir (${user.nombre})`;
                authLink.onclick = (e) => { e.preventDefault(); logout(); };
            }
            document.querySelectorAll('.admin-only').forEach(el => esAdmin() ? el.style.display = 'block' : el.style.display = 'none');
            
            const homeAuthLink = document.getElementById('home-auth-link');
            if (homeAuthLink) {
                homeAuthLink.innerHTML = `Salir (${user.nombre})`;
                homeAuthLink.onclick = (e) => { e.preventDefault(); logout(); };
            }
            await poblarSelectorNegocios();            
           
        } catch (error) {
            console.error("Fallo al validar token. Cerrando sesión.", error);
            logout();
        }
    } else {
        appState.userRol = null;
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelector) businessSelector.style.display = 'none';
        loadContent(null, 'static/login.html');
    }
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