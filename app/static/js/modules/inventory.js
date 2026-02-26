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
let selectedProductIds = new Set();

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
    headerRow.innerHTML = `<th class="col-check"><input type="checkbox" id="check-all-products"></th><th>Foto</th><th>Nombre</th><th>SKU</th><th>Categoría</th><th>Stock</th><th>Precio Venta</th>`;
    if (isAdmin) {
        headerRow.innerHTML += `<th>Costo</th>`;
    }
    headerRow.innerHTML += `<th>Acciones</th>`;
    const colspan = isAdmin ? 9 : 8;

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
        const isChecked = selectedProductIds.has(p.id) ? 'checked' : '';
        const imgHtml = p.imagen_url
            ? `<img src="${p.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.abrirModalEditarProducto(${p.id})">`
            : `<div style="width: 40px; height: 40px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ccc;"><i class="fas fa-image"></i></div>`;

        let rowHTML = `
            <td><input type="checkbox" class="product-check" data-id="${p.id}" ${isChecked}></td>
            <td>${imgHtml}</td>
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
            <button class="btn-info btn-sm" onclick="window.verBitacoraProducto(${p.id}, '${(p.nombre || '').replace(/'/g, "\\'")}')" title="Ver historial de cambios">📋</button>
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

    // 7. Sincronizar eventos de checkboxes
    vincularEventosCheckboxes();
    updateBulkActionBar();
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

// --- ✨ NUEVAS FUNCIONES ACCIONES MASIVAS ✨ ---

function vincularEventosCheckboxes() {
    const checkAll = document.getElementById('check-all-products');
    const rowChecks = document.querySelectorAll('.product-check');

    if (checkAll) {
        checkAll.onchange = (e) => {
            const isChecked = e.target.checked;
            rowChecks.forEach(cb => {
                const id = parseInt(cb.getAttribute('data-id'));
                cb.checked = isChecked;
                if (isChecked) selectedProductIds.add(id);
                else selectedProductIds.delete(id);
            });
            updateBulkActionBar();
        };
    }

    rowChecks.forEach(cb => {
        cb.onchange = (e) => {
            const id = parseInt(cb.getAttribute('data-id'));
            if (e.target.checked) selectedProductIds.add(id);
            else {
                selectedProductIds.delete(id);
                if (checkAll) checkAll.checked = false;
            }
            updateBulkActionBar();
        };
    });
}

function updateBulkActionBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const countEl = document.getElementById('bulk-count');
    if (!bar || !countEl) return;

    const count = selectedProductIds.size;
    if (count > 0) {
        countEl.textContent = count;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}

export function cancelBulkSelection() {
    selectedProductIds.clear();
    const checkAll = document.getElementById('check-all-products');
    if (checkAll) checkAll.checked = false;
    document.querySelectorAll('.product-check').forEach(cb => cb.checked = false);
    updateBulkActionBar();
}

async function bulkDeleteProductos() {
    const count = selectedProductIds.size;
    if (count === 0) return;

    const result = await Swal.fire({
        title: '¿Eliminar productos?',
        text: `Estás por eliminar ${count} productos permanentemente. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData('/api/productos/bulk', { product_ids: Array.from(selectedProductIds) }, 'DELETE');
            mostrarNotificacion(`${count} productos eliminados con éxito.`, 'success');
            selectedProductIds.clear();
            await fetchProductos();
        } catch (error) {
            mostrarNotificacion('Error al realizar el borrado masivo.', 'error');
        }
    }
}

