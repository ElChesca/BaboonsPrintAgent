// app/static/js/modules/configuracion.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';



export async function inicializarLogicaConfiguracion() {
    const form = document.getElementById('form-configuracion');
    if (!form) return;

    // 1. Cargar la configuración actual
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`);
        document.getElementById('config-stock-negativo').value = configs.vender_stock_negativo || 'No';
    } catch (error) {
        mostrarNotificacion('No se pudo cargar la configuración.', 'error');
    }

    // 2. Guardar la configuración al hacer submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nuevasConfigs = {
            vender_stock_negativo: document.getElementById('config-stock-negativo').value
        };
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`, {
                method: 'PUT',
                body: JSON.stringify(nuevasConfigs)
            });
            mostrarNotificacion('Configuración guardada con éxito.', 'success');
        } catch (error) {
            mostrarNotificacion('Error al guardar la configuración: ' + error.message, 'error');
        }
    });
}