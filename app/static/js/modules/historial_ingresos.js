// app/static/js/modules/historial_ingresos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// --- Elementos del DOM (declarados aquí, asignados en init) ---
let tablaBody;
let modalDetalles;
let closeModalBtn;
let contenidoModal;
let filtroProveedorSelect;

// --- Helpers ---
const formatCurrency = (value) => {
    const numberValue = Number(value);
    return isNaN(numberValue) ? '$ 0.00' : numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        console.warn("Error formateando fecha:", dateString, e);
        return dateString;
    }
};

const formatFacturaNro = (tipo, prefijo, numero) => {
    if (!prefijo || !numero) return '-';
    const paddedPrefijo = String(prefijo).padStart(4, '0');
    const paddedNumero = String(numero).padStart(8, '0');
    return `${tipo || 'FC'} ${paddedPrefijo}-${paddedNumero}`;
};

const getEstadoBadgeClass = (estado) => {
    switch (String(estado).toLowerCase()) {
        case 'pagada': return 'status-pagada'; // Necesitas definir .status-pagada en global.css (ej. background verde)
        case 'parcial': return 'status-parcial'; // Necesitas definir .status-parcial (ej. background naranja)
        case 'pendiente': return 'status-pendiente'; // Ya la tienes? (ej. background amarillo)
        default: return 'status-desconocido'; // Añadir un default (ej. background gris)
    }
};


// --- Funciones de Renderizado ---

/** Renderiza la tabla del historial de ingresos */
function renderizarHistorial(ingresos) {
    // Re-chequeo por si acaso
    if (!tablaBody) {
        console.error("renderizarHistorial: tablaBody no está disponible.");
        return;
    }
    tablaBody.innerHTML = ''; // Limpiar

    if (!ingresos || ingresos.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay ingresos para mostrar con los filtros seleccionados.</td></tr>';
        return;
    }

    ingresos.forEach(ingreso => {
        const row = document.createElement('tr');
        const estadoPago = ingreso.estado_pago || 'pendiente';
        row.innerHTML = `
            <td>${formatDate(ingreso.fecha)}</td>
            <td>${ingreso.proveedor_nombre || 'N/A'}</td>
            <td>${formatFacturaNro(ingreso.factura_tipo, ingreso.factura_prefijo, ingreso.factura_numero)}</td>
            <td>${ingreso.referencia || '-'}</td>
            <td>${formatCurrency(ingreso.total_factura)}</td>
            <td>${formatCurrency(ingreso.monto_pagado)}</td>
            <td>${formatCurrency(ingreso.saldo_pendiente)}</td>
            <td><span class="status-badge ${getEstadoBadgeClass(estadoPago)}">${estadoPago}</span></td>
            <td><button class="btn btn-info btn-sm btn-ver-detalles" data-id="${ingreso.id}">Ver</button></td>
        `;
        tablaBody.appendChild(row);
    });
}