async function abrirModalBulkCategoria() {
    if (selectedProductIds.size === 0) return;

    // Poblar el selector del modal masivo (usamos la misma lógica que el modal individual)
    const [categorias] = await Promise.all([
        fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`)
    ]);

    const selectBulk = document.getElementById('bulk-producto-categoria');
    if (selectBulk) {
        selectBulk.innerHTML = `<option value="">Seleccionar nueva categoría...</option>`;
        categorias.forEach(cat => {
            selectBulk.innerHTML += `<option value="${cat.id}">${cat.nombre_indentado}</option>`;
        });
    }

    document.getElementById('modal-bulk-categoria').style.display = 'flex';
}

async function guardarBulkCategoria() {
    const catId = document.getElementById('bulk-producto-categoria').value;
    if (!catId) {
        mostrarNotificacion("Debe seleccionar una categoría.", "warning");
        return;
    }

    const btn = document.getElementById('btn-confirmar-bulk-categoria');
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    try {
        await sendData('/api/productos/bulk/categoria', {
            product_ids: Array.from(selectedProductIds),
            categoria_id: parseInt(catId)
        }, 'PUT');

        mostrarNotificacion('Categorías actualizadas con éxito.', 'success');
        document.getElementById('modal-bulk-categoria').style.display = 'none';
        selectedProductIds.clear();
        await fetchProductos();
    } catch (error) {
        mostrarNotificacion('Error al actualizar categorías.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Actualizar Todos';
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
        if (selectUnidad) {
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
        document.getElementById('producto-stock-minimo').value = producto.stock_minimo || 0;
        document.getElementById('producto-peso').value = producto.peso_kg || 0;
        document.getElementById('producto-volumen').value = producto.volumen_m3 || 0;
        document.getElementById('producto-unidad-medida').value = producto.unidad_medida || 'un';
        document.getElementById('producto-codigo-barras').value = producto.codigo_barras || '';
        document.getElementById('producto-precio-costo').value = producto.precio_costo || '';
        document.getElementById('producto-precio-venta').value = producto.precio_venta || '';
    } else { // Modo Creación
        titulo.textContent = 'Añadir Nuevo Producto';
        document.getElementById('producto-id').value = '';
    }

    // Resetear campo de imagen y preview
    const imgInput = document.getElementById('producto-imagen');
    const previewContainer = document.getElementById('producto-imagen-preview');
    const previewImg = previewContainer.querySelector('img');
    if (imgInput) imgInput.value = '';
    if (previewContainer) {
        if (producto && producto.imagen_url) {
            previewImg.src = producto.imagen_url;
            previewContainer.style.display = 'block';
        } else {
            previewImg.src = '';
            previewContainer.style.display = 'none';
        }
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
        stock: parseFloat(document.getElementById('producto-stock').value),
        stock_minimo: parseFloat(document.getElementById('producto-stock-minimo').value),
        peso_kg: parseFloat(document.getElementById('producto-peso').value) || 0,
        volumen_m3: parseFloat(document.getElementById('producto-volumen').value) || 0,
        unidad_medida: document.getElementById('producto-unidad-medida').value,
        codigo_barras: document.getElementById('producto-codigo-barras').value || null,
        precio_costo: parseFloat(document.getElementById('producto-precio-costo').value) || null,
        precio_venta: parseFloat(document.getElementById('producto-precio-venta').value)
    };

    const esEdicion = !!id;
    const url = esEdicion ? `/api/productos/${id}` : `/api/negocios/${appState.negocioActivoId}/productos`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        const productoGuardado = response;

        // --- ✨ SUBIDA DE IMAGEN (Si hay archivo seleccionado) ---
        const fileInput = document.getElementById('producto-imagen');
        if (fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('imagen', fileInput.files[0]);

            const uploadUrl = `/api/productos/${productoGuardado.id}/upload-image`;
            const headers = getAuthHeaders();
            delete headers['Content-Type'];
            delete headers['content-type'];

            await fetch(uploadUrl, {
                method: 'POST',
                headers: headers,
                body: formData
            });
        }

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
        mostrarNotificacion("Por favor, selecciona un archivo CSV o Excel.", "error");
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

export async function verBitacoraProducto(productoId, nombre) {
    const modal = document.getElementById('modal-bitacora-producto');
    const titulo = document.getElementById('bitacora-producto-nombre');
    const tbody = document.querySelector('#tabla-bitacora-producto tbody');

    if (!modal || !tbody) return;

    titulo.textContent = nombre;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center"><i>Cargando...</i></td></tr>`;
    modal.style.display = 'flex';

    try {
        const registros = await fetchData(`/api/productos/${productoId}/bitacora`);

        if (registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin cambios registrados aún.</td></tr>`;
            return;
        }

        const campoLabel = { precio_venta: '💰 Precio Venta', precio_costo: '📦 Precio Costo', stock: '📊 Stock' };

        tbody.innerHTML = registros.map(r => {
            const fecha = r.fecha_local ? new Date(r.fecha_local).toLocaleString('es-AR') : '-';
            const campo = campoLabel[r.campo] || r.campo;
            const anterior = r.valor_anterior != null ? Number(r.valor_anterior).toLocaleString('es-AR') : '-';
            const nuevo = r.valor_nuevo != null ? Number(r.valor_nuevo).toLocaleString('es-AR') : '-';
            const diff = r.valor_anterior != null && r.valor_nuevo != null
                ? Number(r.valor_nuevo) - Number(r.valor_anterior) : null;
            const diffHtml = diff !== null
                ? `<small class="${diff >= 0 ? 'text-success' : 'text-danger'}">${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR')}</small>`
                : '';
            return `<tr>
                <td><small>${fecha}</small></td>
                <td>${campo}</td>
                <td class="text-end">${anterior}</td>
                <td class="text-end fw-bold">${nuevo} ${diffHtml}</td>
                <td><small class="text-muted">${r.usuario_nombre || '-'}</small></td>
            </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar historial.</td></tr>`;
    }
}

// ---
// EXPORTAR PRODUCTOS CON PORCENTAJE (Simplificado y Rápido)
// ---
async function poblarCategoriasExportar() {
    const select = document.getElementById('exportar-categorias');
    if (!select) return;
    try {
        const categorias = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`);
        select.innerHTML = '<option value="all" selected>-- Todas las Categorías --</option>';
        categorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.nombre_indentado || cat.nombre}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar categorías para exportación:", error);
    }
}

function getNombreNegocio() {
    if (appState.negociosCache && appState.negociosCache.length > 0) {
        const negocio = appState.negociosCache.find(n => n.id === appState.negocioActivoId);
        if (negocio) return negocio.nombre;
    }
    // Fallback: intentar sacarlo del selector de la interfaz si está visible
    const selector = document.getElementById('selector-negocio');
    if (selector && selector.options[selector.selectedIndex]) {
        return selector.options[selector.selectedIndex].text;
    }
    return 'Mi Negocio';
}

export function abrirModalExportar() {
    const modal = document.getElementById('modal-exportar-producto');
    if (!modal) return;
    document.getElementById('exportar-porcentaje').value = 0;
    poblarCategoriasExportar();
    modal.style.display = 'flex';
}

async function exportarProductosConPrecio() {
    const porcentaje = parseFloat(document.getElementById('exportar-porcentaje').value) || 0;
    const catSelect = document.getElementById('exportar-categorias');
    const selectedCats = Array.from(catSelect.selectedOptions).map(opt => opt.value);

    const btn = document.getElementById('btn-confirmar-exportar');
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        let productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);

        if (productos.length === 0) {
            mostrarNotificacion("No hay productos para exportar.", "warning");
            return;
        }

        // Filtrar por categorías si no es "all"
        if (!selectedCats.includes('all')) {
            const catIds = selectedCats.map(id => parseInt(id));
            productos = productos.filter(p => catIds.includes(p.categoria_id));
        }

        if (productos.length === 0) {
            mostrarNotificacion("No hay productos en las categorías seleccionadas.", "warning");
            return;
        }

        // 1. Agrupar/Ordenar por Categoría
        productos.sort((a, b) => {
            const catA = a.categoria_nombre || 'Sin categoría';
            const catB = b.categoria_nombre || 'Sin categoría';
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return a.nombre.localeCompare(b.nombre);
        });

        // 2. Mapear datos con cálculo de porcentaje
        const factor = 1 + (porcentaje / 100);
        const dataExcel = productos.map(p => {
            const precioBase = parseFloat(p.precio_venta) || 0;
            const precioAjustado = precioBase * factor;

            return {
                'Categoría': p.categoria_nombre || 'Sin categoría',
                'Producto': p.nombre,
                'Alias': p.alias || '',
                'SKU': p.sku || '',
                'Stock': p.stock,
                'Unidad': p.unidad_medida || 'un',
                'Precio Base': precioBase,
                [`Precio Ajustado (${porcentaje >= 0 ? '+' : ''}${porcentaje}%)`]: Math.round(precioAjustado * 100) / 100
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataExcel);

        // Ajustar anchos de columna básicos
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, ws, "Lista de Precios");
        XLSX.writeFile(wb, `Lista_Precios_Exportada_${porcentaje}pct.xlsx`);

        mostrarNotificacion("Exportación completada con éxito.", "success");
        document.getElementById('modal-exportar-producto').style.display = 'none';
    } catch (error) {
        console.error("Error al exportar:", error);
        mostrarNotificacion("Error al generar el archivo de exportación.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function exportarProductosAPDF() {
    if (typeof window.jspdf === 'undefined') {
        mostrarNotificacion('Error: La librería jsPDF no está cargada.', 'error');
        return;
    }

    const porcentaje = parseFloat(document.getElementById('exportar-porcentaje').value) || 0;
    const catSelect = document.getElementById('exportar-categorias');
    const selectedCats = Array.from(catSelect.selectedOptions).map(opt => opt.value);

    const btn = document.getElementById('btn-confirmar-pdf');
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        let productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);

        if (productos.length === 0) {
            mostrarNotificacion("No hay productos para exportar.", "warning");
            return;
        }

        // Filtrar por categorías si no es "all"
        if (!selectedCats.includes('all')) {
            const catIds = selectedCats.map(id => parseInt(id));
            productos = productos.filter(p => catIds.includes(p.categoria_id));
        }

        if (productos.length === 0) {
            mostrarNotificacion("No hay productos en las categorías seleccionadas.", "warning");
            return;
        }

        // 1. Agrupar/Ordenar por Categoría
        productos.sort((a, b) => {
            const catA = a.categoria_nombre || 'Sin categoría';
            const catB = b.categoria_nombre || 'Sin categoría';
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return a.nombre.localeCompare(b.nombre);
        });

        // 2. Preparar jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const nombreNegocio = getNombreNegocio();

        // Membrete
        doc.setFontSize(18);
        doc.setTextColor(44, 62, 80); // Azul oscuro medianoche
        doc.text(nombreNegocio, 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(52, 152, 219); // Azul primario
        doc.text("LISTA DE PRECIOS", 14, 30);

        const fechaActual = new Date();
        const fechaFin = new Date();
        fechaFin.setDate(fechaActual.getDate() + 7);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Fecha de emisión: ${fechaActual.toLocaleDateString('es-AR')}`, 14, 38);
        doc.setTextColor(192, 57, 43); // Rojo suave
        doc.text(`* Oferta válida hasta: ${fechaFin.toLocaleDateString('es-AR')} (7 días)`, 14, 43);

        // Tabla
        const factor = 1 + (porcentaje / 100);
        const tableBody = productos.map(p => [
            p.categoria_nombre || 'Sin categoría',
            p.nombre,
            p.sku || '-',
            `$${(parseFloat(p.precio_venta) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            `$${((parseFloat(p.precio_venta) || 0) * factor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        ]);

        doc.autoTable({
            head: [['Categoría', 'Producto', 'SKU', 'Precio Lista', `Revendedor (${porcentaje >= 0 ? '+' : ''}${porcentaje}%)`]],
            body: tableBody,
            startY: 50,
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80], fontSize: 9, halign: 'center' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        doc.save(`Lista_Precios_${nombreNegocio.replace(/\s+/g, '_')}.pdf`);
        mostrarNotificacion("PDF generado con éxito.", "success");
        document.getElementById('modal-exportar-producto').style.display = 'none';

    } catch (error) {
        console.error("Error al exportar PDF:", error);
        mostrarNotificacion("Error al generar el PDF.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

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

    // Preview de imagen
    const imgInput = document.getElementById('producto-imagen');
    if (imgInput) {
        imgInput.onchange = (e) => {
            const file = e.target.files[0];
            const previewContainer = document.getElementById('producto-imagen-preview');
            const previewImg = previewContainer.querySelector('img');
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'none';
                previewImg.src = '';
            }
        };
    }

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

    // Lógica del modal de exportación
    const btnAbrirExportar = document.getElementById('btn-abrir-modal-exportar');
    const modalExportar = document.getElementById('modal-exportar-producto');
    const btnCerrarExportar = document.getElementById('close-modal-exportar');
    const btnConfirmarExportar = document.getElementById('btn-confirmar-exportar');
    const btnConfirmarPdf = document.getElementById('btn-confirmar-pdf');

    if (btnAbrirExportar) {
        btnAbrirExportar.addEventListener('click', abrirModalExportar);
        btnCerrarExportar.addEventListener('click', () => modalExportar.style.display = 'none');
        btnConfirmarExportar.addEventListener('click', exportarProductosConPrecio);
        if (btnConfirmarPdf) btnConfirmarPdf.addEventListener('click', exportarProductosAPDF);
        window.addEventListener('click', (e) => {
            if (e.target == modalExportar) modalExportar.style.display = 'none';
        });
    }

    // Carga inicial
    await poblarSelectoresDelModal();
    fetchProductos();

    // NUEVOS LISTENERS MASIVOS
    const btnBulkCat = document.getElementById('btn-bulk-categoria');
    const btnBulkDel = document.getElementById('btn-bulk-borrar');
    const btnBulkCan = document.getElementById('btn-bulk-cancelar');
    const btnBulkConfirmCat = document.getElementById('btn-confirmar-bulk-categoria');
    const closeModalBulkCat = document.getElementById('close-modal-bulk-cat');

    if (btnBulkCat) btnBulkCat.onclick = abrirModalBulkCategoria;
    if (btnBulkDel) btnBulkDel.onclick = bulkDeleteProductos;
    if (btnBulkCan) btnBulkCan.onclick = cancelBulkSelection;
    if (btnBulkConfirmCat) btnBulkConfirmCat.onclick = guardarBulkCategoria;
    if (closeModalBulkCat) closeModalBulkCat.onclick = () => document.getElementById('modal-bulk-categoria').style.display = 'none';

    // Registrar función global de exportación (opcional si se quier llamar de fuera)
    window.abrirModalExportar = abrirModalExportar;

    // Registrar función global de bitácora
    window.verBitacoraProducto = verBitacoraProducto;
    window.addEventListener('click', (e) => {
        const modalBitacora = document.getElementById('modal-bitacora-producto');
        if (modalBitacora && e.target == modalBitacora) modalBitacora.style.display = 'none';
    });
}
