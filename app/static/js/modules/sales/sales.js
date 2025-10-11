import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { setProductosCache } from './sales/state.js';
import { renderPosGrid } from './sales/ui.js';
import { setupEventListeners } from './sales/events.js';
import { addItem } from './sales/state.js';
import { renderSaleItemsTable, calculateTotal } from './sales/ui.js';

async function cargarDatosIniciales() {
    try {
        const [productos, clientes, topProductos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos/top?limit=10`)
        ]);

        setProductosCache(productos);

        const selectorClientes = document.getElementById('cliente-selector');
        if (selectorClientes) {
            selectorClientes.innerHTML = '<option value="">Consumidor Final</option>';
            clientes.forEach(c => selectorClientes.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        }

        renderPosGrid(topProductos, (productId) => {
            const producto = productos.find(p => p.id === productId);
            if (producto) {
                const result = addItem(producto, 1); // Añade 1 por defecto al hacer clic
                if (result.success) {
                    renderSaleItemsTable(state.getSaleItems(), state.calculateTotal());
                } else {
                    mostrarNotificacion(result.message, 'error');
                }
            }
        });

    } catch (error) {
        mostrarNotificacion('Error al cargar datos iniciales de ventas: ' + error.message, 'error');
    }
}

export function inicializarLogicaVentas() {
    cargarDatosIniciales();
    setupEventListeners();
}