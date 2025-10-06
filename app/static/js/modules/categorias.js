// app/static/js/modules/categorias.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let categoriasCache = [];

async function cargarCategorias() {
    try {
        categoriasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar las categorías: ' + error.message, 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-categorias tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    categoriasCache.forEach(cat => {
        tbody.innerHTML += `
            <tr>
                <td>${cat.nombre}</td>
                <td>
                    <button class="btn-edit btn-small" onclick="editarCategoria(${cat.id}, '${cat.nombre}')">Editar</button>
                    <button class="btn-delete btn-small" onclick="borrarCategoria(${cat.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

// ✨ FUNCIÓN AÑADIDA
export function editarCategoria(id, nombreActual) {
    const nuevoNombre = prompt("Editar nombre de la categoría:", nombreActual);
    if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== nombreActual) {
        fetchData(`/api/categorias/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre: nuevoNombre })
        }).then(() => {
            mostrarNotificacion('Categoría actualizada.', 'success');
            cargarCategorias();
        }).catch(err => mostrarNotificacion(err.message, 'error'));
    }
}

// ✨ FUNCIÓN AÑADIDA
export async function borrarCategoria(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) return;
    try {
        await fetchData(`/api/categorias/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Categoría eliminada con éxito.', 'success');
        cargarCategorias();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaCategorias() {
    const form = document.getElementById('form-categoria');
    if (!form) return;

    cargarCategorias();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre-categoria').value;
        if (!nombre) {
            mostrarNotificacion('El nombre es obligatorio.', 'warning');
            return;
        }
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`, {
                method: 'POST',
                body: JSON.stringify({ nombre })
            });
            mostrarNotificacion('Categoría creada.', 'success');
            form.reset();
            cargarCategorias();
        } catch (error) {
            mostrarNotificacion('Error al crear: ' + error.message, 'error');
        }
    });
}