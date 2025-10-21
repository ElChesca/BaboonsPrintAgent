// static/js/modules/sales/events.js (Versión Corregida)

import { fetchData, sendData } from '../../api.js'; // Usamos sendData para POST
import { appState } from '../../main.js';
import { mostrarNotificacion } from '../notifications.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { recalcularCarritoPorCliente } from '../sales.js';


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
        
        const responseData = await sendData(`/api/negocios/${appState.negocioActivoId}/ventas`, payload, 'POST');
        
        mostrarNotificacion(responseData.message || `¡Venta #${responseData.venta_id} registrada!`, 'success');
        
        state.clearSale();
        // ✨ CORRECCIÓN: Llamamos a renderSaleItemsTable sin el segundo parámetro
        ui.renderSaleItemsTable(state.getSaleItems()); 
        ui.resetSaleUI();

    } catch (error) {
        mostrarNotificacion(error.message || "Error desconocido al procesar la venta.", 'error');
    } finally {
        ui.toggleFinalizeButtons(false);
    }
}

async function buscarProductosEnVivo(query) {
    if (query.length < 2) {
        ui.renderSearchResults([], () => {});
        return;
    }
    const clienteId = document.getElementById('cliente-selector').value || null;
    const listaId = document.getElementById('lista-precios-selector').value || null;
    let url = `/api/negocios/${appState.negocioActivoId}/productos/buscar?query=${encodeURIComponent(query)}`;
    if (clienteId) {
        url += `&cliente_id=${clienteId}`;
    }
    if (listaId) url += `&lista_de_precio_id=${listaId}`;
    try {
        const productosConPrecio = await fetchData(url);
        ui.renderSearchResults(productosConPrecio, (productoSeleccionado) => {
            state.addItem(productoSeleccionado, 1);
            // ✨ CORRECCIÓN: Llamamos a renderSaleItemsTable sin el segundo parámetro
            ui.renderSaleItemsTable(state.getSaleItems()); 
            document.getElementById('venta-producto-input').value = '';
            document.getElementById('venta-producto-input').focus();
        });
    } catch (error) {
        mostrarNotificacion('Error al buscar productos.', 'error');
    }
}

export function setupEventListeners() {
    // --- Selectores ---
    const formAddItem = document.getElementById('form-add-item-venta');
    const productoInput = document.getElementById('venta-producto-input');
    const tablaItems = document.querySelector('#staged-items-venta tbody');
    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagaConInput = document.getElementById('paga-con-input');
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const toggleAccesoRapido = document.getElementById('toggle-acceso-rapido');
    const panelAccesoRapido = document.getElementById('pos-grid-container');
    const clienteSelector = document.getElementById('cliente-selector');
    const listaPreciosSelector = document.getElementById('lista-precios-selector');
    const descuentoInput = document.getElementById('descuento-extra');
    const envioInput = document.getElementById('gastos-envio');

    // --- Listeners ---   
    if (clienteSelector) {
        clienteSelector.addEventListener('change', (event) => { // Añadimos 'event'
            // ✨ --- LOG 1: ¿Se activa el listener? --- ✨
            console.log('Cliente selector changed! New value:', event.target.value); 
            recalcularCarritoPorCliente();
        });
    }

    if (listaPreciosSelector) listaPreciosSelector.addEventListener('change', recalcularCarritoPorCliente);
    
    // ✨ --- CORRECCIÓN CLAVE --- ✨
    // Añadimos el prefijo 'ui.' para llamar a la función correctamente
    if (descuentoInput) descuentoInput.addEventListener('input', ui.actualizarTotalFinal);
    if (envioInput) envioInput.addEventListener('input', ui.actualizarTotalFinal);

    if (productoInput) {
        productoInput.addEventListener('input', () => {
            buscarProductosEnVivo(productoInput.value);
        });
    }

    if (formAddItem) {
        formAddItem.addEventListener('submit', (e) => {
            e.preventDefault();
            const primerResultado = document.querySelector('#search-results-venta .search-item');
            if (primerResultado) {
                primerResultado.click();
            }
        });
    }

    if (tablaItems) {
        tablaItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-quitar')) {
                const index = parseInt(e.target.closest('tr').dataset.index, 10);
                state.removeItem(index);
                // ✨ CORRECCIÓN: Llamamos a renderSaleItemsTable sin el segundo parámetro
                ui.renderSaleItemsTable(state.getSaleItems()); 
            }
        });
    }

    if (btnFinalizar) btnFinalizar.addEventListener('click', () => procesarVenta(false));
    
    if (metodoPagoSelector) {
        metodoPagoSelector.addEventListener('change', () => {
            const esEfectivo = metodoPagoSelector.value === 'Efectivo';
            const pagoDetallesContainer = document.getElementById('pago-detalles-container');
            const calculoVueltoContainer = document.getElementById('calculo-vuelto-container');
            
            if (calculoVueltoContainer) calculoVueltoContainer.style.display = esEfectivo ? 'block' : 'none';
            if (pagoDetallesContainer) pagoDetallesContainer.style.display = esEfectivo ? 'none' : 'grid';
        });
    }

    if (pagaConInput) {
        pagaConInput.addEventListener('input', () => {
            const pagaCon = parseFloat(pagaConInput.value) || 0;
            ui.updateVueltoDisplay(pagaCon, state.calculateTotal());
        });
    }

    if (toggleAccesoRapido && panelAccesoRapido) {
        toggleAccesoRapido.addEventListener('change', (e) => {
            panelAccesoRapido.style.display = e.target.checked ? 'grid' : 'none';
        });
        panelAccesoRapido.style.display = toggleAccesoRapido.checked ? 'grid' : 'none';
    }
    // ✨ --- LÓGICA PARA EL MODAL DE CLIENTE RÁPIDO --- ✨
    if (btnNuevoClienteRapido) {
        btnNuevoClienteRapido.addEventListener('click', () => {
            formClienteRapido.reset(); // Limpia el form
            modalClienteRapido.style.display = 'flex';
        });
    }
    if (closeModalClienteRapido) {
        closeModalClienteRapido.addEventListener('click', () => {
            modalClienteRapido.style.display = 'none';
        });
    }
    // Cierra el modal si se hace clic fuera
    window.addEventListener('click', (e) => {
        if (e.target == modalClienteRapido) modalClienteRapido.style.display = 'none';
    });

    if (formClienteRapido) {
        formClienteRapido.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoCliente = {
                nombre: document.getElementById('cliente-rapido-nombre').value,
                dni: document.getElementById('cliente-rapido-dni').value,
                // Puedes añadir valores por defecto para otros campos si tu API los requiere
            };
            try {
                const clienteCreado = await sendData(`/api/negocios/${appState.negocioActivoId}/clientes`, nuevoCliente, 'POST');
                mostrarNotificacion('Cliente creado con éxito.', 'success');
                modalClienteRapido.style.display = 'none';
                
                // Recargamos el selector de clientes Y seleccionamos el nuevo
                await cargarClientesSelector(clienteCreado.id); 

            } catch (error) {
                mostrarNotificacion(error.message, 'error');
            }
        });
    }
}
