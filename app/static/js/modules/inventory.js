import { getCurrentUser } from './auth.js';
import { appState } from '../main.js';
import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let productosCache = [];
let categoriasCache = [];
let proveedoresCache = [];

async function poblarSelectores() {
    try {
        if (!appState.negocioActivoId) {
            throw new Error("No hay un negocio activo seleccionado.");
        }
        
        // ✨ CORRECCIÓN CLAVE: Ambas llamadas ahora usan el negocio activo correctamente
        const [categoriasResponse, proveedoresResponse] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/unidades_medida`)
        ]);

        categoriasCache = Array.isArray(categoriasResponse) ? categoriasResponse : [];
        proveedoresCache = Array.isArray(proveedoresResponse) ? proveedoresResponse : [];

        // Poblar selectores de Categoría
        const catAdd = document.getElementById('categoria_id');
        const catEdit = document.getElementById('edit-categoria_id');
        if (catAdd && catEdit) {
            catAdd.innerHTML = catEdit.innerHTML = '<option value="">Sin categoría</option>';
            categoriasCache.forEach(cat => {
                const optionHtml = `<option value="${cat.id}">${cat.nombre}</option>`;
                catAdd.innerHTML += optionHtml;
                catEdit.innerHTML += optionHtml;
            });
        }

        // Poblar selectores de Proveedor
        const provAdd = document.getElementById('proveedor_id');
        const provEdit = document.getElementById('edit-proveedor_id');
        if (provAdd && provEdit) {
            provAdd.innerHTML = provEdit.innerHTML = '<option value="">Sin proveedor</option>';
            proveedoresCache.forEach(prov => {
                const optionHtml = `<option value="${prov.id}">${prov.nombre}</option>`;
                provAdd.innerHTML += optionHtml;
                provEdit.innerHTML += optionHtml;
            });
        }
        // ✨ POBLAR LOS SELECTORES DE UNIDAD DE MEDIDA ✨
        const umAdd = document.getElementById('unidad_medida');
        const umEdit = document.getElementById('edit-unidad_medida'); // Asumiendo que existe en tu modal de edición
        if (umAdd && umEdit) {
            umAdd.innerHTML = umEdit.innerHTML = '<option value="">Seleccionar...</option>';
            unidades.forEach(um => {
                // Usamos la abreviatura como valor, que es más corto y estándar
                const optionHtml = `<option value="${um.abreviatura}">${um.nombre} (${um.abreviatura})</option>`;
                umAdd.innerHTML += optionHtml;
                umEdit.innerHTML += optionHtml;
            });
        }
    } catch (error) {
        mostrarNotificacion("Error al cargar datos para formularios: " + error.message, 'error');
    }
}
async function fetchProductos() {
    if (!appState.negocioActivoId) {
        productosCache = [];
        renderProductos();
        return;
    }
    try {
        productosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        renderProductos();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los productos: ' + error.message, 'error');
        productosCache = [];
        renderProductos();
    }
}

function renderProductos() {
    const user = getCurrentUser();
    const isAdmin = user && user.rol === 'admin';
    const listaProductos = document.querySelector('#tabla-productos tbody');
    const headerRow = document.querySelector('#tabla-productos thead tr');
    const filtro = document.getElementById('buscador-productos')?.value.toLowerCase() || '';

    if (!listaProductos || !headerRow) return;

    // 1. Construir la cabecera dinámicamente
    headerRow.innerHTML = `<th>Nombre</th><th>SKU</th><th>Proveedor</th><th>Categoría</th><th>Stock</th><th>Precio Venta</th>`;
    if (isAdmin) {
        headerRow.innerHTML += `<th>Costo</th><th>Stock Mín.</th>`;
    }
    headerRow.innerHTML += `<th>Acciones</th>`;
    
    const colspan = isAdmin ? 9 : 7;

    if (!appState.negocioActivoId) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">Seleccione un negocio para ver su inventario.</td></tr>`;
        return;
    }

    // 2. Filtrar los productos cacheados por nombre, SKU o código de barras
    const productosFiltrados = productosCache.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
        (p.sku && p.sku.toLowerCase().includes(filtro)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(filtro))
    );
    
    listaProductos.innerHTML = '';
    productosFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        const stockClass = (p.stock > 0 && p.stock <= p.stock_minimo) ? 'stock-bajo' : '';
        let rowHTML = `
            <td>${p.nombre}</td>
            <td>${p.sku || '-'}</td>
            <td>${p.proveedor_nombre || '-'}</td>
            <td><small style="color: grey;">${p.categoria_nombre || 'Sin categoría'}</small></td>
            <td class="${stockClass}">${p.stock} ${p.unidad_medida}</td>
            <td>$${p.precio_venta ? p.precio_venta.toFixed(2) : '0.00'}</td>
        `;
        
        if (isAdmin) {
            rowHTML += `
                <td>$${(p.hasOwnProperty('precio_costo') && p.precio_costo) ? p.precio_costo.toFixed(2) : '0.00'}</td>
                <td>${p.stock_minimo}</td>
            `;
        }

        rowHTML += `<td class="actions">`;
        if (isAdmin) {
            rowHTML += `<button class="btn-edit" onclick="abrirModalEditarProducto(${p.id})">Editar</button><button class="btn-delete" onclick="borrarProducto(${p.id})">Borrar</button>`;
        } else {
            rowHTML += `<span>-</span>`;
        }
        rowHTML += `</td>`;
        
        tr.innerHTML = rowHTML;
        listaProductos.appendChild(tr);
    });

    if (productosFiltrados.length === 0) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">No se encontraron productos con ese filtro.</td></tr>`;
    }
}

