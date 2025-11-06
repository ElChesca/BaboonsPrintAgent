// static/js/modules/reclamos.js
// ✨ ARCHIVO COMPLETO Y CORREGIDO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Almacenes de caché ---
let reclamosCache = [];
let usuariosAdminCache = [];
let misUnidadesCache = [];
let estadosCache = []; // Caché para los nuevos estados dinámicos
let selectsPopulating = false;

// --- Elementos del DOM ---
let modal, form, tituloModal, idInput, filtroEstado;

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
        tbody.innerHTML = `<tr><td colspan="7">No se encontraron reclamos con el filtro actual.</td></tr>`;
        return;
    }

    reclamosFiltrados.forEach(r => {
        const fechaAct = new Date(r.fecha_actualizacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const acciones = esAdmin()
            ? `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver/Editar</button>
               <button class="btn-danger btn-sm" onclick="window.borrarReclamo(${r.id})">Borrar</button>`
            : `<button class="btn-secondary btn-sm" onclick="window.abrirModalReclamo(${r.id})">Ver</button>`;
        
        tbody.innerHTML += `
            <tr>
                <td><span class="estado-${r.estado.toLowerCase().replace(' ', '-')}">${r.estado}</span></td>
                <td>${fechaAct}</td>
                <td><strong>${r.nombre_unidad}</strong></td>
                <td>${r.titulo}</td>
                <td>${r.creador_nombre}</td>
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
    
    colAbierto.innerHTML = '';
    colProceso.innerHTML = '';
    colCerrado.innerHTML = '';

    const filtro = filtroEstado.value; 
    const reclamosFiltrados = (filtro === 'Todos')
        ? reclamosCache
        : reclamosCache.filter(r => r.estado === filtro);

    reclamosFiltrados.forEach(r => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.reclamoId = r.id; 
        
        card.innerHTML = `
            <h4>${r.titulo}</h4>
            <p><strong>Unidad:</strong> ${r.nombre_unidad}</p>
            <small>Creado por: ${r.creador_nombre}</small>
        `;
        
        card.addEventListener('click', () => abrirModalReclamo(r.id));
        
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', r.id);
            e.target.style.opacity = '0.5';
        });
        
        card.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
        });

        // NOTA: Esta lógica de Kanban es simple. Si añades estados
        // como "Tercerizado", necesitaríamos crear columnas dinámicamente.
        // Por ahora, los agrupa en las 3 columnas principales.
        if (r.estado === 'Abierto') {
            colAbierto.appendChild(card);
        } else if (r.estado === 'En Proceso') {
            colProceso.appendChild(card);
        } else { // Todos los demás (Cerrado, Tercerizado, etc) van a la última
            colCerrado.appendChild(card);
        }
    });
}

// Carga las listas para los <select> del modal (Unidades y Usuarios)
async function poblarSelectoresModal() {
    if (selectsPopulating) return;
    selectsPopulating = true;
    
    try {
        const urlUsuarios = '/api/usuarios';
        const urlUnidades = esAdmin()
            ? `/api/consorcio/${appState.negocioActivoId}/unidades`
            : `/api/consorcio/${appState.negocioActivoId}/mis-unidades`;
        
        const [usuarios, unidades] = await Promise.all([
            fetchData(urlUsuarios),
            fetchData(urlUnidades)
        ]);

        usuariosAdminCache = usuarios.filter(u => u.rol === 'admin' || u.rol === 'superadmin');
        misUnidadesCache = unidades;

        const selectUnidad = document.getElementById('reclamo-unidad');
        selectUnidad.innerHTML = '<option value="">-- Seleccione una unidad --</option>';
        unidades.forEach(u => {
            selectUnidad.innerHTML += `<option value="${u.id}">${u.nombre_unidad}</option>`;
        });

        const selectAsignado = document.getElementById('reclamo-asignado');
        selectAsignado.innerHTML = '<option value="">-- Sin Asignar --</option>';
        usuariosAdminCache.forEach(u => {
            selectAsignado.innerHTML += `<option value="${u.id}">${u.nombre}</option>`;
        });

    } catch (error) {
        mostrarNotificacion('No se pudo cargar la lista de usuarios/unidades.', 'error');
    } finally {
        selectsPopulating = false;
    }
}

// ✨ --- NUEVA FUNCIÓN (Poblar Estados) --- ✨
async function poblarSelectorEstados() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos/estados`;
        estadosCache = await fetchData(url); // Ej: ["Abierto", "En Proceso", "Cerrado"]

        const filtroSelect = document.getElementById('filtro-reclamo-estado');
        const modalSelect = document.getElementById('reclamo-estado');

        // 1. Llenar el <select> del FILTRO (preservando "Todos")
        estadosCache.forEach(estado => {
            const selected = (estado === 'Abierto') ? 'selected' : '';
            filtroSelect.innerHTML += `<option value="${estado}" ${selected}>${estado}</option>`;
        });

        // 2. Llenar el <select> del MODAL (sin "Todos")
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
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos`;
        reclamosCache = await fetchData(url);
        renderizarTabla(); 
        renderizarKanban();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
        const tbody = document.querySelector('#tabla-reclamos tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7">Error al cargar reclamos.</td></tr>`;
    }
}

// --- Lógica del Modal (CRUD) ---
export function abrirModalReclamo(id = null) {
    form.reset();
    
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

        // Aseguramos que la unidad esté en el select (incluso si está deshabilitado)
        const selectUnidad = document.getElementById('reclamo-unidad');
        if (![...selectUnidad.options].some(opt => opt.value == reclamo.unidad_id)) {
            // Si la unidad no está en la lista (ej. un admin viendo el reclamo de otro)
            // la añadimos temporalmente para que se vea el nombre
            selectUnidad.innerHTML += `<option value="${reclamo.unidad_id}">${reclamo.nombre_unidad} (otra)</option>`;
        }
        selectUnidad.value = reclamo.unidad_id; 
        
        document.getElementById('reclamo-titulo').value = reclamo.titulo;
        document.getElementById('reclamo-descripcion').value = reclamo.descripcion || '';
        
        document.getElementById('reclamo-estado').value = reclamo.estado;
        document.getElementById('reclamo-asignado').value = reclamo.usuario_asignado_id || '';
    
    } else {
        // --- Modo Creación ---
        tituloModal.textContent = 'Nuevo Reclamo';
        idInput.value = '';
        document.getElementById('reclamo-titulo').disabled = false;
        document.getElementById('reclamo-descripcion').disabled = false;
        document.getElementById('reclamo-unidad').disabled = false;
    }
    
    modal.style.display = 'flex';
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

    const url = esEdicion 
        ? `/api/consorcio/reclamos/${id}` 
        : `/api/consorcio/${appState.negocioActivoId}/reclamos`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Reclamo ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        modal.style.display = 'none';
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
// ✨ --- CORRECCIÓN: Añadido 'async' --- ✨
export async function inicializarLogicaReclamos() {
    modal = document.getElementById('modal-reclamo');
    form = document.getElementById('form-reclamo');
    tituloModal = document.getElementById('modal-reclamo-titulo');
    idInput = document.getElementById('reclamo-id');
    filtroEstado = document.getElementById('filtro-reclamo-estado');
    
    if (!modal || !form || !filtroEstado) {
        console.error('No se encontraron los elementos del DOM para Reclamos.');
        return;
    }

    // ✨ ORDEN DE CARGA CORREGIDO ✨
    await poblarSelectorEstados(); // 1. Carga estados y los pone en el <select>
    await cargarReclamos();        // 2. Carga reclamos (y renderiza tabla/kanban)
    poblarSelectoresModal();       // 3. Carga usuarios/unidades (en paralelo)
    
    // Listeners
    filtroEstado.addEventListener('change', () => {
        renderizarTabla();
        renderizarKanban(); // El filtro refresca ambas vistas
    });
    document.getElementById('btn-abrir-modal-reclamo').addEventListener('click', () => abrirModalReclamo());
    document.getElementById('close-modal-reclamo').addEventListener('click', () => modal.style.display = 'none');
    form.addEventListener('submit', guardarReclamo);
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    // --- LÓGICA DE DRAG & DROP (BLINDADA) ---
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
                if (columnaId === 'cards-abierto') nuevoEstado = 'Abierto';
                if (columnaId === 'cards-en-proceso') nuevoEstado = 'En Proceso';
                if (columnaId === 'cards-cerrado') nuevoEstado = 'Cerrado';

                // Si se suelta en una columna no reconocida O si el estado ya es ese, no hacer nada
                if (!nuevoEstado) return; 
                const reclamo = reclamosCache.find(r => r.id == reclamoId);
                if (reclamo.estado === nuevoEstado) return;

                if (!esAdmin()) {
                    mostrarNotificacion('Solo los administradores pueden cambiar el estado.', 'warning');
                    return;
                }

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

    // --- LÓGICA DEL TOGGLE DE VISTAS (BLINDADA) ---
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
}