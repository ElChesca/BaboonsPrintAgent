// static/js/modules/precios_especificos.js
import { fetchData, sendData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let todosLosProductos = [];
let preciosEspecificosActuales = {}; // Guardará { producto_id: precio }

// --- Funciones de Carga ---
async function cargarListasPrecios() {
    console.log("cargarListasPrecios iniciada.");
    const selector = document.getElementById('selector-lista-precios');
    console.log("appState.negocioActivoId:", appState.negocioActivoId);
    if (!appState.negocioActivoId) {
        console.warn("No hay negocio activo, no se cargarán listas.");
        return; // Salimos si no hay negocio
    }
    try {
        const listas = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`);
        selector.innerHTML = '<option value="">-- Elija una lista --</option>';
        listas.forEach(lista => {
            selector.innerHTML += `<option value="${lista.id}">${lista.nombre}</option>`;
        });
    } catch (error) { mostrarNotificacion('Error al cargar listas de precios.', 'error'); }
}

async function cargarTodosLosProductos() {
    try {
        todosLosProductos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
    } catch (error) { mostrarNotificacion('Error al cargar productos.', 'error'); todosLosProductos = []; }
}

async function cargarPreciosEspecificos(listaId) {
    preciosEspecificosActuales = {}; // Limpia caché anterior
    // NOTA: Necesitamos un endpoint que devuelva SOLO los precios específicos
    // Por ahora, asumimos que no existe y cargaremos todos los productos y marcaremos
    // (Idealmente, el backend devolvería { producto_id: precio } para esta lista)
    // const precios = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas/${listaId}/precios_especificos`);
    // precios.forEach(p => { preciosEspecificosActuales[p.producto_id] = p.precio; });
    
    // Por ahora, solo mostramos la tabla
    renderizarTablaPrecios(); 
    document.getElementById('tabla-precios-container').classList.remove('hidden');
    document.getElementById('btn-guardar-precios').classList.remove('hidden');
}

// --- Renderizado ---
function renderizarTablaPrecios() {
    const tbody = document.querySelector('#tabla-precios-especificos tbody');
    tbody.innerHTML = '';
    
    if (todosLosProductos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No hay productos cargados en este negocio.</td></tr>';
        return;
    }

    todosLosProductos.forEach(prod => {
        // Busca si hay un precio específico guardado (requiere endpoint futuro)
        const precioEsp = preciosEspecificosActuales[prod.id] || ''; 
        tbody.innerHTML += `
            <tr data-product-id="${prod.id}">
                <td>${prod.nombre}</td>
                <td>${prod.sku || '-'}</td>
                <td>${(prod.precio_venta || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td>
                    <input 
                        type="number" 
                        class="precio-especifico-input" 
                        value="${precioEsp}" 
                        step="0.01" 
                        placeholder="Usar base/regla"
                    >
                </td>
            </tr>
        `;
    });
}

// --- Guardado ---
async function guardarPrecios() {
    const listaId = document.getElementById('selector-lista-precios').value;
    if (!listaId) return;

    const btnGuardar = document.getElementById('btn-guardar-precios');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    const preciosPayload = [];
    document.querySelectorAll('#tabla-precios-especificos tbody tr').forEach(row => {
        const productoId = row.dataset.productId;
        const inputPrecio = row.querySelector('.precio-especifico-input');
        // Solo enviamos si hay un valor ingresado (o si queremos borrarlo explícitamente)
        if (inputPrecio && productoId) {
             preciosPayload.push({
                 producto_id: parseInt(productoId),
                 precio: inputPrecio.value === '' ? null : parseFloat(inputPrecio.value) // Envía null si está vacío
             });
        }
    });

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/precios_especificos/bulk`, {
            lista_de_precio_id: parseInt(listaId),
            precios: preciosPayload
        }, 'POST');
        mostrarNotificacion('Precios guardados con éxito.', 'success');
        // Quizás recargar precios específicos aquí si tuviéramos el endpoint GET
        // await cargarPreciosEspecificos(listaId); 
    } catch (error) {
        mostrarNotificacion('Error al guardar precios: ' + error.message, 'error');
    } finally {
         btnGuardar.disabled = false;
         btnGuardar.textContent = '💾 Guardar Cambios';
    }
}

// --- Inicialización ---
export async function inicializarPreciosEspecificos() {
    console.log("inicializarPreciosEspecificos iniciada.");     
    const selectorLista = document.getElementById('selector-lista-precios');
    const btnGuardar = document.getElementById('btn-guardar-precios');
    
    if (!selectorLista || !btnGuardar) return;

    // Carga inicial
    await cargarListasPrecios();
    await cargarTodosLosProductos(); // Cargamos productos una vez

    // Listeners
    selectorLista.addEventListener('change', (e) => {
        const listaId = e.target.value;
        if (listaId) {
            cargarPreciosEspecificos(listaId);
        } else {
            document.getElementById('tabla-precios-container').classList.add('hidden');
            document.getElementById('btn-guardar-precios').classList.add('hidden');
        }
    });
    
    btnGuardar.addEventListener('click', guardarPrecios);
}