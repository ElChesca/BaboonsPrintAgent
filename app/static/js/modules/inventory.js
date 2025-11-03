// static/js/modules/inventory.js (Versión Actualizada)

import { getCurrentUser, getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js'; // Usamos sendData para guardar
import { mostrarNotificacion } from './notifications.js';

let productosCache = [];

// --- Funciones de Renderizado y Carga de Datos (SIN CAMBIOS) ---

function renderProductos() {
    const user = getCurrentUser();
    const isAdmin = user && user.rol === 'admin';
    const listaProductos = document.querySelector('#tabla-productos tbody');
    const headerRow = document.querySelector('#tabla-productos thead tr');
    const filtro = document.getElementById('buscador-productos')?.value.toLowerCase() || '';

    if (!listaProductos || !headerRow) return;

    headerRow.innerHTML = `<th>Nombre</th><th>SKU</th><th>Categoría</th><th>Stock</th><th>Precio Venta</th>`;
    if (isAdmin) {
        headerRow.innerHTML += `<th>Costo</th>`;
    }
    headerRow.innerHTML += `<th>Acciones</th>`;
    
    const colspan = isAdmin ? 7 : 6;

    if (!appState.negocioActivoId) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">Seleccione un negocio para ver su inventario.</td></tr>`;
        return;
    }

    const productosFiltrados = productosCache.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
        (p.sku && p.sku.toLowerCase().includes(filtro)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(filtro))
    );
    
    listaProductos.innerHTML = '';
    productosFiltrados.forEach(p => {
        const stockClass = (p.stock > 0 && p.stock <= p.stock_minimo) ? 'stock-bajo' : '';
        const aliasHtml = p.alias ? `<small class="text-muted d-block">${p.alias}</small>` : '';
        let rowHTML = `
            <td>${p.nombre}${aliasHtml}</td>
            <td>${p.sku || '-'}</td>
            <td>${p.categoria_nombre || 'Sin categoría'}</td>
            <td class="${stockClass}">${p.stock} ${p.unidad_medida || 'un'}</td>
            <td>${(p.precio_venta || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
        `;
        if (isAdmin) {
            rowHTML += `<td>${(p.precio_costo || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>`;
        }
        rowHTML += `<td class="acciones">
            <button class="btn-secondary btn-sm" onclick="window.abrirModalEditarProducto(${p.id})">Editar</button>
            <button class="btn-danger btn-sm" onclick="window.borrarProducto(${p.id})">Borrar</button>
        </td>`;
        listaProductos.innerHTML += `<tr>${rowHTML}</tr>`;
    });

    if (productosFiltrados.length === 0) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">No se encontraron productos.</td></tr>`;
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
        mostrarNotificacion('No se pudieron cargar los productos.', 'error');
    }
}

async function poblarSelectoresDelModal() {
    try {
        const [categorias, proveedores, unidades] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/unidades_medida`)
        ]);

        const selectores = {
            'producto-categoria': categorias,
            'producto-proveedor': proveedores
        };

        for (const [id, data] of Object.entries(selectores)) {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = `<option value="">Seleccionar...</option>`;
                data.forEach(item => {
                    select.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
                });
            }
        }
        
        const selectUnidad = document.getElementById('producto-unidad-medida');
        if(selectUnidad) {
            selectUnidad.innerHTML = '';
            unidades.forEach(um => {
                selectUnidad.innerHTML += `<option value="${um.abreviatura}">${um.nombre} (${um.abreviatura})</option>`;
            });
        }
    } catch (error) {
        mostrarNotificacion("Error al cargar datos para el formulario.", 'error');
    }
}


// --- Lógica del Modal (Producto Individual - SIN CAMBIOS) ---

function abrirModal(producto = null) {
    const modal = document.getElementById('modal-producto');
    const titulo = document.getElementById('modal-producto-titulo');
    document.getElementById('form-producto').reset();

    if (producto) { // Modo Edición
        titulo.textContent = 'Editar Producto';
        document.getElementById('producto-id').value = producto.id;
        document.getElementById('producto-nombre').value = producto.nombre;
        document.getElementById('producto-alias').value = producto.alias || '';
        document.getElementById('producto-sku').value = producto.sku || '';
        document.getElementById('producto-categoria').value = producto.categoria_id || '';
        document.getElementById('producto-proveedor').value = producto.proveedor_id || '';
        document.getElementById('producto-stock').value = producto.stock || 0;
        document.getElementById('producto-stock-minimo').value = producto.stock_minimo || 0;
        document.getElementById('producto-unidad-medida').value = producto.unidad_medida || 'un';
        document.getElementById('producto-codigo-barras').value = producto.codigo_barras || '';
        document.getElementById('producto-precio-costo').value = producto.precio_costo || '';
        document.getElementById('producto-precio-venta').value = producto.precio_venta || '';
    } else { // Modo Creación
        titulo.textContent = 'Añadir Nuevo Producto';
        document.getElementById('producto-id').value = '';
    }
    modal.style.display = 'flex';
}

async function guardarProducto(e) {
    e.preventDefault();
    const botonGuardar = e.target.querySelector('button[type="submit"]');
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';

    const id = document.getElementById('producto-id').value;
    const data = {
        nombre: document.getElementById('producto-nombre').value,
        alias: document.getElementById('producto-alias').value || null,
        sku: document.getElementById('producto-sku').value || null,
        categoria_id: document.getElementById('producto-categoria').value || null,
        proveedor_id: document.getElementById('producto-proveedor').value || null,
        stock: parseFloat(document.getElementById('producto-stock').value),
        stock_minimo: parseFloat(document.getElementById('producto-stock-minimo').value),
        unidad_medida: document.getElementById('producto-unidad-medida').value,
        codigo_barras: document.getElementById('producto-codigo-barras').value || null,
        precio_costo: parseFloat(document.getElementById('producto-precio-costo').value) || null,
        precio_venta: parseFloat(document.getElementById('producto-precio-venta').value)
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/productos/${id}` : `/api/negocios/${appState.negocioActivoId}/productos`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Producto ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        document.getElementById('modal-producto').style.display = 'none';
        await fetchProductos();
    } catch (error) {
        if (error.message.includes('409')) {
            mostrarNotificacion('Error: Ya existe un producto con este SKU en este negocio.', 'error');
        } else {
            mostrarNotificacion(error.message, 'error');
        }
    } finally {
        botonGuardar.disabled = false;
        botonGuardar.textContent = 'Guardar';
    }
}


