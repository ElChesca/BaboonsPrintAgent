    // app/static/js/modules/proveedores.js
    import { fetchData } from '../api.js';
    import { appState } from '../main.js';
    import { mostrarNotificacion } from './notifications.js';

    let form, tituloForm, idInput, nombreInput, contactoInput, telefonoInput, emailInput, btnCancelar;
    let proveedoresCache = [];

    async function cargarProveedores() {
        try {
            proveedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
            renderizarTabla();
        } catch (error) {
            mostrarNotificacion('No se pudieron cargar los proveedores.', 'error');
        }
    }

    function renderizarTabla() {
        const tbody = document.querySelector('#tabla-proveedores tbody');
        tbody.innerHTML = '';
        proveedoresCache.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${p.contacto || '-'}</td>
                    <td>${p.telefono || '-'}</td>
                    <td>${p.email || '-'}</td>
                    <td>
                        <button class="btn-edit btn-small" onclick="editarProveedor(${p.id})">Editar</button>
                        <button class="btn-delete btn-small" onclick="borrarProveedor(${p.id})">Borrar</button>
                    </td>
                </tr>
            `;
        });
    }

    function resetFormulario() {
        tituloForm.textContent = 'Añadir Nuevo Proveedor';
        form.reset();
        idInput.value = '';
        btnCancelar.style.display = 'none';
    }

    async function guardarProveedor(e) {
        e.preventDefault();
        const id = idInput.value;
        const data = {
            nombre: nombreInput.value,
            contacto: contactoInput.value,
            telefono: telefonoInput.value,
            email: emailInput.value
        };

        const esEdicion = !!id;
        const url = esEdicion ? `/api/proveedores/${id}` : `/api/negocios/${appState.negocioActivoId}/proveedores`;
        const method = esEdicion ? 'PUT' : 'POST';

        try {
            await fetchData(url, { method, body: JSON.stringify(data) });
            mostrarNotificacion(`Proveedor ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
            resetFormulario();
            cargarProveedores();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }

    export function editarProveedor(id) {
        const proveedor = proveedoresCache.find(p => p.id === id);
        if (!proveedor) return;

        tituloForm.textContent = 'Editar Proveedor';
        idInput.value = proveedor.id;
        nombreInput.value = proveedor.nombre;
        contactoInput.value = proveedor.contacto;
        telefonoInput.value = proveedor.telefono;
        emailInput.value = proveedor.email;
        btnCancelar.style.display = 'inline-block';
        window.scrollTo(0, 0);
    }

    export async function borrarProveedor(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) return;
        try {
            await fetchData(`/api/proveedores/${id}`, { method: 'DELETE' });
            mostrarNotificacion('Proveedor eliminado con éxito.', 'success');
            cargarProveedores();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }

    export function inicializarLogicaProveedores() {
        form = document.getElementById('form-proveedor');
        if (!form) return;

        tituloForm = document.getElementById('form-proveedor-titulo');
        idInput = document.getElementById('proveedor-id');
        nombreInput = document.getElementById('proveedor-nombre');
        contactoInput = document.getElementById('proveedor-contacto');
        telefonoInput = document.getElementById('proveedor-telefono');
        emailInput = document.getElementById('proveedor-email');
        btnCancelar = document.getElementById('btn-cancelar-edicion');

        form.addEventListener('submit', guardarProveedor);
        btnCancelar.addEventListener('click', resetFormulario);

        cargarProveedores();
    }