// app/static/js/modules/categorias.js
// ✨ ARCHIVO ACTUALIZADO ✨

// ✨ Importamos sendData para ser consistentes con tus otros módulos
import { fetchData, sendData } from '../api.js'; 
import { appState, esAdmin } from '../main.js'; 
import { mostrarNotificacion } from './notifications.js';

let form, tituloForm, idInput, nombreInput, padreInput, btnCancelar;
let categoriasCache = [];

async function cargarCategorias() {
    try {
        categoriasCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`);
        renderizarTabla();
        // ✨ Al editar, no queremos recargar el selector, así que solo lo poblamos al cargar
        if (!idInput.value) {
            poblarSelectorPadre();
        }
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar las categorías: ' + error.message, 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-categorias tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    categoriasCache.forEach(cat => {
        // ✨ Usamos 'nombre_indentado' y 'ruta_categoria' que vienen del API
        tbody.innerHTML += `
            <tr>
                <td title="${cat.ruta_categoria}">
                    ${cat.nombre_indentado}
                </td>
                <td>
                    <button class="btn-edit btn-small" onclick="editarCategoria(${cat.id})">Editar</button>
                    <button class="btn-delete btn-small" onclick="borrarCategoria(${cat.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

// ✨ --- NUEVA FUNCIÓN --- ✨
// Rellena el <select> de "Categoría Padre"
function poblarSelectorPadre(idEdicion = null) {
    if (!padreInput) return;
    
    // Guardamos el valor que tenía para restaurarlo si es posible
    const valorPrevio = padreInput.value;
    padreInput.innerHTML = '<option value="">-- Ninguna (Es una Categoría Principal) --</option>';
    
    categoriasCache.forEach(cat => {
        // ✨ Lógica de seguridad:
        // No puedes ser tu propio padre.
        if (idEdicion !== null && cat.id === idEdicion) {
            return; 
        }
        
        // (Opcional avanzado): Tampoco puedes ser padre de uno de tus hijos.
        // Por ahora, la indentación visual ayuda a prevenir esto.
        
        padreInput.innerHTML += `
            <option value="${cat.id}" title="${cat.ruta_categoria}">
                ${cat.nombre_indentado}
            </option>
        `;
    });

    // Restauramos el valor si sigue existiendo
    padreInput.value = valorPrevio;
}

function resetFormulario() {
    tituloForm.textContent = 'Añadir Nueva Categoría';
    form.reset();
    idInput.value = '';
    padreInput.value = ''; // Limpiamos el select
    btnCancelar.style.display = 'none';
    poblarSelectorPadre(); // Recargamos el selector con todos los items
}

async function guardarCategoria(e) {
    e.preventDefault();
    const id = idInput.value;
    
    // ✨ Obtenemos el valor del nuevo select
    const data = {
        nombre: nombreInput.value,
        categoria_padre_id: padreInput.value || null 
    };
    
    if (!data.nombre) {
        mostrarNotificacion('El nombre es obligatorio.', 'warning');
        return;
    }

    const esEdicion = !!id;
    const url = esEdicion ? `/api/categorias/${id}` : `/api/negocios/${appState.negocioActivoId}/categorias`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        // ✨ Usamos sendData (más consistente con tu módulo de inventario)
        await sendData(url, data, method);
        mostrarNotificacion(`Categoría ${esEdicion ? 'actualizada' : 'creada'} con éxito.`, 'success');
        resetFormulario();
        cargarCategorias(); // Esto recargará la tabla Y el selector
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function editarCategoria(id) { 
    const categoria = categoriasCache.find(c => c.id === id);
    if (!categoria) return;

    tituloForm.textContent = 'Editar Categoría';
    idInput.value = categoria.id;
    nombreInput.value = categoria.nombre;
    
    // ✨ Rellenamos el selector EXCLUYENDO la categoría actual
    poblarSelectorPadre(categoria.id); 
    
    // ✨ Asignamos el padre que tiene guardado
    padreInput.value = categoria.categoria_padre_id || ''; 
    
    btnCancelar.style.display = 'inline-block';
    window.scrollTo(0, 0);
}

export async function borrarCategoria(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) return;
    try {
        // ✨ Usamos sendData
        await sendData(`/api/categorias/${id}`, {}, 'DELETE');
        mostrarNotificacion('Categoría eliminada con éxito.', 'success');
        resetFormulario(); // Por si estaba en modo edición
        cargarCategorias(); // Recargamos tabla y selector
    } catch (error) {
        // El backend ya nos dará el error de "tiene subcategorías"
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaCategorias() {
    form = document.getElementById('form-categoria');
    if (!form) return;

    if (!esAdmin()) {
        const cardForm = form.closest('.card');
        if (cardForm) cardForm.style.display = 'none';
    }

    tituloForm = document.getElementById('form-categoria-titulo');
    idInput = document.getElementById('categoria-id');
    nombreInput = document.getElementById('nombre-categoria');
    btnCancelar = document.getElementById('btn-cancelar-edicion-cat');
    
    // ✨ Capturamos el nuevo select
    padreInput = document.getElementById('categoria-padre');
    
    form.addEventListener('submit', guardarCategoria);
    btnCancelar.addEventListener('click', resetFormulario);

    cargarCategorias();
}