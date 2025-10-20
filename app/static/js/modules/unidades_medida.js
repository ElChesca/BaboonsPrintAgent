import { fetchData, sendData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let unidadesCache = [];

// --- Funciones Principales ---

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-unidades tbody');
    tbody.innerHTML = '';
    unidadesCache.forEach(u => {
        tbody.innerHTML += `
            <tr data-id="${u.id}">
                <td>${u.nombre}</td>
                <td>${u.abreviatura}</td>
                <td class="acciones">
                    <button class="btn-secondary btn-sm" onclick="window.editarUnidad(${u.id})">Editar</button>
                    <button class="btn-danger btn-sm" onclick="window.borrarUnidad(${u.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

async function cargarUnidades() {
    try {
        if (!appState.negocioActivoId) return;
        unidadesCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/unidades_medida`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar las unidades de medida.', 'error');
    }
}

function resetFormulario() {
    document.getElementById('form-unidad-titulo').textContent = 'Añadir Nueva Unidad';
    document.getElementById('form-unidad').reset();
    document.getElementById('unidad-id').value = '';
    document.getElementById('btn-cancelar-edicion').style.display = 'none';
}

async function guardarUnidad(e) {
    e.preventDefault();
    const id = document.getElementById('unidad-id').value;
    const data = {
        nombre: document.getElementById('unidad-nombre').value,
        abreviatura: document.getElementById('unidad-abreviatura').value,
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/unidades_medida/${id}` : `/api/negocios/${appState.negocioActivoId}/unidades_medida`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message, 'success');
        resetFormulario();
        await cargarUnidades();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Funciones Globales para onclick ---

window.editarUnidad = (id) => {
    const unidad = unidadesCache.find(u => u.id === id);
    if (!unidad) return;

    document.getElementById('form-unidad-titulo').textContent = 'Editar Unidad';
    document.getElementById('unidad-id').value = unidad.id;
    document.getElementById('unidad-nombre').value = unidad.nombre;
    document.getElementById('unidad-abreviatura').value = unidad.abreviatura;
    document.getElementById('btn-cancelar-edicion').style.display = 'inline-block';
    window.scrollTo(0, 0);
};

window.borrarUnidad = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta unidad de medida?')) return;
    try {
        const response = await sendData(`/api/unidades_medida/${id}`, {}, 'DELETE');
        mostrarNotificacion(response.message, 'success');
        await cargarUnidades();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};

// --- Función de Inicialización ---

export function inicializarLogicaUnidadesMedida() {
    const form = document.getElementById('form-unidad');
    const btnCancelar = document.getElementById('btn-cancelar-edicion');

    if (!form) return;

    form.addEventListener('submit', guardarUnidad);
    btnCancelar.addEventListener('click', resetFormulario);

    cargarUnidades();
}