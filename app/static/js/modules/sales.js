// app/static/js/modules/sales.js

import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { fetchData } from '../api.js';

let stagedSaleItems = [];
let productosVentaCache = [];
let addItemForm = null;

// ... (las funciones verificarEstadoCajaVentas y cargarDatosIniciales no cambian) ...
async function verificarEstadoCajaVentas() {
    const infoCajaEl = document.getElementById('info-caja-activa');
    if (!infoCajaEl) return;
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta') {
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const usuarioResponse = await fetchData(`/api/usuarios/${data.sesion.usuario_id}`);
            infoCajaEl.textContent = `Caja abierta por ${usuarioResponse.nombre} a las ${fechaApertura}`;
            infoCajaEl.className = 'caja-info-banner abierta';
        } else {
            infoCajaEl.textContent = '¡ATENCIÓN! La caja está cerrada. No se pueden registrar ventas.';
            infoCajaEl.className = 'caja-info-banner cerrada';
        }
    } catch (error) {
        infoCajaEl.textContent = 'No se pudo verificar el estado de la caja.';
        infoCajaEl.className = 'caja-info-banner cerrada';
    }
}

async function cargarDatosIniciales() {
    try {
        const [productos, clientes] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`)
        ]);
        productosVentaCache = productos;
        const selectorClientes = document.getElementById('cliente-selector');
        if (selectorClientes) {
            selectorClientes.innerHTML = '<option value="">Consumidor Final</option>';
            clientes.forEach(c => selectorClientes.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        }
    } catch (error) {
        mostrarNotificacion('Error al cargar datos iniciales: ' + error.message, 'error');
    }
}


function renderStagedSaleItems() {
    // ... (esta función no cambia) ...
    const tbody = document.querySelector('#staged-items-venta tbody');
    const totalEl = document.getElementById('venta-total');
    if (!tbody || !totalEl) return;
    let total = 0;
    tbody.innerHTML = '';
    stagedSaleItems.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio_unitario;
        total += subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precio_unitario.toFixed(2)}</td>
                <td>$${subtotal.toFixed(2)}</td>
                <td><button type="button" class="btn-quitar" onclick="quitarItemDeVenta(${index})">Quitar</button></td>
            </tr>`;
    });
    totalEl.textContent = `$${total.toFixed(2)}`;
}

export function quitarItemDeVenta(index) {
    // ... (esta función no cambia) ...
    stagedSaleItems.splice(index, 1);
    renderStagedSaleItems();
}

// ✨ CAMBIO #1: La función ahora recibe el ID de la venta para incluirlo en el ticket.
function generarTicket(ventaId, items) {
    const negocioActivo = document.getElementById('selector-negocio').options[document.getElementById('selector-negocio').selectedIndex].text;
    const clienteSeleccionado = document.getElementById('cliente-selector').options[document.getElementById('cliente-selector').selectedIndex].text;
    let itemsHtml = '', total = 0;
    items.forEach(item => {
        const subtotal = item.cantidad * item.precio_unitario;
        total += subtotal;
        itemsHtml += `<tr><td style="text-align: left;">${item.cantidad}</td><td style="text-align: left;">${item.nombre}</td><td style="text-align: right;">$${subtotal.toFixed(2)}</td></tr>`;
    });
    // ✨ Se añade el número de ticket (Venta Nro) al HTML
    const ticketHtml = `
        <html><head><title>Ticket de Venta #${ventaId}</title><style>
            body { font-family: 'Courier New', monospace; font-size: 10pt; width: 58mm; margin: 0; padding: 5px; }
            * { box-sizing: border-box; } .ticket-header, .ticket-footer, .ticket-total { text-align: center; }
            .ticket-header h3, .ticket-header p { margin: 2px 0; } .ticket-table { width: 100%; border-collapse: collapse; margin: 5px 0; }
            .ticket-table th, .ticket-table td { padding: 2px 0; } .ticket-total { font-weight: bold; border-top: 1px dashed black; padding-top: 5px; text-align: right; }
        </style></head><body>
            <div class="ticket-header">
                <h3>${negocioActivo}</h3>
                <p>Fecha: ${new Date().toLocaleString('es-AR')}</p>
                <p>Cliente: ${clienteSeleccionado}</p>
                <p style="font-weight: bold;">Venta Nro: ${ventaId}</p>
            </div><hr>
            <table class="ticket-table"><thead><tr><th style="text-align: left;">Cant.</th><th style="text-align: left;">Producto</th><th style="text-align: right;">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr>
            <div class="ticket-total">TOTAL: $${total.toFixed(2)}</div><br><p class="ticket-footer">¡Gracias por su compra!</p>
        </body></html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(ticketHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

// ✨ CAMBIO #2: Lógica principal para evitar ventas duplicadas.
async function procesarVenta(imprimir = false) {
    if (stagedSaleItems.length === 0) {
        mostrarNotificacion("Debe añadir al menos un producto.", 'warning');
        return;
    }
    
    // Obtenemos los botones de finalizar
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');

    try {
        // Deshabilitamos AMBOS botones y mostramos un feedback
        btnFinalizar.disabled = true;
        btnImprimir.disabled = true;
        btnFinalizar.textContent = 'Procesando...';
        btnImprimir.textContent = 'Procesando...';

        const payload = {
            cliente_id: document.getElementById('cliente-selector').value || null,
            metodo_pago: document.getElementById('metodo-pago-selector').value,
            detalles: stagedSaleItems.map(item => ({
                producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: item.precio_unitario
            }))
        };
        
        if (payload.metodo_pago !== 'Efectivo') {
            payload.pago_detalle = { /* ... tu lógica de pago ... */ };
        }

        const responseData = await fetchData(`/api/negocios/${appState.negocioActivoId}/ventas`, { method: 'POST', body: JSON.stringify(payload) });
        
        // Usamos el venta_id de la respuesta para el ticket y la notificación
        mostrarNotificacion(`¡Venta #${responseData.venta_id} registrada!`, 'success');
        
        if (imprimir) {
            generarTicket(responseData.venta_id, stagedSaleItems);
        }
        
        if (responseData.notificaciones) {
            responseData.notificaciones.forEach((notif, index) => {
                setTimeout(() => mostrarNotificacion(notif.mensaje, notif.tipo), (index + 1) * 300);
            });
        }
        
        // Limpiamos todo para la siguiente venta
        stagedSaleItems = [];
        renderStagedSaleItems();
        document.getElementById('form-finalize-venta').reset();
        addItemForm.reset();
        cargarDatosIniciales();

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        // Se ejecuta SIEMPRE (con éxito o con error), re-habilitando los botones
        btnFinalizar.disabled = false;
        btnImprimir.disabled = false;
        btnFinalizar.textContent = 'Finalizar Venta';
        btnImprimir.textContent = 'Finalizar e Imprimir Ticket';
    }
}


