import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';


// Estas variables se quedan aquí fuera
let stagedIncomeItems = [];
let productosCache = [];

async function poblarSelectorProveedores() {
    console.log("--- DENTRO de poblarSelectorProveedores ---");
    const selector = document.getElementById('ingreso-proveedor-selector');
    if (!selector) {
        console.error("ERROR: No se encontró el selector de proveedores.");
        return;
    }
    if (!appState.negocioActivoId) {
        console.warn("ADVERTENCIA: No hay negocio activo para buscar proveedores.");
        selector.innerHTML = '<option value="">Seleccione un negocio</option>';
        return;
    }
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/proveedores`;
        console.log("Pidiendo proveedores a:", url);
        const proveedores = await fetchData(url);
        console.log("Proveedores recibidos:", proveedores);

        selector.innerHTML = '<option value="">Seleccione un proveedor...</option>';
        proveedores.forEach(p => {
            selector.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
        console.log("¡Selector de proveedores poblado!");
    } catch (error) {
        console.error("ERROR al cargar proveedores:", error);
        mostrarNotificacion('No se pudieron cargar los proveedores.', 'error');
    }
}

async function poblarSelectorProductos() {
    console.log("--- DENTRO de poblarSelectorProductos ---");
    const selector = document.getElementById('ingreso-producto-selector');
    if (!selector) {
        console.error("ERROR: No se encontró el selector de productos.");
        return;
    }
    if (!appState.negocioActivoId) {
        console.warn("ADVERTENCIA: No hay negocio activo para buscar productos.");
        return;
    }
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/productos`;
        console.log("Pidiendo productos a:", url);
        productosCache = await fetchData(url);
        console.log("Productos recibidos:", productosCache);

        selector.innerHTML = '<option value="">Seleccione un producto...</option>';
        productosCache.forEach(p => {
            selector.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
        console.log("¡Selector de productos poblado!");
    } catch (error) {
        console.error("ERROR al cargar productos:", error);
        mostrarNotificacion('No se pudieron cargar los productos.', 'error');
    }
}

function renderStagedIncomeItems() {
    console.log("--- DENTRO de renderStagedIncomeItems ---");
    const tbody = document.querySelector('#staged-items-ingreso tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    stagedIncomeItems.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td><button type="button" class="btn-quitar" onclick="quitarItem(${index})">Quitar</button></td>
            </tr>
        `;
    });
}

export function quitarItem(index) {
    stagedIncomeItems.splice(index, 1);
    renderStagedIncomeItems();
}

export function inicializarLogicaIngresos() {
    console.log("PASO A: Entrando en inicializarLogicaIngresos.");
    
    stagedIncomeItems = [];
    const formAddItem = document.getElementById('form-add-item-ingreso');
    const formFinalize = document.getElementById('form-finalize-ingreso');
    
    if (!formAddItem || !formFinalize) {
        console.error("PASO B: ERROR CRÍTICO - No se encontraron los formularios necesarios. Saliendo.");
        return;
    }
    
    console.log("PASO C: Formularios encontrados. Poblando selectores...");
    poblarSelectorProveedores();
    poblarSelectorProductos();
    renderStagedIncomeItems();
    console.log("PASO D: Selectores y tabla inicial renderizados. Añadiendo listeners...");

    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoId = document.getElementById('ingreso-producto-selector').value;
        const cantidad = parseFloat(document.getElementById('ingreso-item-cantidad').value);
        const costo = document.getElementById('ingreso-item-costo').value;

        if (!productoId || !cantidad) {
            mostrarNotificacion('Debe seleccionar un producto y una cantidad.', 'warning');
            return;
        }

        const productoSeleccionado = productosCache.find(p => p.id == productoId);
        stagedIncomeItems.push({
            producto_id: productoId,
            nombre: productoSeleccionado.nombre,
            cantidad: cantidad,
            precio_costo: costo ? parseFloat(costo) : null
        });

        renderStagedIncomeItems();
        formAddItem.reset();
    });

    formFinalize.addEventListener('submit', async (e) => {
        e.preventDefault();
        const proveedorId = document.getElementById('ingreso-proveedor-selector').value;

        if (stagedIncomeItems.length === 0) {
            mostrarNotificacion('Debe añadir al menos un producto al ingreso.', 'warning');
            return;
        }
        if (!proveedorId) {
            mostrarNotificacion('Debe seleccionar un proveedor.', 'warning');
            return;
        }

        const payload = {
            proveedor_id: proveedorId,
            referencia: document.getElementById('ingreso-referencia').value || null,
            detalles: stagedIncomeItems
        };

        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/ingresos`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            mostrarNotificacion(response.message, 'success');
            stagedIncomeItems = [];
            renderStagedIncomeItems();
            formFinalize.reset();
            // Repoblamos por si hay cambios
            poblarSelectorProveedores();
            poblarSelectorProductos();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });

    console.log("PASO E: Listeners añadidos. Fin de la inicialización.");
}