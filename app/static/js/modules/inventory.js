// static/js/modules/inventory.js
// ✨ ARCHIVO COMPLETO Y CORREGIDO ✨

import { getCurrentUser, getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let productosCache = [];
// --- Variables de Paginación ---
let currentPage = 1;
const itemsPerPage = 15; // Número de productos por página

// ---
// FUNCIÓN PARA CAMBIAR DE PÁGINA (llamada desde onclick)
// ---
export function changeProductPage(newPage) {
    if (newPage < 1) return;
    currentPage = newPage;
    renderProductos();
}

// ---
// FUNCIÓN PARA RENDERIZAR LA TABLA (con filtro corregido)
// ---
function renderProductos() {
    const user = getCurrentUser();
    const isAdmin = user && user.rol === 'admin';
    const listaProductos = document.querySelector('#tabla-productos tbody');
    const headerRow = document.querySelector('#tabla-productos thead tr');
    const filtro = document.getElementById('buscador-productos')?.value.toLowerCase() || '';

    if (!listaProductos || !headerRow) return;

    // 1. Renderizar cabecera
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

    // ✨ 2. FILTRO CORREGIDO (Maneja valores NULL) ✨
    const productosFiltrados = productosCache.filter(p => {
        const nombre = String(p.nombre || '').toLowerCase();
        const sku = String(p.sku || '').toLowerCase();
        const codigoBarras = String(p.codigo_barras || '').toLowerCase();
        
        return nombre.includes(filtro) || 
               sku.includes(filtro) || 
               codigoBarras.includes(filtro);
    });
    
    // 3. Renderizar resumen
    const summaryEl = document.getElementById('productos-summary');
    if (summaryEl) {
        let summaryText = `<strong>${productosFiltrados.length}</strong> productos encontrados`;
        if (filtro) {
            summaryText += ` (de <strong>${productosCache.length}</strong> productos totales)`;
        }
        summaryEl.innerHTML = summaryText;
    }

    // 4. Calcular paginación
    const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages; 
    } else if (totalPages === 0) {
        currentPage = 1;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productosPaginados = productosFiltrados.slice(startIndex, endIndex);

    // 5. Renderizar filas de la tabla
    listaProductos.innerHTML = '';
    productosPaginados.forEach(p => {
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

    if (productosPaginados.length === 0) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">No se encontraron productos.</td></tr>`;
    }

    // 6. Renderizar botones de paginación
    const paginationEl = document.getElementById('productos-pagination');
    if (paginationEl) {
        paginationEl.innerHTML = '';
        if (totalPages > 1) {
            const btnPrev = document.createElement('button');
            btnPrev.innerHTML = '&laquo; Anterior';
            btnPrev.className = 'btn-secondary';
            if (currentPage === 1) btnPrev.disabled = true;
            btnPrev.onclick = () => changeProductPage(currentPage - 1);
            
            const pageInfo = document.createElement('span');
            pageInfo.className = 'page-info';
            pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
            
            const btnNext = document.createElement('button');
            btnNext.innerHTML = 'Siguiente &raquo;';
            btnNext.className = 'btn-secondary';
            if (currentPage === totalPages) btnNext.disabled = true;
            btnNext.onclick = () => changeProductPage(currentPage + 1);
            
            paginationEl.appendChild(btnPrev);
            paginationEl.appendChild(pageInfo);
            paginationEl.appendChild(btnNext);
        }
    }
}

// ---
// FUNCIÓN PARA OBTENER LOS DATOS (¡Aquí estaba el error!)
// ---
async function fetchProductos() {
    if (!appState.negocioActivoId) {
        productosCache = [];
        renderProductos();
        return;
    }
    try {
        productosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        currentPage = 1; // Resetear a la página 1
        renderProductos(); // Renderizar después de cargar
    } catch (error) {
        // Añadimos el console.error para ver el detalle en la consola
        console.error('Error detallado al cargar productos:', error); 
        mostrarNotificacion('No se pudieron cargar los productos.', 'error');
    }
}

// ---
// FUNCIÓN PARA POBLAR MODALES (con subcategorías)
// ---
async function poblarSelectoresDelModal() {
    try {
        const [categorias, proveedores, unidades] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/unidades_medida`)
        ]);

        // Renderizado de categorías (con indentación)
        const selectCat = document.getElementById('producto-categoria');
        if (selectCat) {
            selectCat.innerHTML = `<option value="">Seleccionar...</option>`;
            categorias.forEach(cat => {
                selectCat.innerHTML += `
                    <option value="${cat.id}" title="${cat.ruta_categoria}">
                        ${cat.nombre_indentado}
                    </option>`;
            });
        }

        // Renderizado de proveedores
        const selectProv = document.getElementById('producto-proveedor');
        if (selectProv) {
            selectProv.innerHTML = `<option value="">Seleccionar...</option>`;
            proveedores.forEach(item => {
                selectProv.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
            });
        }
        
        // Renderizado de unidades de medida
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

// ---
// LÓGICA DEL MODAL (Crear/Editar)
// ---
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
        await fetchProductos(); // Recarga la lista
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

// ---
// LÓGICA DEL MODAL DE IMPORTACIÓN
// ---
async function importarProductos(e) {
    e.preventDefault();
    const boton = document.getElementById('btn-submit-importar');
    const fileInput = document.getElementById('archivo-importar');
    
    const feedbackContainer = document.getElementById('importar-feedback');
    const loader = document.getElementById('importar-loader');
    const feedbackTexto = document.getElementById('importar-feedback-texto');
    
    const file = fileInput.files[0];

    if (!file) {
        mostrarNotificacion("Por favor, selecciona un archivo CSV.", "error");
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Importando...';
    
    feedbackContainer.className = 'importar-feedback info';
    loader.style.display = 'block';
    feedbackTexto.innerHTML = '<p>Procesando archivo, esto puede tardar...</p>';

    const formData = new FormData();
    formData.append('archivo_productos', file);

    const url = `/api/negocios/${appState.negocioActivoId}/productos/importar`;

    try {
        const headers = getAuthHeaders();
        delete headers['Content-Type'];
        delete headers['content-type']; 

        const response = await fetch(url, {
            method: 'POST',
            headers: headers, 
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status} al importar`);
        }

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
        feedbackContainer.className = 'importar-feedback success';
        feedbackTexto.innerHTML = feedbackHTML;
        
        await fetchProductos(); // Recargar la lista
        
    } catch (error) {
        console.error("Error en importarProductos:", error);
        feedbackContainer.className = 'importar-feedback error';
        feedbackTexto.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        mostrarNotificacion(error.message, 'error');
    } finally {
        loader.style.display = 'none'; 
        boton.disabled = false;
        boton.textContent = 'Subir e Importar';
        fileInput.value = ''; 
    }
}

