// app/static/js/modules/ingresos.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let stagedIncomeItems = [];
let productosCache = [];

async function poblarSelectores() {
    try {
        const [proveedores, productos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos`)
        ]);
        
        productosCache = productos;
        const selProv = document.getElementById('ingreso-proveedor-selector');
        const selProd = document.getElementById('ingreso-producto-selector');
        
        selProv.innerHTML = '<option value="">Seleccione un proveedor...</option>';
        proveedores.forEach(p => selProv.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);

        selProd.innerHTML = '<option value="">Seleccione un producto...</option>';
        productos.forEach(p => selProd.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
        
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los datos para el formulario.', 'error');
    }
}

function renderStagedIncomeItems() {
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
    stagedIncomeItems = [];
    const formAddItem = document.getElementById('form-add-item-ingreso');
    const formFinalize = document.getElementById('form-finalize-ingreso');
    if (!formAddItem || !formFinalize) return;

    poblarSelectores();
    renderStagedIncomeItems();

    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoId = document.getElementById('ingreso-producto-selector').value;
        const cantidad = parseFloat(document.getElementById('ingreso-item-cantidad').value);
        if (!productoId || !cantidad) return mostrarNotificacion('Seleccione producto y cantidad.', 'warning');
        
        const productoSel = productosCache.find(p => p.id == productoId);
        stagedIncomeItems.push({
            producto_id: productoId,
            nombre: productoSel.nombre,
            cantidad: cantidad,
            precio_costo: document.getElementById('ingreso-item-costo').value || null
        });
        renderStagedIncomeItems();
        formAddItem.reset();
    });

    formFinalize.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (stagedIncomeItems.length === 0) return mostrarNotificacion('Añada al menos un producto.', 'warning');
        
        const payload = {
            proveedor_id: document.getElementById('ingreso-proveedor-selector').value,
            referencia: document.getElementById('ingreso-referencia').value || null,
            detalles: stagedIncomeItems
        };
        if (!payload.proveedor_id) return mostrarNotificacion('Seleccione un proveedor.', 'warning');

        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/ingresos`, {
                method: 'POST', body: JSON.stringify(payload)
            });
            mostrarNotificacion(response.message, 'success');
            stagedIncomeItems = [];
            renderStagedIncomeItems();
            formFinalize.reset();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });
}