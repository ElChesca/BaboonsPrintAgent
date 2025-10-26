// app/static/js/modules/proveedores.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
let proveedoresCache = [];

// Helper para formatear moneda
const formatCurrency = (value) => {
    return (value || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};


async function cargarProveedores() {
    try {
        proveedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los proveedores.', 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-proveedores tbody');
    if (!tbody) return; // Añadido chequeo por si el elemento no existe aún
    tbody.innerHTML = '';
    proveedoresCache.forEach(p => {
        // --- CAMBIO AQUÍ: Añadimos la celda para saldo_cta_cte ---
        tbody.innerHTML += `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${formatCurrency(p.saldo_cta_cte)}</td> 
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editarProveedor(${p.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="borrarProveedor(${p.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function resetFormulario() {
    if (!form) return; // Chequeo adicional
    tituloForm.textContent = 'Añadir Nuevo Proveedor';
    form.reset();
    idInput.value = '';
    btnCancelar.style.display = 'none';
}

async function guardarProveedor(e) {
    e.preventDefault();
    const id = idInput.value;
    const data = {
        nombre: nombreInput.value.trim(), // Usar trim para evitar espacios
        contacto: contactoInput.value.trim(),
        telefono: telefonoInput.value.trim(),
        email: emailInput.value.trim()
    };
    
    // Validación básica en frontend
    if (!data.nombre) {
        return mostrarNotificacion('El nombre del proveedor es obligatorio.', 'warning');
    }

    const esEdicion = !!id;
    const url = esEdicion ? `/api/proveedores/${id}` : `/api/negocios/${appState.negocioActivoId}/proveedores`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        // Usamos sendData que maneja la respuesta JSON
        const responseData = await fetchData(url, { method, body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
        mostrarNotificacion(`Proveedor ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        resetFormulario();
        cargarProveedores(); // Recarga la tabla para mostrar el nuevo/actualizado proveedor
    } catch (error) {
        // El error ya viene formateado desde fetchData/sendData
        mostrarNotificacion(error.message || 'Ocurrió un error al guardar el proveedor.', 'error');
    }
}

// Asegurarse que las funciones estén disponibles globalmente si se llaman desde HTML
window.editarProveedor = (id) => {
    const proveedor = proveedoresCache.find(p => p.id === id);
    if (!proveedor) return;

    tituloForm.textContent = 'Editar Proveedor';
    idInput.value = proveedor.id;
    nombreInput.value = proveedor.nombre;
    contactoInput.value = proveedor.contacto || ''; // Usar '' si es null
    telefonoInput.value = proveedor.telefono || '';
    emailInput.value = proveedor.email || '';
    btnCancelar.style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' }); // Mejor que window.scrollTo
}

window.borrarProveedor = async (id) => {
    // Reemplazar confirm con un modal personalizado si es posible
    if (!confirm('¿Estás seguro de que quieres eliminar este proveedor? Esta acción no se puede deshacer.')) return; 
    try {
        await fetchData(`/api/proveedores/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Proveedor eliminado con éxito.', 'success');
        cargarProveedores(); // Recarga la tabla
    } catch (error) {
        mostrarNotificacion(error.message || 'Ocurrió un error al eliminar el proveedor.', 'error');
    }
}

export function inicializarLogicaProveedores() {
    form = document.getElementById('form-proveedor');
    if (!form) {
        console.error("Formulario de proveedor no encontrado.");
        return; // Salir si el formulario no está
    }

    tituloForm = document.getElementById('form-proveedor-titulo');
    idInput = document.getElementById('proveedor-id');
    nombreInput = document.getElementById('proveedor-nombre');
    contactoInput = document.getElementById('proveedor-contacto');
    telefonoInput = document.getElementById('proveedor-telefono');
    emailInput = document.getElementById('proveedor-email');
    btnCancelar = document.getElementById('btn-cancelar-edicion');
    
    // Asegurarse de que todos los elementos existan antes de añadir listeners
    if (!tituloForm || !idInput || !nombreInput || !contactoInput || !telefonoInput || !emailInput || !btnCancelar) {
        console.error("Faltan elementos en el formulario de proveedores.");
        return;
    }

    form.addEventListener('submit', guardarProveedor);
    btnCancelar.addEventListener('click', resetFormulario);

    cargarProveedores();
}
