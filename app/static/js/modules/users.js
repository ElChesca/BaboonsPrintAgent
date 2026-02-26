// static/js/modules/users.js (Versión Ajustada Completa)
import { fetchData, sendData } from '../api.js';
import { loadContent } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function poblarSelectorNegocios() {
    const select = document.getElementById('create-user-negocios');
    if (!select) return;

    try {
        const negocios = await fetchData('/api/negocios');
        select.innerHTML = '';
        if (negocios.length === 0) {
            select.innerHTML = '<option disabled>No hay negocios para asignar.</option>';
        }
        negocios.forEach(n => {
            select.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los negocios.', 'error');
    }
}

export function inicializarLogicaUsuarios() {
    const addUserForm = document.getElementById('form-add-user');
    const editUserForm = document.getElementById('form-edit-user');
    const closeModalBtn = document.getElementById('close-edit-user-modal');

    if (closeModalBtn) {
        closeModalBtn.onclick = () => document.getElementById('edit-user-modal').style.display = 'none';
    }

    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const negocios_ids = Array.from(document.getElementById('create-user-negocios').selectedOptions).map(option => option.value);

            const newUser = {
                nombre: e.target.nombre.value,
                email: e.target.email.value,
                password: e.target.password.value,
                rol: e.target.rol.value,
                negocios_ids: negocios_ids
            };

            try {
                await sendData('/api/usuarios', newUser, 'POST');
                addUserForm.reset();
                await cargarUsuarios();
                mostrarNotificacion('Usuario creado con éxito.', 'success');
            } catch (error) {
                mostrarNotificacion(error.message, 'error');
            }
        });
    }

    if (editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            const checkedBusinesses = document.querySelectorAll('#edit-user-negocios-list input:checked');
            const negocios_ids = Array.from(checkedBusinesses).map(cb => parseInt(cb.value));

            const updatedUser = {
                rol: document.getElementById('edit-rol').value,
                negocios_ids: negocios_ids
            };

            // Si se ingresó una contraseña, enviarla
            const newPassword = document.getElementById('edit-password').value;
            if (newPassword) {
                updatedUser.password = newPassword;
            }

            try {
                await sendData(`/api/usuarios/${userId}`, updatedUser, 'PUT');
                document.getElementById('edit-user-modal').style.display = 'none';
                await cargarUsuarios();
                mostrarNotificacion('Usuario actualizado con éxito.', 'success');
            } catch (error) {
                mostrarNotificacion(error.message, 'error');
            }
        });
    }

    poblarSelectorNegocios();
    cargarUsuarios();
}

export async function cargarUsuarios() {
    try {
        const usuarios = await fetchData('/api/usuarios');
        const userList = document.querySelector('#user-list tbody');
        if (!userList) return;
        userList.innerHTML = '';
        usuarios.forEach(user => {
            const businesses = user.negocios_asignados.map(b => `<span class="assigned-businesses">${b.nombre}</span>`).join(' ') || 'Ninguno';
            const statusLabel = user.activo ?
                '<span style="color: green; font-weight: bold;">Activo</span>' :
                '<span style="color: red; font-weight: bold;">Inactivo</span>';
            const actionBtn = user.activo ?
                `<button class="btn-secondary" style="background-color: #f44336; color: white;" onclick="window.toggleUserActive(${user.id}, false)">Desactivar</button>` :
                `<button class="btn-secondary" style="background-color: #4CAF50; color: white;" onclick="window.toggleUserActive(${user.id}, true)">Activar</button>`;

            const row = document.createElement('tr');
            if (!user.activo) row.style.opacity = '0.6';

            row.innerHTML = `
                <td>${user.nombre}</td>
                <td>${user.email}</td>
                <td>${user.rol}</td>
                <td>${businesses}</td>
                <td>${statusLabel}</td>
                <td style="display: flex; gap: 5px;">
                    <button class="btn-secondary" onclick="window.abrirModalEditarUsuario(${user.id})">Editar</button>
                    ${actionBtn}
                </td>
            `;
            userList.appendChild(row);
        });
    } catch (error) {
        mostrarNotificacion('No tienes permiso para ver esta sección.', 'error');
        loadContent(null, 'static/dashboard.html');
    }
}

