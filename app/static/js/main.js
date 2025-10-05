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

async function poblarSelectorNegocios() {
    // ... (esta función se queda como está en tu última versión funcional)
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

    // ✨ 2. CORRECCIÓN DE SEGURIDAD: Añadimos comprobaciones
    if (user) {
        if (mainNav) mainNav.style.display = 'flex';
        if (authLink) {
            authLink.innerHTML = `Salir (${user.rol})`;
            authLink.onclick = (e) => { e.preventDefault(); logout(); };
        }
        if (businessSelector) businessSelector.style.display = 'flex';
        
        await poblarSelectorNegocios();
        
    } else {
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelector) businessSelector.style.display = 'none';
        // ✨ 3. CORRECCIÓN DE RUTA: Pasamos la ruta completa
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