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
    
    // ✨ LLAMAMOS AL NUEVO ENDPOINT ✨
    try {
        preciosEspecificosActuales = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios/${listaId}/precios_especificos`);
        console.log("Precios específicos cargados:", preciosEspecificosActuales); // Log para depurar
    } catch (error) {
        // Si falla (ej: 404 si no hay precios), continuamos con un objeto vacío
        console.warn(`No se encontraron precios específicos para la lista ${listaId} o hubo un error:`, error.message);
        preciosEspecificosActuales = {}; 
    }
    
    // Mostramos la tabla (esta función ahora usará los precios cargados)
    renderizarTablaPrecios(); 
    document.getElementById('tabla-precios-container').classList.remove('hidden');
    document.getElementById('btn-guardar-precios').classList.remove('hidden');
}
// --- Renderizado ---
function renderizarTablaPrecios() {
    const tbody = document.querySelector('#tabla-precios-especificos tbody');
    if (!tbody) {
        console.error("Error: No se encontró el elemento tbody '#tabla-precios-especificos tbody'");
        mostrarNotificacion("Error interno al intentar mostrar la tabla de precios.", "error");
        return; // Detiene la ejecución si no encuentra el tbody
    }
    tbody.innerHTML = '';
    
    if (todosLosProductos.length === 0) { /* ... (mensaje no hay productos) ... */ return; }

    todosLosProductos.forEach(prod => {
        // ✨ BUSCAMOS el precio específico cargado ✨
        const precioEsp = preciosEspecificosActuales[prod.id] !== undefined 
                           ? preciosEspecificosActuales[prod.id] 
                           : ''; // Usamos '' si no existe para que el input quede vacío

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
    const btnAbrirModalImportar = document.getElementById('btn-abrir-modal-importar');
    const modalImportar = document.getElementById('modal-importar-precios');
    const closeModalImportar = document.getElementById('close-modal-importar');
    const btnIniciarImportacion = document.getElementById('btn-iniciar-importacion');
    
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
    if (btnAbrirModalImportar) btnAbrirModalImportar.addEventListener('click', abrirModalImportar);
    if (closeModalImportar) closeModalImportar.addEventListener('click', () => modalImportar.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target == modalImportar) modalImportar.style.display = 'none'; });
    if (btnIniciarImportacion) btnIniciarImportacion.addEventListener('click', iniciarImportacion);
}

function abrirModalImportar() {
    const modal = document.getElementById('modal-importar-precios');
    const selectorDestino = document.getElementById('importar-lista-destino');
    const inputArchivo = document.getElementById('archivo-precios');
    const progresoDiv = document.getElementById('importar-progreso');
    const resultadosDiv = document.getElementById('importar-resultados');
    
    // Limpiar estado anterior
    selectorDestino.innerHTML = document.getElementById('selector-lista-precios').innerHTML; // Copia las opciones
    inputArchivo.value = ''; // Resetea el input file
    progresoDiv.classList.add('hidden');
    resultadosDiv.innerHTML = '';
    
    modal.style.display = 'flex';
}

async function iniciarImportacion() {
    const listaId = document.getElementById('importar-lista-destino').value;
    const archivoInput = document.getElementById('archivo-precios');
    const progresoDiv = document.getElementById('importar-progreso');
    const progresoTexto = document.getElementById('progreso-texto');
    const progresoBarra = document.getElementById('progreso-barra');
    const resultadosDiv = document.getElementById('importar-resultados');
    const btnImportar = document.getElementById('btn-iniciar-importacion');

    if (!listaId) {
        mostrarNotificacion('Debe seleccionar una lista de precios destino.', 'warning');
        return;
    }
    if (!archivoInput.files || archivoInput.files.length === 0) {
        mostrarNotificacion('Debe seleccionar un archivo Excel.', 'warning');
        return;
    }

    const archivo = archivoInput.files[0];
    progresoDiv.classList.remove('hidden');
    progresoTexto.textContent = `Leyendo ${archivo.name}...`;
    progresoBarra.value = 0;
    resultadosDiv.innerHTML = '';
    btnImportar.disabled = true;

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) throw new Error("El archivo está vacío o no tiene datos.");

                // Validar columnas básicas
                if (!jsonData[0].hasOwnProperty('SKU') || !jsonData[0].hasOwnProperty('PRECIO')) {
                    throw new Error("El archivo debe contener las columnas 'SKU' y 'PRECIO'.");
                }
                
                progresoTexto.textContent = `Enviando ${jsonData.length} registros...`;
                progresoBarra.value = 50; // Mitad del proceso

                // Preparamos los datos para enviar al backend
                const preciosPayload = jsonData.map(row => ({
                    sku: row.SKU, // Enviamos SKU, el backend buscará el ID
                    precio: row.PRECIO === null || row.PRECIO === '' ? null : parseFloat(row.PRECIO)
                })).filter(item => item.sku); // Filtra filas sin SKU

                const response = await sendData(`/api/negocios/${appState.negocioActivoId}/precios_especificos/importar`, { // Nueva ruta
                    lista_de_precio_id: parseInt(listaId),
                    precios: preciosPayload
                }, 'POST');

                progresoTexto.textContent = "Importación completada.";
                progresoBarra.value = 100;
                resultadosDiv.innerHTML = `<p style="color:green;">${response.message}</p>`;
                if (response.errores && response.errores.length > 0) {
                    resultadosDiv.innerHTML += '<h4>Errores:</h4><ul>';
                    response.errores.forEach(err => {
                        resultadosDiv.innerHTML += `<li>Fila ${err.fila}: ${err.error} (SKU: ${err.sku || 'N/A'})</li>`;
                    });
                    resultadosDiv.innerHTML += '</ul>';
                }
                
                // Recargar precios si la lista actual es la importada
                if(listaId === document.getElementById('selector-lista-precios').value) {
                    cargarPreciosEspecificos(listaId);
                }

            } catch (error) {
                console.error("Error procesando archivo:", error);
                progresoTexto.textContent = "Error.";
                resultadosDiv.innerHTML = `<p style="color:red;">${error.message}</p>`;
            } finally {
                btnImportar.disabled = false;
            }
        };
        reader.readAsArrayBuffer(archivo);
    } catch (error) {
        mostrarNotificacion('Error inesperado al leer archivo: ' + error.message, 'error');
        progresoDiv.classList.add('hidden');
        btnImportar.disabled = false;
    }
}
