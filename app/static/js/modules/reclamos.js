// static/js/modules/reclamos.js
// ✨ ARCHIVO NUEVO ✨

import { appState, esAdmin } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

// --- Almacenes de caché ---
let reclamosCache = [];
let usuariosAdminCache = []; // Para el <select> de "Asignar a"
let misUnidadesCache = [];  // Para el <select> de "Unidad"

// --- Elementos del DOM ---
let modal, form, tituloModal, idInput, filtroEstado;
let selectsPopulating = false;


// Renderiza el tablero Kanban
function renderizarKanban() {
    // 1. Limpiar todas las columnas
    const colAbierto = document.getElementById('cards-abierto');
    const colProceso = document.getElementById('cards-en-proceso');
    const colCerrado = document.getElementById('cards-cerrado');
    if (!colAbierto || !colProceso || !colCerrado) return; // Chequeo de seguridad
    
    colAbierto.innerHTML = '';
    colProceso.innerHTML = '';
    colCerrado.innerHTML = '';

    // ✨ 2. OBTENER EL FILTRO (ESTA ES LA LÍNEA NUEVA) ✨
    // Lee el valor del <select> que está en el HTML
    const filtro = filtroEstado.value; 
    const reclamosFiltrados = (filtro === 'Todos')
        ? reclamosCache
        : reclamosCache.filter(r => r.estado === filtro);

    // 3. Iterar sobre el caché FILTRADO
    reclamosFiltrados.forEach(r => {
        // 4. Crear la tarjeta (card)
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
        
        // ... (eventos dragstart y dragend sin cambios) ...
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', r.id);
            e.target.style.opacity = '0.5';
        });
        card.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
        });

        // 5. Poner la tarjeta en la columna correcta
        if (r.estado === 'Abierto') {
            colAbierto.appendChild(card);
        } else if (r.estado === 'En Proceso') {
            colProceso.appendChild(card);
        } else if (r.estado === 'Cerrado') {
            colCerrado.appendChild(card);
        }
    });
}

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
        
        // El botón de editar es visible para todos, pero "borrar" solo para admin
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

