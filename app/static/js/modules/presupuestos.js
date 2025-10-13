import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

let stagedBudgetItems = [];
let productosCache = [];

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

function renderizarTablaYTotales() { /* ... (Esta función no cambia) ... */ }
async function cargarDatosIniciales() { /* ... (Esta función no cambia) ... */ }

export function inicializarLogicaPresupuestos() {
    stagedBudgetItems = [];

    // --- ✨ CORRECCIÓN: Verificación individual de cada elemento ---
    const elementos = {
        formAddItem: document.getElementById('form-add-item-presupuesto'),
        productoInput: document.getElementById('presupuesto-producto-input'),
        searchResults: document.getElementById('search-results-presupuesto'),
        tablaBody: document.querySelector('#tabla-presupuesto-items tbody'),
        bonificacionInput: document.getElementById('presupuesto-bonificacion'),
        interesInput: document.getElementById('presupuesto-interes'),
        btnGuardar: document.getElementById('btn-guardar-presupuesto')
    };

    for (const key in elementos) {
        if (!elementos[key]) {
            // Si falta un elemento, muestra un error detallado y detiene todo.
            console.error(`Error de inicialización: Falta el elemento HTML con el selector para '${key}'.`);
            mostrarNotificacion(`Error: Faltan componentes en la página de presupuestos. Revisa la consola.`, 'error');
            return;
        }
    }

    // Si llegamos aquí, todos los elementos existen.
    cargarDatosIniciales();
    renderizarTablaYTotales();

    elementos.productoInput.addEventListener('input', () => {
        const query = elementos.productoInput.value.toLowerCase();
        if (query.length < 2) {
            elementos.searchResults.style.display = 'none';
            return;
        }
        const resultados = productosCache.filter(p => p.nombre.toLowerCase().includes(query));
        elementos.searchResults.innerHTML = '';
        resultados.forEach(p => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.textContent = p.nombre;
            item.onclick = () => {
                elementos.productoInput.value = p.nombre;
                elementos.searchResults.style.display = 'none';
            };
            elementos.searchResults.appendChild(item);
        });
        elementos.searchResults.style.display = 'block';
    });

    elementos.formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const producto = productosCache.find(p => p.nombre === elementos.productoInput.value);
        const cantidad = parseFloat(document.getElementById('presupuesto-item-cantidad').value);

        if (producto && cantidad > 0) {
            stagedBudgetItems.push({
                producto_id: producto.id,
                descripcion_producto: producto.nombre,
                cantidad: cantidad,
                precio_unitario: producto.precio_venta
            });
            renderizarTablaYTotales();
            elementos.productoInput.value = '';
            document.getElementById('presupuesto-item-cantidad').value = '1';
        } else {
            mostrarNotificacion('Seleccione un producto válido y una cantidad.', 'warning');
        }
    });

    elementos.tablaBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-quitar')) {
            const index = parseInt(e.target.closest('tr').dataset.index, 10);
            stagedBudgetItems.splice(index, 1);
            renderizarTablaYTotales();
        }
    });

    elementos.bonificacionInput.addEventListener('input', renderizarTablaYTotales);
    elementos.interesInput.addEventListener('input', renderizarTablaYTotales);

    elementos.btnGuardar.addEventListener('click', async () => {
        // ... (La lógica para guardar el presupuesto no cambia)
    });
}

// Re-pego las funciones que no cambiaron para que el script esté completo.
function renderizarTablaYTotales() {
    const tbody = document.querySelector('#tabla-presupuesto-items tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let subtotal = 0;
    stagedBudgetItems.forEach((item, index) => {
        const itemSubtotal = item.cantidad * item.precio_unitario;
        subtotal += itemSubtotal;
        tbody.innerHTML += `<tr data-index="${index}"><td>${item.descripcion_producto}</td><td>${item.cantidad}</td><td>${formatCurrency(item.precio_unitario)}</td><td>${formatCurrency(itemSubtotal)}</td><td><button type="button" class="btn-quitar">Quitar</button></td></tr>`;
    });
    const bonificacionPct = parseFloat(document.getElementById('presupuesto-bonificacion').value) || 0;
    const interesPct = parseFloat(document.getElementById('presupuesto-interes').value) || 0;
    const montoBonificacion = subtotal * (bonificacionPct / 100);
    const montoInteres = subtotal * (interesPct / 100);
    const totalFinal = subtotal - montoBonificacion + montoInteres;
    document.getElementById('presupuesto-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('presupuesto-total').textContent = formatCurrency(totalFinal);
}
async function cargarDatosIniciales() {
    try {
        const [productos, clientes] = await Promise.all([fetchData(`/api/negocios/${appState.negocioActivoId}/productos`), fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`)]);
        productosCache = productos;
        const selCliente = document.getElementById('presupuesto-cliente');
        selCliente.innerHTML = '<option value="">Seleccione un cliente...</option>';
        clientes.forEach(c => selCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        const currentUser = getCurrentUser();
        if (currentUser) document.getElementById('presupuesto-vendedor').value = currentUser.nombre;
    } catch (error) { mostrarNotificacion('Error al cargar datos iniciales: ' + error.message, 'error'); }
}