// --- ✨ NUEVA LÓGICA PARA EL MODAL DE IMPORTACIÓN ---
async function importarProductos(e) {
    e.preventDefault();
    const boton = document.getElementById('btn-submit-importar');
    const feedback = document.getElementById('importar-feedback');
    const fileInput = document.getElementById('archivo-importar');
    const file = fileInput.files[0];

    if (!file) {
        mostrarNotificacion("Por favor, selecciona un archivo CSV.", "error");
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Importando...';
    feedback.innerHTML = '<p>Procesando archivo, esto puede tardar...</p>';
    feedback.className = 'importar-feedback info';

    const formData = new FormData();
    formData.append('archivo_productos', file);

    const url = `/api/negocios/${appState.negocioActivoId}/productos/importar`;

    try {
        // Usamos fetch directamente porque 'sendData' puede estar configurado
        // para JSON y no para FormData.
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(), // Solo token de Auth, SIN 'Content-Type'
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status} al importar`);
        }

        // Éxito: Mostrar resumen
        let feedbackHTML = `
            <p><strong>${data.message}</strong></p>
            <ul>
                <li>✅ Creados: <strong>${data.creados}</strong></li>
                <li>🔄 Actualizados: <strong>${data.actualizados}</strong></li>
                <li>❌ Errores: <strong>${data.errores.length}</strong></li>
            </ul>
        `;
        if (data.errores.length > 0) {
            feedbackHTML += '<p><strong>Detalle de errores:</strong></p>';
            feedbackHTML += `<ul class="lista-errores"><li>${data.errores.join('</li><li>')}</li></ul>`;
        }
        feedback.innerHTML = feedbackHTML;
        feedback.className = 'importar-feedback success';
        
        await fetchProductos(); // Recargar la lista de productos
        
    } catch (error) {
        console.error("Error en importarProductos:", error);
        feedback.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        feedback.className = 'importar-feedback error';
        mostrarNotificacion(error.message, 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Subir e Importar';
        fileInput.value = ''; // Limpiar el input de archivo
    }
}


// --- Funciones Globales para onclick (SIN CAMBIOS) ---

export async function abrirModalEditarProducto(productoId) {
    try {
        const producto = productosCache.find(p => p.id === productoId);
        if (producto) {
            abrirModal(producto);
        } else {
            const productoRemoto = await fetchData(`/api/productos/${productoId}`);
            abrirModal(productoRemoto);
        }
    } catch (error) {
        mostrarNotificacion("No se pudieron cargar los datos del producto.", 'error');
    }
};


export async function borrarProducto(productoId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;
    try {
        await sendData(`/api/productos/${productoId}`, {}, 'DELETE');
        mostrarNotificacion('Producto eliminado con éxito.', 'success');
        await fetchProductos();
    } catch (error) {
        mostrarNotificacion('Error al eliminar el producto.', 'error');
    }
};


// --- Función de Inicialización (ACTUALIZADA) ---
export async function inicializarLogicaInventario() {
    const formProducto = document.getElementById('form-producto');
    const buscador = document.getElementById('buscador-productos');
    const btnAbrirModal = document.getElementById('btn-abrir-modal-producto');
    const modal = document.getElementById('modal-producto');
    const closeModalBtn = document.getElementById('close-modal-producto');
    
    if (!formProducto) return;

    btnAbrirModal.addEventListener('click', () => abrirModal());
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    formProducto.addEventListener('submit', guardarProducto);
    buscador.addEventListener('keyup', renderProductos);

    // --- ✨ NUEVOS LISTENERS PARA EL MODAL DE IMPORTACIÓN ---
    const modalImportar = document.getElementById('modal-importar-producto');
    const btnAbrirImportar = document.getElementById('btn-abrir-modal-importar');
    const btnCerrarImportar = document.getElementById('close-modal-importar');
    const formImportar = document.getElementById('form-importar-producto');
    const feedbackImportar = document.getElementById('importar-feedback');

    if (modalImportar) {
        btnAbrirImportar.addEventListener('click', () => {
            // Reseteamos el feedback al abrir
            feedbackImportar.innerHTML = '';
            feedbackImportar.className = 'importar-feedback';
            formImportar.reset();
            modalImportar.style.display = 'flex';
        });
        btnCerrarImportar.addEventListener('click', () => modalImportar.style.display = 'none');
        formImportar.addEventListener('submit', importarProductos);
        
        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target == modalImportar) modalImportar.style.display = 'none';
        });
    }
    // --- FIN DE NUEVOS LISTENERS ---

    await poblarSelectoresDelModal();
    fetchProductos();
}