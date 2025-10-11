import { fetchData } from '../../api.js';
import { appState } from '../../main.js';
import { mostrarNotificacion } from '../notifications.js';
import * as state from './state.js';
import * as ui from './ui.js';

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
        
        if (payload.metodo_pago !== 'Efectivo') {
            payload.pago_detalle = {
                cliente_dni: document.getElementById('pago-dni').value,
                tarjeta_numero: document.getElementById('pago-tarjeta').value,
                nro_cupon: document.getElementById('pago-cupon').value,
                banco: document.getElementById('pago-banco').value
            };
        }
        
        const responseData = await fetchData(`/api/negocios/${appState.negocioActivoId}/ventas`, { method: 'POST', body: JSON.stringify(payload) });
        
        mostrarNotificacion(responseData.message || `¡Venta #${responseData.venta_id} registrada!`, 'success');
        
        state.clearSale();
        ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
        ui.resetSaleUI();

    } catch (error) {
        // ✨ CORRECCIÓN (Punto 4): Nos aseguramos de usar nuestro sistema de notificaciones para los errores.
        mostrarNotificacion(error.message || "Error desconocido al procesar la venta.", 'error');
    } finally {
        ui.toggleFinalizeButtons(false);
    }
}

export function setupEventListeners() {
    const formAddItem = document.getElementById('form-add-item-venta');
    const productoInput = document.getElementById('venta-producto-input');
    const tablaItems = document.querySelector('#staged-items-venta tbody');
    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagaConInput = document.getElementById('paga-con-input');
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');
    
    // ... (Listener de formAddItem, keyup de productoInput, y click en tablaItems no cambian) ...

    btnFinalizar.addEventListener('click', () => procesarVenta(false));
    btnImprimir.addEventListener('click', () => procesarVenta(true));

    // ✨ CORRECCIÓN (Punto 5): Añadimos la lógica para mostrar/ocultar los campos de pago.
    metodoPagoSelector.addEventListener('change', () => {
        const esEfectivo = metodoPagoSelector.value === 'Efectivo';
        const pagoDetallesContainer = document.getElementById('pago-detalles-container');
        const calculoVueltoContainer = document.getElementById('calculo-vuelto-container');
        
        if (calculoVueltoContainer) {
            calculoVueltoContainer.style.display = esEfectivo ? 'block' : 'none';
        }
        if (pagoDetallesContainer) {
            pagoDetallesContainer.style.display = esEfectivo ? 'none' : 'grid';
        }
    });

    pagaConInput.addEventListener('input', () => {
        const pagaCon = parseFloat(pagaConInput.value) || 0;
        ui.updateVueltoDisplay(pagaCon, state.calculateTotal());
    });
}