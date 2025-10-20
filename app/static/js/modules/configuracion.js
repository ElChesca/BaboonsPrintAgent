// static/modules/configuracion.js
import { fetchData, sendData } from '../api.js'; // Asegúrate de importar sendData
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

async function cargarClientesEnSelector() {
    const select = document.getElementById('config-cliente-defecto');
    if (!select) return;

    try {
        const clientes = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`);
        select.innerHTML = '<option value="">Consumidor Final (General)</option>';
        clientes.forEach(cliente => {
            select.innerHTML += `<option value="${cliente.id}">${cliente.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error al cargar clientes para configuración', error);
    }
}
async function cargarConfiguracion() {
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`);
        
        // Asigna los valores a cada input/select que tenga un 'data-clave'
        document.querySelectorAll('#form-configuracion [data-clave]').forEach(input => {
            const clave = input.dataset.clave;
            if (configs && configs[clave]) {
                input.value = configs[clave];
            }
        });
    } catch (error) {
        mostrarNotificacion('No se pudo cargar la configuración.', 'error');
    }
}

async function guardarConfiguracion(e) {
    e.preventDefault();
    const payload = {};
    
    // Recoge los valores de todos los inputs/selects con 'data-clave'
    document.querySelectorAll('#form-configuracion [data-clave]').forEach(input => {
        const clave = input.dataset.clave;
        payload[clave] = input.value;
    });

    try {
        // Usamos sendData para enviar los datos con el método POST
        const response = await sendData(`/api/negocios/${appState.negocioActivoId}/configuraciones`, payload, 'POST');
        mostrarNotificacion(response.message, 'success');
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarConfiguracion() {
    const form = document.getElementById('form-configuracion');
    if (!form) return;

    // Llamamos a las funciones para poblar y cargar el formulario
    cargarClientesEnSelector();
    cargarConfiguracion();
    cargarListasEnSelector();

    form.addEventListener('submit', guardarConfiguracion);
}

async function cargarListasEnSelector() {
    const select = document.getElementById('config-lista-defecto'); // Asegúrate que el ID sea el correcto
    if (!select) return;
    try {
        const listas = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`);
        // No borramos el contenido, solo añadimos las opciones
        listas.forEach(lista => {
            select.innerHTML += `<option value="${lista.id}">${lista.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error al cargar listas de precios para configuración', error);
    }
}