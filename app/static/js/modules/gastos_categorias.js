// static/js/modules/gastos_categorias.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js'; // ✨ 1. Importamos el estado global

// 2. Eliminamos la función getActiveNegocioId()

function renderizarTablaCategorias() {
    const tbody = document.querySelector('#tabla-categorias-gasto tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    categoriasCache.forEach(cat => {
        tbody.innerHTML += `
            <tr>
                <td>${cat.id}</td>
                <td>${cat.descripcion}</td>
                <td><span class="badge ${cat.estado === 'Activa' ? 'badge-success' : 'badge-danger'}">${cat.estado}</span></td>
                <td class="acciones">
                    <button class="btn-secondary" onclick="window.editarCategoriaGasto(${cat.id})">Editar</button>
                </td>
            </tr>
        `;
    });
}

async function cargarCategorias() {
    // ✨ 3. Usamos appState directamente
    if (!appState.negocioActivoId) {
        mostrarNotificacion('No hay un negocio seleccionado.', 'error');
        return;
    }
    
    try {
        // ✨ 4. Usamos la nueva ruta anidada
        categoriasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias_gasto`);
        renderizarTablaCategorias();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar las categorías.', 'error');
    }
}

function resetFormularioCategorias() {
    document.getElementById('form-categoria-titulo').textContent = 'Añadir Nueva Categoría';
    document.getElementById('form-categoria-gasto').reset();
    document.getElementById('categoria-gasto-id').value = '';
    document.getElementById('btn-cancelar-edicion-categoria').style.display = 'none';
}

window.editarCategoriaGasto = (id) => {
    const cat = categoriasCache.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('form-categoria-titulo').textContent = 'Editar Categoría';
    document.getElementById('categoria-gasto-id').value = cat.id;
    document.getElementById('descripcion-categoria').value = cat.descripcion;
    document.getElementById('estado-categoria').value = cat.estado;
    document.getElementById('btn-cancelar-edicion-categoria').style.display = 'inline-block';
    window.scrollTo(0, 0);
};

async function guardarCategoria(e) {
    e.preventDefault();
    const id = document.getElementById('categoria-gasto-id').value;
    
    const data = {
        descripcion: document.getElementById('descripcion-categoria').value,
        estado: document.getElementById('estado-categoria').value
        // ✨ 5. Ya no enviamos negocio_id en el body, va en la URL
    };

    const esEdicion = !!id;
    // ✨ 6. Las URLs ahora se construyen con appState.negocioActivoId
    const url = esEdicion 
        ? `/api/negocios/${appState.negocioActivoId}/categorias_gasto/${id}` 
        : `/api/negocios/${appState.negocioActivoId}/categorias_gasto`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message || `Categoría ${esEdicion ? 'actualizada' : 'creada'} con éxito.`, 'success');
        resetFormularioCategorias();
        await cargarCategorias();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarCategoriasGasto() {
    const form = document.getElementById('form-categoria-gasto');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-categoria');

    if (!form) return; 

    form.addEventListener('submit', guardarCategoria);
    btnCancelar.addEventListener('click', resetFormularioCategorias);

    cargarCategorias();
}