import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// ✨ 1. Quitamos los selectores de aquí fuera.

async function verificarEstadoCaja() {
    // ✨ 2. Los declaramos aquí dentro para que se busquen en el momento justo.
    const seccionAbrir = document.getElementById('seccion-abrir-caja');
    const seccionCerrar = document.getElementById('seccion-cerrar-caja');
    const infoSesionEl = document.getElementById('info-sesion-actual');

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta') {
            seccionAbrir.style.display = 'none';
            seccionCerrar.style.display = 'block';
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleString('es-AR');
            const usuarioResponse = await fetchData(`/api/usuarios/${data.sesion.usuario_id}`); // Obtenemos el nombre del usuario
            const nombreUsuario = usuarioResponse ? usuarioResponse.nombre : `ID ${data.sesion.usuario_id}`;

            infoSesionEl.innerHTML = `
                <p><strong>Caja abierta por:</strong> ${nombreUsuario}</p>
                <p><strong>Fecha de apertura:</strong> ${fechaApertura}</p>
                <p><strong>Monto inicial:</strong> $${data.sesion.monto_inicial.toFixed(2)}</p>
            `;
        } else {
            seccionAbrir.style.display = 'block';
            seccionCerrar.style.display = 'none';
        }
    } catch (error) {
        mostrarNotificacion('Error al verificar estado de la caja: ' + error.message, 'error');
    }
}

export function inicializarLogicaCaja() {
    // ✨ 3. Hacemos la comprobación inicial aquí dentro.
    const seccionAbrir = document.getElementById('seccion-abrir-caja');
    if (!seccionAbrir) return; // Si no estamos en la página de caja, no hacemos nada

    // El resto de los selectores también van aquí para los event listeners.
    const formAbrir = document.getElementById('form-abrir-caja');
    const formCerrar = document.getElementById('form-cerrar-caja');
    const modalResumen = document.getElementById('modal-resumen-cierre');
    const contenidoResumenEl = document.getElementById('contenido-resumen');

    verificarEstadoCaja();

    formAbrir.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monto_inicial = document.getElementById('monto-inicial').value;
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/apertura`, {
                method: 'POST',
                body: JSON.stringify({ monto_inicial: parseFloat(monto_inicial) })
            });
            mostrarNotificacion('Caja abierta con éxito.', 'success');
            formAbrir.reset();
            verificarEstadoCaja(); // Refrescamos la vista
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    formCerrar.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!confirm('¿Estás seguro de que quieres cerrar la caja? Esta acción no se puede deshacer.')) return;

        const monto_final_contado = document.getElementById('monto-final-contado').value;
        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/cierre`, {
                method: 'PUT',
                body: JSON.stringify({ monto_final_contado: parseFloat(monto_final_contado) })
            });

            const r = response.resumen;
            // ✨ Creamos el HTML para el desglose de pagos
            let desgloseHtml = '<ul>';
            for (const metodo in r.desglose_pagos) {
                desgloseHtml += `<li><strong>${metodo}:</strong> $${r.desglose_pagos[metodo].toFixed(2)}</li>`;
            }
            desgloseHtml += '</ul>';

            contenidoResumenEl.innerHTML = `
                <p><strong>Monto Inicial:</strong> $${r.monto_inicial.toFixed(2)}</p>
                <p><strong>Desglose de Ventas:</strong></p>
                ${desgloseHtml}
                <hr>
                <p><strong>Total Esperado en Caja (Efectivo):</strong> $${r.monto_final_esperado.toFixed(2)}</p>
                <p><strong>Total Contado:</strong> $${r.monto_final_contado.toFixed(2)}</p>
                <hr>
                <p style="font-size: 1.2em; font-weight: bold;"><strong>Diferencia:</strong> $${r.diferencia.toFixed(2)}</p>
            `;
            modalResumen.style.display = 'flex';
                
            formCerrar.reset();
            verificarEstadoCaja();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    // ✨ Pequeña mejora: Cerrar el modal de resumen al hacer clic en la X
    const closeButton = modalResumen.querySelector('.close-button');
    if(closeButton) {
        closeButton.onclick = () => {
            modalResumen.style.display = 'none';
        }
    }
}