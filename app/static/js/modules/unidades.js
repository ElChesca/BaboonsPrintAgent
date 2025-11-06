// static/js/modules/unidades.js
// ✨ ARCHIVO NUEVO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Almacenes de caché ---
let unidadesCache = [];
let usuariosCache = [];

// --- Elementos del DOM ---
let modal, form, tituloModal, idInput;
let selectsPopulating = false; // Flag para evitar doble carga

// --- Funciones de Renderizado ---

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-unidades tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (unidadesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No se encontraron unidades para este consorcio.</td></tr>';
        return;
    }
    
    unidadesCache.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${u.nombre_unidad}</strong></td>
                <td>${u.piso || '-'}</td>
                <td>${u.inquilino_nombre || 'Sin asignar'}</td>
                <td>${u.propietario_nombre || 'Sin asignar'}</td>
                <td>${u.metros_cuadrados || '-'}</td>
                <td>${u.coeficiente ? (u.coeficiente * 100).toFixed(2) + '%' : '-'}</td>
                <td class="admin-only acciones">
                    <button class="btn-secondary btn-sm" onclick="window.abrirModalUnidad(${u.id})">Editar</button>
                    <button class="btn-danger btn-sm" onclick="window.borrarUnidad(${u.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

// Carga la lista de TODOS los usuarios del sistema para los <select>
async function poblarSelectoresUsuarios() {
    if (selectsPopulating) return; // Evitar cargas múltiples
    selectsPopulating = true;
    
    try {
        usuariosCache = await fetchData('/api/usuarios');
        const selects = [document.getElementById('unidad-inquilino'), document.getElementById('unidad-propietario')];
        
        selects.forEach(select => {
            if (!select) return;
            // Limpiamos guardando la primera opción
            const primeraOpcion = select.options[0];
            select.innerHTML = '';
            select.appendChild(primeraOpcion);
            
            // Llenamos con los usuarios
            usuariosCache.forEach(user => {
                select.innerHTML += `<option value="${user.id}">${user.nombre} (${user.email})</option>`;
            });
        });
    } catch (error) {
        mostrarNotificacion('No se pudo cargar la lista de usuarios.', 'error');
    } finally {
        selectsPopulating = false;
    }
}

// --- Funciones de Carga de Datos ---

async function cargarUnidades() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/unidades`;
        unidadesCache = await fetchData(url);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
        const tbody = document.querySelector('#tabla-unidades tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7">Error al cargar unidades.</td></tr>`;
    }
}

// --- Lógica del Modal (CRUD) ---

export function abrirModalUnidad(id = null) {
    form.reset();
    
    if (id) {
        // --- Modo Edición ---
        const unidad = unidadesCache.find(u => u.id === id);
        if (!unidad) {
            mostrarNotificacion('Error: No se encontró la unidad.', 'error');
            return;
        }
        tituloModal.textContent = 'Editar Unidad';
        idInput.value = unidad.id;
        document.getElementById('unidad-nombre').value = unidad.nombre_unidad;
        document.getElementById('unidad-piso').value = unidad.piso || '';
        document.getElementById('unidad-metros').value = unidad.metros_cuadrados || '';
        document.getElementById('unidad-coeficiente').value = unidad.coeficiente || '';
        document.getElementById('unidad-inquilino').value = unidad.inquilino_id || '';
        document.getElementById('unidad-propietario').value = unidad.propietario_id || '';
        document.getElementById('unidad-descripcion').value = unidad.descripcion || '';
    } else {
        // --- Modo Creación ---
        tituloModal.textContent = 'Añadir Nueva Unidad';
        idInput.value = '';
    }
    
    modal.style.display = 'flex';
}

async function guardarUnidad(e) {
    e.preventDefault();
    const id = idInput.value;
    const esEdicion = !!id;
    
    const data = {
        nombre_unidad: document.getElementById('unidad-nombre').value,
        piso: document.getElementById('unidad-piso').value || null,
        metros_cuadrados: parseFloat(document.getElementById('unidad-metros').value) || null,
        coeficiente: parseFloat(document.getElementById('unidad-coeficiente').value) || null,
        inquilino_id: parseInt(document.getElementById('unidad-inquilino').value) || null,
        propietario_id: parseInt(document.getElementById('unidad-propietario').value) || null,
        descripcion: document.getElementById('unidad-descripcion').value || null
    };

    if (!data.nombre_unidad) {
        mostrarNotificacion('El nombre de la unidad es obligatorio.', 'warning');
        return;
    }

    const url = esEdicion 
        ? `/api/consorcio/unidades/${id}` 
        : `/api/consorcio/${appState.negocioActivoId}/unidades`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Unidad ${esEdicion ? 'actualizada' : 'creada'} con éxito.`, 'success');
        modal.style.display = 'none';
        await cargarUnidades(); // Recargar la tabla
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function borrarUnidad(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta unidad?')) return;
    
    try {
        await sendData(`/api/consorcio/unidades/${id}`, {}, 'DELETE');
        mostrarNotificacion('Unidad eliminada con éxito.', 'success');
        await cargarUnidades(); // Recargar la tabla
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---

export function inicializarLogicaUnidades() {
    modal = document.getElementById('modal-unidad');
    form = document.getElementById('form-unidad');
    tituloModal = document.getElementById('modal-unidad-titulo');
    idInput = document.getElementById('unidad-id');
    
    if (!modal || !form) {
        console.error('No se encontraron los elementos del DOM para Unidades.');
        return;
    }

    // Cargar datos
    cargarUnidades();
    
    // Solo los admins pueden poblar los selects de usuarios y abrir el modal
    if (esAdmin()) {
        poblarSelectoresUsuarios();
        
        document.getElementById('btn-abrir-modal-unidad').addEventListener('click', () => abrirModalUnidad());
        document.getElementById('close-modal-unidad').addEventListener('click', () => modal.style.display = 'none');
        form.addEventListener('submit', guardarUnidad);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
}