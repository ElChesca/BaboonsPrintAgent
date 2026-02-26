import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
// ✨ CORRECCIÓN: Importamos cada cosa desde su archivo correcto.
import * as state from './sales/state.js';
import * as ui from './sales/ui.js';
import { setupEventListeners } from './sales/events.js';

async function cargarDatosIniciales() {
    try {
        // Hacemos todas las llamadas a la API al mismo tiempo para más eficiencia   
        const [listasPrecios] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`)
        ]);

        // Llamamos a la función que carga clientes (Solo una vez)
        await cargarClientesSelector();

        // ✨ Lógica para poblar el nuevo selector de listas de precios
        const selectorListas = document.getElementById('lista-precios-selector');

        if (selectorListas) {
            let html = '<option value="">(Por Cliente)</option>';
            listasPrecios.forEach(lp => {
                html += `<option value="${lp.id}">${lp.nombre}</option>`;
            });
            selectorListas.innerHTML = html;
        }

    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar datos iniciales de ventas.', 'error');
    }
}
// ✨ Añadimos la función para verificar el estado de la caja.
async function verificarEstadoCaja() {
    const infoCajaEl = document.getElementById('info-caja-activa');
    if (!infoCajaEl) return;
    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta') {
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            infoCajaEl.textContent = `Caja abierta por ${data.sesion.usuario_nombre} a las ${fechaApertura}`;
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
// en static/js/modules/sales.js

export async function recalcularCarritoPorCliente() {
    const items = state.getSaleItems();
    // ✨ --- LOG 2: ¿Llega aquí la función? --- ✨
    console.log('recalcularCarritoPorCliente called. Items in cart:', items);

    if (items.length === 0) {
        console.log('Cart is empty, skipping recalculation.'); // LOG adicional
        return;
    }

    const clienteId = document.getElementById('cliente-selector').value || null;
    const listaId = document.getElementById('lista-precios-selector').value || null;
    const productIds = items.map(item => item.producto_id);
    const payload = { product_ids: productIds, cliente_id: clienteId, lista_de_precio_id: listaId };

    // ✨ --- LOG 3: ¿Qué estamos enviando? --- ✨
    console.log('Calling recalculate API with payload:', payload);

    try {
        const preciosActualizados = await sendData(
            `/api/negocios/${appState.negocioActivoId}/recalculate-prices`,
            payload,
            'POST'
        );

        // ✨ --- LOG 4: ¿Qué recibimos si funciona? --- ✨
        console.log('API response OK:', preciosActualizados);

        state.updateItemPrices(preciosActualizados);
        ui.renderSaleItemsTable(state.getSaleItems());

    } catch (error) {
        // ✨ --- LOG 5: ¡EL ERROR EXACTO! --- ✨
        console.error('ERROR caught in recalcularCarritoPorCliente:', error);
        mostrarNotificacion('Error al recalcular precios para el cliente.', 'error');
    }
}
/** ✨ Establece un cliente seleccionado en la interfaz. */
export function setClienteSeleccionado(cliente) {
    const selector = document.getElementById('cliente-selector'); // Input oculto
    const display = document.getElementById('cliente-display');   // Input texto readonly

    if (!selector || !display) return;

    if (cliente) {
        selector.value = cliente.id;
        display.value = cliente.nombre;
    } else {
        selector.value = "";
        display.value = "Consumidor Final";
    }

    // Disparamos el 'change' para recalcular precios
    selector.dispatchEvent(new Event('change'));
}

export async function cargarClientesSelector(seleccionarId = null) {
    // Esta función ya no llena un select, pero puede usarse para cargar un cliente específico tras crearlo
    if (seleccionarId) {
        try {
            // Podríamos traer solo ese cliente, pero por ahora si solo tenemos el ID y el nombre del form...
            // Mejor lo dejamos para que events.js lo maneje tras el post.
        } catch (error) { console.error(error); }
    }
}

export function inicializarLogicaVentas() {
    // 1. Carga los datos necesarios de la API
    verificarEstadoCaja();
    cargarDatosIniciales();
    // 2. Activa todos los botones y formularios
    setupEventListeners();
}