/* app/static/js/modules/mesas.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let mesasCache = [];
let mozosCache = [];
let seleccionados = new Set();

export async function inicializarMesas() {
    console.log("🚀 Inicializando Módulo de Mesas...");

    // Bind UI Events
    const btnNueva = document.getElementById('btn-nueva-mesa');
    const btnNuevaEmpty = document.getElementById('btn-nueva-mesa-empty');
    const btnCerrar = document.getElementById('btn-cerrar-modal-mesa');
    const btnCancelar = document.getElementById('btn-cancelar-mesa');
    const form = document.getElementById('form-mesa');

    if (form) form.onsubmit = guardarMesa;

    if (btnNueva) {
        console.log("✅ Botón Nueva Mesa encontrado");
        btnNueva.onclick = (e) => {
            e.preventDefault();
            window.abrirModalMesa();
        };
    } else {
        console.warn("⚠️ Botón Nueva Mesa NO encontrado en el DOM");
    }

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

async function cargarMesas() {
    const loading = document.getElementById('loading-mesas');
    const noMesas = document.getElementById('no-mesas');
    const tabla = document.getElementById('tabla-mesas');

    if (loading) loading.style.display = 'block';
    if (noMesas) noMesas.style.display = 'none';
    if (tabla) tabla.style.display = 'none';

    try {
        const idNegocio = appState.negocioActivoId;
        mesasCache = await fetchData(`/api/negocios/${idNegocio}/mesas`);

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
    mesasCache.forEach(m => {
        const tr = document.createElement('tr');
        const isSelected = seleccionados.has(m.id);

        // Estado Badge
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

        tr.innerHTML = `
            <td style="padding-left: 20px;">
                <input type="checkbox" class="form-check-input select-mesa" 
                    data-id="${m.id}" ${isSelected ? 'checked' : ''} 
                    onchange="toggleSeleccionMesa(${m.id}, this.checked)">
            </td>
            <td><strong>Mesa ${m.numero}</strong></td>
            <td>${m.nombre || '-'}</td>
            <td><i class="fas fa-users me-1 text-muted"></i> ${m.capacidad} pers.</td>
            <td><span class="badge bg-light text-dark border" style="font-weight: 500;">${m.zona || 'Salon'}</span></td>
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
    
    // Actualizar select-all si corresponde
    const selectAll = document.getElementById('select-all-mesas');
    if (selectAll) {
        selectAll.checked = (seleccionados.size === mesasCache.length && mesasCache.length > 0);
    }
    
    actualizarBarraMasivaMesas();
}
window.toggleSeleccionMesa = toggleSeleccionMesa;

export function actualizarBarraMasivaMesas() {
    const bar = document.getElementById('bulk-actions-bar-mesas');
    const label = document.getElementById('selected-mesas-count');
    
    if (seleccionados.size > 0) {
        if (bar) bar.style.display = 'flex';
        if (label) label.innerText = seleccionados.size;
    } else {
        if (bar) bar.style.display = 'none';
    }
}

export function deseleccionarTodasMesas() {
    seleccionados.clear();
    const selectAll = document.getElementById('select-all-mesas');
    if (selectAll) selectAll.checked = false;
    
    const checkboxes = document.querySelectorAll('.select-mesa');
    checkboxes.forEach(cb => cb.checked = false);
    
    actualizarBarraMasivaMesas();
}
window.deseleccionarTodasMesas = deseleccionarTodasMesas;

export async function asignarSectorMasivo() {
    const { value: zona } = await Swal.fire({
        title: 'Asignar Sector',
        input: 'select',
        inputOptions: {
            'Salon': 'Salón Principal',
            'Terraza': 'Terraza / Exterior',
            'VIP': 'Sector VIP',
            'Barra': 'Barra',
            'Patio': 'Patio',
            'Entrepiso': 'Entrepiso'
        },
        inputPlaceholder: 'Seleccione un sector',
        showCancelButton: true,
        confirmButtonText: 'Aplicar a Selección',
        cancelButtonText: 'Cancelar'
    });

    if (zona) {
        await ejecutarAccionMasiva({ zona });
    }
}
window.asignarSectorMasivo = asignarSectorMasivo;

export async function asignarMozoMasivo() {
    const options = { "": "Sin mozo (Limpiar)" };
    mozosCache.forEach(m => options[m.id] = m.nombre);

    const { value: mozo_id } = await Swal.fire({
        title: 'Asignar Mozo Responsable',
        input: 'select',
        inputOptions: options,
        inputPlaceholder: 'Seleccione un mozo',
        showCancelButton: true,
        confirmButtonText: 'Aplicar a Selección',
        cancelButtonText: 'Cancelar'
    });

    if (mozo_id !== undefined) {
        await ejecutarAccionMasiva({ mozo_id: mozo_id === "" ? "" : parseInt(mozo_id) });
    }
}
window.asignarMozoMasivo = asignarMozoMasivo;

async function ejecutarAccionMasiva(data) {
    try {
        const idNegocio = appState.negocioActivoId;
        const payload = {
            ids: Array.from(seleccionados),
            ...data
        };
        
        await sendData(`/api/negocios/${idNegocio}/mesas/bulk`, payload, 'PATCH');
        mostrarNotificacion('Cambios aplicados correctamente', 'success');
        
        deseleccionarTodasMesas();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al aplicar cambios masivos', 'error');
    }
}

// Ventanas globales expuestas para botones onclick (en tabla dinámica)
export function abrirModalMesa() {
    console.log("🎯 abriendo modal mesa...");
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
        document.getElementById('mesa-zona').value = mesa.zona || 'Salon';
        document.getElementById('mesa-mozo-id').value = mesa.mozo_id || '';
    }
}
window.editarMesa = editarMesa;

async function guardarMesa(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.disabled = true;

    const id = document.getElementById('mesa-id').value;
    const data = {
        numero: parseInt(document.getElementById('mesa-numero').value),
        nombre: document.getElementById('mesa-nombre').value,
        capacidad: parseInt(document.getElementById('mesa-capacidad').value),
        zona: document.getElementById('mesa-zona').value,
        mozo_id: document.getElementById('mesa-mozo-id').value === "" ? null : parseInt(document.getElementById('mesa-mozo-id').value)
    };

    const idNegocio = appState.negocioActivoId;
    const url = id ? `/api/mesas/${id}` : `/api/negocios/${idNegocio}/mesas`;
    const method = id ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(id ? 'Mesa actualizada correctamente' : 'Mesa creada con éxito', 'success');
        cerrarModalMesa();
        await cargarMesas();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al guardar mesa', 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

export async function eliminarMesa(id) {
    const result = await Swal.fire({
        title: '¿Eliminar mesa?',
        text: 'Si la mesa tiene pedidos activos no podrá ser eliminada.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/mesas/${id}`, {}, 'DELETE');
            mostrarNotificacion('Mesa eliminada correctamente', 'success');
            await cargarMesas();
        } catch (error) {
            mostrarNotificacion(error.message || 'No se pudo eliminar la mesa', 'error');
        }
    }
}
window.eliminarMesa = eliminarMesa;
