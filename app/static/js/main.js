// app/static/js/main.js
import { fetchData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
import { inicializarLogicaClientes, editarCliente, borrarCliente } from './modules/clientes.js';
import { inicializarLogicaIngresos, quitarItem } from './modules/ingresos.js';
import { inicializarLogicaVentas, quitarItemDeVenta } from './modules/sales.js';
import { inicializarLogicaUsuarios, abrirModalEditarUsuario } from './modules/users.js';
import { inicializarLogicaHistorial, mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js'; // Renombramos para evitar colisión
import { inicializarLogicaNegocios } from './modules/negocios.js';
import { inicializarLogicaHistorialVentas, mostrarDetalleVenta } from './modules/historial_ventas.js';
import { inicializarLogicaInventario, abrirModalEditarProducto, borrarProducto } from './modules/inventory.js';
import { inicializarLogicaCategorias, editarCategoria, borrarCategoria } from './modules/categorias.js'; 
import { inicializarLogicaReportes } from './modules/reportes.js';
import { inicializarLogicaDashboard } from './modules/dashboard.js';
import { inicializarLogicaCaja } from './modules/caja.js';
import { inicializarLogicaReporteCaja, mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarLogicaReporteGanancias } from './modules/reporte_ganancias.js';
import { inicializarLogicaProveedores, editarProveedor, borrarProveedor } from './modules/proveedores.js';

export const appState = {
    negocioActivoId: null
};
// En app/static/js/main.js
async function poblarSelectorNegocios() {
    const selectorNegocio = document.getElementById('selector-negocio');
    if (!selectorNegocio) {
        console.error("CRÍTICO: No se encontró el elemento #selector-negocio en index.html");
        return;
    }

    try {
        const negocios = await fetchData('/api/negocios');
        
        selectorNegocio.innerHTML = ''; // Limpia el "Cargando..."

        if (!negocios || negocios.length === 0) {
            selectorNegocio.innerHTML = '<option value="">No tienes negocios asignados</option>';
            appState.negocioActivoId = null;
            // Forzamos la recarga del módulo actual para que muestre el estado "sin negocio"
            const linkActivo = document.querySelector('nav a.active, .dropdown-content a.active');
            if (linkActivo) {
                 const pageFile = linkActivo.getAttribute('onclick').match(/'(.*?\.html)'/)[1];
                 loadContent(null, pageFile, linkActivo);
            }
            return;
        }

        negocios.forEach(negocio => {
            const option = new Option(negocio.nombre, negocio.id);
            selectorNegocio.appendChild(option);
        });

        // Lógica para preseleccionar el negocio
        const idPrevio = appState.negocioActivoId;
        let idSeleccionado = negocios[0].id; // Por defecto el primero
        if (idPrevio && negocios.some(n => n.id == idPrevio)) {
            idSeleccionado = idPrevio;
        }
        
        selectorNegocio.value = idSeleccionado;
        
        // Disparamos el evento 'change' solo si el ID es nuevo o no había ninguno
        if (appState.negocioActivoId !== idSeleccionado) {
            selectorNegocio.dispatchEvent(new Event('change'));
        } else {
            // Si el ID es el mismo, pero el módulo no cargó (primer login), forzamos la carga
            appState.negocioActivoId = idSeleccionado;
            const activeLink = document.querySelector('nav a.active, .dropdown-content a.active');
            if (activeLink) {
                 const pageFile = activeLink.getAttribute('onclick').match(/'(.*?\.html)'/)[1];
                 inicializarModulo(pageFile);
            }
        }

    } catch (error) {
        console.error("Error al poblar selector de negocios:", error);
        selectorNegocio.innerHTML = '<option value="">Error al cargar negocios</option>';
    }
}

export function loadContent(event, page, clickedLink) {
    if (event) event.preventDefault();
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
    
    // ✨ 1. CORRECCIÓN PRINCIPAL: Usamos 'page' directamente.
    // El 'onclick' en el HTML ya debe incluir la ruta completa 'static/pagina.html'.
    fetch(page)
        .then(response => response.ok ? response.text() : Promise.reject(`Error al cargar ${page}`))
        .then(html => {
            document.getElementById('content-area').innerHTML = html;
            
            // Separamos la inicialización para claridad
            inicializarModulo(page);
        })
        .catch(console.error);
}

function inicializarModulo(page) {
    if (page.includes('inventario.html')) inicializarLogicaInventario();
    if (page.includes('login.html')) inicializarLogicaLogin();
    if (page.includes('negocios.html')) inicializarLogicaNegocios();
    if (page.includes('usuarios.html')) inicializarLogicaUsuarios();
    if (page.includes('ingresos.html')) inicializarLogicaIngresos();
    if (page.includes('ventas.html')) inicializarLogicaVentas();
    if (page.includes('clientes.html')) inicializarLogicaClientes();
    if (page.includes('categorias.html')) inicializarLogicaCategorias();
    if (page.includes('dashboard.html')) inicializarLogicaDashboard();
    if (page.includes('caja.html')) inicializarLogicaCaja();
    if (page.includes('historial_ventas.html')) inicializarLogicaHistorialVentas();
    if (page.includes('historial_ingresos.html')) inicializarLogicaHistorial();
    if (page.includes('reportes.html')) inicializarLogicaReportes();    
    if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
    if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias();
    if (page.includes('proveedores.html')) inicializarLogicaProveedores();
}

export async function actualizarUIAutenticacion() {
    const user = getCurrentUser();
    const mainNav = document.getElementById('main-nav');
    const authLink = document.getElementById('auth-link');
    const businessSelector = document.getElementById('business-selector-bar');

    if (user) {
        // Hacemos visibles los elementos de navegación si existen
        if (mainNav) mainNav.style.display = 'flex';
        if (businessSelector) businessSelector.style.display = 'flex';
        
        if (authLink) {
            authLink.innerHTML = `Salir (${user.rol})`;
            authLink.onclick = (e) => { e.preventDefault(); logout(); };
        }
        
        // El 'await' aquí es crucial para asegurar que tengamos un negocio antes de continuar
        await poblarSelectorNegocios();
        
        // Verificamos si ya hay un contenido cargado, si no, cargamos el dashboard
        const contentArea = document.getElementById('content-area');
        if (contentArea && contentArea.innerHTML.trim() === "") {
             loadContent(null, 'static/dashboard.html');
        }
        
    } else {
        // Ocultamos los elementos de navegación si existen
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelector) businessSelector.style.display = 'none';
        
        // Cargamos el login
        loadContent(null, 'static/login.html');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // ... (tu listener para 'selector-negocio' se queda igual)
    window.addEventListener('authChange', actualizarUIAutenticacion);
    actualizarUIAutenticacion();
});

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
// ✨ 4. CORRECCIÓN: Nos aseguramos de que todo lo que se expone, se importa.
window.loadContent = loadContent;
window.quitarItemDeVenta = quitarItemDeVenta;
window.quitarItem = quitarItem;
window.borrarProducto = borrarProducto;
window.abrirModalEditarProducto = abrirModalEditarProducto;
window.editarCliente = editarCliente;
window.borrarCliente = borrarCliente;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalleVenta = mostrarDetalleVenta;
window.mostrarDetalleIngreso = mostrarDetalleIngreso;
window.editarCategoria = editarCategoria;
window.borrarCategoria = borrarCategoria;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.editarProveedor = editarProveedor;
window.borrarProveedor = borrarProveedor;