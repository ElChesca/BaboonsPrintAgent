// static/js/modules/noticias.js
// ✨ ARCHIVO ACTUALIZADO (CON LÓGICA FormData) ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js'; // <-- ✨ LÍNEA AÑADIDA (la correcta)
// ...

let noticiasCache = [];
let modal, form, tituloModal, idInput;

function renderizarNoticias() {
    const listaDiv = document.getElementById('lista-noticias');
    if (!listaDiv) return;
    listaDiv.innerHTML = ''; 

    if (noticiasCache.length === 0) {
        listaDiv.innerHTML = '<p>No hay comunicados para mostrar.</p>';
        return;
    }

    noticiasCache.forEach(n => {
        const fecha = new Date(n.fecha_creacion).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        
        const accionesAdmin = esAdmin() ? `
            <div class="noticia-card-footer">
                <button class="btn-secondary btn-sm" onclick="window.abrirModalNoticia(${n.id})">Editar</button>
                <button class="btn-danger btn-sm" onclick="window.borrarNoticia(${n.id})">Borrar</button>
            </div>
        ` : '';

        const iconoFijado = n.es_fijado ? '<span class="pin-icon">📌 FIJADO</span>' : '';
        const claseFijado = n.es_fijado ? 'fijado' : '';

        // ✨ NUEVO: Mostrar el enlace al archivo adjunto
        const bloqueAdjunto = n.archivo_url ? `
            <div class="noticia-adjunto">
                <strong>Adjunto:</strong> 
                <a href="${n.archivo_url}" target="_blank" download="${n.archivo_nombre || 'descarga'}">
                    ${n.archivo_nombre || 'Ver Archivo'}
                </a>
            </div>
        ` : '';

        listaDiv.innerHTML += `
            <div class="noticia-card ${claseFijado}">
                <div class="noticia-card-header">
                    <h3>${n.titulo}</h3>
                    <div class="noticia-card-meta">
                        Publicado por <strong>${n.creador_nombre}</strong><br>
                        ${fecha} ${iconoFijado}
                    </div>
                </div>
                <div class="noticia-card-body">
                    <p>${n.cuerpo}</p>
                    ${bloqueAdjunto} 
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
    const infoArchivo = document.getElementById('archivo-actual-info');
    infoArchivo.style.display = 'none'; // Ocultar por defecto
    
    if (id) {
        const noticia = noticiasCache.find(n => n.id === id);
        if (!noticia) return;
        
        tituloModal.textContent = 'Editar Comunicado';
        idInput.value = noticia.id;
        document.getElementById('noticia-titulo').value = noticia.titulo;
        document.getElementById('noticia-cuerpo').value = noticia.cuerpo;
        document.getElementById('noticia-fijado').checked = noticia.es_fijado;
        
        // ✨ NUEVO: Mostrar info del archivo actual
        if (noticia.archivo_url) {
            document.getElementById('archivo-actual-link').href = noticia.archivo_url;
            document.getElementById('archivo-actual-link').textContent = noticia.archivo_nombre;
            document.getElementById('noticia-eliminar-archivo').checked = false;
            infoArchivo.style.display = 'block';
        }
    } else {
        tituloModal.textContent = 'Nuevo Comunicado';
        idInput.value = '';
    }
    modal.style.display = 'flex';
}

// ✨ FUNCIÓN 'guardarNoticia' (TOTALMENTE REESCRITA)
async function guardarNoticia(e) {
    e.preventDefault();
    const id = idInput.value;
    const esEdicion = !!id;

    // 1. Crear FormData
    const formData = new FormData();
    formData.append('titulo', document.getElementById('noticia-titulo').value);
    formData.append('cuerpo', document.getElementById('noticia-cuerpo').value);
    formData.append('es_fijado', document.getElementById('noticia-fijado').checked);

    // 2. Añadir el archivo si existe
    const archivoInput = document.getElementById('noticia-archivo');
    if (archivoInput.files[0]) {
        formData.append('archivo', archivoInput.files[0]);
    }
    
    // 3. Chequear si se quiere eliminar el archivo existente (en modo edición)
    if (esEdicion) {
        formData.append('eliminar_archivo', document.getElementById('noticia-eliminar-archivo').checked);
    }

    // 4. Definir URL y Método
    // (Usamos POST para ambas, ya que PUT con FormData es problemático)
    const url = esEdicion 
        ? `/api/consorcio/noticias/${id}` 
        : `/api/consorcio/${appState.negocioActivoId}/noticias`;
    const method = 'POST';

    // 5. Enviar con Fetch (no podemos usar sendData)
    try {
        const headers = getAuthHeaders();
        // Quitamos Content-Type para que el navegador lo ponga
        delete headers['Content-Type']; 

        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status}`);
        }

        mostrarNotificacion(`Comunicado ${esEdicion ? 'actualizado' : 'publicado'} con éxito.`, 'success');
        modal.style.display = 'none';
        await cargarNoticias(); // Recargar la lista
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function borrarNoticia(id) {
    if (!confirm('¿Estás seguro...')) return;
    try {
        await sendData(`/api/consorcio/noticias/${id}`, {}, 'DELETE');
        mostrarNotificacion('Comunicado eliminado.', 'success');
        await cargarNoticias();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---
export async function inicializarLogicaNoticias() {
    await new Promise(resolve => setTimeout(resolve, 0)); 
    
    modal = document.getElementById('modal-noticia');
    form = document.getElementById('form-noticia');
    tituloModal = document.getElementById('modal-noticia-titulo');
    idInput = document.getElementById('noticia-id');

    if (!modal || !form) {
        console.error('No se encontraron los elementos del DOM para Noticias.');
        return;
    }

    cargarNoticias();
    
    if (esAdmin()) {
        document.getElementById('btn-abrir-modal-noticia').addEventListener('click', () => abrirModalNoticia());
        document.getElementById('close-modal-noticia').addEventListener('click', () => modal.style.display = 'none');
        form.addEventListener('submit', guardarNoticia);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
}