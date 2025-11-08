// static/js/modules/reclamos.js
// ✨ ARCHIVO LIMPIO Y "BLINDADO" ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let reclamosCache = [];
let usuariosAdminCache = [];
let misUnidadesCache = [];
let estadosCache = [];
let selectsPopulating = false;
let modal, form, tituloModal, idInput, filtroEstado;
let formComentario;

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-reclamos tbody');
    if (!tbody) return;
    const filtro = filtroEstado ? filtroEstado.value : 'Abierto';
    const reclamosFiltrados = (filtro === 'Todos') ? reclamosCache : reclamosCache.filter(r => r.estado === filtro);

    tbody.innerHTML = '';
    if (reclamosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">No se encontraron reclamos.</td></tr>`;
        return;
    }
    reclamosFiltrados.forEach(r => {
        const fechaAct = new Date(r.fecha_actualizacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const acciones = esAdmin()
            ? `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver/Editar</button> <button class="btn-danger btn-sm" onclick="window.borrarReclamo(${r.id})">Borrar</button>`
            : `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver</button>`;
        const globoComentarios = (r.comentarios_count > 0) ? `<span class="comentario-badge">${r.comentarios_count}</span>` : '';
            
        tbody.innerHTML += `<tr><td><span class="estado-${r.estado.toLowerCase().replace(' ', '-')}">${r.estado}</span></td><td>${fechaAct}</td><td><strong>${r.nombre_unidad}</strong></td><td>${r.titulo}</td><td>${globoComentarios}</td><td>${r.creador_nombre}</td><td>${r.asignado_nombre || '-'}</td><td class="acciones">${acciones}</td></tr>`;
    });
}

function renderizarKanban() {
    const colAbierto = document.getElementById('cards-abierto');
    const colProceso = document.getElementById('cards-en-proceso');
    const colCerrado = document.getElementById('cards-cerrado');
    if (!colAbierto || !colProceso || !colCerrado) {
        console.warn("Renderizando Kanban: Columnas no encontradas aún.");
        return;
    }
    colAbierto.innerHTML = ''; colProceso.innerHTML = ''; colCerrado.innerHTML = '';
    const filtro = filtroEstado ? filtroEstado.value : 'Abierto';
    const reclamosFiltrados = (filtro === 'Todos') ? reclamosCache : reclamosCache.filter(r => r.estado === filtro);

    reclamosFiltrados.forEach(r => {
        const card = document.createElement('div');
        card.className = 'kanban-card'; card.draggable = true; card.dataset.reclamoId = r.id; 
        const globoComentarios = (r.comentarios_count > 0) ? `<span class="comentario-badge">${r.comentarios_count}</span>` : '';
        card.innerHTML = `<h4>${r.titulo} ${globoComentarios}</h4><p><strong>Unidad:</strong> ${r.nombre_unidad}</p><small>Creado por: ${r.creador_nombre}</small>`;
        card.addEventListener('click', () => abrirModalReclamo(r.id));
        card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', r.id); e.target.style.opacity = '0.5'; });
        card.addEventListener('dragend', (e) => { e.target.style.opacity = '1'; });
        if (r.estado === 'Abierto') colAbierto.appendChild(card);
        else if (r.estado === 'En Proceso') colProceso.appendChild(card);
        else colCerrado.appendChild(card);
    });
}

