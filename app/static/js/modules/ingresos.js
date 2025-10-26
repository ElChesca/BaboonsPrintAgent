// app/static/js/modules/ingresos.js
import { fetchData, sendData } from '../api.js'; // Asegúrate que sendData esté exportado y funcione
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let stagedIncomeItems = []; // [{ producto_id, nombre, cantidad, precio_costo }]
let productosCache = [];

// Helper para formatear moneda
const formatCurrency = (value) => {
    // Maneja null o undefined devolviendo un string vacío o un placeholder
    if (value === null || typeof value === 'undefined') {
        return '-'; 
    }
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

async function poblarSelectores() {
    try {
        const [proveedores, productos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos?simple=true`) // Pedir versión simple si la API lo soporta
        ]);
        
        productosCache = productos;
        const selProv = document.getElementById('ingreso-proveedor-selector');
        const selProd = document.getElementById('ingreso-producto-selector');
        
        if (!selProv || !selProd) {
             console.error("Selectores de proveedor o producto no encontrados.");
             return;
        }

        selProv.innerHTML = '<option value="">Seleccione un proveedor...</option>';
        proveedores.forEach(p => selProv.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);

        selProd.innerHTML = '<option value="">Seleccione un producto...</option>';
        // Asumiendo que 'productos' es un array de objetos {id, nombre}
        productos.forEach(p => selProd.innerHTML += `<option value="${p.id}">${p.nombre} (ID: ${p.id})</option>`);
        
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar proveedores o productos.', 'error');
        console.error("Error poblando selectores:", error);
    }
}

function renderStagedIncomeItems() {
    const tbody = document.querySelector('#staged-items-ingreso tbody');
    const alertasContainer = document.getElementById('alertas-precios-container');
    const listaAlertas = document.getElementById('lista-alertas-precios');

    if (!tbody) return;
    tbody.innerHTML = ''; // Limpiar tabla

    // Limpiar alertas anteriores si las hubiera
    if (alertasContainer) alertasContainer.classList.add('hidden');
    if (listaAlertas) listaAlertas.innerHTML = '';

    if (stagedIncomeItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Añada productos...</td></tr>';
        return;
    }

    stagedIncomeItems.forEach((item, index) => {
        // --- CAMBIO AQUÍ: Mostramos el precio_costo ---
        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${item.nombre} (ID: ${item.producto_id})</td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio_costo)}</td> 
                <td><button type="button" class="btn btn-danger btn-sm btn-quitar">Quitar</button></td> 
            </tr>
        `;
    });
}

// --- Función para mostrar las alertas de precios ---
function mostrarAlertasDePrecios(alertas) {
     const alertasContainer = document.getElementById('alertas-precios-container');
     const listaAlertas = document.getElementById('lista-alertas-precios');

     if (!alertasContainer || !listaAlertas || !alertas || alertas.length === 0) {
         // Si no hay contenedor o no hay alertas, nos aseguramos que esté oculto
         if(alertasContainer) alertasContainer.classList.add('hidden');
         return; 
     }

     listaAlertas.innerHTML = ''; // Limpiamos alertas previas
     alertas.forEach(alerta => {
         const variacionClass = alerta.variacion > 0 ? 'text-danger' : 'text-success'; // Rojo si sube, verde si baja (o usa tus propias clases)
         const icono = alerta.variacion > 0 ? '🔺' : '🔻';
         listaAlertas.innerHTML += `
            <li>
                <strong>${alerta.producto}:</strong> Costo ${icono} ${Math.abs(alerta.variacion)}% 
                (Antes: ${formatCurrency(alerta.anterior)}, Ahora: ${formatCurrency(alerta.nuevo)})
            </li>
         `;
     });
     alertasContainer.classList.remove('hidden'); // Mostramos el contenedor
}


export function inicializarLogicaIngresos() {
    stagedIncomeItems = []; // Resetear al inicializar
    const formAddItem = document.getElementById('form-add-item-ingreso');
    const formFinalize = document.getElementById('form-finalize-ingreso');
    const tablaItemsBody = document.querySelector('#staged-items-ingreso tbody'); // Mover selector aquí

    if (!formAddItem || !formFinalize || !tablaItemsBody) {
        console.error("Faltan elementos HTML esenciales para el módulo de Ingresos.");
        return; // Salir si falta algo
    }

    poblarSelectores();
    renderStagedIncomeItems(); // Render inicial

    // Listener para añadir ítem
    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoId = document.getElementById('ingreso-producto-selector').value;
        const cantidadInput = document.getElementById('ingreso-item-cantidad');
        const costoInput = document.getElementById('ingreso-item-costo'); // El nuevo input
        
        const cantidad = parseFloat(cantidadInput.value);
        // --- CAMBIO AQUÍ: Capturamos el precio_costo ---
        const precio_costo_str = costoInput.value.trim();
        const precio_costo = precio_costo_str !== '' ? parseFloat(precio_costo_str) : null; // null si está vacío

        if (!productoId || !cantidad || cantidad <= 0) {
            return mostrarNotificacion('Seleccione un producto válido y una cantidad mayor a cero.', 'warning');
        }
        if (precio_costo !== null && precio_costo < 0) {
            return mostrarNotificacion('El precio de costo no puede ser negativo.', 'warning');
        }
        
        const productoSel = productosCache.find(p => p.id == productoId);

        if (!productoSel) {
            return mostrarNotificacion('Error: Producto no encontrado en la lista local.', 'error');
        }

        // Evitar duplicados (opcional, podrías sumar cantidades en vez de error)
        if (stagedIncomeItems.some(item => item.producto_id == productoId)) {
             return mostrarNotificacion('Ese producto ya está en la lista. Quítelo si desea modificarlo.', 'warning');
        }

        stagedIncomeItems.push({
            producto_id: productoId,
            nombre: productoSel.nombre, // Asegúrate que la API devuelva el nombre
            cantidad: cantidad,
            precio_costo: precio_costo // Guardamos el costo (puede ser null)
        });
        
        renderStagedIncomeItems();
        // Limpiar solo los campos de cantidad y costo, no el producto
        cantidadInput.value = '';
        costoInput.value = ''; 
        // Opcional: Poner el foco de vuelta en cantidad
        // cantidadInput.focus(); 
         document.getElementById('ingreso-producto-selector').value = ''; // Resetear selector producto
    });

    // Listener para finalizar ingreso
    formFinalize.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (stagedIncomeItems.length === 0) {
            return mostrarNotificacion('Añada al menos un producto al ingreso.', 'warning');
        }
        
        // --- CAMBIO AQUÍ: Recolectamos datos de la factura ---
        const proveedorId = document.getElementById('ingreso-proveedor-selector').value;
        const facturaTipo = document.getElementById('ingreso-factura-tipo').value.trim();
        const facturaPrefijo = document.getElementById('ingreso-factura-prefijo').value.trim();
        const facturaNumero = document.getElementById('ingreso-factura-numero').value.trim();
        const referencia = document.getElementById('ingreso-referencia').value.trim();

        if (!proveedorId) return mostrarNotificacion('Seleccione un proveedor.', 'warning');
        if (!facturaTipo || !facturaPrefijo || !facturaNumero) {
             return mostrarNotificacion('Ingrese los datos completos de la factura (Tipo, Prefijo, Número).', 'warning');
        }

        const payload = {
            proveedor_id: proveedorId,
            referencia: referencia || null,
            factura_tipo: facturaTipo,
            factura_prefijo: facturaPrefijo,
            factura_numero: facturaNumero,
            detalles: stagedIncomeItems.map(item => ({ // Asegurarse que solo mandamos lo necesario
                 producto_id: item.producto_id,
                 cantidad: item.cantidad,
                 precio_costo: item.precio_costo 
            }))
        };
        
        // Deshabilitar botón para evitar doble envío
        const submitButton = formFinalize.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Registrando...';

        try {
            const response = await sendData(`/api/negocios/${appState.negocioActivoId}/ingresos`, payload); // Usar sendData
            
            mostrarNotificacion(response.message || 'Ingreso registrado con éxito.', 'success');
            
            // --- CAMBIO AQUÍ: Mostramos las alertas de precios ---
            if (response.alertas_precios && response.alertas_precios.length > 0) {
                 mostrarAlertasDePrecios(response.alertas_precios);
                 // Opcional: Añadir un botón o link para ir a "Listas de Precios"
            } else {
                 // Si no hay alertas, nos aseguramos que el contenedor esté oculto
                 const alertasContainer = document.getElementById('alertas-precios-container');
                 if(alertasContainer) alertasContainer.classList.add('hidden');
            }

            // Limpiamos todo
            stagedIncomeItems = [];
            renderStagedIncomeItems(); // Limpia la tabla visualmente
            formFinalize.reset(); // Limpia proveedor, factura, referencia
            formAddItem.reset(); // Limpia producto, cantidad, costo del otro form
            poblarSelectores(); // Recarga los selectores por si hubo cambios
            
        } catch (error) {
            mostrarNotificacion(error.message || 'Ocurrió un error al registrar el ingreso.', 'error');
            console.error("Error al finalizar ingreso:", error);
        } finally {
             // Volver a habilitar el botón
             submitButton.disabled = false;
             submitButton.textContent = 'Registrar Ingreso y Actualizar Stock';
        }
    });

    // Listener único para quitar ítems (Delegación)
    tablaItemsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-quitar')) {
            const fila = e.target.closest('tr');
            if (fila && typeof fila.dataset.index !== 'undefined') { // Chequeo extra
                 const index = parseInt(fila.dataset.index, 10);
                 if (!isNaN(index) && index >= 0 && index < stagedIncomeItems.length) {
                    stagedIncomeItems.splice(index, 1);
                    renderStagedIncomeItems();
                 } else {
                     console.error("Índice inválido al intentar quitar ítem:", fila.dataset.index);
                 }
            }
        }
    });
}
