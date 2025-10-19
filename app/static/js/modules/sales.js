import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// ✨ CORRECCIÓN: Importamos cada cosa desde su archivo correcto.
import * as state from './sales/state.js';
import * as ui from './sales/ui.js';
import { setupEventListeners } from './sales/events.js';

async function cargarDatosIniciales() {
    try {
        // Hacemos todas las llamadas a la API al mismo tiempo para más eficiencia   
        const [clientes, topProductos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos/top?limit=10`)
        ]);
        // Poblamos el selector de clientes
        const selectorClientes = document.getElementById('cliente-selector');
        if (selectorClientes) {
            selectorClientes.innerHTML = '<option value="">Consumidor Final</option>';
            clientes.forEach(c => selectorClientes.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        }

        // Renderizamos la grilla de acceso rápido y le pasamos la lógica que debe ejecutar al hacer clic
        ui.renderPosGrid(topProductos, (productId) => {
            const productoClickeado = productos.find(p => p.id === productId);
            if (productoClickeado) {
                const result = state.addItem(productoClickeado, 1); // Añade 1 por defecto
                if (result.success) {
                    // Si se añade con éxito, actualizamos la tabla
                    ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
                } else {
                    mostrarNotificacion(result.message, 'error');
                }
            }
        });

    } catch (error) {
        mostrarNotificacion('Error al cargar datos iniciales de ventas: ' + error.message, 'error');
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
async function recalcularCarritoPorCliente() {
    const items = state.getSaleItems();
    if (items.length === 0) return; // Si no hay nada en el carrito, no hacemos nada

    const clienteId = document.getElementById('cliente-selector').value || null;
    const productIds = items.map(item => item.producto_id);

    try {
        const payload = { product_ids: productIds, cliente_id: clienteId };
        const preciosActualizados = await sendData( // Usamos sendData porque es un POST
            `/api/negocios/${appState.negocioActivoId}/recalculate-prices`, 
            payload, 
            'POST'
        );

        // Actualizamos el estado del carrito con los nuevos precios
        state.updateItemPrices(preciosActualizados);
        
        // Volvemos a renderizar la tabla y el total para que se vean los cambios
        ui.renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());

    } catch (error) {
        mostrarNotificacion('Error al recalcular precios para el cliente.', 'error');
    }
}

export function inicializarLogicaVentas() {
    // 1. Carga los datos necesarios de la API
    verificarEstadoCaja();
    cargarDatosIniciales();
    // 2. Activa todos los botones y formularios
    setupEventListeners();
}