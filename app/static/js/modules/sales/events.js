// static/js/modules/sales/events.js (Versión Final Limpia)

import { fetchData, sendData } from '../../api.js';
import { appState } from '../../main.js';
import { mostrarNotificacion } from '../notifications.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { imprimirVentaPDF } from './utils.js';
// Importamos funciones específicas que necesitamos
import { recalcularCarritoPorCliente, cargarClientesSelector, setClienteSeleccionado } from '../sales.js';

// --- Funciones Auxiliares (Definidas fuera para claridad) ---

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
            bonificacion_global: parseFloat(document.getElementById('bonificacion-global').value) || 0,
            descuento: parseFloat(document.getElementById('descuento-extra').value) || 0,
            gastos_envio: parseFloat(document.getElementById('gastos-envio').value) || 0,
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

        if (imprimir && responseData.venta_id) {
            await imprimirVentaPDF(responseData.venta_id);
        }

        state.clearSale();
        ui.renderSaleItemsTable(state.getSaleItems());
        ui.resetSaleUI();
        productoSeleccionadoParaAñadir = null; // Reset selección temporal
    } catch (error) {
        mostrarNotificacion(error.message || "Error al procesar la venta.", 'error');
    } finally {
        ui.toggleFinalizeButtons(false);
    }
}

let productoSeleccionadoParaAñadir = null;

async function buscarProductosEnVivo(query) {
    if (query.length < 2) { ui.renderSearchResults([], () => { }); return; }
    const clienteId = document.getElementById('cliente-selector').value || null;
    const listaId = document.getElementById('lista-precios-selector').value || null;
    let url = `/api/negocios/${appState.negocioActivoId}/productos/buscar?query=${encodeURIComponent(query)}`;
    if (clienteId) url += `&cliente_id=${clienteId}`;
    if (listaId) url += `&lista_de_precio_id=${listaId}`;
    try {
        const productosConPrecio = await fetchData(url);
        ui.renderSearchResults(productosConPrecio, (producto) => {
            // --- NUEVO FLUJO: Solo seleccionamos, NO añadimos aún ---
            productoSeleccionadoParaAñadir = producto;
            document.getElementById('venta-producto-input').value = producto.nombre;
            document.getElementById('venta-item-cantidad').focus();
            document.getElementById('venta-item-cantidad').select();
        });
    } catch (error) {
        mostrarNotificacion('Error al buscar productos.', 'error');
    }
}

