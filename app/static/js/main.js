// app/static/js/main.js
import { fetchData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
import { inicializarLogicaClientes, editarCliente, borrarCliente } from './modules/clientes.js';
import { inicializarLogicaIngresos, quitarItem } from './modules/ingresos.js';
import { inicializarLogicaVentas, quitarItemDeVenta } from './modules/sales.js';
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

export const appState = {
    negocioActivoId: null,
    userRol: null // ✨ Guardamos el rol del usuario aquí
};

// ✨ Nueva función para chequear permisos
export function esAdmin() {
    return appState.userRol === 'admin';
}


// En app/static/js/main.js

async function poblarSelectorNegocios() {
    const selectorNegocio = document.getElementById('selector-negocio');
    if (!selectorNegocio) {
        console.error("CRÍTICO: No se encontró el elemento #selector-negocio en index.html");
        return;
    }

    try {
        const negocios = await fetchData('/api/negocios');
        
        selectorNegocio.innerHTML = ''; // Limpia el contenido previo

        if (!Array.isArray(negocios) || negocios.length === 0) {
            selectorNegocio.innerHTML = '<option value="">No hay negocios asignados</option>';
            appState.negocioActivoId = null; 
            // Si no hay negocios, no podemos cargar nada más, pero no disparamos 'change'.
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
        
        // Si el estado global no coincide con lo seleccionado, actualizamos y disparamos el cambio
        if (appState.negocioActivoId !== idSeleccionado) {
            appState.negocioActivoId = idSeleccionado;
            selectorNegocio.dispatchEvent(new Event('change'));
        } else {
            // Si ya estaba bien, pero el módulo no cargó (ej. primer login), lo forzamos
            const activeLink = document.querySelector('nav a.active, .dropdown-content a.active');
            if (activeLink) {
                 const pageFile = activeLink.getAttribute('onclick').match(/'(.*?\.html)'/)[1];
                 inicializarModulo(pageFile); // Llamamos a la carga de datos del módulo actual
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
    
    // ✨ CORRECCIÓN CLAVE: El fetch debe apuntar a la ruta que le pasas
    fetch(page)
        .then(response => response.ok ? response.text() : Promise.reject('Error al cargar.'))
        .then(html => {
            document.getElementById('content-area').innerHTML = html;
            inicializarModulo(page);
        })
        .catch(console.error);
}

function inicializarModulo(page) {
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
    if (page.includes('reportes.html')) inicializarLogicaReportes();
    if (page.includes('dashboard.html')) inicializarLogicaDashboard();
    if (page.includes('caja.html')) inicializarLogicaCaja();
    if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
    if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias();        
    if (page.includes('proveedores.html')) inicializarLogicaProveedores();
}

export async function actualizarUIAutenticacion() {
    const user = getCurrentUser();
    const mainNav = document.getElementById('main-nav');
    const authLink = document.getElementById('auth-link');
    const businessSelector = document.getElementById('business-selector-bar');

    if (user && user.nombre) {
        // --- Si el usuario está logueado ---
        appState.userRol = user.rol;
        if (mainNav) mainNav.style.display = 'flex';
        if (businessSelector) businessSelector.style.display = 'flex';
        if (authLink) {
            authLink.innerHTML = `Salir (${user.nombre})`;
            authLink.onclick = (e) => { e.preventDefault(); logout(); };
        }
        
        // Carga la lista de negocios en el selector
        await poblarSelectorNegocios();
        
        // ✨ CORRECCIÓN CLAVE:
        // Verificamos si ya hay un contenido principal. Si no lo hay (primer login),
        // cargamos el Dashboard por defecto.
        const contentArea = document.getElementById('content-area');
        if (contentArea && contentArea.innerHTML.trim() === "") {
             loadContent(null, 'static/dashboard.html');
        }

    } else {
        // --- Si el usuario NO está logueado ---
        appState.userRol = null;
        if (mainNav) mainNav.style.display = 'none';
        if (businessSelector) businessSelector.style.display = 'none';
        
        // Limpiamos el contenido principal y cargamos solo el login
        const contentArea = document.getElementById('content-area');
        if(contentArea) contentArea.innerHTML = "";
        loadContent(null, 'static/login.html');
    }
}

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

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProducto = borrarProducto; 
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