/** Carga y muestra los detalles de un ingreso en el modal */
// Asegúrate que main.js exporte esta función si se llama desde ahí, o quita el export si no.
// UPDATE: main.js ya la exporta (window.mostrarDetalleIngreso), así que mantenemos el export aquí.
export async function mostrarDetalle(ingresoId) {
    // Re-chequeo de elementos del modal
    if (!modalDetalles || !contenidoModal || !closeModalBtn) {
         console.error("mostrarDetalle: Elementos del modal no encontrados.");
         mostrarNotificacion("Error al intentar abrir los detalles.", "error");
         return;
    }
    contenidoModal.innerHTML = '<p>Cargando detalles...</p>';
    modalDetalles.style.display = 'flex'; // Mostrar modal

    try {
        const detalles = await fetchData(`/api/ingresos/${ingresoId}/detalles`);
        if (!detalles || detalles.length === 0) {
            contenidoModal.innerHTML = '<p>Este ingreso no tiene detalles registrados.</p>';
            return;
        }

        let tablaHtml = `
            <h4>Items del Ingreso</h4>
            <table class="tabla-bonita" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Costo Unit.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        let totalCalculado = 0;
        detalles.forEach(d => {
            const cantidad = Number(d.cantidad) || 0;
            // Asegurarse que el costo sea numérico antes de multiplicar
            const costoUnit = d.precio_costo_unitario !== null ? Number(d.precio_costo_unitario) : 0;
            const subtotal = cantidad * costoUnit;
            totalCalculado += subtotal;
            tablaHtml += `
                <tr>
                    <td>${d.nombre || 'Producto desconocido'}</td>
                    <td>${cantidad}</td>
                    <td>${d.precio_costo_unitario !== null ? formatCurrency(costoUnit) : '-'}</td>
                    <td>${formatCurrency(subtotal)}</td>
                </tr>
            `;
        });
        tablaHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" style="text-align: right;">Total Items:</th>
                        <th>${formatCurrency(totalCalculado)}</th>
                    </tr>
                </tfoot>
            </table>
        `;
        contenidoModal.innerHTML = tablaHtml;

    } catch (error) {
        mostrarNotificacion('Error al cargar los detalles del ingreso.', 'error');
        console.error("Error mostrando detalle ingreso:", error);
        contenidoModal.innerHTML = `<p style="color: red;">Error al cargar detalles: ${error.message}</p>`;
    }
}

// --- Lógica Principal ---

/** Carga el historial de ingresos desde la API, aplicando filtros */
async function cargarHistorial() {
    // Re-chequeo de elementos
    if (!tablaBody || !filtroProveedorSelect) {
        console.error("cargarHistorial: Faltan elementos tablaBody o filtroProveedorSelect.");
        return;
    }
    if (!appState.negocioActivoId) {
         tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
         filtroProveedorSelect.disabled = true; // Deshabilitar filtro si no hay negocio
         return;
    } else {
        // Asegurarse de habilitarlo si SÍ hay negocio (por si se deshabilitó antes)
        filtroProveedorSelect.disabled = false;
    }

    tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Cargando historial...</td></tr>'; // Mostrar 'Cargando'

    let url = `/api/negocios/${appState.negocioActivoId}/ingresos`;
    const proveedorIdSeleccionado = filtroProveedorSelect.value;

    if (proveedorIdSeleccionado) {
        url += `?proveedor_id=${proveedorIdSeleccionado}`;
    }

    try {
        console.log(`Cargando historial desde: ${url}`);
        const ingresos = await fetchData(url);
        renderizarHistorial(ingresos);
    } catch (error) {
        mostrarNotificacion('Error al cargar el historial de ingresos.', 'error');
        console.error("Error cargando historial ingresos:", error);
        tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error al cargar historial. Intente nuevamente.</td></tr>';
    }
}

/** Llena el selector de proveedores para el filtro */
async function poblarFiltroProveedores() {
    if (!filtroProveedorSelect) {
         console.error("poblarFiltroProveedores: filtroProveedorSelect no definido.");
         return Promise.reject("Elemento select no encontrado");
    }
    filtroProveedorSelect.innerHTML = '<option value="">-- Todos --</option>';
    filtroProveedorSelect.disabled = true;

    if (!appState.negocioActivoId) {
         console.warn("poblarFiltroProveedores: No hay negocio activo.");
         return Promise.resolve(); // Resuelve, no hay nada que cargar
    }

    try {
        console.log("Poblando filtro de proveedores para historial ingresos...");
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedores.forEach(p => {
            filtroProveedorSelect.appendChild(new Option(p.nombre, p.id));
        });

        // Leer ID de proveedor desde query params (si existe) DESPUÉS de poblar
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const proveedorIdFromUrl = urlParams.get('proveedor');

        if (proveedorIdFromUrl) {
            if (Array.from(filtroProveedorSelect.options).some(opt => opt.value === proveedorIdFromUrl)) {
                 filtroProveedorSelect.value = proveedorIdFromUrl;
                 console.log(`Filtro proveedor preseleccionado a ID: ${proveedorIdFromUrl}`);
            } else {
                 console.warn(`Proveedor ID ${proveedorIdFromUrl} del hash no existe en la lista, mostrando todos.`);
                 filtroProveedorSelect.value = "";
            }
        } else {
            filtroProveedorSelect.value = ""; // Asegurar "Todos" si no hay filtro
        }

        filtroProveedorSelect.disabled = false;
        console.log("Filtro de proveedores poblado.");
        return Promise.resolve(); // Indicar éxito

    } catch (error) {
        console.error("Error poblando filtro proveedores:", error);
        filtroProveedorSelect.innerHTML = '<option value="">Error al cargar</option>';
        filtroProveedorSelect.disabled = true;
        return Promise.reject(error); // Indicar fallo
    }
}

