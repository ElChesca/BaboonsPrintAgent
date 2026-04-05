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

    const searchInput = document.getElementById('mozo-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = mozosCache.filter(m => 
                m.nombre.toLowerCase().includes(term) || 
                (m.email && m.email.toLowerCase().includes(term)) ||
                (m.zona_nombre && m.zona_nombre.toLowerCase().includes(term))
            );
            renderizarTabla(filtered);
        };
    }

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

function renderizarTabla(lista = null) {
    const tbody = document.querySelector('#tabla-mozos tbody');
    if (!tbody) return;

    const items = lista || mozosCache;
    tbody.innerHTML = '';

    const roleIcons = {
        'mozo': { icon: 'fa-user-tie', color: '#4f46e5', bg: '#eef2ff' },
        'cocinero': { icon: 'fa-utensils', color: '#10b981', bg: '#ecfdf5' },
        'barman': { icon: 'fa-cocktail', color: '#f59e0b', bg: '#fffbeb' },
        'adicionista': { icon: 'fa-file-invoice-dollar', color: '#6366f1', bg: '#f5f3ff' },
        'bachero': { icon: 'fa-sink', color: '#64748b', bg: '#f8fafc' }
    };

    items.forEach(v => {
        const rol = v.especialidad_resto || 'mozo';
        const roleConfig = roleIcons[rol] || roleIcons['mozo'];
        
        const tr = document.createElement('tr');
        tr.style.verticalAlign = 'middle';
        tr.innerHTML = `
            <td style="padding-left: 25px;">
                <div class="d-flex align-items-center">
                    <div class="avatar-circle me-3" style="background: ${roleConfig.bg}; color: ${roleConfig.color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                        <i class="fas ${roleConfig.icon}"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-dark">${v.nombre}</div>
                        <small class="text-muted" style="font-size: 0.75rem;">ID: #${String(v.id).padStart(4, '0')}</small>
                    </div>
                </div>
            </td>
            <td><i class="fas fa-phone-alt me-1 text-muted small"></i> ${v.telefono || '-'}</td>
            <td><code class="px-2 py-1 rounded bg-light text-secondary small">${v.email || '-'}</code></td>
            <td>
                <span class="badge rounded-pill bg-light text-dark border px-3">
                    <i class="fas fa-map-marker-alt me-1 text-primary small"></i> ${v.zona_nombre || 'General'}
                </span>
            </td>
            <td>
                <span class="badge px-3 py-2" style="background: ${roleConfig.bg}; color: ${roleConfig.color}; border: 1px solid ${roleConfig.color}20; text-transform: capitalize; font-weight: 600;">
                    <i class="fas ${roleConfig.icon} me-1"></i> ${rol}
                </span>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="status-dot ${v.activo ? 'bg-success' : 'bg-secondary'} me-2" style="width: 8px; height: 8px; border-radius: 50%;"></div>
                    <span class="small fw-500 ${v.activo ? 'text-success' : 'text-muted'}">${v.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
            </td>
            <td style="text-align: right; padding-right: 25px;">
                <button class="btn btn-icon-only btn-light-primary rounded-circle me-1" onclick="editarMozo(${v.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon-only btn-light-danger rounded-circle" onclick="eliminarMozo(${v.id})" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function abrirModalMozo() {
    const modal = document.getElementById('modal-mozo');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-mozo-titulo').innerText = 'Nuevo Empleado Restó';
        document.getElementById('form-mozo').reset();
        document.getElementById('mozo-id').value = '';
    }
}
window.abrirModalMozo = abrirModalMozo;

export function cerrarModalMozo() {
    const modal = document.getElementById('modal-mozo');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalMozo = cerrarModalMozo;

export function editarMozo(id) {
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
}
window.editarMozo = editarMozo;

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

export async function eliminarMozo(id) {
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
}
window.eliminarMozo = eliminarMozo;
