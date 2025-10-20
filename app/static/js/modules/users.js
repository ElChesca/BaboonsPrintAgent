// static/js/modules/users.js (Versión Ajustada)
import { fetchData, sendData } from '../api.js';
import { loadContent } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function poblarSelectorNegocios() {
    // ✨ APUNTA AL NUEVO ID DEL SELECTOR DE CREACIÓN ✨
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
            
            // ✨ APUNTA AL NUEVO ID DEL SELECTOR ✨
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
            // ✨ APUNTA AL NUEVO ID DEL CONTENEDOR DE CHECKBOXES ✨
            const checkedBusinesses = document.querySelectorAll('#edit-user-negocios-list input:checked');
            const negocios_ids = Array.from(checkedBusinesses).map(cb => parseInt(cb.value));
            const updatedUser = {
                rol: document.getElementById('edit-rol').value,
                negocios_ids: negocios_ids
            };

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
            userList.innerHTML += `<tr><td>${user.nombre}</td><td>${user.email}</td><td>${user.rol}</td><td>${businesses}</td><td><button class="btn-secondary" onclick="window.abrirModalEditarUsuario(${user.id})">Editar</button></td></tr>`;
        });
    } catch (error) {
        mostrarNotificacion('No tienes permiso para ver esta sección.', 'error');
        loadContent(null, 'static/dashboard.html');
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

        // ✨ APUNTA AL NUEVO ID DEL CONTENEDOR DE CHECKBOXES ✨
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
};