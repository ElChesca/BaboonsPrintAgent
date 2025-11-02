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
    
    // ✨ BORRAR EL ID DE SESIÓN ANTERIOR
    appState.cajaSesionIdActiva = null; 

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);
        if (data.estado === 'abierta') {
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleString('es-AR');
            
            infoSesionEl.innerHTML = `
                <p><strong>Caja abierta por:</strong> ${data.sesion.usuario_nombre || 'Usuario desconocido'}</p>
                <p><strong>Fecha de apertura:</strong> ${fechaApertura}</p>
                <p><strong>Monto inicial:</strong> $${data.sesion.monto_inicial.toFixed(2)}</p>
            `;
            seccionCerrar.style.display = 'block';
            
            // ✨ 1. (NUEVO) GUARDAMOS EL ID DE LA SESIÓN ACTIVA EN EL ESTADO GLOBAL
            appState.cajaSesionIdActiva = data.sesion.id;

        } else {
            seccionAbrir.style.display = 'block';
            // (appState.cajaSesionIdActiva ya es null)
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
        // (Esta función no cambia)
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

    // ==========================================================
    // ✨ 2. MODIFICACIÓN AQUÍ (Resumen de Cierre)
    // ==========================================================
    formCerrar.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!confirm('¿Estás seguro de que quieres cerrar la caja? Esta acción no se puede deshacer.')) return;
        
        const monto_final_contado = document.getElementById('monto-final-contado').value;
        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/cierre`, {
                method: 'PUT', body: JSON.stringify({ monto_final_contado: parseFloat(monto_final_contado) })
            });

            const r = response.resumen;

            // --- Lógica de desglose (mejorada) ---
            let otrosMetodosHtml = '<ul>';
            let totalEfectivoVentas = 0;
            
            // Procesar desglose de pagos
            if (r.desglose_pagos) {
                for (const metodo in r.desglose_pagos) {
                    const montoMetodo = r.desglose_pagos[metodo] || 0;
                    if (metodo.toLowerCase() === 'efectivo') {
                        totalEfectivoVentas = montoMetodo;
                    } else {
                        otrosMetodosHtml += `<li><strong>${metodo}:</strong> $${montoMetodo.toFixed(2)}</li>`;
                    }
                }
            }
            otrosMetodosHtml += '</ul>';

            // Desglose de Entradas
            let detallesEntradasHtml = '<ul>';
            detallesEntradasHtml += `<li>Ventas (Efectivo): $${totalEfectivoVentas.toFixed(2)}</li>`;
            detallesEntradasHtml += `<li>Ajustes (Ingreso): $${(r.total_ingresos_ajuste || 0).toFixed(2)}</li>`;
            detallesEntradasHtml += '</ul>';

            // ✨ (NUEVO) Desglose de Salidas (incluye gastos)
            let detallesSalidasHtml = '<ul>';
            detallesSalidasHtml += `<li>Ajustes (Egreso): $${(r.total_egresos_ajuste || 0).toFixed(2)}</li>`;
            detallesSalidasHtml += `<li>Gastos Operativos (Efectivo): $${(r.total_gastos_efectivo || 0).toFixed(2)}</li>`;
            detallesSalidasHtml += '</ul>';
            
            // --- Nuevo HTML para el Resumen ---
            contenidoResumenEl.innerHTML = `
                <p><strong>Monto Inicial:</strong> $${r.monto_inicial.toFixed(2)}</p>
                
                <p><strong>(+) Entradas en Efectivo:</strong></p>
                ${detallesEntradasHtml}
                
                <p><strong>(-) Salidas en Efectivo:</strong></p>
                ${detallesSalidasHtml}
                <hr>
                
                <p><strong>Total Esperado en Caja (Efectivo):</strong> $${r.monto_final_esperado.toFixed(2)}</p>
                <p><strong>Total Contado (Real):</strong> $${r.monto_final_contado.toFixed(2)}</p>
                <hr>
                
                <p style="font-size: 1.2em; font-weight: bold;"><strong>Diferencia:</strong> $${r.diferencia.toFixed(2)}</p>
                
                <hr style="margin-top: 20px;">
                <p><strong>Ventas (Otros Métodos):</strong></p>
                ${otrosMetodosHtml} 
            `;

            modalResumen.style.display = 'flex';
            formCerrar.reset();
            verificarEstadoCaja(); // Esto pondrá appState.cajaSesionIdActiva en null
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    // Lógica para cerrar el modal (sin cambios)
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