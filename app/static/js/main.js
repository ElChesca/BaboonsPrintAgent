// app/static/js/main.js
import { fetchData } from './api.js';
import { inicializarLogicaLogin, getCurrentUser, logout } from './modules/auth.js';
// ... (todos tus otros imports de inicialización)
import { inicializarLogicaProveedores, editarProveedor, borrarProveedor } from './modules/proveedores.js';

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
export const appState = {
    negocioActivoId: null
};

// --- LÓGICA PRINCIPAL ---
async function poblarSelectorNegocios() {
    const selectorNegocio = document.getElementById('selector-negocio');
    if (!selectorNegocio) return;
    try {
        const negocios = await fetchData('/api/negocios');
        selectorNegocio.innerHTML = '';
        if (negocios.length === 0) {
            selectorNegocio.innerHTML = '<option value="">No tienes negocios asignados</option>';
            return;
        }
        negocios.forEach(negocio => {
            const option = new Option(negocio.nombre, negocio.id);
            selectorNegocio.appendChild(option);
        });

        const idPrevio = appState.negocioActivoId;
        if (idPrevio && negocios.some(n => n.id == idPrevio)) {
            selectorNegocio.value = idPrevio;
        } else {
            selectorNegocio.value = negocios[0].id;
        }
        // ✨ Disparamos el evento 'change' para que la app reaccione
        selectorNegocio.dispatchEvent(new Event('change'));

    } catch (error) {
        selectorNegocio.innerHTML = '<option value="">Error al cargar</option>';
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
    
    fetch(`/static/${page}`)
        .then(response => response.ok ? response.text() : Promise.reject('Error al cargar.'))
        .then(html => {
            document.getElementById('content-area').innerHTML = html;
            
            // La inicialización ahora se dispara con el evento 'change' del selector de negocio
            const activeLink = document.querySelector('nav a.active, .dropdown-content a.active');
            if (activeLink && appState.negocioActivoId) {
                 inicializarModulo(page);
            }
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
        mainNav.style.display = 'flex';
        authLink.innerHTML = `Salir (${user.rol})`;
        authLink.onclick = (e) => { e.preventDefault(); logout(); };
        businessSelector.style.display = 'flex';
        
        await poblarSelectorNegocios();
        
    } else {
        mainNav.style.display = 'none';
        businessSelector.style.display = 'none';
        loadContent(null, 'login.html');
    }
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('selector-negocio').addEventListener('change', (e) => {
        appState.negocioActivoId = e.target.value;
        const linkActivo = document.querySelector('nav a.active, .dropdown-content a.active');
        if (linkActivo) {
            // Re-ejecutamos loadContent para refrescar el módulo con el nuevo ID de negocio
            const pageFile = linkActivo.getAttribute('onclick').match(/'(.*?\.html)'/)[1];
            loadContent(null, pageFile, linkActivo);
        }
    });

    window.addEventListener('authChange', actualizarUIAutenticacion);
    actualizarUIAutenticacion();
});

// --- EXPOSICIÓN DE FUNCIONES GLOBALES ---
window.loadContent = loadContent;
window.borrarProducto = borrarProducto;
window.editarCliente = editarCliente;
window.borrarCliente = borrarCliente;
window.quitarItem = quitarItem;
window.quitarItemDeVenta = quitarItemDeVenta;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.mostrarDetalle = mostrarDetalle;
window.mostrarDetalleVenta = mostrarDetalleVenta;
window.abrirModalEditarProducto = abrirModalEditarProducto;
window.borrarProducto = borrarProducto;
window.editarCategoria = editarCategoria; 
window.borrarCategoria = borrarCategoria;
window.mostrarDetallesCaja = mostrarDetallesCaja;
window.editarProveedor = editarProveedor;
window.borrarProveedor = borrarProveedor;