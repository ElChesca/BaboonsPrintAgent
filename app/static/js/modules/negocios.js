import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let negociosCache = [];

// Función para dibujar la tabla (CON LA COLUMNA DE LOGO)
function renderizarTabla() {
    const tbody = document.querySelector('#tabla-negocios tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    negociosCache.forEach(n => {
        // Lógica visual: Si hay URL, mostramos imagen. Si no, un icono genérico.
        const logoHtml = n.logo_url
            ? `<img src="${n.logo_url}" alt="Logo" style="width: 40px; height: 40px; object-fit: contain; background: #eee; border-radius: 5px; padding: 2px;">`
            : '<span style="font-size: 24px;">🏢</span>';

        tbody.innerHTML += `
            <tr>
                <td>${n.id}</td>
                <td style="text-align: center;">${logoHtml}</td>
                <td>${n.nombre}</td>
                <td>${n.tipo_app || 'retail'}</td>
                <td>${n.direccion || '-'}</td>
                <td style="text-align: center;">
                    <span class="badge ${n.suscripcion_activa ? 'bg-success' : 'bg-secondary'}" style="padding: 5px 10px; border-radius: 15px; color: white; font-size: 11px;">
                        ${n.suscripcion_activa ? 'Suscripción Activa' : 'Sin Suscripción'}
                    </span>
                    ${n.acceso_bloqueado ? '<br><span class="badge bg-danger mt-1" style="padding: 5px 10px; border-radius: 15px; color: white; font-size: 11px;">Bloqueado</span>' : ''}
                </td>
                <td class="acciones">
                    <button class="btn-secondary" onclick="window.editarNegocio(${n.id})">Editar</button>
                </td>
            </tr>
        `;
    });
}

// Función que faltaba (Obtiene los datos del backend)
async function cargarNegocios() {
    try {
        negociosCache = await fetchData('/api/negocios');
        renderizarTabla();
    } catch (error) {
        console.error(error);
        mostrarNotificacion('No se pudieron cargar los negocios.', 'error');
    }
}

function resetFormulario() {
    const formTitulo = document.getElementById('form-negocio-titulo');
    const form = document.getElementById('form-negocio');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');

    if (formTitulo) formTitulo.textContent = 'Añadir Nuevo Negocio';
    if (form) form.reset();

    document.getElementById('negocio-id').value = '';
    document.getElementById('logo-negocio').value = '';
    document.getElementById('tipo-app-negocio').value = 'retail';
    document.getElementById('fecha-alta-negocio').value = '';
    document.getElementById('cuota-mensual-negocio').value = '0';
    document.getElementById('suscripcion-activa-negocio').checked = false;
    document.getElementById('acceso-bloqueado-negocio').checked = false;
    document.getElementById('anuncio-texto').value = '';
    document.getElementById('anuncio-version').value = 'v1';
    const btnEliminar = document.getElementById('btn-eliminar-negocio');
    if (btnEliminar) btnEliminar.style.display = 'none';

    if (btnCancelar) btnCancelar.style.display = 'none';
}

