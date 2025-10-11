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
        const [productos, clientes, topProductos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos/top?limit=10`)
        ]);

        // Guardamos la lista completa de productos en nuestro estado
        state.setProductosCache(productos);

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

export function inicializarLogicaVentas() {
    // 1. Carga los datos necesarios de la API
    cargarDatosIniciales();
    // 2. Activa todos los botones y formularios
    setupEventListeners();
}