// static/js/modules/users.js
import { fetchData, sendData } from '../api.js'; // ✨ Usamos las funciones centralizadas
import { loadContent } from '../main.js';

// ✨ --- NUEVA FUNCIÓN --- ✨
// Carga todos los negocios disponibles en el selector del formulario para crear usuarios.
async function poblarSelectorNegocios() {
    const select = document.getElementById('user-negocios');
    if (!select) return;

    try {
        // Como admin, esta ruta nos trae TODOS los negocios.
        const negocios = await fetchData('/api/negocios'); 
        select.innerHTML = '';
        if (negocios.length === 0) {
            select.innerHTML = '<option disabled>No hay negocios para asignar. Primero crea uno.</option>';
        }
        negocios.forEach(n => {
            select.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los negocios para la asignación.', 'error');
    }
}

export function inicializarLogicaUsuarios() {
    const addUserForm = document.getElementById('form-add-user');
    const editUserForm = document.getElementById('form-edit-user');

    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // ✨ --- MODIFICADO --- ✨
            // Obtenemos los IDs de los negocios seleccionados del nuevo selector múltiple
            const negocios_ids = Array.from(document.getElementById('user-negocios').selectedOptions).map(option => option.value);

            const newUser = {
                nombre: e.target.nombre.value,
                email: e.target.email.value,
                password: e.target.password.value,
                rol: e.target.rol.value,
                negocios_ids: negocios_ids // Añadimos la lista al objeto que se envía
            };

            try {
                // Usamos sendData para un manejo de errores consistente
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
            const checkedBusinesses = document.querySelectorAll('#business-checkbox-list input:checked');
            const negocios_ids = Array.from(checkedBusinesses).map(cb => parseInt(cb.value));
            const updatedUser = {
                rol: document.getElementById('edit-rol').value,
                negocios_ids: negocios_ids
            };

            try {
                // Usamos sendData también para la edición
                await sendData(`/api/usuarios/${userId}`, updatedUser, 'PUT');
                document.getElementById('edit-user-modal').style.display = 'none';
                await cargarUsuarios();
                mostrarNotificacion('Usuario actualizado con éxito.', 'success');
            } catch (error) {
                mostrarNotificacion(error.message, 'error');
            }
        });
    }

    // ✨ Llamamos a la nueva función para que el selector se llene al cargar la página
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

// ✨ Hacemos la función global a través de window para que el onclick funcione
window.abrirModalEditarUsuario = async (userId) => {
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
        const checkboxList = document.getElementById('business-checkbox-list');
        checkboxList.innerHTML = '';
        const negociosAsignadosIds = new Set(usuario.negocios_asignados.map(b => b.id));
        
        todosLosNegocios.forEach(negocio => {
            const isChecked = negociosAsignadosIds.has(negocio.id) ? 'checked' : '';
            checkboxList.innerHTML += `<label><input type="checkbox" value="${negocio.id}" ${isChecked}> ${negocio.nombre}</label>`;
        });
        modal.style.display = 'flex'; // Usamos flex para centrarlo
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};