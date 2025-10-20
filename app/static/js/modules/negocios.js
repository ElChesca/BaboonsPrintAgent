// static/js/modules/negocios.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let negociosCache = [];

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-negocios tbody');
    tbody.innerHTML = '';
    negociosCache.forEach(n => {
        tbody.innerHTML += `
            <tr>
                <td>${n.id}</td>
                <td>${n.nombre}</td>
                <td>${n.direccion || '-'}</td>
                <td class="acciones">
                    <button class="btn-secondary" onclick="window.editarNegocio(${n.id})">Editar</button>
                </td>
            </tr>
        `;
    });
}

async function cargarNegocios() {
    try {
        // Usamos la ruta correcta, que ya filtra por usuario si es necesario
        negociosCache = await fetchData('/api/negocios');
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los negocios.', 'error');
    }
}

function resetFormulario() {
    document.getElementById('form-negocio-titulo').textContent = 'Añadir Nuevo Negocio';
    document.getElementById('form-negocio').reset();
    document.getElementById('negocio-id').value = '';
    document.getElementById('btn-cancelar-edicion-negocio').style.display = 'none';
}

window.editarNegocio = (id) => {
    const negocio = negociosCache.find(n => n.id === id);
    if (!negocio) return;

    document.getElementById('form-negocio-titulo').textContent = 'Editar Negocio';
    document.getElementById('negocio-id').value = negocio.id;
    document.getElementById('nombre-negocio').value = negocio.nombre;
    document.getElementById('direccion-negocio').value = negocio.direccion;
    document.getElementById('btn-cancelar-edicion-negocio').style.display = 'inline-block';
    window.scrollTo(0, 0);
};

async function guardarNegocio(e) {
    e.preventDefault();
    const id = document.getElementById('negocio-id').value;
    const data = {
        nombre: document.getElementById('nombre-negocio').value,
        direccion: document.getElementById('direccion-negocio').value,
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/negocios/${id}` : '/api/negocios';
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message || `Negocio ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        resetFormulario();
        await cargarNegocios();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaNegocios() {
    const form = document.getElementById('form-negocio');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');

    if (!form) return;

    form.addEventListener('submit', guardarNegocio);
    btnCancelar.addEventListener('click', resetFormulario);

    cargarNegocios();
}