// Carga las listas para los <select> del modal
async function poblarSelectoresModal() {
    if (selectsPopulating) return;
    selectsPopulating = true;
    
    try {
        const urlUsuarios = '/api/usuarios'; // Trae todos (admin y operadores)
        const urlUnidades = esAdmin()
            ? `/api/consorcio/${appState.negocioActivoId}/unidades` // Admin: trae todas las unidades
            : `/api/consorcio/${appState.negocioActivoId}/mis-unidades`; // Inquilino: trae solo sus unidades
        
        const [usuarios, unidades] = await Promise.all([
            fetchData(urlUsuarios),
            fetchData(urlUnidades)
        ]);

        usuariosAdminCache = usuarios.filter(u => u.rol === 'admin' || u.rol === 'superadmin');
        misUnidadesCache = unidades;

        // Poblar <select> de Unidades (para crear)
        const selectUnidad = document.getElementById('reclamo-unidad');
        selectUnidad.innerHTML = '<option value="">-- Seleccione una unidad --</option>';
        unidades.forEach(u => {
            selectUnidad.innerHTML += `<option value="${u.id}">${u.nombre_unidad}</option>`;
        });

        // Poblar <select> de "Asignar A" (solo admins)
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

// --- Funciones de Carga de Datos ---

async function cargarReclamos() {
    try {
        const url = `/api/consorcio/${appState.negocioActivoId}/reclamos`;
        reclamosCache = await fetchData(url);
        renderizarTabla(); // Renderiza la tabla con los filtros aplicados
        renderizarKanban(); // Renderiza el tablero Kanban
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
        const tbody = document.querySelector('#tabla-reclamos tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7">Error al cargar reclamos.</td></tr>`;
    }
}

// --- Lógica del Modal (CRUD) ---

export function abrirModalReclamo(id = null) {
    form.reset();
    
    // Deshabilitar campos para usuarios normales
    const esUsuarioAdmin = esAdmin();
    document.getElementById('reclamo-titulo').disabled = !esUsuarioAdmin && id !== null; // Deshabilitado en "Ver"
    document.getElementById('reclamo-descripcion').disabled = !esUsuarioAdmin && id !== null;
    document.getElementById('reclamo-unidad').disabled = (id !== null); // No se puede cambiar la unidad
    
    if (id) {
        // --- Modo Edición / Ver ---
        const reclamo = reclamosCache.find(r => r.id === id);
        if (!reclamo) return;
        
        tituloModal.textContent = esUsuarioAdmin ? 'Editar Reclamo' : 'Ver Reclamo';
        idInput.value = reclamo.id;

        // Llenar el select de unidad (incluso si está deshabilitado)
        // (Asumimos que la unidad del reclamo estará en la lista)
        document.getElementById('reclamo-unidad').value = reclamo.unidad_id; 
        document.getElementById('reclamo-titulo').value = reclamo.titulo;
        document.getElementById('reclamo-descripcion').value = reclamo.descripcion || '';
        
        // Llenar campos de admin
        document.getElementById('reclamo-estado').value = reclamo.estado;
        document.getElementById('reclamo-asignado').value = reclamo.usuario_asignado_id || '';
    
    } else {
        // --- Modo Creación ---
        tituloModal.textContent = 'Nuevo Reclamo';
        idInput.value = '';
        // Habilitar campos
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
        // Si edita, solo un admin puede cambiar esto
        if (esAdmin()) {
            data.estado = document.getElementById('reclamo-estado').value;
            data.usuario_asignado_id = parseInt(document.getElementById('reclamo-asignado').value) || null;
        }
    } else {
        // Si crea, se necesita la unidad
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
        await cargarReclamos(); // Recargar la tabla
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function borrarReclamo(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este reclamo?')) return;
    
    try {
        await sendData(`/api/consorcio/reclamos/${id}`, {}, 'DELETE');
        mostrarNotificacion('Reclamo eliminado con éxito.', 'success');
        await cargarReclamos(); // Recargar la tabla
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Función de Inicialización ---

export function inicializarLogicaReclamos() {
    modal = document.getElementById('modal-reclamo');
    form = document.getElementById('form-reclamo');
    tituloModal = document.getElementById('modal-reclamo-titulo');
    idInput = document.getElementById('reclamo-id');
    filtroEstado = document.getElementById('filtro-reclamo-estado');
    
    if (!modal || !form || !filtroEstado) {
        console.error('No se encontraron los elementos del DOM para Reclamos.');
        return;
    }

    // Cargar datos
    cargarReclamos();
    poblarSelectoresModal(); // Carga las unidades y usuarios
    
    // Listeners
    filtroEstado.addEventListener('change', renderizarTabla);
    document.getElementById('btn-abrir-modal-reclamo').addEventListener('click', () => abrirModalReclamo());
    document.getElementById('close-modal-reclamo').addEventListener('click', () => modal.style.display = 'none');
    form.addEventListener('submit', guardarReclamo);
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    // ✨ --- LÓGICA DE DRAG & DROP (NUEVA) --- ✨
   const columnas = document.querySelectorAll('.kanban-cards-container');
    if (columnas.length > 0) {
        columnas.forEach(columna => {
            // Evento 1: Cuando una tarjeta pasa por encima
            columna.addEventListener('dragover', (e) => {
                e.preventDefault(); // ¡Obligatorio para permitir el 'drop'!
                columna.classList.add('drag-over');
            });

            // Evento 2: Cuando una tarjeta sale de encima
            columna.addEventListener('dragleave', () => {
                columna.classList.remove('drag-over');
            });

            // Evento 3: ¡Cuando sueltan la tarjeta!
            columna.addEventListener('drop', async (e) => {
                e.preventDefault();
                columna.classList.remove('drag-over');

                // 1. Obtener los datos
                const reclamoId = e.dataTransfer.getData('text/plain');
                const columnaId = columna.id; // ej: "cards-en-proceso"
                
                let nuevoEstado = '';
                if (columnaId === 'cards-abierto') nuevoEstado = 'Abierto';
                if (columnaId === 'cards-en-proceso') nuevoEstado = 'En Proceso';
                if (columnaId === 'cards-cerrado') nuevoEstado = 'Cerrado';

                // 2. Verificar si el estado es el mismo
                const reclamo = reclamosCache.find(r => r.id == reclamoId);
                if (reclamo.estado === nuevoEstado) return;

                // 3. Llamar a la API (¡Solo si eres admin!)
                if (!esAdmin()) {
                    mostrarNotificacion('Solo los administradores pueden cambiar el estado.', 'warning');
                    return;
                }

                try {
                    mostrarNotificacion('Actualizando estado...', 'info');
                    await sendData(`/api/consorcio/reclamos/${reclamoId}`, { 
                        estado: nuevoEstado,
                        // (Pasamos los datos existentes para no pisarlos)
                        titulo: reclamo.titulo, 
                        descripcion: reclamo.descripcion,
                        usuario_asignado_id: reclamo.usuario_asignado_id
                    }, 'PUT');

                    // 4. Recargar los datos
                    await cargarReclamos();
                    mostrarNotificacion('Estado actualizado.', 'success');
                } catch (error) {
                    mostrarNotificacion(error.message, 'error');
                }
            });
        });
    } else {
        console.warn('Contenedores Kanban no encontrados. Se omite la lógica de Drag & Drop.');
    }

    // ✨ --- LÓGICA DEL TOGGLE DE VISTAS (VERSIÓN BLINDADA) --- ✨
    const btnTabla = document.getElementById('btn-vista-tabla');
    const btnKanban = document.getElementById('btn-vista-kanban');
    const vistaTabla = document.getElementById('vista-tabla');
    const vistaKanban = document.getElementById('vista-kanban');

    // Chequeamos que todos los elementos existan antes de añadir listeners
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
        console.warn('Botones de cambio de vista no encontrados. Se omite la lógica del Toggle.');
    }
}