// --- Handler para clicks en la tabla ---
function handleTablaClick(event) {
    const target = event.target; // Elemento clickeado
    if (target.classList.contains('btn-ver-detalles')) {
        const ingresoId = target.dataset.id;
        if (ingresoId) {
            console.log(`Mostrando detalles para ingreso ID: ${ingresoId}`);
            mostrarDetalle(ingresoId); // Llama a la función exportada
        } else {
            console.warn("Botón 'Ver Detalles' clickeado sin data-id.");
        }
    }
    // Añadir lógica para otros botones si es necesario
}

// Handler nombrado para cerrar modal
function closeModalHandler() {
    if(modalDetalles) modalDetalles.style.display = 'none';
}


// --- Inicialización del Módulo ---
// Exportar con el nombre que espera main.js
export function inicializarLogicaHistorialIngresos() {
    console.log("Inicializando módulo Historial de Ingresos...");

    // Seleccionar elementos DENTRO de init
    tablaBody = document.querySelector('#tabla-historial-ingresos tbody');
    modalDetalles = document.getElementById('modal-detalles-ingreso');
    closeModalBtn = document.getElementById('close-detalles-ingreso');
    contenidoModal = document.getElementById('contenido-detalles-ingreso');
    filtroProveedorSelect = document.getElementById('filtro-proveedor-ingresos');

    // Comprobar que TODOS los elementos críticos existen
    if (!tablaBody || !modalDetalles || !closeModalBtn || !contenidoModal || !filtroProveedorSelect) {
        console.error("Error crítico: Faltan elementos HTML esenciales en historial_ingresos.html.");
        mostrarNotificacion("Error al cargar la página de historial (elementos faltantes).", "error");
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.innerHTML = '<p style="color: red; text-align: center;">Error al cargar el módulo. Faltan componentes HTML.</p>';
        return; // Detener ejecución
    }
    console.log("Elementos HTML de Historial Ingresos encontrados.");

    // Limpiar listeners anteriores
    tablaBody.removeEventListener('click', handleTablaClick);
    closeModalBtn.removeEventListener('click', closeModalHandler);
    filtroProveedorSelect.removeEventListener('change', cargarHistorial);
    console.log("Listeners de Historial Ingresos limpiados.");

    // Añadir listeners
    tablaBody.addEventListener('click', handleTablaClick);
    closeModalBtn.addEventListener('click', closeModalHandler);
    filtroProveedorSelect.addEventListener('change', cargarHistorial);
    console.log("Nuevos listeners de Historial Ingresos añadidos.");

    // Carga inicial: poblar filtro y LUEGO cargar historial
    (async () => {
        try {
            await poblarFiltroProveedores(); // Espera a que se llene y seleccione
            await cargarHistorial(); // Carga con el filtro correcto
        } catch (error) {
            console.error("Error durante la inicialización de Historial Ingresos:", error);
            if(tablaBody) tablaBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error al inicializar. Verifique la consola.</td></tr>';
        }
    })();

    console.log("Inicialización de Historial de Ingresos completada.");
}