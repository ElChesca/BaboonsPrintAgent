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
    userRol: null
};

export function esAdmin() {
    return appState.userRol === 'admin';
}

async function poblarSelectorNegocios() {
    const selectorNegocio = document.getElementById('selector-negocio');
    if (!selectorNegocio) return;
    try {
        const negocios = await fetchData('/api/negocios');
        selectorNegocio.innerHTML = '';
        if (!Array.isArray(negocios) || negocios.length === 0) {
            selectorNegocio.innerHTML = '<option value="">No hay negocios asignados</option>';
            appState.negocioActivoId = null; 
            return;
        }
        negocios.forEach(negocio => {
            const option = new Option(negocio.nombre, negocio.id);
            selectorNegocio.appendChild(option);
        });

        const idPrevio = appState.negocioActivoId;
        let idSeleccionado = negocios[0].id; 
        if (idPrevio && negocios.some(n => n.id == idPrevio)) {
            idSeleccionado = idPrevio;
        }
        
        selectorNegocio.value = idSeleccionado;
        
        if (appState.negocioActivoId !== idSeleccionado) {
            appState.negocioActivoId = idSeleccionado;
            selectorNegocio.dispatchEvent(new Event('change'));
        } else if (!appState.negocioActivoId) {
            selectorNegocio.dispatchEvent(new Event('change'));
        } else {
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
    
    fetch(page)
        .then(response => response.ok ? response.text() : Promise.reject('Error al cargar.'))
        .then(html => {
            document.getElementById('content-area').innerHTML = html;
            setTimeout(() => inicializarModulo(page), 0);
        })
        .catch(console.error);
}

function inicializarModulo(page) {
    if (!page) return;
    if (page.includes('inventario.html')) inicializarLogicaInventario();
    if (page.includes('login.html')) inicializarLogicaLogin();
    // ... etc.
    if (page.includes('proveedores.html')) inicializarLogicaProveedores();
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
// ... (resto de tus window.functions)