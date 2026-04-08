import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let empleadosCache = [];
let unlinkedEntities = { usuarios: [], vendedores: [] };

export async function inicializarLogicaEmpleados() {
    console.log("Inicializando lógica de Empleados...");

    // Función Global Infalible para Pestañas (Simple y Efectiva)
    window.cambiarTabEmpleado = function(targetId, el) {
        console.log("Cambio de pestaña solicitado:", targetId);
        
        // 1. UI: Botones (Resaltado visual)
        const allTabs = document.querySelectorAll('#empleadoTabs .nav-link');
        allTabs.forEach(t => t.classList.remove('active'));
        el.classList.add('active');

        // 2. UI: Contenidos (Mostrar/Ocultar)
        document.querySelectorAll('.tab-content').forEach(c => {
            c.style.display = 'none';
            c.classList.remove('active', 'show');
        });
        
        const targetElement = document.getElementById(`tab-${targetId}`);
        if (targetElement) {
            targetElement.style.display = 'block';
            setTimeout(() => targetElement.classList.add('active', 'show'), 10);
        }
    };

    // Bind Form Submit
    const form = document.getElementById('form-empleado');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await guardarEmpleado();
        };
    }

    // Role Change Hint
    const rolSelect = document.getElementById('rol');
    if (rolSelect) {
        rolSelect.addEventListener('change', (e) => {
            const help = document.getElementById('rol-help');
            if (e.target.value === 'vendedor') {
                help.innerText = "ℹ️ Se creará automáticamente un usuario Vendedor asociado.";
            } else {
                help.innerText = "";
            }
        });
    }

    // Flag para cachear entidades no vinculadas (Moved to global)

    // Bind Toggle Vinculación
    const checkVincular = document.getElementById('check-vincular');
    if (checkVincular) {
        checkVincular.addEventListener('change', async (e) => {
            const container = document.getElementById('container-vinculacion');
            const select = document.getElementById('select-vinculacion');

            if (e.target.checked) {
                container.style.display = 'block';
                await cargarEntidadesNoVinculadas();
            } else {
                container.style.display = 'none';
                select.value = "";
                // Limpiar campos si se desmarca? Mejor no, por si ya escribió algo.
            }
        });
    }

    // Bind Select Vinculación Change
    const selectVinculacion = document.getElementById('select-vinculacion');
    if (selectVinculacion) {
        selectVinculacion.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) return;

            const [type, id] = val.split('-'); // e.g. 'user-123' or 'seller-45'

            let entity = null;
            if (type === 'user') {
                entity = unlinkedEntities.usuarios.find(u => u.id == id);
            } else if (type === 'seller') {
                entity = unlinkedEntities.vendedores.find(v => v.id == id);
            }

            if (entity) {
                // Auto-fill fields
                if (entity.nombre) {
                    // Intentar separar nombre y apellido si viene junto
                    const parts = entity.nombre.split(' ');
                    if (parts.length > 1) {
                        document.getElementById('apellido').value = parts.pop();
                        document.getElementById('nombre').value = parts.join(' ');
                    } else {
                        document.getElementById('nombre').value = entity.nombre;
                    }
                }
                if (entity.email) document.getElementById('email').value = entity.email;
                if (entity.telefono) document.getElementById('telefono').value = entity.telefono;

                // Si es usuario, pre-setear rol si coincide
                if (type === 'user' && entity.rol) {
                    const rolSelect = document.getElementById('rol');
                    // Mapeo simple de roles
                    if (['admin', 'superadmin', 'encargado'].includes(entity.rol)) {
                        rolSelect.value = 'administrativo';
                    } else if (['chofer', 'vendedor', 'deposito'].includes(entity.rol)) {
                        rolSelect.value = entity.rol;
                    }
                }
            }
        });
    }

    await cargarEmpleados();

    // Expose Global Functions
    window.cargarEmpleados = cargarEmpleados;
    window.abrirModalEmpleado = abrirModalEmpleado;
    window.cerrarModalEmpleado = cerrarModalEmpleado;
    window.editarEmpleado = editarEmpleado;
    window.toggleActivoEmpleado = toggleActivoEmpleado;
    window.subirDocumento = subirDocumento;
    window.borrarDocumento = borrarDocumento;
}

