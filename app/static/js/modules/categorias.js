// app/static/js/modules/categorias.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';



let categoriasCache = [];

async function cargarCategorias() {
    try {
        // La URL debe incluir el negocio activo
        categoriasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar las categorías.', 'error');
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
                    <button class="btn-edit btn-small">Editar</button>
                    <button class="btn-delete btn-small">Borrar</button>
                </td>
            </tr>
        `;
    });
}

export function inicializarLogicaCategorias() {
    const form = document.getElementById('form-categoria');
    if (!form) return;

    cargarCategorias();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre-categoria').value;
        if (!nombre) {
            mostrarNotificacion('El nombre de la categoría es obligatorio.', 'warning');
            return;
        }

        try {
            // ✨ CORRECCIÓN: Usamos la URL correcta que incluye el negocio activo
            await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`, {
                method: 'POST',
                body: JSON.stringify({ nombre })
            });
            mostrarNotificacion('Categoría creada con éxito.', 'success');
            form.reset();
            cargarCategorias(); // Recargar la lista
        } catch (error) {
            mostrarNotificacion('Error al crear la categoría: ' + error.message, 'error');
        }
    });
}