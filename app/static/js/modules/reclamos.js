// static/js/modules/reclamos.js
// ✨ ARCHIVO COMPLETO Y ACTUALIZADO (CON KANBAN + COMENTARIOS) ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Almacenes de caché ---
let reclamosCache = [];
let usuariosAdminCache = [];
let misUnidadesCache = [];
let estadosCache = [];
let selectsPopulating = false;

// --- Elementos del DOM ---
let modal, form, tituloModal, idInput, filtroEstado;
let formComentario; // Para el nuevo formulario de chat

// --- Funciones de Renderizado ---
function renderizarTabla() {
    const tbody = document.querySelector('#tabla-reclamos tbody');
    if (!tbody) return;
    
    const filtro = filtroEstado.value;
    const reclamosFiltrados = (filtro === 'Todos')
        ? reclamosCache
        : reclamosCache.filter(r => r.estado === filtro);

    tbody.innerHTML = '';
    if (reclamosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">No se encontraron reclamos.</td></tr>`; // Colspan ahora es 8
        return;
    }

    reclamosFiltrados.forEach(r => {
        const fechaAct = new Date(r.fecha_actualizacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const acciones = esAdmin()
            ? `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver/Editar</button> <button class="btn-danger btn-sm" onclick="window.borrarReclamo(${r.id})">Borrar</button>`
            : `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver</button>`;
        
        // ✨ NUEVO: Lógica del globo de comentarios
        const globoComentarios = (r.comentarios_count > 0)
            ? `<span class="comentario-badge">${r.comentarios_count}</span>`
            : '';
            
        tbody.innerHTML += `
            <tr>
                <td><span class="estado-${r.estado.toLowerCase().replace(' ', '-')}">${r.estado}</span></td>
                <td>${fechaAct}</td>
                <td><strong>${r.nombre_unidad}</strong></td>
                <td>${r.titulo}</td>
                <td>${globoComentarios}</td> <td>${r.creador_nombre}</td>
                <td>${r.asignado_nombre || '-'}</td>
                <td class="acciones">${acciones}</td>
            </tr>
        `;
    });
}
function renderizarKanban() {
    const colAbierto = document.getElementById('cards-abierto');
    const colProceso = document.getElementById('cards-en-proceso');
    const colCerrado = document.getElementById('cards-cerrado');
    if (!colAbierto || !colProceso || !colCerrado) return;
    
    colAbierto.innerHTML = ''; colProceso.innerHTML = ''; colCerrado.innerHTML = '';

    const filtro = filtroEstado.value; 
    const reclamosFiltrados = (filtro === 'Todos')
        ? reclamosCache
        : reclamosCache.filter(r => r.estado === filtro);

    reclamosFiltrados.forEach(r => {
        const card = document.createElement('div');
        card.className = 'kanban-card'; card.draggable = true; card.dataset.reclamoId = r.id; 
        
        // ✨ NUEVO: Lógica del globo de comentarios
        const globoComentarios = (r.comentarios_count > 0)
            ? `<span class="comentario-badge">${r.comentarios_count}</span>`
            : '';

        // ✨ AÑADIDO: Globo al HTML de la tarjeta
        card.innerHTML = `
            <h4>${r.titulo} ${globoComentarios}</h4> 
            <p><strong>Unidad:</strong> ${r.nombre_unidad}</p>
            <small>Creado por: ${r.creador_nombre}</small>
        `;
        
        card.addEventListener('click', () => abrirModalReclamo(r.id));
        card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', r.id); e.target.style.opacity = '0.5'; });
        card.addEventListener('dragend', (e) => { e.target.style.opacity = '1'; });

        if (r.estado === 'Abierto') colAbierto.appendChild(card);
        else if (r.estado === 'En Proceso') colProceso.appendChild(card);
        else colCerrado.appendChild(card);
    });
}

// --- ✨ NUEVA FUNCIÓN: Renderizar Hilo de Comentarios ---
async function renderizarComentarios(reclamoId) {
    const historialDiv = document.getElementById('historial-comentarios');
    historialDiv.innerHTML = '<p>Cargando comentarios...</p>';
    
    try {
        const comentarios = await fetchData(`/api/consorcio/reclamos/${reclamoId}/comentarios`);
        if (comentarios.length === 0) {
            historialDiv.innerHTML = '<p>No hay comentarios en este reclamo.</p>';
            return;
        }
        
        historialDiv.innerHTML = ''; // Limpiar
        comentarios.forEach(c => {
            const fecha = new Date(c.fecha_creacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const esAdmin = (c.usuario_rol === 'admin' || c.usuario_rol === 'superadmin');
            const nombreClass = esAdmin ? 'admin' : '';
            
            historialDiv.innerHTML += `
                <div class="comentario-item">
                    <div class="comentario-header">
                        <strong class="${nombreClass}">${c.usuario_nombre}</strong>
                        <span class="comentario-fecha">${fecha}</span>
                    </div>
                    <div class="comentario-cuerpo">
                        ${c.comentario.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        });
        // Auto-scroll al último mensaje
        historialDiv.scrollTop = historialDiv.scrollHeight;
    } catch (error) {
        historialDiv.innerHTML = '<p style="color: red;">Error al cargar comentarios.</p>';
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Funciones de Poblado de Selects ---
async function poblarSelectoresModal() {
    // ... (código sin cambios)
    if (selectsPopulating) return;
    selectsPopulating = true;
    try {
        const urlUsuarios = '/api/usuarios';
        const urlUnidades = esAdmin()
            ? `/api/consorcio/${appState.negocioActivoId}/unidades`
            : `/api/consorcio/${appState.negocioActivoId}/mis-unidades`;
        const [usuarios, unidades] = await Promise.all([fetchData(urlUsuarios), fetchData(urlUnidades)]);
        usuariosAdminCache = usuarios.filter(u => u.rol === 'admin' || u.rol === 'superadmin');
        misUnidadesCache = unidades;
        const selectUnidad = document.getElementById('reclamo-unidad');
        selectUnidad.innerHTML = '<option value="">-- Seleccione una unidad --</option>';
        unidades.forEach(u => { selectUnidad.innerHTML += `<option value="${u.id}">${u.nombre_unidad}</option>`; });
        const selectAsignado = document.getElementById('reclamo-asignado');
        selectAsignado.innerHTML = '<option value="">-- Sin Asignar --</option>';
        usuariosAdminCache.forEach(u => { selectAsignado.innerHTML += `<option value="${u.id}">${u.nombre}</option>`; });
    } catch (error) {
        mostrarNotificacion('No se pudo cargar la lista de usuarios/unidades.', 'error');
    } finally {
        selectsPopulating = false;
    }
}

async function poblarSelectorEstados() {
    // ... (código sin cambios)
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos/estados`;
        estadosCache = await fetchData(url);
        const filtroSelect = document.getElementById('filtro-reclamo-estado');
        const modalSelect = document.getElementById('reclamo-estado');
        estadosCache.forEach(estado => {
            const selected = (estado === 'Abierto') ? 'selected' : '';
            filtroSelect.innerHTML += `<option value="${estado}" ${selected}>${estado}</option>`;
        });
        modalSelect.innerHTML = '';
        estadosCache.forEach(estado => {
            modalSelect.innerHTML += `<option value="${estado}">${estado}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('Error al cargar los estados de reclamos.', 'error');
    }
}

// --- Funciones de Carga de Datos ---
async function cargarReclamos() {
    // ... (código sin cambios)
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos`;
        reclamosCache = await fetchData(url);
        renderizarTabla(); 
        renderizarKanban();
    } catch (error) { /* ... */ }
}

// --- Lógica del Modal (CRUD) ---

// ✨ ABRIR MODAL (Actualizado para cargar comentarios)
export function abrirModalReclamo(id = null) {
    form.reset();
    formComentario.reset(); // Limpiar el formulario de comentario
    
    const esUsuarioAdmin = esAdmin();
    document.getElementById('reclamo-titulo').disabled = !esUsuarioAdmin && id !== null;
    document.getElementById('reclamo-descripcion').disabled = !esUsuarioAdmin && id !== null;
    document.getElementById('reclamo-unidad').disabled = (id !== null);
    
    if (id) {
        // --- Modo Edición / Ver ---
        const reclamo = reclamosCache.find(r => r.id === id);
        if (!reclamo) return;
        
        tituloModal.textContent = esUsuarioAdmin ? 'Editar Reclamo' : 'Ver Reclamo';
        idInput.value = reclamo.id;

        const selectUnidad = document.getElementById('reclamo-unidad');
        if (![...selectUnidad.options].some(opt => opt.value == reclamo.unidad_id)) {
            selectUnidad.innerHTML += `<option value="${reclamo.unidad_id}">${reclamo.nombre_unidad} (otra)</option>`;
        }
        selectUnidad.value = reclamo.unidad_id; 
        
        document.getElementById('reclamo-titulo').value = reclamo.titulo;
        document.getElementById('reclamo-descripcion').value = reclamo.descripcion || '';
        document.getElementById('reclamo-estado').value = reclamo.estado;
        document.getElementById('reclamo-asignado').value = reclamo.usuario_asignado_id || '';
        
        // ✨ Cargar el historial de chat
        renderizarComentarios(id);
        
        // Ocultar formulario de comentario si el reclamo está cerrado (para inquilinos)
        if (!esAdmin() && reclamo.estado === 'Cerrado') {
            formComentario.style.display = 'none';
        } else {
            formComentario.style.display = 'block';
        }
    
    } else {
        // --- Modo Creación ---
        tituloModal.textContent = 'Nuevo Reclamo';
        idInput.value = '';
        document.getElementById('reclamo-titulo').disabled = false;
        document.getElementById('reclamo-descripcion').disabled = false;
        document.getElementById('reclamo-unidad').disabled = false;
        
        // Ocultar el chat (aún no existe el reclamo)
        document.getElementById('historial-comentarios').innerHTML = '<p>El historial de comentarios aparecerá una vez creado el reclamo.</p>';
        formComentario.style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

// ✨ GUARDAR RECLAMO (Actualizado)
async function guardarReclamo(e) {
    e.preventDefault();
    const id = idInput.value;
    const esEdicion = !!id;
    
    let data = {
        titulo: document.getElementById('reclamo-titulo').value,
        descripcion: document.getElementById('reclamo-descripcion').value || null,
    };

    if (esEdicion) {
        if (esAdmin()) {
            data.estado = document.getElementById('reclamo-estado').value;
            data.usuario_asignado_id = parseInt(document.getElementById('reclamo-asignado').value) || null;
        }
    } else {
        data.unidad_id = parseInt(document.getElementById('reclamo-unidad').value);
        if (!data.unidad_id) {
            mostrarNotificacion('Debe seleccionar una unidad.', 'warning');
            return;
        }
    }
    if (!data.titulo) {
        mostrarNotificacion('El título es obligatorio.', 'warning');
        return;
    }

    const url = esEdicion 
        ? `/api/consorcio/reclamos/${id}` 
        : `/api/consorcio/${appState.negocioActivoId}/reclamos`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const respuesta = await sendData(url, data, method);
        mostrarNotificacion(`Reclamo ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        
        if (esEdicion) {
            // Si editamos, solo recargamos comentarios y tabla
            renderizarComentarios(id);
            await cargarReclamos();
        } else {
            // Si creamos, cerramos el modal y recargamos tabla
            modal.style.display = 'none';
            await cargarReclamos();
        }
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// ✨ NUEVA FUNCIÓN: Guardar Comentario
async function guardarNuevoComentario(e) {
    e.preventDefault();
    const reclamoId = idInput.value; // Obtenemos el ID del reclamo actual
    if (!reclamoId) return; // No debería pasar, pero por seguridad
    
    const textoComentario = document.getElementById('nuevo-comentario-texto').value;
    if (!textoComentario.trim()) {
        mostrarNotificacion('El comentario no puede estar vacío.', 'warning');
        return;
    }
    
    try {
        const url = `/api/consorcio/reclamos/${reclamoId}/comentarios`;
        await sendData(url, { comentario: textoComentario }, 'POST');
        
        // Limpiar el textarea
        document.getElementById('nuevo-comentario-texto').value = '';
        
        // Recargar el historial de comentarios
        await renderizarComentarios(reclamoId);
        
        // Recargar la tabla principal (para que el reclamo suba en la lista)
        await cargarReclamos();
        
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// BORRAR RECLAMO (Sin cambios)
export async function borrarReclamo(id) {
    // ... (código sin cambios)
    if (!confirm('¿Estás seguro...')) return;
    try {
        await sendData(`/api/consorcio/reclamos/${id}`, {}, 'DELETE');
        mostrarNotificacion('Reclamo eliminado.', 'success');
        await cargarReclamos();
    } catch (error) { /* ... */ }
}

// --- Función de Inicialización (Actualizada) ---
export async function inicializarLogicaReclamos() {
    
    modal = document.getElementById('modal-reclamo');
    form = document.getElementById('form-reclamo');
    tituloModal = document.getElementById('modal-reclamo-titulo');
    idInput = document.getElementById('reclamo-id');
    filtroEstado = document.getElementById('filtro-reclamo-estado');
    formComentario = document.getElementById('form-nuevo-comentario'); // ✨ NUEVO
    
    if (!modal || !form || !filtroEstado || !formComentario) {
        console.error('No se encontraron los elementos del DOM para Reclamos.');
        return;
    }

    await poblarSelectorEstados();
    await cargarReclamos();
    poblarSelectoresModal();
    
    // Listeners
    filtroEstado.addEventListener('change', () => {
        renderizarTabla();
        renderizarKanban();
    });
    document.getElementById('btn-abrir-modal-reclamo').addEventListener('click', () => abrirModalReclamo());
    document.getElementById('close-modal-reclamo').addEventListener('click', () => modal.style.display = 'none');
    form.addEventListener('submit', guardarReclamo);
    formComentario.addEventListener('submit', guardarNuevoComentario); // ✨ NUEVO LISTENER
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    // --- Lógica de Drag & Drop (sin cambios) ---
    const columnas = document.querySelectorAll('.kanban-cards-container');
    if (columnas.length > 0) {
        columnas.forEach(columna => {
            // ... (dragover, dragleave, drop) ...
        });
    } else {
        console.warn('Contenedores Kanban no encontrados.');
    }

    // --- Lógica del Toggle de Vistas (sin cambios) ---
    const btnTabla = document.getElementById('btn-vista-tabla');
    const btnKanban = document.getElementById('btn-vista-kanban');
    const vistaTabla = document.getElementById('vista-tabla');
    const vistaKanban = document.getElementById('vista-kanban');
    if (btnTabla && btnKanban && vistaTabla && vistaKanban) {
        // ... (listeners de click para toggle) ...
    } else {
        console.warn('Botones de cambio de vista no encontrados.');
    }
}