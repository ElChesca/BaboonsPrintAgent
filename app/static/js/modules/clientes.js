// app/static/js/modules/clientes.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let form, tituloForm, idInput, nombreInput, dniInput, telefonoInput, emailInput, direccionInput, btnCancelar, buscador;
let clientesCache = [];

async function cargarClientes() {
    try {
        clientesCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los clientes: ' + error.message, 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;

    const filtro = buscador.value.toLowerCase();
    const clientesFiltrados = clientesCache.filter(c => 
        c.nombre.toLowerCase().includes(filtro) || 
        (c.dni && c.dni.toLowerCase().includes(filtro))
    );

    tbody.innerHTML = '';
    clientesFiltrados.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.nombre}</td>
                <td>${c.dni || '-'}</td>
                <td>${c.telefono || '-'}</td>
                <td>${c.email || '-'}</td>
                <td>
                    <button class="btn-edit btn-small" onclick="editarCliente(${c.id})">Editar</button>
                    <button class="btn-delete btn-small" onclick="borrarCliente(${c.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function resetFormulario() {
    tituloForm.textContent = 'Añadir Nuevo Cliente';
    form.reset();
    idInput.value = '';
    btnCancelar.style.display = 'none';
}

async function guardarCliente(e) {
    e.preventDefault();
    const id = idInput.value;
    const data = {
        nombre: nombreInput.value,
        dni: dniInput.value,
        telefono: telefonoInput.value,
        email: emailInput.value,
        direccion: direccionInput.value
    };

    if (!data.nombre) {
        mostrarNotificacion('El nombre es obligatorio.', 'warning');
        return;
    }

    const esEdicion = !!id;
    const url = esEdicion ? `/api/clientes/${id}` : `/api/negocios/${appState.negocioActivoId}/clientes`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await fetchData(url, { method, body: JSON.stringify(data) });
        mostrarNotificacion(`Cliente ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        resetFormulario();
        cargarClientes();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function editarCliente(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;

    tituloForm.textContent = 'Editar Cliente';
    idInput.value = cliente.id;
    nombreInput.value = cliente.nombre;
    dniInput.value = cliente.dni;
    telefonoInput.value = cliente.telefono;
    emailInput.value = cliente.email;
    direccionInput.value = cliente.direccion;
    btnCancelar.style.display = 'inline-block';
    window.scrollTo(0, 0);
}

export async function borrarCliente(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    try {
        await fetchData(`/api/clientes/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Cliente eliminado con éxito.', 'success');
        cargarClientes();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaClientes() {
    form = document.getElementById('form-cliente');
    if (!form) return;

    tituloForm = document.getElementById('form-cliente-titulo');
    idInput = document.getElementById('cliente-id');
    nombreInput = document.getElementById('cliente-nombre');
    dniInput = document.getElementById('cliente-dni');
    telefonoInput = document.getElementById('cliente-telefono');
    emailInput = document.getElementById('cliente-email');
    direccionInput = document.getElementById('cliente-direccion');
    btnCancelar = document.getElementById('btn-cancelar-edicion-cliente');
    buscador = document.getElementById('buscador-clientes');
    
    form.addEventListener('submit', guardarCliente);
    btnCancelar.addEventListener('click', resetFormulario);
    buscador.addEventListener('keyup', renderizarTabla);

    cargarClientes();
}