let timeoutBusquedaCliente = null;
async function buscarClientesEnVivo(query) {
    if (timeoutBusquedaCliente) clearTimeout(timeoutBusquedaCliente);

    if (query.length < 2) {
        ui.renderClientSearchResults([], () => { });
        return;
    }

    timeoutBusquedaCliente = setTimeout(async () => {
        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes?search=${encodeURIComponent(query)}&limit=10`);
            ui.renderClientSearchResults(response.data || [], (cliente) => {
                setClienteSeleccionado(cliente);
                document.getElementById('modal-buscar-cliente').style.display = 'none';
            });
        } catch (error) {
            console.error(error);
        }
    }, 300);
}

// --- Función Principal de Event Listeners ---

export function setupEventListeners() {
    // ... (anteriores selectores igual)
    const formAddItem = document.getElementById('form-add-item-venta');
    const productoInput = document.getElementById('venta-producto-input');
    const cantidadInput = document.getElementById('venta-item-cantidad');
    // ...

    // (Asegurarse de capturar todos los necesarios)
    const tablaItems = document.querySelector('#staged-items-venta tbody');
    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagaConInput = document.getElementById('paga-con-input');
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');
    const clienteSelector = document.getElementById('cliente-selector');
    const listaPreciosSelector = document.getElementById('lista-precios-selector');
    const bonifGlobalInput = document.getElementById('bonificacion-global');
    const descuentoInput = document.getElementById('descuento-extra');
    const envioInput = document.getElementById('gastos-envio');
    const btnNuevoClienteRapido = document.getElementById('btn-nuevo-cliente-rapido');
    const modalClienteRapido = document.getElementById('modal-nuevo-cliente-rapido');
    const formClienteRapido = document.getElementById('form-nuevo-cliente-rapido');
    const closeModalClienteRapido = document.getElementById('close-modal-cliente-rapido');

    // --- Nuevos selectores de búsqueda de clientes ---
    const btnBuscarCliente = document.getElementById('btn-buscar-cliente');
    const displayCliente = document.getElementById('cliente-display');
    const modalBuscarCliente = document.getElementById('modal-buscar-cliente');
    const inputBuscarClienteModal = document.getElementById('input-buscar-cliente-modal');
    const closeModalBuscarCliente = document.getElementById('close-modal-buscar-cliente');

    // --- Listeners ---
    if (clienteSelector) clienteSelector.addEventListener('change', recalcularCarritoPorCliente);
    if (listaPreciosSelector) listaPreciosSelector.addEventListener('change', recalcularCarritoPorCliente);
    if (bonifGlobalInput) bonifGlobalInput.addEventListener('input', ui.actualizarTotalFinal);
    if (descuentoInput) descuentoInput.addEventListener('input', ui.actualizarTotalFinal);
    if (envioInput) envioInput.addEventListener('input', ui.actualizarTotalFinal);

    if (productoInput) {
        productoInput.addEventListener('input', () => {
            productoSeleccionadoParaAñadir = null; // Si escribe manualmente, reseteamos la selección previa
            buscarProductosEnVivo(productoInput.value);
        });
    }

    // --- Listeners Búsqueda de Clientes ---
    const abrirBusqueda = () => {
        if (modalBuscarCliente) {
            modalBuscarCliente.style.display = 'flex';
            if (inputBuscarClienteModal) {
                inputBuscarClienteModal.value = '';
                inputBuscarClienteModal.focus();
                ui.renderClientSearchResults([], () => { });
            }
        }
    };

    if (btnBuscarCliente) btnBuscarCliente.onclick = abrirBusqueda;
    if (displayCliente) displayCliente.onclick = abrirBusqueda;

    if (inputBuscarClienteModal) {
        inputBuscarClienteModal.addEventListener('input', () => {
            buscarClientesEnVivo(inputBuscarClienteModal.value);
        });
    }

    if (closeModalBuscarCliente) {
        closeModalBuscarCliente.onclick = () => modalBuscarCliente.style.display = 'none';
    }


    if (formAddItem) {
        formAddItem.addEventListener('submit', (e) => {
            e.preventDefault();

            // Si hay resultados de búsqueda abiertos, tomamos el primero
            const primerResultado = document.querySelector('#search-results-venta .search-item');
            if (primerResultado && !productoSeleccionadoParaAñadir) {
                primerResultado.click();
                return;
            }

            // Si ya tenemos un producto seleccionado (por click o por el click simulado arriba)
            if (productoSeleccionadoParaAñadir) {
                const cantidad = parseFloat(cantidadInput.value) || 0;
                if (cantidad <= 0) {
                    return mostrarNotificacion("La cantidad debe ser mayor a 0", 'warning');
                }

                state.addItem(productoSeleccionadoParaAñadir, cantidad);
                ui.renderSaleItemsTable(state.getSaleItems());

                // Limpiar para el siguiente
                productoSeleccionadoParaAñadir = null;
                productoInput.value = '';
                cantidadInput.value = '1';
                productoInput.focus();
            } else {
                mostrarNotificacion("Seleccione un producto de la lista primero", 'info');
            }
        });
    }

    if (tablaItems) {
        tablaItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-quitar')) {
                const index = parseInt(e.target.closest('tr').dataset.index, 10);
                state.removeItem(index);
                ui.renderSaleItemsTable(state.getSaleItems());
            }
        });
    }

    if (btnFinalizar) btnFinalizar.addEventListener('click', () => procesarVenta(false));
    if (btnImprimir) btnImprimir.addEventListener('click', () => procesarVenta(true));

    // --- Lógica Modal Cliente Rápido ---
    if (btnNuevoClienteRapido) {
        btnNuevoClienteRapido.addEventListener('click', () => {
            if (formClienteRapido) formClienteRapido.reset();
            if (modalClienteRapido) modalClienteRapido.style.display = 'flex';
        });
    }
    if (closeModalClienteRapido) {
        closeModalClienteRapido.addEventListener('click', () => {
            if (modalClienteRapido) modalClienteRapido.style.display = 'none';
        });
    }
    window.addEventListener('click', (e) => {
        if (modalClienteRapido && e.target == modalClienteRapido) {
            modalClienteRapido.style.display = 'none';
        }
        if (modalBuscarCliente && e.target == modalBuscarCliente) {
            modalBuscarCliente.style.display = 'none';
        }
    });

    if (formClienteRapido) {
        formClienteRapido.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoCliente = {
                nombre: document.getElementById('cliente-rapido-nombre').value,
                dni: document.getElementById('cliente-rapido-dni').value,
            };
            try {
                const clienteCreado = await sendData(`/api/negocios/${appState.negocioActivoId}/clientes`, nuevoCliente, 'POST');
                mostrarNotificacion('Cliente creado con éxito.', 'success');
                if (modalClienteRapido) modalClienteRapido.style.display = 'none';

                // Seleccionar automáticamente al nuevo cliente
                setClienteSeleccionado(clienteCreado);
            } catch (error) {
                mostrarNotificacion(error.message, 'error');
            }
        });
    }

    // --- Resto de Listeners ---
    if (metodoPagoSelector) {
        metodoPagoSelector.addEventListener('change', () => {
            const esEfectivo = metodoPagoSelector.value === 'Efectivo';
            const pagoDetallesContainer = document.getElementById('pago-detalles-container');
            const calculoVueltoContainer = document.getElementById('calculo-vuelto-container');
            if (calculoVueltoContainer) calculoVueltoContainer.style.display = esEfectivo ? 'block' : 'none';
            if (pagoDetallesContainer) pagoDetallesContainer.style.display = esEfectivo ? 'none' : 'grid';
        });
        metodoPagoSelector.dispatchEvent(new Event('change'));
    }

    if (pagaConInput) {
        pagaConInput.addEventListener('input', () => {
            const pagaCon = parseFloat(pagaConInput.value) || 0;
            const subtotalItems = state.calculateTotal();
            const bonifPercent = parseFloat(document.getElementById('bonificacion-global').value) || 0;
            const descFijo = parseFloat(document.getElementById('descuento-extra').value) || 0;
            const envio = parseFloat(document.getElementById('gastos-envio').value) || 0;
            const total = (subtotalItems * (1 - (bonifPercent / 100))) - descFijo + envio;

            ui.updateVueltoDisplay(pagaCon, total);
        });
    }
}