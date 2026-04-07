/* app/static/js/modules/mesas.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let mesasCache = [];
let mozosCache = [];
let sectoresCache = []; // Nuevo: Cache de sectores oficiales
let reservasHoy = []; 
let seleccionados = new Set();
let currentSector = 'todos'; // Nuevo: Filtro actual

export async function inicializarMesas() {
    console.log("🚀 Inicializando Módulo de Mesas (v2 Sectores)...");

    const btnNueva = document.getElementById('btn-nueva-mesa');
    const btnNuevaEmpty = document.getElementById('btn-nueva-mesa-empty');
    const btnCerrar = document.getElementById('btn-cerrar-modal-mesa');
    const btnCancelar = document.getElementById('btn-cancelar-mesa');
    const form = document.getElementById('form-mesa');

    if (form) form.onsubmit = guardarMesa;

    if (btnNueva) btnNueva.onclick = () => window.abrirModalMesa();
    if (btnNuevaEmpty) btnNuevaEmpty.onclick = () => window.abrirModalMesa();
    if (btnCerrar) btnCerrar.onclick = () => window.cerrarModalMesa();
    if (btnCancelar) btnCancelar.onclick = () => window.cerrarModalMesa();

    const selectAll = document.getElementById('select-all-mesas');
    if (selectAll) {
        selectAll.onchange = (e) => {
            const checkboxes = document.querySelectorAll('.select-mesa');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const id = parseInt(cb.dataset.id);
                if (e.target.checked) seleccionados.add(id);
                else seleccionados.delete(id);
            });
            actualizarBarraMasivaMesas();
        };
    }

    await cargarMozos();
    await cargarSectores();
    await cargarMesas();
}

async function cargarMozos() {
    try {
        const idNegocio = appState.negocioActivoId;
        mozosCache = await fetchData(`/api/negocios/${idNegocio}/mozos`);
        const select = document.getElementById('mesa-mozo-id');
        if (select) {
            select.innerHTML = '<option value="">Sin mozo pre-asignado</option>';
            mozosCache.forEach(m => {
                select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
            });
        }
    } catch (error) {
        console.error("Error cargando mozos:", error);
    }
}

async function cargarSectores() {
    try {
        const idNegocio = appState.negocioActivoId;
        sectoresCache = await fetchData(`/api/negocios/${idNegocio}/sectores`);
        
        // Si no hay sectores, crear uno por defecto? Por ahora dejar vacío.
        renderizarSectoresTabs();
        actualizarSelectSectores();
    } catch (error) {
        console.error("Error cargando sectores:", error);
    }
}

function renderizarSectoresTabs() {
    const container = document.getElementById('mesas-sector-tabs');
    if (!container) return;

    let html = `
        <li class="nav-item">
            <button class="nav-link ${currentSector === 'todos' ? 'active' : ''}" 
                style="border-radius: 10px; font-weight: 600; padding: 8px 16px;"
                onclick="window.filtrarPorSector('todos')">Todos</button>
        </li>
    `;

    sectoresCache.forEach(s => {
        html += `
            <li class="nav-item">
                <button class="nav-link ${currentSector === s.nombre ? 'active' : ''}" 
                    style="border-radius: 10px; font-weight: 600; padding: 8px 16px;"
                    onclick="window.filtrarPorSector('${s.nombre}')">${s.nombre}</button>
            </li>
        `;
    });

    container.innerHTML = html;
}

window.filtrarPorSector = (sector) => {
    currentSector = sector;
    renderizarSectoresTabs();
    renderizarTabla();
};

function actualizarSelectSectores() {
    const selects = document.querySelectorAll('.sector-select-dropdown');
    selects.forEach(select => {
        let html = '<option value="">Seleccione sector...</option>';
        sectoresCache.forEach(s => {
            html += `<option value="${s.nombre}">${s.nombre}</option>`;
        });
        // Agregar opción por defecto si no hay
        if (sectoresCache.length === 0) {
            html += '<option value="Salon">Salón Principal</option>';
        }
        select.innerHTML = html;
    });
}

async function cargarMesas() {
    const loading = document.getElementById('loading-mesas');
    const noMesas = document.getElementById('no-mesas');
    const tabla = document.getElementById('tabla-mesas');

    if (loading) loading.style.display = 'block';
    if (noMesas) noMesas.style.display = 'none';
    if (tabla) tabla.style.display = 'none';

    try {
        const idNegocio = appState.negocioActivoId;
        const hoy = new Date().toISOString().split('T')[0];
        
        const [mesas, reservas] = await Promise.all([
            fetchData(`/api/negocios/${idNegocio}/mesas`),
            fetchData(`/api/negocios/${idNegocio}/reservas?fecha=${hoy}`)
        ]);

        mesasCache = mesas;
        reservasHoy = reservas;

        if (loading) loading.style.display = 'none';

        if (mesasCache.length === 0) {
            if (noMesas) noMesas.style.display = 'block';
            if (tabla) tabla.style.display = 'none';
        } else {
            if (tabla) tabla.style.display = 'table';
            renderizarTabla();
        }
    } catch (error) {
        console.error(error);
        if (loading) loading.style.display = 'none';
        mostrarNotificacion('Error al cargar mesas', 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-mesas tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const mesasFiltradas = currentSector === 'todos' 
        ? mesasCache 
        : mesasCache.filter(m => m.zona === currentSector);

    mesasFiltradas.forEach(m => {
        const tr = document.createElement('tr');
        const isSelected = seleccionados.has(m.id);
        if (isSelected) tr.classList.add('selected-row');

        let badgeClass = 'bg-success';
        let estadoLabel = 'Libre';

        if (m.estado === 'ocupada') {
            badgeClass = 'bg-danger';
            estadoLabel = 'Ocupada';
        } else if (m.estado === 'reservada') {
            badgeClass = 'bg-warning text-dark';
            estadoLabel = 'Reservada';
        }

        const mozoNombre = m.mozo_fijo_nombre || '<span class="text-muted small">No asignado</span>';
        const reserva = reservasHoy.find(r => r.mesa_id === m.id && r.estado !== 'cancelada');
        
        let colReserva = '<span class="text-muted small">-</span>';
        let colInfoReserva = '<span class="text-muted small">-</span>';

        if (reserva) {
            const estadoRes = reserva.estado === 'confirmada' ? 'text-success' : 'text-warning';
            colReserva = `<span class="fw-bold ${estadoRes}"><i class="fas fa-calendar-check me-1"></i> Reservada</span>`;
            colInfoReserva = `
                <div class="d-flex flex-column" style="line-height: 1.2;">
                    <span class="fw-bold text-dark">${reserva.hora_reserva} <small class="text-muted">(+15m)</small></span>
                    <span class="small text-muted"><i class="fas fa-users me-1"></i> (${reserva.num_comensales} Pax)</span>
                </div>
            `;
        }

        tr.innerHTML = `
            <td style="padding-left: 20px;">
                <input type="checkbox" class="form-check-input select-mesa" 
                    data-id="${m.id}" ${isSelected ? 'checked' : ''} 
                    onchange="toggleSeleccionMesa(${m.id}, this.checked)">
            </td>
            <td><strong>Mesa ${m.numero}</strong></td>
            <td>${m.nombre || '-'}</td>
            <td><i class="fas fa-users me-1 text-muted"></i> ${m.capacidad} pers.</td>
            <td>${colReserva}</td>
            <td>${colInfoReserva}</td>
            <td><span class="badge bg-light text-dark border" style="font-weight: 500;">${m.zona || 'Sin Sector'}</span></td>
            <td><i class="fas fa-user-tie me-1 text-muted small"></i> ${mozoNombre}</td>
            <td><span class="badge ${badgeClass}" style="min-width: 80px; padding: 6px;">${estadoLabel}</span></td>
            <td style="text-align: right; padding-right: 25px;">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarMesa(${m.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarMesa(${m.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function toggleSeleccionMesa(id, checked) {
    if (checked) seleccionados.add(id);
    else seleccionados.delete(id);
    actualizarBarraMasivaMesas();
}
window.toggleSeleccionMesa = toggleSeleccionMesa;

export function actualizarBarraMasivaMesas() {
    const bar = document.getElementById('bulk-actions-bar-mesas');
    const label = document.getElementById('selected-mesas-count');
    if (bar) {
        if (seleccionados.size > 0) bar.classList.add('active');
        else bar.classList.remove('active');
    }
    if (label) label.innerText = seleccionados.size;

    // Actualizar visualmente filas seleccionadas
    document.querySelectorAll('.select-mesa').forEach(cb => {
        const tr = cb.closest('tr');
        if (tr) {
            if (cb.checked) tr.classList.add('selected-row');
            else tr.classList.remove('selected-row');
        }
    });
}

export function deseleccionarTodasMesas() {
    seleccionados.clear();
    const selectAll = document.getElementById('select-all-mesas');
    if (selectAll) selectAll.checked = false;
    document.querySelectorAll('.select-mesa').forEach(cb => cb.checked = false);
    actualizarBarraMasivaMesas();
}
window.deseleccionarTodasMesas = deseleccionarTodasMesas;

// --- MODALES Y ACCIONES ---

export function abrirModalMesa() {
    const modal = document.getElementById('modal-mesa');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-mesa-titulo').innerText = 'Nueva Mesa';
        document.getElementById('form-mesa').reset();
        document.getElementById('mesa-id').value = '';
    }
}
window.abrirModalMesa = abrirModalMesa;

export function cerrarModalMesa() {
    const modal = document.getElementById('modal-mesa');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalMesa = cerrarModalMesa;

export function editarMesa(id) {
    const mesa = mesasCache.find(m => m.id === id);
    if (!mesa) return;
    const modal = document.getElementById('modal-mesa');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-mesa-titulo').innerText = `Editar Mesa ${mesa.numero}`;
        document.getElementById('mesa-id').value = mesa.id;
        document.getElementById('mesa-numero').value = mesa.numero;
        document.getElementById('mesa-nombre').value = mesa.nombre || '';
        document.getElementById('mesa-capacidad').value = mesa.capacidad;
        document.getElementById('mesa-zona').value = mesa.zona || '';
        document.getElementById('mesa-mozo-id').value = mesa.mozo_id || '';
    }
}
window.editarMesa = editarMesa;

async function guardarMesa(e) {
    e.preventDefault();
    const id = document.getElementById('mesa-id').value;
    const data = {
        numero: parseInt(document.getElementById('mesa-numero').value),
        nombre: document.getElementById('mesa-nombre').value,
        capacidad: parseInt(document.getElementById('mesa-capacidad').value),
        zona: document.getElementById('mesa-zona').value,
        mozo_id: document.getElementById('mesa-mozo-id').value === "" ? null : parseInt(document.getElementById('mesa-mozo-id').value)
    };

    try {
        const idNegocio = appState.negocioActivoId;
        const url = id ? `/api/mesas/${id}` : `/api/negocios/${idNegocio}/mesas`;
        await sendData(url, data, id ? 'PUT' : 'POST');
        mostrarNotificacion('Mesa guardada', 'success');
        window.cerrarModalMesa();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function eliminarMesa(id) {
    if (confirm('¿Eliminar mesa?')) {
        try {
            await sendData(`/api/mesas/${id}`, {}, 'DELETE');
            mostrarNotificacion('Mesa eliminada', 'success');
            await cargarMesas();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }
}
window.eliminarMesa = eliminarMesa;

// --- GESTIÓN DE SECTORES ---

window.abrirModalSectores = () => {
    const modal = document.getElementById('modal-sectores');
    if (modal) {
        modal.style.display = 'flex';
        renderizarListaSectoresEdicion();
    }
};

window.cerrarModalSectores = () => {
    const modal = document.getElementById('modal-sectores');
    if (modal) modal.style.display = 'none';
};

function renderizarListaSectoresEdicion() {
    const container = document.getElementById('sectores-list-container');
    if (!container) return;

    let html = '';
    sectoresCache.forEach((s, index) => {
        html += `
            <div class="d-flex align-items-center gap-2 mb-2 p-2 border-bottom">
                <input type="text" class="form-control sector-edit-input" data-index="${index}" value="${s.nombre}">
                <button class="btn btn-sm btn-outline-danger" onclick="window.quitarFilaSector(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    if (sectoresCache.length === 0) {
        html = '<p class="text-muted text-center py-3">No hay sectores definidos.</p>';
    }
    
    container.innerHTML = html;
}

window.agregarFilaSector = () => {
    const input = document.getElementById('nuevo-sector-nombre');
    const nombre = input.value.trim();
    if (!nombre) return;

    sectoresCache.push({ nombre, orden: sectoresCache.length });
    input.value = '';
    renderizarListaSectoresEdicion();
};

window.quitarFilaSector = (index) => {
    sectoresCache.splice(index, 1);
    renderizarListaSectoresEdicion();
};

window.guardarSectores = async () => {
    // Actualizar nombres desde inputs
    const inputs = document.querySelectorAll('.sector-edit-input');
    inputs.forEach(inp => {
        const idx = parseInt(inp.dataset.index);
        sectoresCache[idx].nombre = inp.value.trim();
    });

    try {
        const idNegocio = appState.negocioActivoId;
        await sendData(`/api/negocios/${idNegocio}/sectores`, { sectores: sectoresCache }, 'POST');
        mostrarNotificacion('Sectores actualizados', 'success');
        window.cerrarModalSectores();
        await cargarSectores(); // Recargar oficial
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};

// --- CREACIÓN MASIVA ---

window.abrirModalBulkMesas = () => {
    const modal = document.getElementById('modal-bulk-mesas');
    if (modal) {
        modal.style.display = 'flex';
        actualizarSelectSectores();
    }
};

window.cerrarModalBulkMesas = () => {
    const modal = document.getElementById('modal-bulk-mesas');
    if (modal) modal.style.display = 'none';
};

window.ejecutarBulkCreate = async (e) => {
    e.preventDefault();
    const data = {
        desde: parseInt(document.getElementById('bulk-desde').value),
        hasta: parseInt(document.getElementById('bulk-hasta').value),
        capacidad: parseInt(document.getElementById('bulk-capacidad').value),
        zona: document.getElementById('bulk-zona').value
    };

    try {
        const idNegocio = appState.negocioActivoId;
        await sendData(`/api/negocios/${idNegocio}/mesas/bulk-create`, data, 'POST');
        mostrarNotificacion('Mesas creadas correctamente', 'success');
        window.cerrarModalBulkMesas();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};

// --- ACCIONES MASIVAS (API PATCH) ---

window.asignarSectorMasivo = async () => {
    if (seleccionados.size === 0) return;
    
    // Simplificar: Usar prompt para elegir el sector de la lista
    const sector = prompt("Ingrese el nombre del sector a asignar:\n" + sectoresCache.map(s => s.nombre).join(", "));
    if (!sector) return;

    if (!sectoresCache.find(s => s.nombre === sector)) {
        mostrarNotificacion("Sector no válido", "error");
        return;
    }

    try {
        const idNegocio = appState.negocioActivoId;
        await sendData(`/api/negocios/${idNegocio}/mesas/bulk`, {
            ids: Array.from(seleccionados),
            zona: sector
        }, 'PATCH');
        
        mostrarNotificacion(`Sector asignado a ${seleccionados.size} mesas`, 'success');
        deseleccionarTodasMesas();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};

window.asignarMozoMasivo = async () => {
    if (seleccionados.size === 0) return;

    const lista = mozosCache.map(m => `${m.id}: ${m.nombre}`).join("\n");
    const res = prompt("Ingrese el ID del mozo a asignar:\n" + lista);
    if (!res) return;

    const mozoId = parseInt(res);
    if (isNaN(mozoId) || !mozosCache.find(m => m.id === mozoId)) {
        mostrarNotificacion("ID de mozo no válido", "error");
        return;
    }

    try {
        const idNegocio = appState.negocioActivoId;
        await sendData(`/api/negocios/${idNegocio}/mesas/bulk`, {
            ids: Array.from(seleccionados),
            mozo_id: mozoId
        }, 'PATCH');
        
        mostrarNotificacion(`Mozo asignado a ${seleccionados.size} mesas`, 'success');
        deseleccionarTodasMesas();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};
