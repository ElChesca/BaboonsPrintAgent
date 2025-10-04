import { getAuthHeaders } from './auth.js';
import { loadContent } from '../main.js';

export function inicializarLogicaUsuarios() {
    const addUserForm = document.getElementById('form-add-user');
    if(addUserForm) addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUser = { nombre: e.target.nombre.value, email: e.target.email.value, password: e.target.password.value, rol: e.target.rol.value };
        await fetch('/api/usuarios', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newUser) });
        addUserForm.reset();
        cargarUsuarios();
    });
    const editUserForm = document.getElementById('form-edit-user');
    if(editUserForm) editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const checkedBusinesses = document.querySelectorAll('#business-checkbox-list input:checked');
        const negocios_ids = Array.from(checkedBusinesses).map(cb => parseInt(cb.value));
        const updatedUser = { rol: document.getElementById('edit-rol').value, negocios_ids: negocios_ids };
        await fetch(`/api/usuarios/${userId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(updatedUser) });
        document.getElementById('edit-user-modal').style.display = 'none';
        cargarUsuarios();
    });
    cargarUsuarios();
}

export async function cargarUsuarios() {
    const response = await fetch('/api/usuarios', { headers: getAuthHeaders() });
    if (!response.ok) {
        alert("No tienes permiso para ver esta sección.");
        loadContent(null, 'static/inventario.html', document.querySelector('nav a'));
        return;
    }
    const usuarios = await response.json();
    const userList = document.querySelector('#user-list tbody');
    if(!userList) return;
    userList.innerHTML = '';
    usuarios.forEach(user => {
        const businesses = user.negocios_asignados.map(b => `<span class="assigned-businesses">${b.nombre}</span>`).join(' ') || 'Ninguno';
        userList.innerHTML += `<tr><td>${user.nombre}</td><td>${user.email}</td><td>${user.rol}</td><td>${businesses}</td><td><button onclick="abrirModalEditarUsuario(${user.id})">Editar</button></td></tr>`;
    });
}

export async function abrirModalEditarUsuario(userId) {
    const [negociosResponse, usuariosResponse] = await Promise.all([
        fetch('/api/negocios', { headers: getAuthHeaders() }),
        fetch('/api/usuarios', { headers: getAuthHeaders() })
    ]);
    const todosLosNegocios = await negociosResponse.json();
    const todosLosUsuarios = await usuariosResponse.json();
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
    modal.style.display = 'block';
}