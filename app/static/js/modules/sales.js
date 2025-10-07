// app/static/js/modules/sales.js
import { getCurrentUser } from './auth.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { fetchData } from '../api.js';

let stagedSaleItems = [];
let productosVentaCache = [];
let addItemForm = null;

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
    stagedSaleItems.splice(index, 1);
    renderStagedSaleItems();
}

function generarTicket(payload, items) {
    // ... tu función generarTicket no necesita cambios ...
}

async function procesarVenta(imprimir = false) {
    if (stagedSaleItems.length === 0) return mostrarNotificacion("Debe añadir al menos un producto.", 'warning');
    
    const payload = {
        cliente_id: document.getElementById('cliente-selector').value || null,
        metodo_pago: document.getElementById('metodo-pago-selector').value,
        detalles: stagedSaleItems.map(item => ({
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
    
    try {
        const responseData = await fetchData(`/api/negocios/${appState.negocioActivoId}/ventas`, {
            method: 'POST', body: JSON.stringify(payload)
        });
        mostrarNotificacion(responseData.message || '¡Venta registrada!', 'success');
        if (imprimir) generarTicket(payload, stagedSaleItems);
        if (responseData.notificaciones) {
            responseData.notificaciones.forEach((notif, index) => {
                setTimeout(() => mostrarNotificacion(notif.mensaje, notif.tipo), (index + 1) * 300);
            });
        }
        stagedSaleItems = [];
        renderStagedSaleItems();
        document.getElementById('form-finalize-venta').reset();
        addItemForm.reset();
        cargarDatosIniciales(); // Recargamos productos (por el stock) y clientes
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaVentas() {
    addItemForm = document.getElementById('form-add-item-venta');
    const finalizeSaleForm = document.getElementById('form-finalize-venta');
    if(!addItemForm || !finalizeSaleForm) return;

    verificarEstadoCajaVentas();
    cargarDatosIniciales();
    renderStagedSaleItems();

    // Resto de los listeners...
    // (Buscador, add item, botones de finalizar, etc. se quedan como en tu última versión funcional)
}