// app/static/js/modules/pagos_proveedores.js
import { fetchData } from '../api.js';
import { appState } from '../main.js'; // Necesitamos negocioActivoId
import { mostrarNotificacion } from './notifications.js';

// --- Estado del Módulo ---
let proveedoresCache = [];
let facturasPendientesCache = [];
let aplicacionesPago = []; // Guardará { ingreso_id, monto_aplicado }

// --- Elementos del DOM (cachear para eficiencia) ---
let selProveedor, contFacturas, tablaFacturasBody, contDetallesPago, formPago;
let msgNoFacturas, displayTotalAplicado, inputMontoTotalPago, inputFechaPago, selMetodoPago, inputReferencia;

// --- Helpers ---
const formatCurrency = (value) => {
    const numberValue = Number(value);
    return isNaN(numberValue) ? '$ 0.00' : numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

// --- Funciones de Renderizado ---

/** Llena el selector de proveedores */
async function poblarSelectorProveedores() {
    if (!selProveedor) return;
    selProveedor.innerHTML = '<option value="">Cargando...</option>';
    selProveedor.disabled = true;
    try {
        proveedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        selProveedor.innerHTML = '<option value="">-- Seleccione un Proveedor --</option>';
        proveedoresCache.forEach(p => {
            selProveedor.appendChild(new Option(`${p.nombre} (${formatCurrency(p.saldo_cta_cte)})`, p.id));
        });
        selProveedor.disabled = false;
    } catch (error) {
        mostrarNotificacion('Error al cargar proveedores.', 'error');
        console.error("Error poblando selector proveedores:", error);
        selProveedor.innerHTML = '<option value="">Error al cargar</option>';
    }
}

/** Muestra u oculta secciones según el estado */
function actualizarVisibilidadSecciones(proveedorSeleccionado = false, hayFacturas = false) {
    contFacturas.classList.toggle('hidden', !proveedorSeleccionado || !hayFacturas);
    contDetallesPago.classList.toggle('hidden', !proveedorSeleccionado || !hayFacturas);
    msgNoFacturas.classList.toggle('hidden', !proveedorSeleccionado || hayFacturas);
}

/** Renderiza la tabla de facturas pendientes */
function renderizarTablaFacturas() {
    if (!tablaFacturasBody) return;
    tablaFacturasBody.innerHTML = ''; // Limpiar tabla
    aplicacionesPago = []; // Limpiar aplicaciones al renderizar
    let hayFacturas = facturasPendientesCache.length > 0;

    if (!hayFacturas) {
        actualizarVisibilidadSecciones(true, false); // Mostrar mensaje "no hay facturas"
        actualizarTotalAplicado(); // Asegurarse que el total sea 0
        return;
    }

    actualizarVisibilidadSecciones(true, true); // Mostrar tabla y detalles de pago

    facturasPendientesCache.forEach(factura => {
        const row = document.createElement('tr');
        row.dataset.ingresoId = factura.id; // Guardar ID para referencia

        // Formatear número de factura si existe
        let numFactura = '-';
        if (factura.factura_prefijo && factura.factura_numero) {
             numFactura = `${factura.factura_tipo || 'FC'} ${factura.factura_prefijo}-${factura.factura_numero}`;
        }

        row.innerHTML = `
            <td><input type="checkbox" class="chk-pagar" data-saldo="${factura.saldo_pendiente}"></td>
            <td>${new Date(factura.fecha).toLocaleDateString('es-AR')}</td>
            <td>${numFactura}</td>
            <td>${factura.referencia || '-'}</td>
            <td>${formatCurrency(factura.total_factura)}</td>
            <td>${formatCurrency(factura.saldo_pendiente)}</td>
            <td><input type="number" class="input-monto-aplicar" step="0.01" min="0" max="${factura.saldo_pendiente}" disabled></td>
        `;
        tablaFacturasBody.appendChild(row);
    });
    actualizarTotalAplicado(); // Calcular total inicial (debería ser 0)
}

// --- Funciones de Lógica y Eventos ---

/** Obtiene las facturas pendientes para el proveedor seleccionado */
async function cargarFacturasPendientes() {
    const proveedorId = selProveedor.value;
    // Resetear vistas antes de cargar
    facturasPendientesCache = [];
    renderizarTablaFacturas(); // Limpia la tabla y oculta secciones

    if (!proveedorId) {
        actualizarVisibilidadSecciones(false); // Ocultar todo si no hay proveedor
        return;
    }

    try {
        facturasPendientesCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores/${proveedorId}/facturas-pendientes`);
        console.log("Facturas pendientes recibidas:", facturasPendientesCache);
        renderizarTablaFacturas(); // Renderiza la tabla o el mensaje "no hay facturas"
    } catch (error) {
        mostrarNotificacion('Error al cargar facturas pendientes.', 'error');
        console.error("Error cargando facturas pendientes:", error);
        actualizarVisibilidadSecciones(true, false); // Mostrar mensaje "no hay facturas" en caso de error
    }
}

/** Calcula y muestra el total de los montos aplicados */
function actualizarTotalAplicado() {
    let total = 0;
    aplicacionesPago = []; // Recalcular aplicaciones desde cero
    const rows = tablaFacturasBody.querySelectorAll('tr');
    rows.forEach(row => {
        const checkbox = row.querySelector('.chk-pagar');
        const inputMonto = row.querySelector('.input-monto-aplicar');
        if (checkbox && checkbox.checked && inputMonto) {
            const monto = parseFloat(inputMonto.value) || 0;
            total += monto;
            aplicacionesPago.push({
                ingreso_id: parseInt(row.dataset.ingresoId),
                monto_aplicado: monto.toFixed(2) // Asegurar 2 decimales como string
            });
        }
    });
    displayTotalAplicado.textContent = formatCurrency(total);
    inputMontoTotalPago.value = total.toFixed(2); // Actualizar el input del monto total del pago
}

/** Maneja los cambios en checkboxes e inputs de la tabla */
function handleTablaInput(event) {
    const target = event.target;
    const row = target.closest('tr');
    if (!row) return;

    const checkbox = row.querySelector('.chk-pagar');
    const inputMonto = row.querySelector('.input-monto-aplicar');
    const saldoPendiente = parseFloat(checkbox.dataset.saldo);

    if (target.classList.contains('chk-pagar')) {
        // Si se marca el check, habilitar input y poner el saldo por defecto
        inputMonto.disabled = !target.checked;
        if (target.checked) {
            inputMonto.value = saldoPendiente.toFixed(2);
            inputMonto.max = saldoPendiente.toFixed(2); // Asegurar el máximo
        } else {
            inputMonto.value = ''; // Limpiar si se desmarca
        }
    } else if (target.classList.contains('input-monto-aplicar')) {
        // Validar que el monto no exceda el saldo
        let valorIngresado = parseFloat(target.value) || 0;
        if (valorIngresado > saldoPendiente) {
            target.value = saldoPendiente.toFixed(2);
            valorIngresado = saldoPendiente;
            mostrarNotificacion('El monto aplicado no puede exceder el saldo pendiente.', 'warning');
        }
        if (valorIngresado < 0) {
            target.value = '0.00';
            valorIngresado = 0;
        }
        // Si se ingresa un monto válido (aunque sea 0), marcar el checkbox
        checkbox.checked = valorIngresado >= 0 && target.value !== ''; 
        inputMonto.disabled = !checkbox.checked; // Reasegurar estado disabled
    }

    actualizarTotalAplicado(); // Recalcular siempre
}

/** Envía el formulario de pago al backend */
async function submitFormularioPago(event) {
    event.preventDefault();

    const proveedorId = selProveedor.value;
    const montoTotal = parseFloat(inputMontoTotalPago.value) || 0;
    const metodoPago = selMetodoPago.value;
    const fechaPago = inputFechaPago.value; // Ya está en YYYY-MM-DD

    // Validaciones
    if (!proveedorId) return mostrarNotificacion('Seleccione un proveedor.', 'warning');
    if (aplicacionesPago.length === 0) return mostrarNotificacion('Seleccione al menos una factura y aplique un monto.', 'warning');
    if (montoTotal <= 0) return mostrarNotificacion('El monto total del pago debe ser mayor a cero.', 'warning');
    if (!metodoPago) return mostrarNotificacion('Seleccione un método de pago.', 'warning');
     if (!fechaPago) return mostrarNotificacion('Seleccione la fecha del pago.', 'warning');


    const payload = {
        proveedor_id: parseInt(proveedorId),
        monto_total: montoTotal.toFixed(2),
        metodo_pago: metodoPago,
        fecha: fechaPago,
        referencia: inputReferencia.value.trim() || null,
        aplicaciones: aplicacionesPago
    };

    const submitButton = formPago.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';

    try {
        console.log("Enviando pago:", payload);
        const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/pagos-proveedores`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        mostrarNotificacion(response.message || 'Pago registrado con éxito.', 'success');
        
        // Resetear todo después de un pago exitoso
        selProveedor.value = ''; // Deseleccionar proveedor
        facturasPendientesCache = [];
        renderizarTablaFacturas(); // Limpia tabla y actualiza visibilidad
        formPago.reset(); // Limpiar formulario de pago
        // Actualizar el saldo del proveedor en el selector (opcional, requiere recargar proveedores)
        // await poblarSelectorProveedores(); // Descomentar si quieres ver el saldo actualizado inmediatamente

    } catch (error) {
        mostrarNotificacion(error.message || 'Error al registrar el pago.', 'error');
        console.error("Error registrando pago:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Registrar Pago';
    }
}


// --- Inicialización del Módulo ---
export function inicializarLogicaPagosProveedores() {
    console.log("Inicializando módulo Pagos a Proveedores...");

    // Cachear elementos del DOM
    selProveedor = document.getElementById('pago-proveedor-selector');
    contFacturas = document.getElementById('facturas-pendientes-container');
    tablaFacturasBody = document.getElementById('tabla-facturas-pendientes')?.querySelector('tbody'); // Más seguro
    contDetallesPago = document.getElementById('detalles-pago-container');
    formPago = document.getElementById('form-registrar-pago');
    msgNoFacturas = document.getElementById('mensaje-no-facturas');
    displayTotalAplicado = document.getElementById('total-aplicado-display');
    inputMontoTotalPago = document.getElementById('pago-monto-total');
    inputFechaPago = document.getElementById('pago-fecha');
    selMetodoPago = document.getElementById('pago-metodo');
    inputReferencia = document.getElementById('pago-referencia');

    // Validar que todos los elementos existan
    if (!selProveedor || !contFacturas || !tablaFacturasBody || !contDetallesPago || !formPago || !msgNoFacturas || !displayTotalAplicado || !inputMontoTotalPago || !inputFechaPago || !selMetodoPago || !inputReferencia) {
        console.error("Error crítico: Faltan elementos HTML esenciales en pagos_proveedores.html");
        mostrarNotificacion("Error al cargar la página de pagos.", "error");
        return;
    }

    // Configurar estado inicial
    actualizarVisibilidadSecciones(false); // Ocultar todo al inicio
    inputFechaPago.valueAsDate = new Date(); // Poner fecha de hoy por defecto

    // Limpiar listeners anteriores (buena práctica)
    selProveedor.removeEventListener('change', cargarFacturasPendientes);
    tablaFacturasBody.removeEventListener('input', handleTablaInput); // Usamos 'input' para capturar cambios en checkbox y number
    formPago.removeEventListener('submit', submitFormularioPago);

    // Añadir listeners
    selProveedor.addEventListener('change', cargarFacturasPendientes);
    tablaFacturasBody.addEventListener('input', handleTablaInput);
    formPago.addEventListener('submit', submitFormularioPago);

    // Cargar proveedores iniciales
    poblarSelectorProveedores();
}
