// app/static/js/modules/caja.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function verificarEstadoCaja() {
    const seccionAbrir = document.getElementById('seccion-abrir-caja');
    const seccionCerrar = document.getElementById('seccion-cerrar-caja');
    const infoSesionEl = document.getElementById('info-sesion-actual');

    seccionAbrir.style.display = 'none';
    seccionCerrar.style.display = 'none';

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta') {
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleString('es-AR');
            
            // ✨ LA CORRECCIÓN ESTÁ AQUÍ:
            // Ya no necesitamos la segunda llamada a la API. Usamos el nombre que ya viene en la respuesta.
            // const usuarioResponse = await fetchData(`/api/usuarios/${data.sesion.usuario_id}`);
            
            infoSesionEl.innerHTML = `
                <p><strong>Caja abierta por:</strong> ${data.sesion.usuario_nombre || 'Usuario desconocido'}</p>
                <p><strong>Fecha de apertura:</strong> ${fechaApertura}</p>
                <p><strong>Monto inicial:</strong> $${data.sesion.monto_inicial.toFixed(2)}</p>
            `;
            seccionCerrar.style.display = 'block';
        } else {
            seccionAbrir.style.display = 'block';
        }
    } catch (error) {
        mostrarNotificacion('Error al verificar estado de la caja: ' + error.message, 'error');
    }
}

export function inicializarLogicaCaja() {
    const formAbrir = document.getElementById('form-abrir-caja');
    if (!formAbrir) return;

    const formCerrar = document.getElementById('form-cerrar-caja');
    const modalResumen = document.getElementById('modal-resumen-cierre');
    const contenidoResumenEl = document.getElementById('contenido-resumen');
    
    verificarEstadoCaja();

    formAbrir.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monto_inicial = document.getElementById('monto-inicial').value;
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/apertura`, {
                method: 'POST', body: JSON.stringify({ monto_inicial: parseFloat(monto_inicial) })
            });
            mostrarNotificacion('Caja abierta con éxito.', 'success');
            formAbrir.reset();
            verificarEstadoCaja();
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
                method: 'PUT', body: JSON.stringify({ monto_final_contado: parseFloat(monto_final_contado) })
            });

            const r = response.resumen;
            let desgloseHtml = '<ul>';
            for (const metodo in r.desglose_pagos) {
                desgloseHtml += `<li><strong>${metodo}:</strong> $${r.desglose_pagos[metodo].toFixed(2)}</li>`;
            }
            desgloseHtml += '</ul>';
            
            contenidoResumenEl.innerHTML = `
                <p><strong>Monto Inicial:</strong> $${r.monto_inicial.toFixed(2)}</p>
                <p><strong>Desglose de Ventas:</strong></p>
                ${desgloseHtml} <hr>
                <p><strong>Total Esperado en Caja (Efectivo):</strong> $${r.monto_final_esperado.toFixed(2)}</p>
                <p><strong>Total Contado:</strong> $${r.monto_final_contado.toFixed(2)}</p> <hr>
                <p style="font-size: 1.2em; font-weight: bold;"><strong>Diferencia:</strong> $${r.diferencia.toFixed(2)}</p>
            `;
            modalResumen.style.display = 'flex';
            formCerrar.reset();
            verificarEstadoCaja();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    // Lógica para cerrar el modal
    const closeButton = modalResumen.querySelector('.close-button');
    if(closeButton) {
        closeButton.onclick = () => modalResumen.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target == modalResumen) {
            modalResumen.style.display = 'none';
        }
    }
}