// Función global para el botón "Editar" de la tabla
window.editarNegocio = (id) => {
    const negocio = negociosCache.find(n => n.id === id);
    if (!negocio) return;

    document.getElementById('form-negocio-titulo').textContent = 'Editar Negocio';
    document.getElementById('negocio-id').value = negocio.id;
    document.getElementById('nombre-negocio').value = negocio.nombre;
    document.getElementById('direccion-negocio').value = negocio.direccion;
    document.getElementById('logo-negocio').value = negocio.logo_url || '';
    document.getElementById('tipo-app-negocio').value = negocio.tipo_app || 'retail';

    // Nuevos campos
    document.getElementById('fecha-alta-negocio').value = negocio.fecha_alta || '';
    document.getElementById('cuota-mensual-negocio').value = negocio.cuota_mensual || 0;
    document.getElementById('suscripcion-activa-negocio').checked = !!negocio.suscripcion_activa;
    document.getElementById('acceso-bloqueado-negocio').checked = !!negocio.acceso_bloqueado;
    document.getElementById('anuncio-texto').value = negocio.anuncio_texto || '';
    document.getElementById('anuncio-version').value = negocio.anuncio_version || 'v1';

    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';

    // Mostrar botón eliminar solo si es superadmin
    const btnEliminar = document.getElementById('btn-eliminar-negocio');
    if (btnEliminar && window.appState && window.appState.userRol === 'superadmin') {
        btnEliminar.style.display = 'inline-block';
    }

    // Scroll suave hacia arriba para ver el form
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Función para eliminar negocio con doble advertencia
async function eliminarNegocioActual() {
    const id = document.getElementById('negocio-id').value;
    const nombre = document.getElementById('nombre-negocio').value;
    if (!id) return;

    // PRIMERA ADVERTENCIA
    const result1 = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Vas a eliminar el negocio "${nombre}". Esta acción es IRREVERSIBLE.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    });

    if (!result1.isConfirmed) return;

    // SEGUNDA ADVERTENCIA (DOBLE CONFIRMACIÓN)
    const result2 = await Swal.fire({
        title: 'CONFIRMACIÓN FINAL',
        text: `PARA CONFIRMAR: Esta acción borrará el negocio y sus configuraciones. ¿Realmente deseas proceder?`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'SÍ, BORRAR DEFINITIVAMENTE',
        cancelButtonText: 'Me arrepentí'
    });

    if (!result2.isConfirmed) return;

    try {
        const response = await sendData(`/api/negocios/${id}`, {}, 'DELETE');
        mostrarNotificacion(response.message || 'Negocio eliminado.', 'success');
        resetFormulario();
        await cargarNegocios();
    } catch (error) {
        mostrarNotificacion(error.message || 'No se pudo eliminar el negocio.', 'error');
    }
}

// En static/js/modules/negocios.js

async function guardarNegocio(e) {
    e.preventDefault();
    const id = document.getElementById('negocio-id').value;

    // LOGICA INTELIGENTE PARA EL LOGO
    let logoInput = document.getElementById('logo-negocio').value.trim();

    // Si escribió algo, y NO es una ruta completa (no tiene barras), asumimos que es solo el nombre
    if (logoInput && !logoInput.includes('/') && !logoInput.includes('\\')) {
        logoInput = `/static/img/logos/${logoInput}`;
    }

    const data = {
        nombre: document.getElementById('nombre-negocio').value,
        direccion: document.getElementById('direccion-negocio').value,
        tipo_app: document.getElementById('tipo-app-negocio').value,
        logo_url: logoInput,
        fecha_alta: document.getElementById('fecha-alta-negocio').value || null,
        cuota_mensual: parseFloat(document.getElementById('cuota-mensual-negocio').value) || 0,
        suscripcion_activa: document.getElementById('suscripcion-activa-negocio').checked,
        acceso_bloqueado: document.getElementById('acceso-bloqueado-negocio').checked,
        anuncio_texto: document.getElementById('anuncio-texto').value.trim(),
        anuncio_version: document.getElementById('anuncio-version').value.trim() || 'v1'
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/negocios/${id}` : '/api/negocios';
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message || `Negocio ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');

        // Reset manual del formulario para limpiar variables
        resetFormulario();

        await cargarNegocios();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// Función principal de inicialización
export function inicializarLogicaNegocios() {
    const form = document.getElementById('form-negocio');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');
    const btnEliminar = document.getElementById('btn-eliminar-negocio');

    if (!form) return;

    form.addEventListener('submit', guardarNegocio);

    if (btnCancelar) {
        btnCancelar.addEventListener('click', resetFormulario);
    }

    if (btnEliminar) {
        btnEliminar.addEventListener('click', eliminarNegocioActual);
    }

    cargarNegocios(); // Ahora sí, esta función existe arriba
}