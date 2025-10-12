import { fetchData } from '../api.js';
import { appState, esAdmin } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

let stagedBudgetItems = [];
let productosCache = [];

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

/** Renderiza la tabla de items del presupuesto y actualiza totales */
function renderizarTablaYTotales() {
    const tbody = document.querySelector('#tabla-presupuesto-items tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let subtotal = 0;
    stagedBudgetItems.forEach((item, index) => {
        const itemSubtotal = item.cantidad * item.precio_unitario;
        subtotal += itemSubtotal;
        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${item.descripcion_producto}</td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio_unitario)}</td>
                <td>${formatCurrency(itemSubtotal)}</td>
                <td><button type="button" class="btn-quitar">Quitar</button></td>
            </tr>
        `;
    });

    const bonificacionPct = parseFloat(document.getElementById('presupuesto-bonificacion').value) || 0;
    const interesPct = parseFloat(document.getElementById('presupuesto-interes').value) || 0;
    
    const montoBonificacion = subtotal * (bonificacionPct / 100);
    const montoInteres = subtotal * (interesPct / 100);
    const totalFinal = subtotal - montoBonificacion + montoInteres;

    document.getElementById('presupuesto-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('presupuesto-total').textContent = formatCurrency(totalFinal);
}

/** Carga los datos iniciales (clientes, productos) en los selectores */
async function cargarDatosIniciales() {
    try {
        const [productos, clientes] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`)
        ]);

        productosCache = productos;
        
        const selCliente = document.getElementById('presupuesto-cliente');
        selCliente.innerHTML = '<option value="">Seleccione un cliente...</option>';
        clientes.forEach(c => selCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);

        const currentUser = getCurrentUser();
        document.getElementById('presupuesto-vendedor').value = currentUser.nombre;

    } catch (error) {
        mostrarNotificacion('Error al cargar datos iniciales: ' + error.message, 'error');
    }
}

export function inicializarLogicaPresupuestos() {
    stagedBudgetItems = []; // Limpiamos al inicializar

    const formAddItem = document.getElementById('form-add-item-presupuesto');
    const productoInput = document.getElementById('presupuesto-producto-input');
    const searchResults = document.getElementById('search-results-presupuesto');
    const tablaBody = document.querySelector('#tabla-presupuesto-items tbody');
    const bonificacionInput = document.getElementById('presupuesto-bonificacion');
    const interesInput = document.getElementById('presupuesto-interes');
    const btnGuardar = document.getElementById('btn-guardar-presupuesto');

    cargarDatosIniciales();
    renderizarTablaYTotales();

    // Listener para buscar productos
    productoInput.addEventListener('input', () => {
        const query = productoInput.value.toLowerCase();
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        const resultados = productosCache.filter(p => p.nombre.toLowerCase().includes(query));
        searchResults.innerHTML = '';
        resultados.forEach(p => {
            const item = document.createElement('div');
            item.className = 'search-item'; // Asumiendo que tienes esta clase globalmente
            item.textContent = p.nombre;
            item.onclick = () => {
                productoInput.value = p.nombre;
                searchResults.style.display = 'none';
            };
            searchResults.appendChild(item);
        });
        searchResults.style.display = 'block';
    });

    // Listener para añadir un item
    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const producto = productosCache.find(p => p.nombre === productoInput.value);
        const cantidad = parseFloat(document.getElementById('presupuesto-item-cantidad').value);

        if (producto && cantidad > 0) {
            stagedBudgetItems.push({
                producto_id: producto.id,
                descripcion_producto: producto.nombre,
                cantidad: cantidad,
                precio_unitario: producto.precio_venta
            });
            renderizarTablaYTotales();
            productoInput.value = '';
            document.getElementById('presupuesto-item-cantidad').value = '1';
        } else {
            mostrarNotificacion('Seleccione un producto válido y una cantidad.', 'warning');
        }
    });

    // Listener para quitar un item (delegación)
    tablaBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-quitar')) {
            const index = parseInt(e.target.closest('tr').dataset.index, 10);
            stagedBudgetItems.splice(index, 1);
            renderizarTablaYTotales();
        }
    });

    // Listeners para bonificación e interés
    bonificacionInput.addEventListener('input', renderizarTablaYTotales);
    interesInput.addEventListener('input', renderizarTablaYTotales);

    // Listener para guardar el presupuesto
    btnGuardar.addEventListener('click', async () => {
        const payload = {
            cliente_id: document.getElementById('presupuesto-cliente').value,
            tipo_comprobante: document.getElementById('presupuesto-tipo-comprobante').value,
            forma_pago: document.getElementById('presupuesto-forma-pago').value,
            plazo_pago: document.getElementById('presupuesto-plazo-pago').value,
            fecha_entrega_estimada: document.getElementById('presupuesto-fecha-entrega').value || null,
            observaciones: document.getElementById('presupuesto-observaciones').value,
            bonificacion: parseFloat(bonificacionInput.value) || 0,
            interes: parseFloat(interesInput.value) || 0,
            detalles: stagedBudgetItems
        };

        if (!payload.cliente_id || stagedBudgetItems.length === 0) {
            return mostrarNotificacion('Debe seleccionar un cliente y añadir al menos un producto.', 'warning');
        }

        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/presupuestos`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            mostrarNotificacion(response.message, 'success');
            // Limpiar todo para un nuevo presupuesto
            stagedBudgetItems = [];
            document.getElementById('form-presupuesto-principal').reset();
            renderizarTablaYTotales();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });
}