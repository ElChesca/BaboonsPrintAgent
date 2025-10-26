// app/static/js/modules/proveedores.js
// --- CAMBIO: Importamos loadContent para usarlo en los botones ---
import { fetchData } from '../api.js';
import { appState, loadContent } from '../main.js'; // Necesitamos negocioActivoId y loadContent
import { mostrarNotificacion } from './notifications.js';

let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
let proveedoresCache = [];

// Helper para formatear moneda
const formatCurrency = (value) => {
    // Asegurarse de que el valor sea un número antes de formatear
    const numberValue = Number(value);
    if (isNaN(numberValue)) {
        console.warn(`Valor no numérico recibido por formatCurrency: ${value}`);
        return '$ 0.00'; // O un valor por defecto/error
    }
    return numberValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};


async function cargarProveedores() {
    // Asegurarse de que negocioActivoId no sea null antes de llamar a la API
    if (!appState.negocioActivoId) {
        mostrarNotificacion('Seleccione un negocio activo para ver proveedores.', 'warning');
        console.warn("cargarProveedores llamado sin negocioActivoId.");
        // Limpiar tabla si no hay negocio
        const tbody = document.querySelector('#tabla-proveedores tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Seleccione un negocio activo.</td></tr>';
        return;
    }
    try {
        console.log(`Cargando proveedores para negocio ID: ${appState.negocioActivoId}`);
        proveedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        console.log("Proveedores recibidos:", proveedoresCache);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los proveedores.', 'error');
        console.error("Error cargando proveedores:", error);
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-proveedores tbody');
    if (!tbody) {
        console.error("Elemento tbody #tabla-proveedores no encontrado.");
        return;
    }
    tbody.innerHTML = '';
    if (!proveedoresCache || proveedoresCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay proveedores para mostrar.</td></tr>';
        return;
    }
    proveedoresCache.forEach(p => {
        // --- CAMBIO: Añadimos botones Ver Ingresos y Ver Pagos ---
        tbody.innerHTML += `
            <tr data-proveedor-id="${p.id}">
                <td>${p.nombre || 'Sin Nombre'}</td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${formatCurrency(p.saldo_cta_cte)}</td>
                <td>
                    <button class="btn btn-info btn-sm btn-ver-ingresos" data-id="${p.id}" title="Ver Ingresos de Mercadería">Ingresos</button>
                    <button class="btn btn-success btn-sm btn-ver-pagos" data-id="${p.id}" title="Ver Pagos Realizados">Pagos</button>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${p.id}" title="Editar Proveedor">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${p.id}" title="Borrar Proveedor">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function resetFormulario() {
    if (!form) return;
    // Asegurarse que los elementos existan antes de usarlos
    if(tituloForm) tituloForm.textContent = 'Añadir Nuevo Proveedor';
    form.reset();
    if(idInput) idInput.value = '';
    if(btnCancelar) btnCancelar.style.display = 'none';
}

async function guardarProveedor(e) {
    e.preventDefault();
    // Validar que los elementos del form existen
    if (!nombreInput || !contactoInput || !telefonoInput || !emailInput || !idInput) {
        console.error("Elementos del formulario no encontrados al guardar.");
        mostrarNotificacion("Error interno del formulario.", "error");
        return;
    }

    const id = idInput.value;
    const data = {
        nombre: nombreInput.value.trim(),
        contacto: contactoInput.value.trim(),
        telefono: telefonoInput.value.trim(),
        email: emailInput.value.trim()
    };

    if (!data.nombre) {
        return mostrarNotificacion('El nombre del proveedor es obligatorio.', 'warning');
    }

    const esEdicion = !!id;
    const url = esEdicion ? `/api/proveedores/${id}` : `/api/negocios/${appState.negocioActivoId}/proveedores`;
    const method = esEdicion ? 'PUT' : 'POST';

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) { // Verificar si el botón existe
        submitButton.disabled = true;
        submitButton.textContent = esEdicion ? 'Guardando...' : 'Creando...';
    }

    try {
        const responseData = await fetchData(url, { method, body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
        mostrarNotificacion(`Proveedor ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        resetFormulario();
        await cargarProveedores();
    } catch (error) {
        mostrarNotificacion(error.message || 'Ocurrió un error al guardar el proveedor.', 'error');
        console.error(`Error guardando proveedor (ID: ${id}):`, error);
    } finally {
         if (submitButton) {
             submitButton.disabled = false;
             submitButton.textContent = 'Guardar';
         }
    }
}

// Ya no necesita ser exportada directamente
function editarProveedor(id) {
    // Validar elementos del form
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar || !form) {
        console.error("Elementos del formulario no encontrados al intentar editar.");
        mostrarNotificacion("Error interno del formulario.", "error");
        return;
    }

    const proveedor = proveedoresCache.find(p => p.id === id);
    if (!proveedor) {
        console.error(`Proveedor con ID ${id} no encontrado en caché.`);
        mostrarNotificacion('Error: No se encontró el proveedor para editar.', 'error');
        return;
    }

    tituloForm.textContent = 'Editar Proveedor';
    idInput.value = proveedor.id;
    nombreInput.value = proveedor.nombre || ''; // Default a '' si es null/undefined
    contactoInput.value = proveedor.contacto || '';
    telefonoInput.value = proveedor.telefono || '';
    emailInput.value = proveedor.email || '';
    btnCancelar.style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll más preciso
}

// Mantenemos export porque main.js lo necesita globalmente (por si acaso o para futuro)
export async function borrarProveedor(id) {
    if (!confirm(`¿Estás seguro de que quieres eliminar al proveedor con ID ${id}? Esta acción no se puede deshacer.`)) return;
    try {
        await fetchData(`/api/proveedores/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Proveedor eliminado con éxito.', 'success');
        await cargarProveedores();
    } catch (error) {
        mostrarNotificacion(error.message || 'Ocurrió un error al eliminar el proveedor.', 'error');
        console.error(`Error borrando proveedor (ID: ${id}):`, error);
    }
}

// --- NUEVO: Función nombrada para el handler de la tabla ---
function handleTablaClick(e) {
    const target = e.target; // Elemento clickeado
    // Buscar el ID en el data-id del botón o en el data-proveedor-id de la fila
    const proveedorId = target.dataset.id || target.closest('tr')?.dataset.proveedorId;

    if (!proveedorId) return; // Si no hay ID, no hacemos nada

    const id = parseInt(proveedorId);

    if (target.classList.contains('btn-edit')) {
        console.log(`Editando proveedor ${id}`);
        editarProveedor(id); // Llama a la función local

    } else if (target.classList.contains('btn-delete')) {
        console.log(`Borrando proveedor ${id}`);
        borrarProveedor(id); // Llama a la función exportada

    // --- CAMBIO: Añadimos lógica para los nuevos botones ---
    } else if (target.classList.contains('btn-ver-ingresos')) {
        console.log(`Navegando a ingresos del proveedor ${id}`);
        // TODO: Necesitamos una forma de pasar el ID al módulo historial_ingresos
        // Opción: Pasarlo en el hash
        window.location.hash = `#historial_ingresos?proveedor=${id}`;
        // loadContent se encargará de cargar la página correcta por el hash change

    } else if (target.classList.contains('btn-ver-pagos')) {
        console.log(`Navegando a pagos del proveedor ${id}`);
        // TODO: Necesitamos crear historial_pagos_proveedores.html y .js
        // Opción: Pasarlo en el hash
        window.location.hash = `#historial_pagos_proveedores?proveedor=${id}`;
        mostrarNotificacion(`Módulo 'Historial de Pagos a Proveedores' no implementado aún.`, 'warning');
    }
}


export function inicializarLogicaProveedores() {
    console.log("Inicializando lógica de proveedores...");
    form = document.getElementById('form-proveedor');
    const tablaBody = document.querySelector('#tabla-proveedores tbody');

    if (!form || !tablaBody) {
        console.error("Error Crítico: Formulario (#form-proveedor) o tabla (#tabla-proveedores tbody) no encontrados en proveedores.html.");
        return;
    }

    tituloForm = document.getElementById('form-proveedor-titulo');
    idInput = document.getElementById('proveedor-id');
    nombreInput = document.getElementById('proveedor-nombre');
    contactoInput = document.getElementById('proveedor-contacto');
    telefonoInput = document.getElementById('proveedor-telefono');
    emailInput = document.getElementById('proveedor-email');
    btnCancelar = document.getElementById('btn-cancelar-edicion');

    // Validar existencia de todos los elementos antes de asignar listeners
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar) {
        console.error("Faltan elementos internos en el formulario de proveedores (titulo, inputs, etc.).");
        return;
    }

    // Limpiar listeners anteriores para evitar duplicados al recargar
    form.removeEventListener('submit', guardarProveedor);
    btnCancelar.removeEventListener('click', resetFormulario);
    // Removemos listener específico si ya existía
    tablaBody.removeEventListener('click', handleTablaClick);

    // Añadir listeners
    form.addEventListener('submit', guardarProveedor);
    btnCancelar.addEventListener('click', resetFormulario);
    // Añadir listener de delegación
    tablaBody.addEventListener('click', handleTablaClick);

    cargarProveedores(); // Carga inicial
    resetFormulario();
}

// La exportación de borrarProveedor se mantiene
// La exportación de inicializarLogicaProveedores es necesaria para main.js