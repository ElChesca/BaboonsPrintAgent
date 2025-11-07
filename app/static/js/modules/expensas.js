// static/js/modules/expensas.js
// ✨ ARCHIVO NUEVO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Almacenes de caché ---
let periodosCache = [];
let detallePeriodoCache = {}; // Para guardar los detalles del período activo

// --- Elementos del DOM ---
let modalPeriodo, formPeriodo, modalPago, formPago;
let vistaPrincipal, vistaDetalle;

function parseSQLDate(dateString) {
    if (!dateString) return new Date(); // Fallback
    
    // Si la fecha es "YYYY-MM-DD"
    if (dateString.length === 10) { 
        // La convertimos a "YYYY-MM-DDT00:00:00"
        // Esto le dice a JavaScript: "Interpreta esta fecha en la zona horaria local"
        // y evita que la convierta a UTC (lo que a veces la atrasa un día).
        return new Date(dateString + 'T00:00:00');
    }
    
    // Si ya es un timestamp completo, solo lo parsea
    return new Date(dateString); 
}

// --- VISTAS DEL INQUILINO (USUARIO OPERADOR) ---
function renderTablaInquilino(expensas) {
    const thead = document.getElementById('tabla-expensas-head');
    const tbody = document.getElementById('tabla-expensas-body');
    if (!thead || !tbody) return;
    
    thead.innerHTML = `<tr><th>Período</th><th>Unidad</th><th>Vencimiento</th><th>Total a Pagar</th><th>Saldo Pendiente</th><th>Estado</th></tr>`;
    tbody.innerHTML = '';
    if (expensas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No tienes expensas emitidas.</td></tr>';
        return;
    }
    
    expensas.forEach(ex => {
        // ✨ CAMBIO: Usamos el helper de fecha
        const periodo = parseSQLDate(ex.periodo).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const vencimiento = parseSQLDate(ex.fecha_vencimiento).toLocaleDateString('es-ES');
        
        tbody.innerHTML += `<tr><td>${periodo}</td><td>${ex.nombre_unidad}</td><td>${vencimiento}</td><td>${ex.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td><strong>${ex.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></td><td><span class="estado-${ex.estado_pago.toLowerCase().replace(' ', '-')}">${ex.estado_pago}</span></td></tr>`;
    });
}

async function cargarMisExpensas() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/mis-expensas`;
        const expensas = await fetchData(url);
        renderTablaInquilino(expensas);
    } catch (error) {
        mostrarNotificacion('Error al cargar tus expensas.', 'error');
    }
}

// --- VISTAS DEL ADMINISTRADOR ---
function renderTablaAdmin() {
    const thead = document.getElementById('tabla-expensas-head');
    const tbody = document.getElementById('tabla-expensas-body');
    if (!thead || !tbody) return;

    thead.innerHTML = `<tr><th>Período</th><th>Gastos Ord.</th><th>Gastos Ext.</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr>`;
    tbody.innerHTML = '';
    if (periodosCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No se han creado períodos de expensas.</td></tr>';
        return;
    }

    periodosCache.forEach(p => {
        // ✨ CAMBIO: Usamos el helper de fecha
        const periodo = parseSQLDate(p.periodo).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const vencimiento = parseSQLDate(p.fecha_vencimiento).toLocaleDateString('es-ES');
        
        tbody.innerHTML += `<tr><td><strong>${periodo}</strong></td><td>${p.total_gastos_ordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td>${p.total_gastos_extraordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td>${vencimiento}</td><td><span class="estado-${p.estado.toLowerCase()}">${p.estado}</span></td><td class="acciones"><button class="btn-secondary btn-sm" onclick="window.verDetallePeriodo(${p.id})">Ver Detalle</button></td></tr>`;
    });
}

async function cargarPeriodosAdmin() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/expensas-periodos`;
        periodosCache = await fetchData(url);
        renderTablaAdmin();
    } catch (error) {
        mostrarNotificacion('Error al cargar los períodos.', 'error');
    }
}

// --- Lógica del Modal 1: Crear Período (Admin) ---

