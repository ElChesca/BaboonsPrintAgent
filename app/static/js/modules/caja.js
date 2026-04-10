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

        // ✨ 3. (NUEVO) CARGAR REPORTE RESTÓ SI CORRESPONDE
        if (appState.negocioActivoTipo === 'resto') {
            await cargarReporteRestoCierre();
        } else {
            const containerResto = document.getElementById('resto-cierre-container');
            if (containerResto) containerResto.style.display = 'none';
        }
    } catch (error) {
        mostrarNotificacion('Error al verificar estado de la caja: ' + error.message, 'error');
    }
}

async function cargarReporteRestoCierre() {
    const containerResto = document.getElementById('resto-cierre-container');
    if (!containerResto) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/caja/reporte-cierre-resto`);
        containerResto.style.display = 'block';

        // A. Monitoreo KDS
        const kdsGrid = document.getElementById('kds-stations-grid');
        let kdsHtml = '';
        if (Object.keys(data.kds_movimientos).length === 0) {
            kdsHtml = '<p class="text-muted small">Sin pedidos pendientes.</p>';
        } else {
            for (const station in data.kds_movimientos) {
                const count = data.kds_movimientos[station];
                kdsHtml += `
                    <div style="background: white; border: 1px solid #ddd; padding: 5px 12px; border-radius: 20px; font-size: 0.85em;">
                        <strong>${station.toUpperCase()}:</strong> ${count}
                    </div>
                `;
            }
        }
        kdsGrid.innerHTML = kdsHtml;

        // B. Mesas Abiertas
        const countMesas = document.getElementById('count-mesas-abiertas');
        const alertaMesas = document.getElementById('alerta-mesas-abiertas');
        const listaMesas = document.getElementById('lista-mesas-abiertas');

        countMesas.textContent = data.comandas_abiertas.length;
        if (data.comandas_abiertas.length > 0) {
            alertaMesas.style.display = 'block';
            listaMesas.innerHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #eee; text-align: left;">
                            <th>Mesa</th>
                            <th>Mozo</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.comandas_abiertas.map(c => `
                            <tr style="border-bottom: 1px solid #f9f9f9;">
                                <td>${c.mesa_numero}</td>
                                <td>${c.mozo_nombre}</td>
                                <td>$${parseFloat(c.total).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            // Guardar en window para el acta
            window.datosActaResto = data.comandas_abiertas;
        } else {
            alertaMesas.style.display = 'none';
            listaMesas.innerHTML = '<p class="text-muted small">Todas las mesas cerradas.</p>';
            window.datosActaResto = null;
        }

        // C. Ventas del Turno
        const listaVentas = document.getElementById('lista-ventas-turno');
        if (data.ventas_turno.length === 0) {
            listaVentas.innerHTML = '<p class="text-muted small">Sin ventas registradas en esta sesión.</p>';
        } else {
            listaVentas.innerHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #eee; text-align: left;">
                            <th>#</th>
                            <th>H/M</th>
                            <th>Total</th>
                            <th>Método</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.ventas_turno.map(v => `
                            <tr style="border-bottom: 1px solid #f9f9f9;">
                                <td>${v.numero_interno || v.id}</td>
                                <td>${new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>$${parseFloat(v.total).toFixed(2)}</td>
                                <td class="text-muted">${v.metodo_pago}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (err) {
        console.error("Error cargando reporte Resto:", err);
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

    // ==========================================================
    // ✨ MODIFICACIÓN AQUÍ (Resumen de Cierre Modal)
    // ==========================================================
    const btnImprimirActa = document.getElementById('btn-imprimir-acta');
    if (btnImprimirActa) {
        btnImprimirActa.onclick = () => {
            if (!window.datosActaResto || window.datosActaResto.length === 0) {
                mostrarNotificacion('No hay mesas abiertas para generar acta.', 'info');
                return;
            }
            imprimirActaMesasAbiertas(window.datosActaResto);
        };
    }

    formCerrar.addEventListener('submit', async (e) => {
        e.preventDefault();

        // ⚠ Validación Resto: Advertencia de Mesas Abiertas
        if (appState.negocioActivoTipo === 'resto' && window.datosActaResto && window.datosActaResto.length > 0) {
            const numMesas = window.datosActaResto.length;
            if (!confirm(`⚠ HAY ${numMesas} MESAS ABIERTAS.\nSe recomienda cerrar todas antes del cierre de caja.\n¿Quieres cerrar la caja de todos modos?`)) {
                return;
            }
        }

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

    // Lógica para cerrar el modal
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

function imprimirActaMesasAbiertas(datos) {
    const printWindow = window.open('', '_blank');
    const hoy = new Date().toLocaleString('es-AR');
    let tablaMesas = `
        <table style="width:100%; border-collapse: collapse; margin-top:20px;">
            <tr style="background:#eee; border-bottom: 2px solid #333;">
                <th style="padding:10px; text-align:left;">Mesa</th>
                <th style="padding:10px; text-align:left;">Mozo</th>
                <th style="padding:10px; text-align:right;">Total Acum.</th>
            </tr>
    `;
    
    let granTotal = 0;
    datos.forEach(m => {
        granTotal += parseFloat(m.total);
        tablaMesas += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding:10px;">Mesa ${m.mesa_numero}</td>
                <td style="padding:10px;">${m.mozo_nombre}</td>
                <td style="padding:10px; text-align:right;">$${parseFloat(m.total).toFixed(2)}</td>
            </tr>
        `;
    });

    tablaMesas += `
            <tr style="background:#f9f9f9; font-weight:bold;">
                <td colspan="2" style="padding:10px; text-align:right;">TOTAL EN MESAS:</td>
                <td style="padding:10px; text-align:right;">$${granTotal.toFixed(2)}</td>
            </tr>
        </table>
    `;

    const html = `
        <html>
        <head>
            <title>Acta de Mesas Abiertas</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                .footer { margin-top: 50px; text-align: center; border-top: 1px dashed #666; padding-top: 20px; font-size: 0.8em; }
                .firma { margin-top: 80px; display: flex; justify-content: space-around; }
                .box-firma { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="header">
                <h2>MULTINEGOCIO BABOONS - RESTÓ</h2>
                <h3>ACTA DE MESAS / COMANDAS ABIERTAS AL CIERRE</h3>
                <p><strong>Fecha/Hora:</strong> ${hoy}</p>
            </div>
            
            <p style="margin-top:20px;">Por medio de la presente, se deja constancia de las siguientes comandas que permanecen abiertas en el salón al momento del cierre de caja del turno:</p>
            
            ${tablaMesas}
            
            <div class="firma">
                <div class="box-firma">Firma Responsable Turno</div>
                <div class="box-firma">Firma Administrador</div>
            </div>
            
            <div class="footer">
                <p>Este documento es un comprobante interno del sistema. No válido como factura.</p>
                <p>Generado por: ${localStorage.getItem('user_nombre') || 'Usuario'}</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
}