async function renderizarComentarios(reclamoId) {
    const historialDiv = document.getElementById('historial-comentarios');
    if (!historialDiv) return;
    historialDiv.innerHTML = '<p>Cargando comentarios...</p>';
    try {
        const comentarios = await fetchData(`/api/consorcio/reclamos/${reclamoId}/comentarios`);
        if (comentarios.length === 0) {
            historialDiv.innerHTML = '<p>No hay comentarios en este reclamo.</p>';
            return;
        }
        historialDiv.innerHTML = '';
        comentarios.forEach(c => {
            const fecha = new Date(c.fecha_creacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const esAdmin = (c.usuario_rol === 'admin' || c.usuario_rol === 'superadmin');
            const nombreClass = esAdmin ? 'admin' : '';
            historialDiv.innerHTML += `<div class="comentario-item"><div class="comentario-header"><strong class="${nombreClass}">${c.usuario_nombre}</strong><span class="comentario-fecha">${fecha}</span></div><div class="comentario-cuerpo">${c.comentario.replace(/\n/g, '<br>')}</div></div>`;
        });
        historialDiv.scrollTop = historialDiv.scrollHeight;
    } catch (error) {
        historialDiv.innerHTML = '<p style="color: red;">Error al cargar comentarios.</p>';
        mostrarNotificacion(error.message, 'error');
    }
}

async function poblarSelectoresModal() {
    if (selectsPopulating) return;
    selectsPopulating = true;
    
    try {
        // Arrays para guardar los resultados
        let usuarios = [];
        let unidades = [];

        // Creamos las promesas
        const promesas = [];

        // ✨ LÓGICA DE ROLES MEJORADA ✨
        if (esAdmin()) {
            // 1. Si es Admin, necesita la lista de TODOS los usuarios (para asignar)
            promesas.push(fetchData('/api/usuarios'));
            // 2. Y la lista de TODAS las unidades (para crear reclamos en nombre de otros)
            promesas.push(fetchData(`/api/consorcio/${appState.negocioActivoId}/unidades`));

            // Ejecutamos ambas promesas
            const [usuariosData, unidadesData] = await Promise.all(promesas);
            usuarios = usuariosData;
            unidades = unidadesData;

            // Llenamos el <select> de "Asignar A" (solo admins)
            usuariosAdminCache = usuarios.filter(u => u.rol === 'admin' || u.rol === 'superadmin');
            const selectAsignado = document.getElementById('reclamo-asignado');
            if (selectAsignado) { // Verificamos que exista
                selectAsignado.innerHTML = '<option value="">-- Sin Asignar --</option>';
                usuariosAdminCache.forEach(u => {
                    selectAsignado.innerHTML += `<option value="${u.id}">${u.nombre}</option>`;
                });
            }

        } else {
            // 1. Si es Inquilino, SOLO necesita la lista de "Mis Unidades"
            promesas.push(fetchData(`/api/consorcio/${appState.negocioActivoId}/mis-unidades`));
            
            // Ejecutamos la única promesa
            const [unidadesData] = await Promise.all(promesas);
            unidades = unidadesData;
        }

        // --- Lógica Común ---
        // Ambos roles necesitan llenar el <select> de Unidades
        misUnidadesCache = unidades; // Guardamos en caché
        const selectUnidad = document.getElementById('reclamo-unidad');
        if (selectUnidad) { // Verificamos que exista
            selectUnidad.innerHTML = '<option value="">-- Seleccione una unidad --</option>';
            unidades.forEach(u => {
                selectUnidad.innerHTML += `<option value="${u.id}">${u.nombre_unidad}</option>`;
            });
        }

    } catch (error) {
        // Si algo falla (ej. el 403 que veías), se notifica
        console.error("Error en poblarSelectoresModal:", error);
        mostrarNotificacion('No se pudo cargar la lista de usuarios/unidades.', 'error');
    } finally {
        selectsPopulating = false;
    }
}

async function poblarSelectorEstados() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos/estados`;
        estadosCache = await fetchData(url);
        const filtroSelect = document.getElementById('filtro-reclamo-estado');
        const modalSelect = document.getElementById('reclamo-estado');
        if (filtroSelect) {
            estadosCache.forEach(estado => {
                const selected = (estado === 'Abierto') ? 'selected' : '';
                filtroSelect.innerHTML += `<option value="${estado}" ${selected}>${estado}</option>`;
            });
        }
        if (modalSelect) {
            modalSelect.innerHTML = '';
            estadosCache.forEach(estado => {
                modalSelect.innerHTML += `<option value="${estado}">${estado}</option>`;
            });
        }
    } catch (error) {
        mostrarNotificacion('Error al cargar los estados de reclamos.', 'error');
    }
}

async function cargarReclamos() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos`;
        reclamosCache = await fetchData(url);
        renderizarTabla(); 
        renderizarKanban();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function abrirModalReclamo(id = null) {
    if (!form || !formComentario) return;
    form.reset();
    formComentario.reset();
    const esUsuarioAdmin = esAdmin();
    document.getElementById('reclamo-titulo').disabled = !esUsuarioAdmin && id !== null;
    document.getElementById('reclamo-descripcion').disabled = !esUsuarioAdmin && id !== null;
    document.getElementById('reclamo-unidad').disabled = (id !== null);
    if (id) {
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
        renderizarComentarios(id);
        formComentario.style.display = (!esAdmin() && reclamo.estado === 'Cerrado') ? 'none' : 'block';
    } else {
        tituloModal.textContent = 'Nuevo Reclamo';
        idInput.value = '';
        document.getElementById('reclamo-titulo').disabled = false;
        document.getElementById('reclamo-descripcion').disabled = false;
        document.getElementById('reclamo-unidad').disabled = false;
        const historialDiv = document.getElementById('historial-comentarios');
        if (historialDiv) historialDiv.innerHTML = '<p>El historial de comentarios aparecerá una vez creado el reclamo.</p>';
        formComentario.style.display = 'none';
    }
    if (modal) modal.style.display = 'flex';
}

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
    const url = esEdicion ? `/api/consorcio/reclamos/${id}` : `/api/consorcio/${appState.negocioActivoId}/reclamos`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Reclamo ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        if (esEdicion) {
            renderizarComentarios(id);
            await cargarReclamos();
        } else {
            if (modal) modal.style.display = 'none';
            await cargarReclamos();
        }
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

async function guardarNuevoComentario(e) {
    e.preventDefault();
    const reclamoId = idInput.value;
    if (!reclamoId) return;
    const textoComentarioEl = document.getElementById('nuevo-comentario-texto');
    const textoComentario = textoComentarioEl.value;
    if (!textoComentario.trim()) {
        mostrarNotificacion('El comentario no puede estar vacío.', 'warning');
        return;
    }
    try {
        const url = `/api/consorcio/reclamos/${reclamoId}/comentarios`;
        await sendData(url, { comentario: textoComentario }, 'POST');
        textoComentarioEl.value = '';
        await renderizarComentarios(reclamoId);
        await cargarReclamos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function borrarReclamo(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este reclamo?')) return;
    try {
        await sendData(`/api/consorcio/reclamos/${id}`, {}, 'DELETE');
        mostrarNotificacion('Reclamo eliminado con éxito.', 'success');
        await cargarReclamos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---
export async function inicializarLogicaReclamos() {
    
    // 1. Buscamos los elementos ESENCIALES primero
    modal = document.getElementById('modal-reclamo');
    form = document.getElementById('form-reclamo');
    tituloModal = document.getElementById('modal-reclamo-titulo');
    idInput = document.getElementById('reclamo-id');
    filtroEstado = document.getElementById('filtro-reclamo-estado');
    formComentario = document.getElementById('form-nuevo-comentario');
    
    // Si falta algo básico (como el modal o el filtro), no continuamos.
    if (!modal || !form || !filtroEstado || !formComentario) {
        console.error('No se encontraron los elementos del DOM para Reclamos. El HTML está incompleto.');
        return;
    }

    // 2. Cargamos los datos
    await poblarSelectorEstados();
    await cargarReclamos();
    poblarSelectoresModal();
    
    // 3. Listeners BÁSICOS (para todos los roles)
    filtroEstado.addEventListener('change', () => {
        renderizarTabla();
        renderizarKanban();
    });
    document.getElementById('btn-abrir-modal-reclamo').addEventListener('click', () => abrirModalReclamo());
    document.getElementById('close-modal-reclamo').addEventListener('click', () => modal.style.display = 'none');
    form.addEventListener('submit', guardarReclamo);
    formComentario.addEventListener('submit', guardarNuevoComentario);
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    // ✨ --- 4. LÓGICA SÓLO PARA ADMINS --- ✨
    // Envolvemos el Drag&Drop y el Toggle en una validación 'esAdmin()'
    if (esAdmin()) {
        
        // --- Lógica de Drag & Drop ---
        const columnas = document.querySelectorAll('.kanban-cards-container');
        if (columnas.length > 0) {
            columnas.forEach(columna => {
                columna.addEventListener('dragover', (e) => {
                    e.preventDefault(); 
                    columna.classList.add('drag-over');
                });
                columna.addEventListener('dragleave', () => {
                    columna.classList.remove('drag-over');
                });
                columna.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    columna.classList.remove('drag-over');
                    const reclamoId = e.dataTransfer.getData('text/plain');
                    const columnaId = columna.id;
                    
                    let nuevoEstado = '';
                    if (columnaId.includes('abierto')) nuevoEstado = 'Abierto';
                    if (columnaId.includes('en-proceso')) nuevoEstado = 'En Proceso';
                    if (columnaId.includes('cerrado')) nuevoEstado = 'Cerrado';

                    if (!nuevoEstado) return; 
                    const reclamo = reclamosCache.find(r => r.id == reclamoId);
                    if (reclamo.estado === nuevoEstado) return;

                    // (Ya estamos dentro de 'esAdmin()', así que no hace falta chequear de nuevo)
                    try {
                        mostrarNotificacion('Actualizando estado...', 'info');
                        await sendData(`/api/consorcio/reclamos/${reclamoId}`, { 
                            estado: nuevoEstado,
                            titulo: reclamo.titulo, 
                            descripcion: reclamo.descripcion,
                            usuario_asignado_id: reclamo.usuario_asignado_id
                        }, 'PUT');

                        await cargarReclamos();
                        mostrarNotificacion('Estado actualizado.', 'success');
                    } catch (error) {
                        mostrarNotificacion(error.message, 'error');
                    }
                });
            });
        } else {
            console.warn('Contenedores Kanban no encontrados.');
        }

        // --- Lógica del Toggle de Vistas ---
        const btnTabla = document.getElementById('btn-vista-tabla');
        const btnKanban = document.getElementById('btn-vista-kanban');
        const vistaTabla = document.getElementById('vista-tabla');
        const vistaKanban = document.getElementById('vista-kanban');

        if (btnTabla && btnKanban && vistaTabla && vistaKanban) {
            btnTabla.addEventListener('click', () => {
                vistaTabla.style.display = 'block';
                vistaKanban.style.display = 'none';
                btnTabla.classList.add('active');
                btnKanban.classList.remove('active');
            });
            btnKanban.addEventListener('click', () => {
                vistaTabla.style.display = 'none';
                vistaKanban.style.display = 'block';
                btnTabla.classList.remove('active');
                btnKanban.classList.add('active');
            });
        } else {
            console.warn('Botones de cambio de vista no encontrados.');
        }
        
    } // <-- Fin del 'if (esAdmin())'
}