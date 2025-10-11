import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

export function inicializarLogicaAjusteCaja() {
    const form = document.getElementById('form-ajuste-caja');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            tipo: document.getElementById('ajuste-tipo').value,
            monto: parseFloat(document.getElementById('ajuste-monto').value),
            concepto: document.getElementById('ajuste-concepto').value,
            observaciones: document.getElementById('ajuste-observaciones').value || null
        };

        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/ajustes`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            mostrarNotificacion(response.message, 'success');
            form.reset();
        } catch (error) {
            const mensajeError = error.message || "Error de red o del servidor. Intente de nuevo.";           
            mostrarNotificacion(error.message, 'error');
        }
    });
}