async function guardarPeriodo(e) {
    e.preventDefault();
    
    // Convertir 'YYYY-MM' (del input month) a 'YYYY-MM-01' (DATE)
    const periodoMes = document.getElementById('periodo-mes').value;
    if (!periodoMes) {
        mostrarNotificacion('Debe seleccionar un período (Mes y Año).', 'warning');
        return;
    }
    const periodoDate = periodoMes + '-01'; // Añade el día 1
    
    const data = {
        periodo: periodoDate,
        fecha_vencimiento: document.getElementById('periodo-vencimiento').value,
        total_gastos_ordinarios: parseFloat(document.getElementById('periodo-ordinarios').value) || 0,
        total_gastos_extraordinarios: parseFloat(document.getElementById('periodo-extraordinarios').value) || 0
    };
    
    try {
        await sendData(`/api/consorcio/${appState.negocioActivoId}/expensas-periodos`, data, 'POST');
        mostrarNotificacion('Período creado en Borrador.', 'success');
        modalPeriodo.style.display = 'none';
        formPeriodo.reset();
        await cargarPeriodosAdmin();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Lógica de la Vista de Detalle (Admin) ---
export async function verDetallePeriodo(periodoId) {
    try {
        const data = await fetchData(`/api/consorcio/expensas-periodos/${periodoId}/detalles`);
        detallePeriodoCache = data;
        const { periodo, detalles } = data;

        if (vistaPrincipal) vistaPrincipal.style.display = 'none';
        if (vistaDetalle) vistaDetalle.style.display = 'block';

        // ✨ CAMBIO: Usamos el helper de fecha
        const periodoStr = parseSQLDate(periodo.periodo).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        
        const detalleTitulo = document.getElementById('detalle-titulo');
        const detalleResumen = document.getElementById('detalle-resumen');
        const btnEmitir = document.getElementById('btn-emitir-periodo');
        const tbody = document.getElementById('tabla-detalle-expensas-body');
        
        // ¡Aquí estaba el bug!
        if (detalleTitulo) detalleTitulo.textContent = `Detalle del Período: ${periodoStr}`;
        if (detalleResumen) detalleResumen.innerHTML = `<strong>Gastos Ord:</strong> ${periodo.total_gastos_ordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} | <strong>Gastos Ext:</strong> ${periodo.total_gastos_extraordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} | <strong>Estado:</strong> <span class="estado-${periodo.estado.toLowerCase()}">${periodo.estado}</span>`;

        if (btnEmitir) {
            if (periodo.estado === 'Borrador') {
                btnEmitir.style.display = 'block';
                btnEmitir.onclick = () => emitirPeriodo(periodoId);
            } else {
                btnEmitir.style.display = 'none';
            }
        }
        
        if (tbody) {
            tbody.innerHTML = '';
            if (detalles.length === 0 && periodo.estado === 'Emitido') {
                tbody.innerHTML = '<tr><td colspan="7">No se encontraron deudas para este período.</td></tr>';
            } else if (periodo.estado === 'Borrador') {
                 tbody.innerHTML = `<tr><td colspan="7">El período está en "Borrador". Haga clic en "Emitir Expensas" para calcular las deudas.</td></tr>`;
            }

            detalles.forEach(d => {
                const saldo = d.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
                
                let acciones = '';
                if (d.estado_pago !== 'Pagado' && d.estado_pago !== 'Anulado') {
                    acciones += `<button class="btn-primary btn-sm" onclick="window.abrirModalPago(${d.id}, '${d.nombre_unidad}', ${d.saldo_pendiente})">Registrar Pago</button>`;
                }
                if (d.estado_pago !== 'Anulado') {
                    // ✨ NUEVO: Botón de Anular (solo superadmin)
                    acciones += ` <button class="btn-danger btn-sm superadmin-only" onclick="window.anularExpensa(${d.id})">Anular</button>`;
                }
                
                // ✨ CAMBIO: Arreglo para NaN% (usamos (d.coeficiente || 0))
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${d.nombre_unidad}</strong></td>
                        <td>${((d.coeficiente || 0) * 100).toFixed(2)}%</td>
                        <td>${d.monto_ordinario.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                        <td>${d.monto_extraordinario.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                        <td>${d.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                        <td><span class="estado-${d.estado_pago.toLowerCase().replace(' ', '-')}">${d.estado_pago}</span></td>
                        <td class="acciones">${acciones}</td>
                    </tr>
                `;
            });
        }

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function volverALista() {
    vistaPrincipal.style.display = 'block';
    vistaDetalle.style.display = 'none';
    detallePeriodoCache = {}; // Limpiar caché
    cargarPeriodosAdmin(); // Recargar la lista por si algo cambió
}

export async function emitirPeriodo(periodoId) {
    if (!confirm('¿Está seguro de que desea emitir este período? \n\nEsta acción calculará la deuda para todas las unidades y ya no podrá modificar los gastos totales.')) {
        return;
    }
    
    try {
        const url = `/api/consorcio/expensas-periodos/${periodoId}/emitir`;
        const respuesta = await sendData(url, {}, 'POST');
        mostrarNotificacion(respuesta.message, 'success');
        // Recargamos la vista de detalle
        verDetallePeriodo(periodoId);
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Lógica del Modal 2: Registrar Pago (Admin) ---

export function abrirModalPago(expensaUnidadId, nombreUnidad, saldoPendiente) {
    formPago.reset();
    document.getElementById('pago-expensa-unidad-id').value = expensaUnidadId;
    document.getElementById('pago-info-unidad').textContent = nombreUnidad;
    
    const saldoStr = saldoPendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    document.getElementById('pago-info-saldo').textContent = saldoStr;
    
    // Sugerir el monto total del saldo
    document.getElementById('pago-monto').value = saldoPendiente.toFixed(2);
    
    modalPago.style.display = 'flex';
}

async function registrarPago(e) {
    e.preventDefault();
    const expensaUnidadId = document.getElementById('pago-expensa-unidad-id').value;
    const data = {
        monto_pagado: parseFloat(document.getElementById('pago-monto').value),
        notas_pago: document.getElementById('pago-notas').value || null
    };

    if (data.monto_pagado <= 0) {
        mostrarNotificacion('El monto a pagar debe ser mayor a cero.', 'warning');
        return;
    }

    try {
        const url = `/api/consorcio/expensas-unidades/${expensaUnidadId}/registrar-pago`;
        await sendData(url, data, 'POST');
        mostrarNotificacion('Pago registrado con éxito.', 'success');
        modalPago.style.display = 'none';
        // Recargamos la vista de detalle
        verDetallePeriodo(detallePeriodoCache.periodo.id);
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- ✨ NUEVA FUNCIÓN: Anular Expensa (Superadmin) ---
export async function anularExpensa(expensaUnidadId) {
    if (!confirm('¿ESTÁ SEGURO? \n\nEsta acción (solo Superadmin) anulará esta expensa, poniendo todos sus montos en CERO. Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const url = `/api/consorcio/expensas-unidades/${expensaUnidadId}/anular`;
        await sendData(url, {}, 'PUT');
        mostrarNotificacion('Expensa anulada con éxito.', 'success');
        // Recargamos la vista de detalle
        verDetallePeriodo(detallePeriodoCache.periodo.id);
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---
export function inicializarLogicaExpensas() {
    // Vistas principales
    vistaPrincipal = document.getElementById('lista-principal-view');
    vistaDetalle = document.getElementById('detalle-periodo-view');
    
    // Modales
    modalPeriodo = document.getElementById('modal-periodo');
    formPeriodo = document.getElementById('form-periodo');
    modalPago = document.getElementById('modal-registrar-pago');
    formPago = document.getElementById('form-registrar-pago');
    
    const expensasTitulo = document.getElementById('expensas-titulo');
    
    // Validamos solo la vista principal
    if (!vistaPrincipal) {
        console.error('No se encontró #lista-principal-view. Abortando inicialización de Expensas.');
        return;
    }

    // --- LÓGICA DE ROLES ---
    if (esAdmin()) {
        if (expensasTitulo) expensasTitulo.textContent = 'Gestión de Períodos de Expensas';
        cargarPeriodosAdmin();
        
        // --- Listeners de Admin (BLINDADOS) ---
        const btnAbrir = document.getElementById('btn-abrir-modal-periodo');
        if (btnAbrir) {
            btnAbrir.addEventListener('click', () => {
                if (modalPeriodo) modalPeriodo.style.display = 'flex';
            });
        }
        
        const btnCerrarPeriodo = document.getElementById('close-modal-periodo');
        if (btnCerrarPeriodo) {
            btnCerrarPeriodo.addEventListener('click', () => {
                if (modalPeriodo) modalPeriodo.style.display = 'none';
            });
        }
        
        if (formPeriodo) {
            formPeriodo.addEventListener('submit', guardarPeriodo);
        }

        const btnCerrarPago = document.getElementById('close-modal-pago');
        if (btnCerrarPago) {
            btnCerrarPago.addEventListener('click', () => {
                if (modalPago) modalPago.style.display = 'none';
            });
        }

        if (formPago) {
            formPago.addEventListener('submit', registrarPago);
        }

    } else {
        if (expensasTitulo) expensasTitulo.textContent = 'Mis Expensas';
        cargarMisExpensas();
    }
    
    // Listeners generales (para cerrar modales al hacer clic fuera)
    window.addEventListener('click', (e) => {
        if (e.target == modalPeriodo) modalPeriodo.style.display = 'none';
        if (e.target == modalPago) modalPago.style.display = 'none';
    });
}