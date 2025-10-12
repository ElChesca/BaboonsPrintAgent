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
        mostrarNotificacion(error.message || "Error desconocido al procesar la venta.", 'error');
    } finally {
        ui.toggleFinalizeButtons(false);
    }
}

export function setupEventListeners() {
    // --- Selectores de Elementos ---
    const formAddItem = document.getElementById('form-add-item-venta');
    const productoInput = document.getElementById('venta-producto-input');
    const tablaItems = document.querySelector('#staged-items-venta tbody');
    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagaConInput = document.getElementById('paga-con-input');
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');
    const toggleAccesoRapido = document.getElementById('toggle-acceso-rapido');
    const panelAccesoRapido = document.getElementById('pos-grid-container');
    
    // --- Lógica de Listeners ---

    // 1. Añadir item a la venta desde el formulario principal
    if (formAddItem) {
        formAddItem.addEventListener('submit', (e) => {
            e.preventDefault();
            const productoNombre = productoInput.value;
            const cantidad = parseFloat(document.getElementById('venta-item-cantidad').value);
            const productosEncontrados = state.findProductoInCache(productoNombre);
            const producto = productosEncontrados.find(p => p.nombre === productoNombre);

            if (!producto) {
                return mostrarNotificacion("Producto no válido o no encontrado.", 'error');
            }
            
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
    }

    // 2. Búsqueda de productos en tiempo real
    if (productoInput) {
        productoInput.addEventListener('keyup', () => {
            const query = productoInput.value;
            const resultados = state.findProductoInCache(query);
            ui.renderSearchResults(resultados, (nombreSeleccionado) => {
                productoInput.value = nombreSeleccionado;
                document.getElementById('search-results-venta').style.display = 'none';
            });
        });
    }

    // 3. Quitar un item de la venta (delegación de eventos)
    if (tablaItems) {
        tablaItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-quitar')) {
                const index = parseInt(e.target.closest('tr').dataset.index, 10);
                state.removeItem(index);
                ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
            }
        });
    }

    // 4. Botones para finalizar la venta
    if (btnFinalizar) btnFinalizar.addEventListener('click', () => procesarVenta(false));
    if (btnImprimir) btnImprimir.addEventListener('click', () => procesarVenta(true));

    // 5. Lógica de UI para los métodos de pago
    if (metodoPagoSelector) {
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
    }

    // 6. Cálculo del vuelto en tiempo real
    if (pagaConInput) {
        pagaConInput.addEventListener('input', () => {
            const pagaCon = parseFloat(pagaConInput.value) || 0;
            ui.updateVueltoDisplay(pagaCon, state.calculateTotal());
        });
    }

    // ✨ 7. LÓGICA PARA EL INTERRUPTOR DE ACCESO RÁPIDO ✨
    if (toggleAccesoRapido && panelAccesoRapido) {
        toggleAccesoRapido.addEventListener('change', (e) => {
            panelAccesoRapido.style.display = e.target.checked ? 'grid' : 'none';
        });
        // Aseguramos que el estado inicial sea el correcto al cargar
        panelAccesoRapido.style.display = toggleAccesoRapido.checked ? 'grid' : 'none';
    }
}