export async function abrirModalEditarProducto(productoId) {
    try {
        const producto = await fetchData(`/api/productos/${productoId}`);
        
        document.getElementById('edit-producto-id').value = producto.id || '';
        document.getElementById('edit-nombre').value = producto.nombre || '';
        document.getElementById('edit-sku').value = producto.sku || '';
        document.getElementById('edit-codigo_barras').value = producto.codigo_barras || '';
        document.getElementById('edit-proveedor_id').value = producto.proveedor_id || '';
        document.getElementById('edit-categoria_id').value = producto.categoria_id || '';
        document.getElementById('edit-stock').value = producto.stock || 0;
        document.getElementById('edit-producto-stock-minimo').value = producto.stock_minimo || 0;
        document.getElementById('edit-precio-venta').value = producto.precio_venta || 0;
        document.getElementById('edit-precio-costo').value = producto.precio_costo || 0;
        
        document.getElementById('edit-product-modal').style.display = 'flex';
    } catch (error) {
        mostrarNotificacion("No se pudieron cargar los datos del producto: " + error.message, 'error');
    }
}

export async function borrarProducto(productoId) {
    const user = getCurrentUser();
    if (!user || user.rol !== 'admin') {
        mostrarNotificacion("Acción no permitida.", 'error');
        return;
    }
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;
    
    try {
        await fetchData(`/api/productos/${productoId}`, { method: 'DELETE' });
        mostrarNotificacion('Producto eliminado con éxito.', 'success');
        fetchProductos();
    } catch (error) {
        mostrarNotificacion('Error al eliminar el producto: ' + error.message, 'error');
    }
}

export async function inicializarLogicaInventario() {
    const formAdd = document.getElementById('form-add-producto');
    const formEdit = document.getElementById('form-edit-producto');
    const buscador = document.getElementById('buscador-productos');

    if (!formAdd) return;

    await poblarSelectores();

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nuevoProducto = {
            nombre: document.getElementById('nombre').value,
            stock: parseFloat(document.getElementById('stock').value),
            precio_venta: parseFloat(document.getElementById('precio_venta').value),
            precio_costo: parseFloat(document.getElementById('precio-costo-add').value) || null,
            unidad_medida: document.getElementById('unidad_medida').value,
            categoria_id: document.getElementById('categoria_id').value || null,
            stock_minimo: parseFloat(document.getElementById('producto-stock-minimo').value) || 5,
            proveedor_id: document.getElementById('proveedor_id').value || null,
            sku: document.getElementById('sku').value || null,
            codigo_barras: document.getElementById('codigo_barras').value || null
        };
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`, {
                method: 'POST', body: JSON.stringify(nuevoProducto)
            });
            mostrarNotificacion('Producto añadido con éxito', 'success');
            formAdd.reset();
            fetchProductos();
        } catch (error) {
            mostrarNotificacion("Error al añadir producto: " + error.message, 'error');
        }
    });

    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productoId = document.getElementById('edit-producto-id').value;
            const updatedData = {
                nombre: document.getElementById('edit-nombre').value,
                stock: parseFloat(document.getElementById('edit-stock').value),
                precio_venta: parseFloat(document.getElementById('edit-precio-venta').value),
                precio_costo: parseFloat(document.getElementById('edit-precio-costo').value) || null,
                categoria_id: document.getElementById('edit-categoria_id').value || null,
                stock_minimo: parseFloat(document.getElementById('edit-producto-stock-minimo').value),
                proveedor_id: document.getElementById('edit-proveedor_id').value || null,
                sku: document.getElementById('edit-sku').value || null,
                codigo_barras: document.getElementById('edit-codigo_barras').value || null
            };
            try {
                await fetchData(`/api/productos/${productoId}`, {
                    method: 'PUT', body: JSON.stringify(updatedData)
                });
                mostrarNotificacion('Producto actualizado con éxito', 'success');
                document.getElementById('edit-product-modal').style.display = 'none';
                fetchProductos();
            } catch (error) {
                mostrarNotificacion('Error al actualizar: ' + error.message, 'error');
            }
        });
    }

    if (buscador) {
        buscador.addEventListener('keyup', renderProductos);
    }

    fetchProductos();
}