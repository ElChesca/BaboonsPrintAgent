/* app/static/js/modules/mozos.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let mozosCache = [];

export async function inicializarLogicaMozos() {
    console.log("🤵 Módulo de Mozos Inicializado");

    // Bind UI
    const btnNuevo = document.getElementById('btn-nuevo-mozo');
    const btnCerrar = document.getElementById('btn-cerrar-modal-mozo');
    const btnCancelar = document.getElementById('btn-cancelar-mozo');
    const form = document.getElementById('form-mozo');

    if (btnNuevo) btnNuevo.onclick = () => window.abrirModalMozo();
    if (btnCerrar) btnCerrar.onclick = () => window.cerrarModalMozo();
    if (btnCancelar) btnCancelar.onclick = () => window.cerrarModalMozo();
    if (form) form.onsubmit = guardarMozo;

    await cargarMozos();
}

async function cargarMozos() {
    const loading = document.getElementById('loading-mozos');
    const noMozos = document.getElementById('no-mozos');
    const tabla = document.getElementById('tabla-mozos');

    if (loading) loading.style.display = 'block';
    if (noMozos) noMozos.style.display = 'none';
    if (tabla) tabla.style.display = 'none';

    try {
        const idNegocio = appState.negocioActivoId;
        // Reutilizamos el endpoint de vendedores
        mozosCache = await fetchData(`/api/negocios/${idNegocio}/vendedores`);

        if (loading) loading.style.display = 'none';

        if (mozosCache.length === 0) {
            if (noMozos) noMozos.style.display = 'block';
        } else {
            if (tabla) tabla.style.display = 'table';
            renderizarTabla();
        }
    } catch (error) {
        console.error(error);
        if (loading) loading.style.display = 'none';
        mostrarNotificacion('Error al cargar mozos', 'error');
    }
}

function renderizarTabla() {
    const tbody = document.querySelector('#tabla-mozos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    mozosCache.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding-left: 25px;"><strong>${v.nombre}</strong></td>
            <td>${v.telefono || '-'}</td>
            <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${v.email || '-'}</code></td>
            <td><span class="badge bg-light text-dark border">${v.zona_nombre || 'General'}</span></td>
            <td><span class="badge bg-info text-white" style="text-transform: capitalize;">${v.especialidad_resto || 'mozo'}</span></td>
            <td>
                <span class="badge ${v.activo ? 'bg-success' : 'bg-secondary'}">
                    ${v.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td style="text-align: right; padding-right: 25px;">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarMozo(${v.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarMozo(${v.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.abrirModalMozo = () => {
    const modal = document.getElementById('modal-mozo');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-mozo-titulo').innerText = 'Nuevo Empleado Restó';
        document.getElementById('form-mozo').reset();
        document.getElementById('mozo-id').value = '';
    }
};

window.cerrarModalMozo = () => {
    const modal = document.getElementById('modal-mozo');
    if (modal) modal.style.display = 'none';
};

window.editarMozo = (id) => {
    const mozo = mozosCache.find(m => m.id === id);
    if (!mozo) return;

    const modal = document.getElementById('modal-mozo');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-mozo-titulo').innerText = 'Editando Empleado';
        document.getElementById('mozo-id').value = mozo.id;
        document.getElementById('mozo-nombre').value = mozo.nombre;
        document.getElementById('mozo-telefono').value = mozo.telefono || '';
        document.getElementById('mozo-email').value = mozo.email || '';
        document.getElementById('mozo-sector').value = mozo.zona_nombre || 'Salon';
        document.getElementById('mozo-rol-resto').value = mozo.especialidad_resto || 'mozo';
        document.getElementById('mozo-activo').checked = !!mozo.activo;
        document.getElementById('mozo-password').value = '';
    }
};

async function guardarMozo(e) {
    e.preventDefault();
    const id = document.getElementById('mozo-id').value;
    const data = {
        nombre: document.getElementById('mozo-nombre').value,
        telefono: document.getElementById('mozo-telefono').value,
        email: document.getElementById('mozo-email').value,
        zona_nombre: document.getElementById('mozo-sector').value, // Reutilizamos zona_nombre para el sector
        especialidad_resto: document.getElementById('mozo-rol-resto').value,
        activo: document.getElementById('mozo-activo').checked,
        password: document.getElementById('mozo-password').value
    };

    const idNegocio = appState.negocioActivoId;
    const url = id ? `/api/vendedores/${id}` : `/api/negocios/${idNegocio}/vendedores`;
    const method = id ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(id ? 'Empleado actualizado' : 'Empleado creado con éxito', 'success');
        cerrarModalMozo();
        await cargarMozos();
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al guardar mozo', 'error');
    }
}

window.eliminarMozo = async (id) => {
    const result = await Swal.fire({
        title: '¿Eliminar personal?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/vendedores/${id}`, {}, 'DELETE');
            mostrarNotificacion('Personal eliminado', 'success');
            await cargarMozos();
        } catch (error) {
            mostrarNotificacion(error.message || 'No se pudo eliminar', 'error');
        }
    }
};
