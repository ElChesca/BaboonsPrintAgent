// app/static/js/modules/historial_pagos_proveedores.js
import { fetchData } from '../api.js';
import { appState } from '../main.js'; // Necesitamos negocioActivoId
import { mostrarNotificacion } from './notifications.js';

// --- Elementos del DOM ---
let tablaBodyHistorialPagos, filtroProveedorSelectPagos;

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

// --- Funciones de Renderizado ---

/** Renderiza la tabla del historial de pagos */
function renderizarHistorialPagos(pagos) {
    // <-- DEBUG: Verificar si llegamos a renderizar
    console.log("DEBUG: Entrando a renderizarHistorialPagos. Datos recibidos:", pagos);

    if (!tablaBodyHistorialPagos) {
        console.error("renderizarHistorialPagos: tablaBodyHistorialPagos no está definido.");
        return;
    }
    tablaBodyHistorialPagos.innerHTML = ''; // Limpiar

    // Verificar si 'pagos' es realmente un Array
    if (!Array.isArray(pagos)) {
        console.error("renderizarHistorialPagos recibió algo que no es un array:", pagos);
        mostrarNotificacion("Error inesperado al procesar los datos de pagos.", "error");
        tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error al procesar datos. Verifique la consola.</td></tr>';
        return;
    }

    if (pagos.length === 0) {
        tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay pagos registrados para mostrar con los filtros seleccionados.</td></tr>';
        return;
    }

    pagos.forEach(pago => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(pago.fecha)}</td>
            <td>${pago.proveedor_nombre || 'N/A'}</td>
            <td>${formatCurrency(pago.monto_total)}</td>
            <td>${pago.metodo_pago || '-'}</td>
            <td>${pago.referencia || '-'}</td>
            <!--<td>${pago.usuario_nombre || '-'}</td> Opcional -->
            <!--<td><button class="btn btn-info btn-sm" data-id="${pago.id}">Detalles</button></td> Opcional -->
        `;
        tablaBodyHistorialPagos.appendChild(row);
    });
    // <-- DEBUG: Confirmar fin de renderizado
    console.log("DEBUG: renderizarHistorialPagos completado.");
}

// --- Lógica Principal ---

/** Carga el historial de pagos desde la API, aplicando filtros */
async function cargarHistorialPagos() {
    // <-- DEBUG: Inicio de la función
    console.log("DEBUG: Iniciando cargarHistorialPagos...");

    // <-- DEBUG: Verificar elementos antes de usarlos
    if (!tablaBodyHistorialPagos) {
        console.error("DEBUG: cargarHistorialPagos abortado - tablaBodyHistorialPagos no encontrado.");
        return;
    }
     if (!filtroProveedorSelectPagos) {
         console.error("DEBUG: cargarHistorialPagos abortado - filtroProveedorSelectPagos no encontrado.");
         return;
     }

    // <-- DEBUG: Verificar negocio activo
    console.log("DEBUG: Verificando negocio activo. ID:", appState.negocioActivoId);
    if (!appState.negocioActivoId) {
         tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
         console.log("DEBUG: cargarHistorialPagos abortado - No hay negocio activo.");
         return;
    }

    tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando historial...</td></tr>';

    let url = `/api/negocios/${appState.negocioActivoId}/pagos-proveedores`;
    const proveedorIdSeleccionado = filtroProveedorSelectPagos.value;
    // <-- DEBUG: Verificar ID de proveedor seleccionado
    console.log("DEBUG: ID Proveedor seleccionado en filtro:", proveedorIdSeleccionado);
    // Usar el filtro de la URL si existe y el select está en "Todos"
    const proveedorIdFinal = proveedorIdSeleccionado || appState.filtroProveedorId;
    console.log("DEBUG: ID Proveedor final a usar:", proveedorIdFinal);


    if (proveedorIdFinal) {
        url += `?proveedor_id=${proveedorIdFinal}`;
        // Preseleccionar si usamos el de appState
        if (!proveedorIdSeleccionado && appState.filtroProveedorId) {
            if (Array.from(filtroProveedorSelectPagos.options).some(opt => opt.value === appState.filtroProveedorId)){
                filtroProveedorSelectPagos.value = appState.filtroProveedorId;
                console.log("DEBUG: Preseleccionado filtro por appState.filtroProveedorId");
             } else {
                 console.warn(`DEBUG: Proveedor ID ${appState.filtroProveedorId} del hash no existe, mostrando todos.`);
                 appState.filtroProveedorId = null; // Limpiar si no existe
             }
        }
    }
    // Limpiar filtro temporal DESPUÉS de usarlo
    console.log("DEBUG: Limpiando appState.filtroProveedorId");
    appState.filtroProveedorId = null;

    try {
        // <-- DEBUG: URL final antes del fetch
        console.log(`DEBUG: Llamando a fetchData con URL: ${url}`);
        const pagos = await fetchData(url);
        // <-- DEBUG: Respuesta recibida de fetchData
        console.log("DEBUG: Datos recibidos de fetchData:", pagos);
        renderizarHistorialPagos(pagos);
    } catch (error) {
        // <-- DEBUG: Error durante fetchData o renderizado
        console.error("DEBUG: Error en cargarHistorialPagos (fetchData o renderizar):", error);
        // fetchData ya muestra notificación si la API dio error 500, etc.
        // Solo mostramos error genérico en tabla si no es un error ya notificado
        if (tablaBodyHistorialPagos && !error.notified) { // Asumiendo que fetchData añade 'notified'
             tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar historial. Verifique la consola.</td></tr>';
        }
    }
    // <-- DEBUG: Fin de cargarHistorialPagos
    console.log("DEBUG: Fin de cargarHistorialPagos.");
}

/** Llena el selector de proveedores para el filtro */
async function poblarFiltroProveedoresPagos() {
    // <-- DEBUG: Inicio de poblar filtro
    console.log("DEBUG: Iniciando poblarFiltroProveedoresPagos...");

    if (!filtroProveedorSelectPagos) {
        console.error("DEBUG: poblarFiltroProveedoresPagos abortado - filtroProveedorSelectPagos no encontrado.");
        return Promise.reject("Elemento select no encontrado");
    }
    filtroProveedorSelectPagos.innerHTML = '<option value="">-- Todos --</option>';
    filtroProveedorSelectPagos.disabled = true;

    // <-- DEBUG: Verificar negocio activo
    console.log("DEBUG: Verificando negocio activo (poblar filtro). ID:", appState.negocioActivoId);
    if (!appState.negocioActivoId) {
        console.warn("DEBUG: poblarFiltroProveedoresPagos abortado - No hay negocio activo.");
        return Promise.resolve(); // Resuelve, no hay nada que cargar
    }

    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        // <-- DEBUG: Proveedores recibidos para el filtro
        console.log("DEBUG: Proveedores recibidos para filtro:", proveedores);
        
        // Verificar si es un array antes de iterar
        if(Array.isArray(proveedores)) {
            proveedores.forEach(p => {
                filtroProveedorSelectPagos.appendChild(new Option(p.nombre, p.id));
            });
        } else {
             console.error("DEBUG: La API de proveedores no devolvió un array para el filtro.");
             throw new Error("Formato de respuesta de proveedores incorrecto.");
        }


        // Seleccionar valor si appState.filtroProveedorId tiene algo
        // (appState.filtroProveedorId se setea en inicializarLogica...)
        // <-- DEBUG: Verificar filtroProveedorId antes de seleccionar
        console.log("DEBUG: appState.filtroProveedorId antes de seleccionar en filtro:", appState.filtroProveedorId);
        if (appState.filtroProveedorId) {
            if (Array.from(filtroProveedorSelectPagos.options).some(opt => opt.value === appState.filtroProveedorId)) {
                 filtroProveedorSelectPagos.value = appState.filtroProveedorId;
                 console.log(`DEBUG: Filtro proveedor preseleccionado a ID: ${appState.filtroProveedorId}`);
            } else {
                 console.warn(`DEBUG: Proveedor ID ${appState.filtroProveedorId} del hash no existe, mostrando todos.`);
                 // No limpiar appState aquí, se limpia en cargarHistorialPagos
                 filtroProveedorSelectPagos.value = ""; // Asegurar "Todos"
            }
        } else {
             filtroProveedorSelectPagos.value = ""; // Asegurar "Todos"
        }


        filtroProveedorSelectPagos.disabled = false;
        console.log("DEBUG: Filtro de proveedores poblado.");
        return Promise.resolve();

    } catch (error) {
        console.error("DEBUG: Error poblando filtro proveedores para pagos:", error);
        filtroProveedorSelectPagos.innerHTML = '<option value="">Error al cargar</option>';
        filtroProveedorSelectPagos.disabled = true;
        return Promise.reject(error);
    }
}

// --- Inicialización del Módulo ---
export function inicializarLogicaHistorialPagosProveedores() {
    console.log("DEBUG: Iniciando inicializarLogicaHistorialPagosProveedores...");

    tablaBodyHistorialPagos = document.querySelector('#tabla-historial-pagos tbody');
    filtroProveedorSelectPagos = document.getElementById('filtro-proveedor-pagos');

    if (!tablaBodyHistorialPagos || !filtroProveedorSelectPagos) {
        console.error("Error crítico: Faltan elementos HTML en historial_pagos_proveedores.html. IDs buscados:",
            '#tabla-historial-pagos tbody', '#filtro-proveedor-pagos');
        mostrarNotificacion("Error al cargar la página de historial de pagos.", "error");
        return;
    }
    console.log("DEBUG: Elementos HTML de Historial Pagos encontrados.");

    // Limpiar listeners anteriores
    filtroProveedorSelectPagos.removeEventListener('change', cargarHistorialPagos);
    console.log("DEBUG: Listeners de Historial Pagos limpiados.");

    // Añadir listener para el filtro
    filtroProveedorSelectPagos.addEventListener('change', cargarHistorialPagos);
    console.log("DEBUG: Nuevo listener de filtro añadido.");

    // Leer ID de proveedor desde query params (si venimos del botón 'Pagos')
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const proveedorIdFromUrl = urlParams.get('proveedor');

    // Resetear filtro en appState AL INICIO de la inicialización
    appState.filtroProveedorId = proveedorIdFromUrl || null;
    console.log(`DEBUG: Filtro inicial de proveedor ID desde URL (pagos): ${appState.filtroProveedorId}`);


    // Carga inicial: poblar filtro y LUEGO cargar historial
    (async () => {
        try {
            console.log("DEBUG: Llamando a poblarFiltroProveedoresPagos...");
            await poblarFiltroProveedoresPagos(); // Espera a que el filtro se llene y seleccione
            console.log("DEBUG: Llamando a cargarHistorialPagos después de poblar filtro...");
            await cargarHistorialPagos(); // Carga con el filtro correcto
        } catch (error) {
            console.error("DEBUG: Error durante la inicialización de Historial Pagos:", error);
            if(tablaBodyHistorialPagos) tablaBodyHistorialPagos.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error al inicializar. Verifique la consola.</td></tr>';
        }
    })();

    console.log("DEBUG: Inicialización de Historial de Pagos a Proveedores completada.");
}