// static/js/modules/noticias.js
// ✨ ARCHIVO NUEVO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let noticiasCache = [];
let modal, form, tituloModal, idInput;

function renderizarNoticias() {
    const listaDiv = document.getElementById('lista-noticias');
    if (!listaDiv) return;

    listaDiv.innerHTML = ''; // Limpiar lista

    if (noticiasCache.length === 0) {
        listaDiv.innerHTML = '<p>No hay comunicados para mostrar.</p>';
        return;
    }

    noticiasCache.forEach(n => {
        const fecha = new Date(n.fecha_creacion).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        
        // Acciones solo para admin
        const accionesAdmin = esAdmin() ? `
            <div class="noticia-card-footer">
                <button class="btn-secondary btn-sm" onclick="window.abrirModalNoticia(${n.id})">Editar</button>
                <button class="btn-danger btn-sm" onclick="window.borrarNoticia(${n.id})">Borrar</button>
            </div>
        ` : '';

        // Icono de "Fijado"
        const iconoFijado = n.es_fijado ? '<span class="pin-icon">📌 FIJADO</span>' : '';
        const claseFijado = n.es_fijado ? 'fijado' : '';

        listaDiv.innerHTML += `
            <div class="noticia-card ${claseFijado}">
                <div class="noticia-card-header">
                    <h3>${n.titulo}</h3>
                    <div class="noticia-card-meta">
                        Publicado por <strong>${n.creador_nombre}</strong>
                        <br>
                        ${fecha}
                        ${iconoFijado}
                    </div>
                </div>
                <div class="noticia-card-body">
                    <p>${n.cuerpo}</p>
                </div>
                ${accionesAdmin}
            </div>
        `;
    });
}

async function cargarNoticias() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/noticias`;
        noticiasCache = await fetchData(url);
        renderizarNoticias();
    } catch (error) {
        mostrarNotificacion('Error al cargar los comunicados.', 'error');
    }
}

export function abrirModalNoticia(id = null) {
    form.reset();
    if (id) {
        // Modo Edición
        const noticia = noticiasCache.find(n => n.id === id);
        if (!noticia) return;
        
        tituloModal.textContent = 'Editar Comunicado';
        idInput.value = noticia.id;
        document.getElementById('noticia-titulo').value = noticia.titulo;
        document.getElementById('noticia-cuerpo').value = noticia.cuerpo;
        document.getElementById('noticia-fijado').checked = noticia.es_fijado;
    } else {
        // Modo Creación
        tituloModal.textContent = 'Nuevo Comunicado';
        idInput.value = '';
    }
    modal.style.display = 'flex';
}

async function guardarNoticia(e) {
    e.preventDefault();
    const id = idInput.value;
    const esEdicion = !!id;
    
    const data = {
        titulo: document.getElementById('noticia-titulo').value,
        cuerpo: document.getElementById('noticia-cuerpo').value,
        es_fijado: document.getElementById('noticia-fijado').checked
    };

    if (!data.titulo || !data.cuerpo) {
        mostrarNotificacion('El título y el cuerpo son obligatorios.', 'warning');
        return;
    }

    const url = esEdicion 
        ? `/api/consorcio/noticias/${id}` 
        : `/api/consorcio/${appState.negocioActivoId}/noticias`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Comunicado ${esEdicion ? 'actualizado' : 'publicado'} con éxito.`, 'success');
        modal.style.display = 'none';
        await cargarNoticias(); // Recargar la lista
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function borrarNoticia(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este comunicado?')) return;
    
    try {
        await sendData(`/api/consorcio/noticias/${id}`, {}, 'DELETE');
        mostrarNotificacion('Comunicado eliminado.', 'success');
        await cargarNoticias(); // Recargar la lista
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---
export async function inicializarLogicaNoticias() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Espera a que el DOM esté listo
    
    modal = document.getElementById('modal-noticia');
    form = document.getElementById('form-noticia');
    tituloModal = document.getElementById('modal-noticia-titulo');
    idInput = document.getElementById('noticia-id');

    if (!modal || !form) {
        console.error('No se encontraron los elementos del DOM para Noticias.');
        return;
    }

    // Cargar datos
    cargarNoticias();
    
    // Listeners (solo para admin)
    if (esAdmin()) {
        document.getElementById('btn-abrir-modal-noticia').addEventListener('click', () => abrirModalNoticia());
        document.getElementById('close-modal-noticia').addEventListener('click', () => modal.style.display = 'none');
        form.addEventListener('submit', guardarNoticia);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
}