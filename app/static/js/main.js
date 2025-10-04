// app/static/js/main.js
import { fetchData } from './api.js'; 

// --- IMPORTACIONES DE MÓDulos ---
import { inicializarLogicaLogin, getCurrentUser, logout, getAuthHeaders } from './modules/auth.js';
import { inicializarLogicaClientes, editarCliente, borrarCliente } from './modules/clientes.js';
import { inicializarLogicaIngresos, quitarItem } from './modules/ingresos.js';
import { inicializarLogicaVentas, quitarItemDeVenta } from './modules/sales.js';
import { inicializarLogicaUsuarios, abrirModalEditarUsuario } from './modules/users.js';
import { inicializarLogicaHistorial, mostrarDetalle } from './modules/historial_ingresos.js';
import { inicializarLogicaNegocios } from './modules/negocios.js';
import { inicializarLogicaHistorialVentas, mostrarDetalleVenta } from './modules/historial_ventas.js';
import { inicializarLogicaInventario, abrirModalEditarProducto, borrarProducto } from './modules/inventory.js';
import { inicializarLogicaCategorias, editarCategoria, borrarCategoria } from './modules/categorias.js'; 
import { inicializarLogicaReportes } from './modules/reportes.js';
import { inicializarLogicaDashboard } from './modules/dashboard.js';
import { inicializarLogicaCaja } from './modules/caja.js';
import { inicializarLogicaReporteGanancias } from './modules/reporte_ganancias.js';
import { inicializarLogicaReporteCaja, mostrarDetallesCaja } from './modules/reporte_caja.js';
import { inicializarLogicaProveedores, editarProveedor, borrarProveedor } from './modules/proveedores.js';



// --- ESTADO GLOBAL DE LA APLICACIÓN ---
export const appState = {
    negocioActivoId: null
};

async function poblarSelectorNegocios() {
    const selectorNegocio = document.getElementById('selector-negocio');
    if (!selectorNegocio) return;

    try {
        const negocios = await fetchData('/api/negocios');
        
        selectorNegocio.innerHTML = ''; // Limpiamos por si acaso
        negocios.forEach(negocio => {
            const option = new Option(negocio.nombre, negocio.id);
            selectorNegocio.appendChild(option);
        });

        // Lógica para preseccionar el negocio activo o el primero de la lista
        const idPrevio = appState.negocioActivoId;
        let idSeleccionado = null;
        if (idPrevio && negocios.some(n => n.id == idPrevio)) {
            idSeleccionado = idPrevio;
        } else if (negocios.length > 0) {
            idSeleccionado = negocios[0].id;
        }
        
        selectorNegocio.value = idSeleccionado;
        // Disparamos el evento 'change' para que el resto de la app se actualice
        if (appState.negocioActivoId !== idSeleccionado) {
            appState.negocioActivoId = idSeleccionado;
            selectorNegocio.dispatchEvent(new Event('change'));
        } else {
             appState.negocioActivoId = idSeleccionado;
        }

    } catch (error) {
        console.error("Error al poblar selector de negocios:", error);
        selectorNegocio.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// --- LÓGICA PRINCIPAL (ORQUESTADOR) ---
export async function actualizarUIAutenticacion() {
    const user = getCurrentUser();
    const authLink = document.getElementById('auth-link');
    const businessSelector = document.getElementById('business-selector-bar');
    const selector = document.getElementById('selector-negocio');
    const adminLinks = [document.getElementById('usuarios-link'), document.getElementById('negocios-link')];

    if (user) {
        authLink.innerHTML = `Salir (<strong>${user.rol}</strong>)`;
        authLink.onclick = (e) => { e.preventDefault(); logout(); };
        businessSelector.style.display = 'flex';
        
        const isAdmin = user.rol === 'admin';
        selector.disabled = !isAdmin;
        adminLinks.forEach(link => { if(link) link.style.display = isAdmin ? 'inline-block' : 'none'; });
        
        await poblarSelectorNegocios();
        
        // --- ✨ LÓGICA SIMPLIFICADA ---
        // Eliminamos la comprobación de la página activa y forzamos
        // la carga del Dashboard cada vez que la UI se actualiza con un usuario logueado.
        loadContent(null, 'static/dashboard.html', document.querySelector('a[onclick*="dashboard.html"]'));
        
    } else {
        // --- Lógica para usuario no logueado (sin cambios) ---
        authLink.textContent = 'Login';
        authLink.onclick = (e) => { e.preventDefault(); loadContent(e, 'static/login.html', authLink); };
        businessSelector.style.display = 'none';
        adminLinks.forEach(link => { if(link) link.style.display = 'none'; });
        loadContent(null, 'static/login.html', authLink);
    }
}

export function loadContent(event, page, clickedLink) {
  //  debugger; // ✨ PRIMER PUNTO DE PAUSA
    console.log("loadContent se ejecutó para la página:", page);

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

            // ✨ 2. Mensaje para confirmar que el HTML se cargó
            console.log("HTML cargado, verificando qué lógica inicializar...");

            if (page.includes('inventario.html')) inicializarLogicaInventario();
            if (page.includes('login.html')) inicializarLogicaLogin();
            if (page.includes('negocios.html')) inicializarLogicaNegocios();
            if (page.includes('usuarios.html')) inicializarLogicaUsuarios();
            
            // ✨ 3. Añadimos un log específico para 'ingresos.html'
            if (page.includes('ingresos.html')) {
               // debugger;
                console.log("¡Coincidencia encontrada para 'ingresos.html'! Ejecutando inicializarLogicaIngresos.");
                inicializarLogicaIngresos();
            }

            if (page.includes('historial_ingresos.html')) inicializarLogicaHistorial();
            if (page.includes('ventas.html')) inicializarLogicaVentas();
            if (page.includes('clientes.html')) inicializarLogicaClientes();
            if (page.includes('historial_ventas.html')) inicializarLogicaHistorialVentas();
            if (page.includes('categorias.html')) inicializarLogicaCategorias();
            if (page.includes('reportes.html')) inicializarLogicaReportes(); // Esta línea parece ser para un reporte antiguo, tal vez 'reportes_ventas.html'
            if (page.includes('dashboard.html')) inicializarLogicaDashboard();
            if (page.includes('caja.html')) inicializarLogicaCaja();
            if (page.includes('reporte_caja.html')) inicializarLogicaReporteCaja();
            if (page.includes('reporte_ganancias.html')) inicializarLogicaReporteGanancias();
            if (page.includes('proveedores.html')) inicializarLogicaProveedores();

        })
        .catch(error => {
            console.error("Error durante el fetch:", error);
        });
}
// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('selector-negocio').addEventListener('change', (e) => {
        appState.negocioActivoId = e.target.value;
        const linkActivo = document.querySelector('nav a.active, .dropdown-content a.active');
        if (linkActivo) { linkActivo.click(); }
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