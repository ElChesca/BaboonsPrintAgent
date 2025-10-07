// app/static/js/modules/categorias.js
import { fetchData } from '../api.js';
import { appState, esAdmin } from '../main.js'; 
import { mostrarNotificacion } from './notifications.js';

let form, tituloForm, idInput, nombreInput, btnCancelar;
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
        // Usamos JSON.stringify para pasar el nombre de forma segura si contiene comillas
        const nombreSeguro = JSON.stringify(cat.nombre);
        tbody.innerHTML += `
            <tr>
                <td>${cat.nombre}</td>
                <td>
                    <button class="btn-edit btn-small" onclick="editarCategoria(${cat.id}, ${nombreSeguro})">Editar</button>
                    <button class="btn-delete btn-small" onclick="borrarCategoria(${cat.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function resetFormulario() {
    tituloForm.textContent = 'Añadir Nueva Categoría';
    form.reset();
    idInput.value = '';
    btnCancelar.style.display = 'none';
}

async function guardarCategoria(e) {
    e.preventDefault();
    const id = idInput.value;
    const data = {
        nombre: nombreInput.value
    };
    if (!data.nombre) {
        mostrarNotificacion('El nombre es obligatorio.', 'warning');
        return;
    }

    const esEdicion = !!id;
    const url = esEdicion ? `/api/categorias/${id}` : `/api/negocios/${appState.negocioActivoId}/categorias`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await fetchData(url, { method, body: JSON.stringify(data) });
        mostrarNotificacion(`Categoría ${esEdicion ? 'actualizada' : 'creada'} con éxito.`, 'success');
        resetFormulario();
        cargarCategorias();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function editarCategoria(id, nombreActual) {
    const categoria = categoriasCache.find(c => c.id === id);
    if (!categoria) return;

    tituloForm.textContent = 'Editar Categoría';
    idInput.value = categoria.id;
    nombreInput.value = categoria.nombre;
    btnCancelar.style.display = 'inline-block';
    window.scrollTo(0, 0);
}

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
    form = document.getElementById('form-categoria');
    if (!form) return;

    // ✨ Ocultamos el formulario si no es admin
    if (!esAdmin()) {
        const cardForm = form.closest('.card');
        if (cardForm) cardForm.style.display = 'none';
    }

    tituloForm = document.getElementById('form-categoria-titulo');
    idInput = document.getElementById('categoria-id');
    nombreInput = document.getElementById('nombre-categoria');
    btnCancelar = document.getElementById('btn-cancelar-edicion-cat');
    
    form.addEventListener('submit', guardarCategoria);
    btnCancelar.addEventListener('click', resetFormulario);

    cargarCategorias();
}