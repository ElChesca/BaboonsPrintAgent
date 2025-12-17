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
                <td>${n.direccion || '-'}</td>
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
    
    if(formTitulo) formTitulo.textContent = 'Añadir Nuevo Negocio';
    if(form) form.reset();
    
    document.getElementById('negocio-id').value = '';
    document.getElementById('logo-negocio').value = ''; // Limpiamos el campo logo
    if(btnCancelar) btnCancelar.style.display = 'none';
}

// Función global para el botón "Editar" de la tabla
window.editarNegocio = (id) => {
    const negocio = negociosCache.find(n => n.id === id);
    if (!negocio) return;

    document.getElementById('form-negocio-titulo').textContent = 'Editar Negocio';
    document.getElementById('negocio-id').value = negocio.id;
    document.getElementById('nombre-negocio').value = negocio.nombre;
    document.getElementById('direccion-negocio').value = negocio.direccion;
    document.getElementById('logo-negocio').value = negocio.logo_url || ''; // Carga el logo
    
    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');
    if(btnCancelar) btnCancelar.style.display = 'inline-block';
    
    // Scroll suave hacia arriba para ver el form
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

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
        logo_url: logoInput // Enviamos la ruta procesada
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/negocios/${id}` : '/api/negocios';
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message || `Negocio ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        
        // Reset manual del formulario para limpiar variables
        document.getElementById('form-negocio').reset();
        document.getElementById('negocio-id').value = '';
        document.getElementById('logo-negocio').value = '';
        document.getElementById('form-negocio-titulo').textContent = 'Añadir Nuevo Negocio';
        document.getElementById('btn-cancelar-edicion-negocio').style.display = 'none';

        await cargarNegocios(); 
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// Función principal de inicialización
export function inicializarLogicaNegocios() {
    const form = document.getElementById('form-negocio');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-negocio');

    if (!form) return;

    form.addEventListener('submit', guardarNegocio);
    
    if(btnCancelar) {
        btnCancelar.addEventListener('click', resetFormulario);
    }

    cargarNegocios(); // Ahora sí, esta función existe arriba
}