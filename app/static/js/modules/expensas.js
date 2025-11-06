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

// --- VISTAS DEL INQUILINO (USUARIO OPERADOR) ---

function renderTablaInquilino(expensas) {
    const thead = document.getElementById('tabla-expensas-head');
    const tbody = document.getElementById('tabla-expensas-body');
    
    thead.innerHTML = `
        <tr>
            <th>Período</th>
            <th>Unidad</th>
            <th>Vencimiento</th>
            <th>Total a Pagar</th>
            <th>Saldo Pendiente</th>
            <th>Estado</th>
        </tr>
    `;
    
    tbody.innerHTML = '';
    if (expensas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No tienes expensas emitidas.</td></tr>';
        return;
    }
    
    expensas.forEach(ex => {
        const periodo = new Date(ex.periodo + 'T00:00:00').toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const vencimiento = new Date(ex.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES');
        tbody.innerHTML += `
            <tr>
                <td>${periodo}</td>
                <td>${ex.nombre_unidad}</td>
                <td>${vencimiento}</td>
                <td>${ex.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td><strong>${ex.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></td>
                <td><span class="estado-${ex.estado_pago.toLowerCase().replace(' ', '-')}">${ex.estado_pago}</span></td>
            </tr>
        `;
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
    
    thead.innerHTML = `
        <tr>
            <th>Período</th>
            <th>Gastos Ord.</th>
            <th>Gastos Ext.</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Acciones</th>
        </tr>
    `;
    
    tbody.innerHTML = '';
    if (periodosCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No se han creado períodos de expensas.</td></tr>';
        return;
    }

    periodosCache.forEach(p => {
        const periodo = new Date(p.periodo + 'T00:00:00').toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const vencimiento = new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES');
        tbody.innerHTML += `
            <tr>
                <td><strong>${periodo}</strong></td>
                <td>${p.total_gastos_ordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td>${p.total_gastos_extraordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td>${vencimiento}</td>
                <td><span class="estado-${p.estado.toLowerCase()}">${p.estado}</span></td>
                <td class="acciones">
                    <button class="btn-secondary btn-sm" onclick="window.verDetallePeriodo(${p.id})">Ver Detalle</button>
                    </td>
            </tr>
        `;
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
        detallePeriodoCache = data; // Guardamos {periodo: {...}, detalles: [...]}
        
        const { periodo, detalles } = data;

        // 1. Mostrar/Ocultar Vistas
        vistaPrincipal.style.display = 'none';
        vistaDetalle.style.display = 'block';

        // 2. Llenar Resumen
        const periodoStr = new Date(periodo.periodo + 'T00:00:00').toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        document.getElementById('detalle-titulo').textContent = `Detalle del Período: ${periodoStr}`;
        document.getElementById('detalle-resumen').innerHTML = `
            <strong>Gastos Ord:</strong> ${periodo.total_gastos_ordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} | 
            <strong>Gastos Ext:</strong> ${periodo.total_gastos_extraordinarios.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} |
            <strong>Estado:</strong> <span class="estado-${periodo.estado.toLowerCase()}">${periodo.estado}</span>
        `;

        // 3. Mostrar/Ocultar botón "Emitir"
        const btnEmitir = document.getElementById('btn-emitir-periodo');
        if (periodo.estado === 'Borrador') {
            btnEmitir.style.display = 'block';
            btnEmitir.onclick = () => emitirPeriodo(periodoId);
        } else {
            btnEmitir.style.display = 'none';
        }

        // 4. Llenar Tabla de Detalles
        const tbody = document.getElementById('tabla-detalle-expensas-body');
        tbody.innerHTML = '';
        if (detalles.length === 0 && periodo.estado === 'Emitido') {
            tbody.innerHTML = '<tr><td colspan="7">No se encontraron deudas para este período.</td></tr>';
        } else if (periodo.estado === 'Borrador') {
             tbody.innerHTML = `<tr><td colspan="7">El período está en "Borrador". Haga clic en "Emitir Expensas" para calcular las deudas.</td></tr>`;
        }

        detalles.forEach(d => {
            const saldo = d.saldo_pendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
            const btnPago = (d.estado_pago !== 'Pagado')
                ? `<button class="btn-primary btn-sm" onclick="window.abrirModalPago(${d.id}, '${d.nombre_unidad}', ${d.saldo_pendiente})">Registrar Pago</button>`
                : '';
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${d.nombre_unidad}</strong></td>
                    <td>${(d.coeficiente * 100).toFixed(2)}%</td>
                    <td>${d.monto_ordinario.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td>${d.monto_extraordinario.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td>${d.monto_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td><span class="estado-${d.estado_pago.toLowerCase().replace(' ', '-')}">${d.estado_pago}</span></td>
                    <td class="acciones">${btnPago}</td>
                </tr>
            `;
        });

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