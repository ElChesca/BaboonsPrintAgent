// app/static/js/modules/categorias.js
import { getAuthHeaders } from './auth.js';

export function inicializarLogicaCategorias() {
    const form = document.getElementById('form-add-categoria');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('categoria-nombre').value;
            if (!nombre) return;
            
            const response = await fetch('/api/categorias', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ nombre })
            });

            if (response.ok) {
                form.reset();
                cargarCategorias();
            } else {
                alert('Error al crear la categoría.');
            }
        });
    }
    cargarCategorias();
}

async function cargarCategorias() {
    const response = await fetch('/api/categorias', { headers: getAuthHeaders() });
    const categorias = await response.json();
    const ul = document.getElementById('lista-categorias');
    if (!ul) return;
    ul.innerHTML = '';
    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${cat.nombre}</span>
            <div>
                <button onclick="editarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')">Editar</button>
                <button onclick="borrarCategoria(${cat.id})">Borrar</button>
            </div>
        `;
        ul.appendChild(li);
    });
}

export async function editarCategoria(id, nombreActual) {
    const nuevoNombre = prompt("Nuevo nombre para la categoría:", nombreActual);
    if (!nuevoNombre || nuevoNombre === nombreActual) return;

    const response = await fetch(`/api/categorias/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nombre: nuevoNombre })
    });
    if (response.ok) {
        cargarCategorias();
    } else {
        alert("Error al actualizar la categoría.");
    }
}

export async function borrarCategoria(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta categoría?")) return;

    const response = await fetch(`/api/categorias/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (response.ok) {
        cargarCategorias();
    } else {
        alert("Error al eliminar la categoría.");
    }
}