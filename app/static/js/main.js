// app/static/js/main.js
import { fetchData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
import { inicializarLogicaClientes, editarCliente, borrarCliente } from './modules/clientes.js';
import { inicializarLogicaIngresos } from './modules/ingresos.js';
import { inicializarLogicaVentas } from './modules/sales.js';
import { inicializarLogicaUsuarios, abrirModalEditarUsuario } from './modules/users.js';
import { inicializarLogicaHistorial, mostrarDetalle as mostrarDetalleIngreso } from './modules/historial_ingresos.js';
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
        // Verificamos si el archivo existe antes de añadirlo.
        fetch(link.href).then(res => {
            if (res.ok) {
                 document.head.appendChild(link);
            } else {
                // Esto ayuda a depurar el error 404
                console.error(`Error 404: No se encontró el archivo CSS en ${link.href}`);
            }
        });
    }
}

// --- FUNCIONES AUXILIARES ---
export function esAdmin() {
    return appState.userRol === 'admin';
}

function inicializarModulo(page) {
    if (!page) return;
    if (page.includes('inventario.html')) inicializarLogicaInventario();
    if (page.includes('login.html')) inicializarLogicaLogin();
    if (page.includes('negocios.html')) inicializarLogicaNegocios();
    if (page.includes('clientes.html')) inicializarLogicaClientes();
    if (page.includes('ingresos.html')) inicializarLogicaIngresos();
    if (page.includes('ventas.html')) inicializarLogicaVentas();
    if (page.includes('usuarios.html')) inicializarLogicaUsuarios();
    if (page.includes('historial_ingresos.html')) inicializarLogicaHistorial();
    if (page.includes('historial_ventas.html')) inicializarLogicaHistorialVentas();
    if (page.includes('categorias.html')) inicializarLogicaCategorias();
    if (page.includes('dashboard.html')) inicializarLogicaDashboard();
    if (page.includes('caja.html')) inicializarLogicaCaja();
    if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
    if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias();
    if (page.includes('proveedores.html')) inicializarLogicaProveedores();
    if (page.includes('reportes.html')) inicializarLogicaReportes();
}

// --- FUNCIONES PRINCIPALES DE FLUJO ---
export function loadContent(event, page, clickedLink) {
    if (event) event.preventDefault();
    
    // ✨ Extrae el nombre base (ej: 'ventas') y llama a la función para cargar su CSS.
    const pageName = page.split('/').pop().replace('.html', '');
    loadPageCSS(pageName);

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
            setTimeout(() => inicializarModulo(page), 0);
        })
        .catch(error => {
            console.error(error);
            loadPageCSS(null); // Si falla la carga, quitamos el CSS.
        });
}



export async function actualizarUIAutenticacion() {
    const user = getCurrentUser();
    const mainNav = document.getElementById('main-nav');
    const authLink = document.getElementById('auth-link');
    const businessSelector = document.getElementById('business-selector-bar');

    if (user && user.nombre) {
        appState.userRol = user.rol;
        if (mainNav) mainNav.style.display = 'flex';
        if (businessSelector) businessSelector.style.display = 'flex';
        if (authLink) {
            authLink.innerHTML = `Salir (${user.nombre})`;
            authLink.onclick = (e) => { e.preventDefault(); logout(); };
        }
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = esAdmin() ? 'block' : 'none');
        await poblarSelectorNegocios();
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
    window.addEventListener('authChange', actualizarUIAutenticacion);
    actualizarUIAutenticacion();
});

// --- EXPOSICIÓN DE FUNCIONES GLOBALES (SIN DUPLICADOS) ---
window.loadContent = loadContent;
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

