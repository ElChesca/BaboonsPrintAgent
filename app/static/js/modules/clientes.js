// app/static/js/modules/clientes.js
import { getAuthHeaders } from './auth.js';
import { appState } from '../main.js';

export function inicializarLogicaClientes() {
    const form = document.getElementById('form-add-cliente');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!appState.negocioActivoId) { alert("Por favor, seleccione un negocio activo."); return; }

        const nuevoCliente = {
            nombre: form.nombre.value,
            documento: form.documento.value,
            telefono: form.telefono.value,
            email: form.email.value,
            direccion: form.direccion.value
        };

        const response = await fetch(`/api/negocios/${appState.negocioActivoId}/clientes`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(nuevoCliente)
        });

        if (response.ok) {
            form.reset();
            cargarClientes();
        } else {
            alert("Error al crear el cliente.");
        }
    });

    cargarClientes();
}

async function cargarClientes() {
    if (!appState.negocioActivoId) return;
    const response = await fetch(`/api/negocios/${appState.negocioActivoId}/clientes`, { headers: getAuthHeaders() });
    const clientes = await response.json();
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    clientes.forEach(c => {
        const row = document.createElement('tr');
        // Usamos JSON.stringify para pasar los strings de forma segura al onclick
        const nombre = JSON.stringify(c.nombre);
        const documento = JSON.stringify(c.documento || '');
        const telefono = JSON.stringify(c.telefono || '');
        row.innerHTML = `
            <td>${c.nombre}</td>
            <td>${c.documento || '-'}</td>
            <td>${c.telefono || '-'}</td>
            <td>
                <button onclick="editarCliente(${c.id}, ${nombre}, ${documento}, ${telefono})">Editar</button>
                <button onclick="borrarCliente(${c.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ✨ CORRECCIÓN: Añadimos 'export' para que main.js pueda importar la función
export async function borrarCliente(clienteId) {
    if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;
    const response = await fetch(`/api/clientes/${clienteId}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (response.ok) {
        cargarClientes();
    } else {
        alert("Error al eliminar el cliente.");
    }
}

// ✨ CORRECCIÓN: Añadimos 'export' para que main.js pueda importar la función
export async function editarCliente(clienteId, nombreActual, docActual, telActual) {
    const nombre = prompt("Nuevo nombre:", nombreActual);
    if (nombre === null) return;
    const documento = prompt("Nuevo documento:", docActual);
    if (documento === null) return;
    const telefono = prompt("Nuevo teléfono:", telActual);
    if (telefono === null) return;

    const updatedCliente = { nombre, documento, telefono };

    const response = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedCliente)
    });
    if (response.ok) {
        cargarClientes();
    } else {
        alert("Error al actualizar el cliente.");
    }
}