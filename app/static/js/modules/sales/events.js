import { fetchData } from '../../api.js';
import { appState } from '../../main.js';
import { mostrarNotificacion } from '../notifications.js';
import * as state from './state.js';
import * as ui from './ui.js';

/** Procesa la venta, la envía a la API y actualiza la UI. */
async function procesarVenta(imprimir = false) {
    const items = state.getSaleItems();
    if (items.length === 0) {
        return mostrarNotificacion("Debe añadir al menos un producto.", 'warning');
    }
    
    ui.toggleFinalizeButtons(true);
    try {
        const payload = {
            cliente_id: document.getElementById('cliente-selector').value || null,
            metodo_pago: document.getElementById('metodo-pago-selector').value,
            detalles: items.map(item => ({
                producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: item.precio_unitario
            }))
        };
        // Aquí iría la lógica para añadir pago_detalle si es necesario
        
        const responseData = await fetchData(`/api/negocios/${appState.negocioActivoId}/ventas`, { method: 'POST', body: JSON.stringify(payload) });
        
        mostrarNotificacion(`¡Venta #${responseData.venta_id} registrada!`, 'success');
        // Aquí iría la lógica para generar el ticket si 'imprimir' es true
        
        state.clearSale();
        ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
        ui.resetSaleUI();

    } catch (error) {
        mostrarNotificacion(error.message || "Error desconocido al procesar la venta.", 'error');
    } finally {
        ui.toggleFinalizeButtons(false);
    }
}

/** Configura todos los event listeners de la página de ventas. */
export function setupEventListeners() {
    const formAddItem = document.getElementById('form-add-item-venta');
    const productoInput = document.getElementById('venta-producto-input');
    const tablaItems = document.querySelector('#staged-items-venta tbody');
    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagaConInput = document.getElementById('paga-con-input');
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');
    
    // Añadir item por formulario
    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoNombre = productoInput.value;
        const cantidad = parseFloat(document.getElementById('venta-item-cantidad').value);
        const producto = state.findProductoInCache(productoNombre)[0]; // Asumimos que es el primero si hay duplicados
        
        if (!producto) return mostrarNotificacion("Producto no válido.", 'error');
        
        const result = state.addItem(producto, cantidad);
        if (result.success) {
            ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
            formAddItem.reset();
            document.getElementById('venta-item-cantidad').value = '1';
            productoInput.focus();
        } else {
            mostrarNotificacion(result.message, 'error');
        }
    });

    // Búsqueda de productos
    productoInput.addEventListener('keyup', () => {
        const query = productoInput.value;
        const resultados = state.findProductoInCache(query);
        ui.renderSearchResults(resultados, (nombreSeleccionado) => {
            productoInput.value = nombreSeleccionado;
        });
    });

    // Quitar item de la tabla (delegación de eventos)
    tablaItems.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-quitar')) {
            const index = parseInt(e.target.closest('tr').dataset.index, 10);
            state.removeItem(index);
            ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
        }
    });

    // Finalizar venta
    btnFinalizar.addEventListener('click', () => procesarVenta(false));
    btnImprimir.addEventListener('click', () => procesarVenta(true));

    // Lógica de UI para pagos
    metodoPagoSelector.addEventListener('change', () => { /* Lógica para pago-detalles-container si existe */ });
    pagaConInput.addEventListener('input', () => {
        const pagaCon = parseFloat(pagaConInput.value) || 0;
        ui.updateVueltoDisplay(pagaCon, state.calculateTotal());
    });
}