export async function toggleUserActive(userId, currentStatus) {
    if (!confirm(`¿Estás seguro de que deseas ${currentStatus ? 'activar' : 'desactivar'} a este usuario?`)) return;
    try {
        await sendData(`/api/usuarios/${userId}`, {}, 'DELETE');
        await cargarUsuarios();
        mostrarNotificacion(`Usuario ${currentStatus ? 'activado' : 'desactivado'} correctamente.`, 'success');
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export async function abrirModalEditarUsuario(userId) {
    try {
        const [todosLosNegocios, todosLosUsuarios] = await Promise.all([
            fetchData('/api/negocios'),
            fetchData('/api/usuarios')
        ]);

        const usuario = todosLosUsuarios.find(u => u.id === userId);
        if (!usuario) return;

        const modal = document.getElementById('edit-user-modal');
        document.getElementById('edit-user-id').value = usuario.id;
        document.getElementById('edit-user-name').textContent = usuario.nombre;
        document.getElementById('edit-rol').value = usuario.rol;
        document.getElementById('edit-password').value = ''; // Limpiar campo pass

        const btnConfigPerms = document.getElementById('btn-config-vendedor-perms');
        if (btnConfigPerms) {
            btnConfigPerms.style.display = usuario.rol === 'vendedor' ? 'block' : 'none';
            btnConfigPerms.onclick = () => abrirConfigPermisosVendedor();
        }

        document.getElementById('edit-rol').onchange = (e) => {
            if (btnConfigPerms) {
                btnConfigPerms.style.display = e.target.value === 'vendedor' ? 'block' : 'none';
            }
        };

        const checkboxList = document.getElementById('edit-user-negocios-list');
        checkboxList.innerHTML = '';
        const negociosAsignadosIds = new Set(usuario.negocios_asignados.map(b => b.id));

        todosLosNegocios.forEach(negocio => {
            const isChecked = negociosAsignadosIds.has(negocio.id) ? 'checked' : '';
            checkboxList.innerHTML += `<label><input type="checkbox" value="${negocio.id}" ${isChecked}> ${negocio.nombre}</label>`;
        });
        modal.style.display = 'flex';
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

async function abrirConfigPermisosVendedor() {
    const negocioId = document.querySelector('#edit-user-negocios-list input:checked')?.value;
    if (!negocioId) {
        mostrarNotificacion('El usuario debe estar asignado a al menos un negocio para configurar sus permisos.', 'warning');
        return;
    }

    const modal = document.getElementById('config-perms-vendedor-modal');
    const container = document.getElementById('modulos-permisos-list');
    const btnSave = document.getElementById('btn-save-vendedor-perms');
    const btnClose = document.getElementById('close-config-perms-modal');

    if (!modal || !container || !btnSave || !btnClose) return;

    modal.style.display = 'flex';
    container.innerHTML = '<p style="text-align: center;">Cargando módulos...</p>';

    try {
        const [modulos, permsActuales] = await Promise.all([
            fetchData('/api/admin/modules'),
            fetchData(`/api/negocios/${negocioId}/permisos-rol/vendedor`)
        ]);

        container.innerHTML = '';
        const setPerms = new Set(permsActuales || []);

        modulos.forEach(m => {
            const isChecked = setPerms.has(m.code) ? 'checked' : '';
            const row = document.createElement('label');
            row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '10px';
            row.style.padding = '8px'; row.style.borderBottom = '1px solid #f0f0f0'; row.style.cursor = 'pointer';

            row.innerHTML = `
                <input type="checkbox" value="${m.code}" ${isChecked}>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: #333;">${m.name}</span>
                    <small style="color: #888; font-size: 11px;">${m.category || 'General'}</small>
                </div>
            `;
            container.appendChild(row);
        });

        btnSave.onclick = async () => {
            const selectedModules = Array.from(container.querySelectorAll('input:checked')).map(i => i.value);
            try {
                await sendData(`/api/negocios/${negocioId}/permisos-rol/vendedor`, { modules: selectedModules }, 'POST');
                mostrarNotificacion('Permisos guardados.', 'success');
                modal.style.display = 'none';
            } catch (error) {
                mostrarNotificacion('Error al guardar permisos: ' + error.message, 'error');
            }
        };

        btnClose.onclick = () => { modal.style.display = 'none'; };
    } catch (error) {
        mostrarNotificacion('Error al cargar módulos: ' + error.message, 'error');
        modal.style.display = 'none';
    }
}

// Ventanas globales
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.toggleUserActive = toggleUserActive;