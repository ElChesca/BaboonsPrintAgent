// app/static/js/modules/caja.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function verificarEstadoCaja() {
    // ==========================================================
    // ✨ 1. (NUEVO) GUARDIA DE SEGURIDAD
    // ==========================================================
    // Si no estamos en la página de caja, los elementos no existirán.
    const seccionAbrir = document.getElementById('seccion-abrir-caja');
    if (!seccionAbrir) {
        // console.log("No estamos en la página de caja, verificarEstadoCaja se detiene.");
        return;
    }

    // De aquí en adelante, el código solo se ejecuta si estamos en la página de caja.
    const seccionCerrar = document.getElementById('seccion-cerrar-caja');
    const infoSesionEl = document.getElementById('info-sesion-actual');

    seccionAbrir.style.display = 'none';
    seccionCerrar.style.display = 'none';
    appState.cajaSesionIdActiva = null;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/estado`);

        if (data.estado === 'abierta') {
            const fechaApertura = new Date(data.sesion.fecha_apertura).toLocaleString('es-AR');

            infoSesionEl.innerHTML = `
                <p style="font-size: 1.2em; color: var(--primary-color);"><strong>Sesión #${data.sesion.numero}</strong></p>
                <p><strong>Caja abierta por:</strong> ${data.sesion.usuario_nombre || 'Usuario desconocido'}</p>
                <p><strong>Fecha de apertura:</strong> ${fechaApertura}</p>
                <p><strong>Monto inicial:</strong> $${data.sesion.monto_inicial.toFixed(2)}</p>
            `;

            // 2. Rellenar los totales en tiempo real
            if (data.totales) {
                const totales = data.totales;
                // (Se asegura que los elementos existan antes de rellenar)
                const elResumenEfectivo = document.getElementById('resumen-efectivo');
                if (elResumenEfectivo) {
                    elResumenEfectivo.textContent = `$${(totales.efectivo || 0).toFixed(2)}`;
                    document.getElementById('resumen-mp').textContent = `$${(totales.mp || 0).toFixed(2)}`;
                    document.getElementById('resumen-tarjeta').textContent = `$${(totales.tarjeta || 0).toFixed(2)}`;
                    document.getElementById('resumen-transferencia').textContent = `$${(totales.transferencia || 0).toFixed(2)}`;

                    const elIngresosAjuste = document.getElementById('resumen-ingresos-ajuste');
                    if (elIngresosAjuste) elIngresosAjuste.textContent = `$${(totales.total_ingresos_ajuste || 0).toFixed(2)}`;

                    const elEgresosAjuste = document.getElementById('resumen-egresos-ajuste');
                    if (elEgresosAjuste) elEgresosAjuste.textContent = `$${(totales.total_egresos_ajuste || 0).toFixed(2)}`;

                    document.getElementById('resumen-gastos').textContent = `$${(totales.total_gastos || 0).toFixed(2)}`;
                    document.getElementById('resumen-pagos-prov').textContent = `$${(totales.total_pagos_proveedores || 0).toFixed(2)}`;
                } else {
                    // Esto te avisará si el HTML sigue desactualizado
                    console.warn("ADVERTENCIA: Faltan los <span> de resumen en caja.html.");
                }
            }

            seccionCerrar.style.display = 'block';
            appState.cajaSesionIdActiva = data.sesion.id;

        } else {
            seccionAbrir.style.display = 'block';
        }
    } catch (error) {
        mostrarNotificacion('Error al verificar estado de la caja: ' + error.message, 'error');
    }
}

export function inicializarLogicaCaja() {
    // ... (formAbrir, formCerrar, modalResumen, etc. sin cambios)
    const formAbrir = document.getElementById('form-abrir-caja');
    if (!formAbrir) return;

    const formCerrar = document.getElementById('form-cerrar-caja');
    const modalResumen = document.getElementById('modal-resumen-cierre');
    const contenidoResumenEl = document.getElementById('contenido-resumen');

    verificarEstadoCaja();

    formAbrir.addEventListener('submit', async (e) => {
        // ... (sin cambios)
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
    // ✨ MODIFICACIÓN AQUÍ (Resumen de Cierre Modal)
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
            let otrosMetodosHtml = '<ul>';
            let totalEfectivoVentas = 0;

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

            // ✨ (NUEVO) Desglose de Salidas
            let detallesSalidasHtml = '<ul>';
            detallesSalidasHtml += `<li>Ajustes (Egreso): $${(r.total_egresos_ajuste || 0).toFixed(2)}</li>`;
            detallesSalidasHtml += `<li>Gastos Operativos (Efectivo): $${(r.total_gastos_efectivo || 0).toFixed(2)}</li>`;
            detallesSalidasHtml += `<li>Pagos a Proveedores (Efectivo): $${(r.total_pagos_prov_efectivo || 0).toFixed(2)}</li>`;
            detallesSalidasHtml += '</ul>';

            contenidoResumenEl.innerHTML = `
                <p><strong>Monto Inicial:</strong> $${r.monto_inicial.toFixed(2)}</p>
                <p><strong>(+) Entradas en Efectivo:</strong></p>
                ${detallesEntradasHtml}
                <p><strong>(-) Salidas en Efectivo:</strong></p>
                ${detallesSalidasHtml}
                <hr>
                <p><strong>Total Esperado en Caja (Efectivo):</strong> $${r.monto_final_esperado.toFixed(2)}</p>
                <p><strong>Total Contado (Real):</strong> $${r.monto_final_contado.toFixed(2)}</p> <hr>
                <p style="font-size: 1.2em; font-weight: bold;"><strong>Diferencia:</strong> $${r.diferencia.toFixed(2)}</p>
                <hr style="margin-top: 20px;">
                <p><strong>Ventas (Otros Métodos):</strong></p>
                ${otrosMetodosHtml} 
            `;
            modalResumen.style.display = 'flex';
            formCerrar.reset();
            verificarEstadoCaja();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    // ... (Lógica para cerrar el modal sin cambios) ...
    const closeButton = modalResumen.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = () => modalResumen.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target == modalResumen) {
            modalResumen.style.display = 'none';
        }
    }
}