// ---
// FUNCIONES GLOBALES (Edit/Delete)
// ---
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
        await fetchProductos(); // Recarga la lista
    } catch (error) {
        mostrarNotificacion('Error al eliminar el producto.', 'error');
    }
};

// ---
// FUNCIÓN DE INICIALIZACIÓN (con listeners corregidos)
// ---
export async function inicializarLogicaInventario() {
    const formProducto = document.getElementById('form-producto');
    const buscador = document.getElementById('buscador-productos');
    const btnAbrirModal = document.getElementById('btn-abrir-modal-producto');
    const modal = document.getElementById('modal-producto');
    const closeModalBtn = document.getElementById('close-modal-producto');
    
    if (!formProducto) return;

    // Lógica del modal de producto
    btnAbrirModal.addEventListener('click', () => abrirModal());
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
    formProducto.addEventListener('submit', guardarProducto);

    // Lógica del buscador (resetea paginación)
    buscador.addEventListener('keyup', () => {
        currentPage = 1;
        renderProductos();
    });

    // Lógica del modal de importación (con reseteo corregido)
    const modalImportar = document.getElementById('modal-importar-producto');
    const btnAbrirImportar = document.getElementById('btn-abrir-modal-importar');
    const btnCerrarImportar = document.getElementById('close-modal-importar');
    const formImportar = document.getElementById('form-importar-producto');

    if (modalImportar) {
        btnAbrirImportar.addEventListener('click', () => {
            const feedbackContainer = document.getElementById('importar-feedback');
            const loader = document.getElementById('importar-loader');
            const feedbackTexto = document.getElementById('importar-feedback-texto');

            if (feedbackContainer) feedbackContainer.className = 'importar-feedback';
            if (loader) loader.style.display = 'none';
            if (feedbackTexto) feedbackTexto.innerHTML = '';
            
            formImportar.reset();
            modalImportar.style.display = 'flex';
        });
        
        btnCerrarImportar.addEventListener('click', () => modalImportar.style.display = 'none');
        formImportar.addEventListener('submit', importarProductos);
        
        window.addEventListener('click', (e) => {
            if (e.target == modalImportar) modalImportar.style.display = 'none';
        });
    }

    // Carga inicial
    await poblarSelectoresDelModal();
    fetchProductos(); // <-- Esta es la llamada que daba el error
}