export function inicializarLogicaVentas() {
    // ... (El resto de la función inicializarLogicaVentas no cambia) ...
    addItemForm = document.getElementById('form-add-item-venta');
    const finalizeSaleForm = document.getElementById('form-finalize-venta');
    if (!addItemForm || !finalizeSaleForm) return;

    verificarEstadoCajaVentas();
    cargarDatosIniciales();
    renderStagedSaleItems();
    
    // --- LÓGICA DE LISTENERS ---
    const productoInput = document.getElementById('venta-producto-input');
    const searchResultsEl = document.getElementById('search-results-venta');
    productoInput.addEventListener('keyup', () => {
        const query = productoInput.value.toLowerCase();
        searchResultsEl.style.display = 'block';
        if (query.length < 2) {
            searchResultsEl.innerHTML = ''; return;
        }
        const resultados = productosVentaCache.filter(p => p.nombre.toLowerCase().includes(query));
        searchResultsEl.innerHTML = '';
        resultados.forEach(p => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'search-item';
            const precioFormateado = p.precio_venta ? p.precio_venta.toFixed(2) : '0.00';
            itemDiv.innerHTML = `<span>${p.nombre}</span> <span class="stock">Stock: ${p.stock} | Precio: $${precioFormateado}</span>`;
            itemDiv.addEventListener('click', () => {
                productoInput.value = p.nombre;
                searchResultsEl.innerHTML = '';
                searchResultsEl.style.display = 'none';
            });
            searchResultsEl.appendChild(itemDiv);
        });
    });

    addItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoSeleccionado = productosVentaCache.find(p => p.nombre === productoInput.value);
        if (!productoSeleccionado) return mostrarNotificacion("Producto no válido.", 'error');
        
        const cantidad = parseFloat(document.getElementById('venta-item-cantidad').value);
        if (cantidad > productoSeleccionado.stock) return mostrarNotificacion(`Stock insuficiente. Solo quedan ${productoSeleccionado.stock} unidades.`, 'error');

        const newItem = {
            producto_id: productoSeleccionado.id, nombre: productoSeleccionado.nombre,
            cantidad: cantidad, precio_unitario: parseFloat(productoSeleccionado.precio_venta)
        };
        const existingItem = stagedSaleItems.find(item => item.producto_id === newItem.producto_id);
        if (existingItem) {
            existingItem.cantidad += newItem.cantidad;
        } else {
            stagedSaleItems.push(newItem);
        }
        renderStagedSaleItems();
        addItemForm.reset();
        document.getElementById('venta-item-cantidad').value = '1';
        productoInput.focus();
    });

    document.getElementById('btn-finalize-sale').addEventListener('click', (e) => {
        e.preventDefault();
        procesarVenta(false);
    });

    document.getElementById('btn-finalize-and-print').addEventListener('click', (e) => {
        e.preventDefault();
        procesarVenta(true);
    });

    const metodoPagoSelector = document.getElementById('metodo-pago-selector');
    const pagoDetallesContainer = document.getElementById('pago-detalles-container');
    metodoPagoSelector.addEventListener('change', () => {
        pagoDetallesContainer.style.display = metodoPagoSelector.value === 'Efectivo' ? 'none' : 'block';
    });
}