async function cargarEntidadesNoVinculadas() {
    const select = document.getElementById('select-vinculacion');
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
        const data = await fetchData(`/api/empleados/unlinked?negocio_id=${appState.negocioActivoId}`);
        unlinkedEntities = data;

        select.innerHTML = '<option value="">Seleccione...</option>';

        // Populate options based on selected Role? Or show all formatted?
        // Vamos a mostrar todo agrupado

        if (data.usuarios && data.usuarios.length > 0) {
            const groupUser = document.createElement('optgroup');
            groupUser.label = "Usuarios del Sistema";
            data.usuarios.forEach(u => {
                const opt = document.createElement('option');
                opt.value = `user-${u.id}`;
                opt.innerText = `${u.nombre} (${u.email || 'Sin Email'}) - Rol: ${u.rol}`;
                groupUser.appendChild(opt);
            });
            select.appendChild(groupUser);
        }

        if (data.vendedores && data.vendedores.length > 0) {
            const groupSeller = document.createElement('optgroup');
            groupSeller.label = "Vendedores (H. de Ruta)";
            data.vendedores.forEach(v => {
                const opt = document.createElement('option');
                opt.value = `seller-${v.id}`;
                opt.innerText = `${v.nombre} (${v.email || 'Sin Email'})`;
                groupSeller.appendChild(opt);
            });
            select.appendChild(groupSeller);
        }

    } catch (error) {
        console.error("Error loading unlinked entities:", error);
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function cargarEmpleados() {
    const rol = document.getElementById('filtro-rol').value;
    const soloActivos = document.getElementById('filtro-activos').checked;

    let url = `/api/empleados?negocio_id=${appState.negocioActivoId}`;
    if (rol) url += `&rol=${rol}`;
    if (soloActivos) url += `&activo=true`;

    try {
        const empleados = await fetchData(url);
        empleadosCache = empleados;
        renderEmpleados(empleados);
    } catch (error) {
        console.error("Error cargando empleados:", error);
        mostrarNotificacion("Error al cargar lista de empleados", "error");
    }
}

function renderEmpleados(empleados) {
    const tbody = document.getElementById('lista-empleados');
    tbody.innerHTML = '';

    if (!empleados || empleados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">No se encontraron empleados.</td></tr>';
        return;
    }

    empleados.forEach(emp => {
        const tr = document.createElement('tr');
        const rolKey = (emp.rol || "").toLowerCase();
        const badgeClass = {
            'chofer': 'bg-primary',
            'vendedor': 'bg-success',
            'administrativo': 'bg-info',
            'deposito': 'bg-warning text-dark',
            'adicionista': 'bg-teal',
            'mozo': 'bg-indigo',
            'cocinero': 'bg-orange',
            'chef': 'bg-danger',
            'bartender': 'bg-purple',
            'bachero': 'bg-secondary',
            'maitre': 'bg-dark'
        }[rolKey] || 'bg-secondary';

        const rolText = (emp.rol || "Sin Puesto").toUpperCase();

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${emp.nombre} ${emp.apellido}</div>
                <small class="text-muted">${emp.dni || '-'}</small>
            </td>
            <td><span class="badge ${badgeClass}">${rolText}</span></td>
            <td>${emp.telefono || '-'}</td>
            <td>${emp.email || '-'}</td>
            <td>
                <span class="badge ${emp.activo ? 'bg-success' : 'bg-danger'}">
                    ${emp.activo ? 'ACTIVO' : 'INACTIVO'}
                </span>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarEmpleado(${emp.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm ${emp.activo ? 'btn-outline-danger' : 'btn-outline-success'}" 
                        onclick="toggleActivoEmpleado(${emp.id}, ${!emp.activo})" 
                        title="${emp.activo ? 'Desactivar' : 'Activar'}">
                    <i class="fas ${emp.activo ? 'fa-user-slash' : 'fa-user-check'}"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalEmpleado(id = null) {
    console.log("Abriendo modal empleado. ID:", id);
    const modal = document.getElementById('modal-empleado');
    const form = document.getElementById('form-empleado');
    
    if (!modal) {
        console.error("Error: No se encontró el elemento 'modal-empleado'");
        return;
    }

    // Reset Tabs Premium
    const modalTabs = document.querySelectorAll('#empleadoTabs .nav-link');
    modalTabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    
    const firstTab = document.querySelector('#empleadoTabs [data-tab="datos-personales"]');
    if (firstTab) firstTab.classList.add('active');
    document.getElementById('tab-datos-personales').style.display = 'block';

    // Reset Linking UI
    const checkVincular = document.getElementById('check-vincular');
    const containerVinculacion = document.getElementById('container-vinculacion');
    if (checkVincular) {
        checkVincular.checked = false;
        checkVincular.disabled = false; // Enable by default
        containerVinculacion.style.display = 'none';
        document.getElementById('select-vinculacion').value = "";
    }

    if (id) {
        // Modo Edición (La carga de datos se hace en editarEmpleado)
        document.getElementById('modal-titulo').innerText = "Editar Empleado";
        if (checkVincular) {
            checkVincular.disabled = false;
        }
    } else {
        // Modo Creación
        form.reset();
        document.getElementById('empleado-id').value = '';
        document.getElementById('activo').checked = true;
        document.getElementById('modal-titulo').innerText = "Nuevo Empleado";
        const rHelp = document.getElementById('rol-help');
        if (rHelp) rHelp.innerText = "";

        // Limpiar docs
        document.getElementById('lista-docs').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Guardar empleado antes de cargar documentos</td></tr>';
        document.getElementById('doc-upload-container').style.display = 'none'; // Ocultar carga hasta guardar
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function cerrarModalEmpleado() {
    document.getElementById('modal-empleado').style.display = 'none';
}

async function editarEmpleado(id) {
    const emp = empleadosCache.find(e => e.id === id);
    if (!emp) return;

    abrirModalEmpleado(id);

    // Llenar campos
    document.getElementById('empleado-id').value = emp.id;
    document.getElementById('nombre').value = emp.nombre;
    document.getElementById('apellido').value = emp.apellido;
    document.getElementById('dni').value = emp.dni || '';
    document.getElementById('fecha_nacimiento').value = emp.fecha_nacimiento || '';
    document.getElementById('direccion').value = emp.direccion || '';
    document.getElementById('telefono').value = emp.telefono || '';
    document.getElementById('email').value = emp.email || '';
    document.getElementById('estado_civil').value = emp.estado_civil || 'soltero';
    document.getElementById('hijos').value = emp.hijos || 0;

    document.getElementById('rol').value = emp.rol;
    document.getElementById('fecha_ingreso').value = emp.fecha_ingreso || '';
    document.getElementById('contacto_emergencia_nombre').value = emp.contacto_emergencia_nombre || '';
    document.getElementById('contacto_emergencia_telefono').value = emp.contacto_emergencia_telefono || '';
    document.getElementById('activo').checked = emp.activo;

    // Habilitar carga de documentos
    document.getElementById('doc-upload-container').style.display = 'block';
    await cargarDocumentacion(id);
}

async function guardarEmpleado() {
    const id = document.getElementById('empleado-id').value;
    const selectVinculacion = document.getElementById('select-vinculacion');

    // Prepare linking IDs
    let link_user_id = null;
    let link_seller_id = null;

    if (!id && selectVinculacion && selectVinculacion.value) {
        const [type, valId] = selectVinculacion.value.split('-');
        if (type === 'user') link_user_id = valId;
        if (type === 'seller') link_seller_id = valId;
    }

    const data = {
        negocio_id: appState.negocioActivoId,
        nombre: document.getElementById('nombre').value,
        apellido: document.getElementById('apellido').value,
        dni: document.getElementById('dni').value,
        fecha_nacimiento: document.getElementById('fecha_nacimiento').value,
        direccion: document.getElementById('direccion').value,
        telefono: document.getElementById('telefono').value,
        email: document.getElementById('email').value,
        estado_civil: document.getElementById('estado_civil').value,
        hijos: document.getElementById('hijos').value,
        rol: document.getElementById('rol').value,
        fecha_ingreso: document.getElementById('fecha_ingreso').value,
        contacto_emergencia_nombre: document.getElementById('contacto_emergencia_nombre').value,
        contacto_emergencia_telefono: document.getElementById('contacto_emergencia_telefono').value,
        // Linking params
        link_user_id: link_user_id,
        link_seller_id: link_seller_id
    };

    try {
        let res;
        if (id) {
            await sendData(`/api/empleados/${id}`, data, 'PUT');
            mostrarNotificacion("Empleado actualizado correctamente", "success");
        } else {
            res = await sendData('/api/empleados', data, 'POST');
            mostrarNotificacion("Empleado creado correctamente", "success");
            // Si queremos mostrar docs inmediamente, podríamos abrir el modal en modo edit con el ID nuevo
            // pero cerramos por simplicidad
        }
        cerrarModalEmpleado();
        cargarEmpleados();
    } catch (error) {
        console.error("Error guardando empleado:", error);
        mostrarNotificacion("Error al guardar: " + error.message, "error");
    }
}

async function toggleActivoEmpleado(id, nuevoEstado) {
    if (!confirm(`¿Seguro que deseas ${nuevoEstado ? 'activar' : 'desactivar'} este empleado?`)) return;

    try {
        await sendData(`/api/empleados/${id}/activo`, { activo: nuevoEstado }, 'PUT');
        mostrarNotificacion(`Empleado ${nuevoEstado ? 'activado' : 'desactivado'}`, "success");
        cargarEmpleados();
    } catch (error) {
        mostrarNotificacion("Error al cambiar estado", "error");
    }
}

// --- Documentación ---

async function cargarDocumentacion(empleadoId) {
    const tbody = document.getElementById('lista-docs');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const docs = await fetchData(`/api/empleados/${empleadoId}/documentacion`);
        tbody.innerHTML = '';

        if (!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay documentos cargados</td></tr>';
            return;
        }

        docs.forEach(doc => {
            const tr = document.createElement('tr');

            // Calculo de estado vencimiento
            let estadoBadge = '<span class="badge bg-success">Vigente</span>';
            if (doc.fecha_vencimiento) {
                const now = new Date();
                const vto = new Date(doc.fecha_vencimiento);
                const diffDays = Math.ceil((vto - now) / (1000 * 60 * 60 * 24));

                if (diffDays < 0) estadoBadge = '<span class="badge bg-danger">Vencido</span>';
                else if (diffDays < 30) estadoBadge = '<span class="badge bg-warning text-dark">Por Vencer</span>';
            }

            tr.innerHTML = `
                <td>
                    <strong>${doc.tipo_documento.replace('_', ' ').toUpperCase()}</strong><br>
                    <small class="text-muted">${doc.observaciones || ''}</small>
                </td>
                <td>${doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString() : '-'}</td>
                <td>${estadoBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarDocumento(${doc.id})"><i class="fas fa-trash"></i></button>
                    ${doc.archivo_path ? '<a href="#" class="btn btn-sm btn-outline-info"><i class="fas fa-eye"></i></a>' : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error docs:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error cargando documentos</td></tr>';
    }
}

async function subirDocumento() {
    const id = document.getElementById('empleado-id').value;
    if (!id) return;

    const data = {
        tipo_documento: document.getElementById('doc-tipo').value,
        fecha_vencimiento: document.getElementById('doc-vencimiento').value,
        observaciones: document.getElementById('doc-obs').value,
        archivo_path: null // TODO: Implement file upload
    };

    if (document.getElementById('doc-vencimiento').value === '') {
        alert("Por favor ingrese la fecha de vencimiento");
        return;
    }

    try {
        await sendData(`/api/empleados/${id}/documentacion`, data, 'POST');
        mostrarNotificacion("Documento guardado", "success");
        // Limpiar campos
        document.getElementById('doc-obs').value = '';
        document.getElementById('doc-vencimiento').value = '';
        cargarDocumentacion(id);
    } catch (error) {
        mostrarNotificacion("Error subiendo documento", "error");
    }
}

function borrarDocumento(id) {
    if (!confirm("¿Eliminar documento?")) return;
    // TODO: Implement DELETE endpoint
    alert("Función borrar pendiente de implementar en backend");
}
