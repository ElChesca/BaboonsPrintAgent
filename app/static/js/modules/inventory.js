// static/js/modules/inventory.js
// ✨ ARCHIVO COMPLETO Y CORREGIDO ✨

import { getCurrentUser, getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let productosCache = [];
// --- Variables de Paginación y Ordenamiento ---
let currentPage = 1;
const itemsPerPage = 15; // Número de productos por página
let selectedProductIds = new Set();
let sortColumn = 'nombre';
let sortDirection = 'asc';

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

    // 1. Renderizar cabecera con ordenamiento
    const getSortIcon = (col) => {
        if (sortColumn !== col) return '<i class="fas fa-sort text-muted ms-1" style="font-size: 0.8rem;"></i>';
        return sortDirection === 'asc' ? '<i class="fas fa-sort-up ms-1"></i>' : '<i class="fas fa-sort-down ms-1"></i>';
    };

    let headerHTML = `<th class="col-check"><input type="checkbox" id="check-all-products"></th><th>Foto</th>`;
    headerHTML += `<th onclick="window.sortInventory('nombre')" style="cursor: pointer;">Nombre ${getSortIcon('nombre')}</th>`;
    headerHTML += `<th onclick="window.sortInventory('sku')" style="cursor: pointer;">SKU ${getSortIcon('sku')}</th>`;
    headerHTML += `<th onclick="window.sortInventory('categoria_nombre')" style="cursor: pointer;">Categoría ${getSortIcon('categoria_nombre')}</th>`;
    
    // Ocultar columnas industriales/logísticas en Restó
    const esResto = appState.negocioActivoTipo === 'resto';
    
    if (!esResto) {
        headerHTML += `<th onclick="window.sortInventory('ubicacion')" style="cursor: pointer;">Ubicación ${getSortIcon('ubicacion')}</th>`;
    }
    
    headerHTML += `<th onclick="window.sortInventory('stock')" style="cursor: pointer;">Stock ${getSortIcon('stock')}</th>`;
    
    if (!esResto) {
        headerHTML += `<th onclick="window.sortInventory('stock_comprometido')" style="cursor: pointer;" title="Comprometido en pedidos pendientes">Comprometido ${getSortIcon('stock_comprometido')}</th>`;
        headerHTML += `<th onclick="window.sortInventory('stock_movil')" style="cursor: pointer;">Móvil ${getSortIcon('stock_movil')}</th>`;
    }
    
    headerHTML += `<th onclick="window.sortInventory('precio_venta')" style="cursor: pointer;">Precio Venta ${getSortIcon('precio_venta')}</th>`;

    if (isAdmin) {
        headerHTML += `<th onclick="window.sortInventory('precio_costo')" style="cursor: pointer;">Costo ${getSortIcon('precio_costo')}</th>`;
    }
    headerHTML += `<th>Acciones</th>`;
    headerRow.innerHTML = headerHTML;
    
    // Calcular colspan dinámico para mensajes de error
    let colspan = 6; // Base: check, foto, nombre, sku, cat, stock, precio, acciones (8)
    if (!esResto) colspan += 3; // ubicacion, comprometido, movil
    if (isAdmin) colspan += 1; // costo

    if (!appState.negocioActivoId) {
        listaProductos.innerHTML = `<tr><td colspan="${colspan}">Seleccione un negocio para ver su inventario.</td></tr>`;
        return;
    }

    // ✨ 2. FILTRO CORREGIDO (Maneja valores NULL) ✨
    const filtroUbicacion = document.getElementById('filtro-ubicacion')?.value || 'all';
    const filtroCategoriaId = document.getElementById('filtro-categoria')?.value || 'all';

    const productosFiltrados = productosCache.filter(p => {
        const nombre = String(p.nombre || '').toLowerCase();
        const sku = String(p.sku || '').toLowerCase();
        const codigoBarras = String(p.codigo_barras || '').toLowerCase();

        const matchTexto = nombre.includes(filtro) ||
            sku.includes(filtro) ||
            codigoBarras.includes(filtro);

        const matchUbicacion = filtroUbicacion === 'all' || (p.ubicacion || 'Depósito 1') === filtroUbicacion;
        const matchCategoria = filtroCategoriaId === 'all' || String(p.categoria_id) === filtroCategoriaId;

        return matchTexto && matchUbicacion && matchCategoria;
    });

    // ✨ 3. ORDENAMIENTO ✨
    productosFiltrados.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Manejo de nulos
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        // Si es string, comparar ignorando mayúsculas
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDirection === 'asc'
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        }

        // Si es número
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. Renderizar resumen
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

    const filtroEstado = document.getElementById('filtro-estado')?.value || 'activos';

    // 5. Renderizar filas de la tabla
    listaProductos.innerHTML = '';
    productosPaginados.forEach(p => {
        const stockClass = (p.stock > 0 && p.stock <= p.stock_minimo) ? 'stock-bajo' : '';
        const inactiveClass = p.activo === false ? 'producto-inactivo' : ''; // Clase para estilo visual
        const aliasHtml = p.alias ? `<small class="text-muted d-block">${p.alias}</small>` : '';
        const isChecked = selectedProductIds.has(p.id) ? 'checked' : '';
        const imgHtml = p.imagen_url
            ? `<img src="${p.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.abrirModalEditarProducto(${p.id})">`
            : `<div style="width: 40px; height: 40px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ccc;"><i class="fas fa-image"></i></div>`;

        let rowHTML = `
            <td><input type="checkbox" class="product-check" data-id="${p.id}" ${isChecked}></td>
            <td>${imgHtml}</td>
            <td>
                ${p.nombre}${aliasHtml}
                ${p.activo === false ? '<span class="badge bg-secondary ms-1" style="font-size: 0.7rem;">Inactivo</span>' : ''}
            </td>
            <td>${p.sku || '-'}</td>
            <td>${p.categoria_nombre || 'Sin categoría'}</td>
        `;

        if (!esResto) {
            rowHTML += `<td>${p.ubicacion || 'Depósito 1'}</td>`;
        }

        rowHTML += `<td class="${stockClass}">${p.stock} ${p.unidad_medida || 'un'}</td>`;

        if (!esResto) {
            rowHTML += `
                <td class="text-danger" style="cursor: pointer;" onclick="window.verDetalleComprometido(${p.id})">
                    <strong title="Click para ver detalle">${p.stock_comprometido || 0} ${p.unidad_medida || 'un'}</strong>
                </td>
                <td>
                    <strong>${p.stock_movil || 0}</strong>
                    ${p.patentes_movil ? `<br><small class="text-muted" style="font-size: 0.75rem;">(${p.patentes_movil})</small>` : ''}
                </td>
            `;
        }

        rowHTML += `<td>${(p.precio_venta || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>`;
        
        if (isAdmin) {
            rowHTML += `<td>${(p.precio_costo || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>`;
        }

        // Botones de acción dinámicos
        let btnBorrarOReactivar = p.activo === false
            ? `<button class="btn-success btn-sm" onclick="window.reactivarProducto(${p.id})">Reactivar</button>`
            : `<button class="btn-danger btn-sm" onclick="window.borrarProducto(${p.id})">Borrar</button>`;

        rowHTML += `<td class="acciones">
            <button class="btn-secondary btn-sm" onclick="window.abrirModalEditarProducto(${p.id})">Editar</button>
            ${btnBorrarOReactivar}
            <button class="btn-info btn-sm" onclick="window.verBitacoraProducto(${p.id}, '${(p.nombre || '').replace(/'/g, "\\'")}')" title="Ver historial de cambios">📋</button>
        </td>`;
        const tr = document.createElement('tr');
        if (p.activo === false) tr.style.opacity = '0.6';
        tr.innerHTML = rowHTML;
        listaProductos.appendChild(tr);
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

// --- ✨ FUNCIÓN DE ORDENAMIENTO ✨ ---
export function sortInventory(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    renderProductos();
}
window.sortInventory = sortInventory;

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
        const filtroEstado = document.getElementById('filtro-estado')?.value || 'activos';
        let url = `/api/negocios/${appState.negocioActivoId}/productos`;

        if (filtroEstado === 'inactivos') {
            url += '?mostrar_inactivos=true';
        } else if (filtroEstado === 'todos') {
            url += '?mostrar_inactivos=true';
        }

        productosCache = await fetchData(url);

        // Si el filtro es "inactivos" por UI pero traemos "todos" de la API, filtramos en cache
        if (filtroEstado === 'inactivos') {
            productosCache = productosCache.filter(p => p.activo === false);
        }

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
        title: '¿Desactivar productos?',
        text: `Estás por desactivar ${count} productos. Podrás reactivarlos luego desde el filtro de inactivos.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, desactivar',
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

function abrirModalBulkTipo() {
    if (selectedProductIds.size === 0) {
        mostrarNotificacion("Debe seleccionar al menos un producto.", "warning");
        return;
    }
    document.getElementById('modal-bulk-tipo').style.display = 'flex';
}

async function guardarBulkTipo() {
    const tipo = document.getElementById('bulk-nuevo-tipo').value;
    if (!tipo) {
        mostrarNotificacion("Debe seleccionar un tipo.", "warning");
        return;
    }

    const btn = document.getElementById('btn-confirmar-bulk-tipo');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    try {
        await sendData('/api/productos/bulk/tipo', {
            product_ids: Array.from(selectedProductIds),
            tipo_producto: tipo
        }, 'PUT');

        mostrarNotificacion('Tipo de producto actualizado con éxito.', 'success');
        document.getElementById('modal-bulk-tipo').style.display = 'none';
        selectedProductIds.clear();
        await fetchProductos();
    } catch (error) {
        console.error("Error al actualizar tipos:", error);
        mostrarNotificacion('Error al actualizar tipos de producto.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
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
        const filtroCat = document.getElementById('filtro-categoria');
        if (selectCat) {
            selectCat.innerHTML = `<option value="">Seleccionar...</option>`;
            if (filtroCat) filtroCat.innerHTML = `<option value="all">Todas las Categorías</option>`;

            categorias.forEach(cat => {
                const optHTML = `
                    <option value="${cat.id}" title="${cat.ruta_categoria}">
                        ${cat.nombre_indentado}
                    </option>`;
                selectCat.innerHTML += optHTML;
                if (filtroCat) filtroCat.innerHTML += optHTML;
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
        document.getElementById('producto-tipo').value = producto.tipo_producto || 'producto_final'; // Cambio a nuevo valor
        document.getElementById('producto-ubicacion').value = producto.ubicacion || 'Depósito 1';
        document.getElementById('producto-proveedor').value = producto.proveedor_id || '';
        document.getElementById('producto-stock').value = producto.stock || 0;
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

    // --- ✨ ESPECIALIZACIÓN BABOONS PREMIUM ✨ ---
    const soloDistribuidora = document.querySelectorAll('.solo-distribuidora');
    const esResto = appState.negocioActivoTipo === 'resto';

    soloDistribuidora.forEach(el => {
        if (esResto) {
            el.classList.add('hidden-specialized');
        } else {
            el.classList.remove('hidden-specialized');
        }
    });

    // Ajustar label de "Tipo" si es resto
    const labelTipo = document.querySelector('label[for="producto-tipo"]');
    if (labelTipo && esResto) {
        labelTipo.textContent = 'Función en Menú:';
    } else if (labelTipo) {
        labelTipo.textContent = 'Tipo de Producto:';
    }

    // Resetear campo de imagen y preview
    const imgInput = document.getElementById('producto-imagen');
    const previewContainer = document.getElementById('producto-imagen-preview');
    const btnEliminarFoto = document.getElementById('btn-eliminar-foto');
    const previewImg = previewContainer.querySelector('img');

    if (imgInput) imgInput.value = '';

    if (previewContainer) {
        if (producto && producto.imagen_url) {
            previewImg.src = producto.imagen_url;
            previewContainer.style.display = 'flex';
            if (btnEliminarFoto) btnEliminarFoto.style.display = 'block';
        } else {
            previewImg.src = '';
            previewContainer.style.display = 'none';
            if (btnEliminarFoto) btnEliminarFoto.style.display = 'none';
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
        tipo_producto: document.getElementById('producto-tipo').value || 'final',
        ubicacion: document.getElementById('producto-ubicacion').value || 'Depósito 1',
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

// --- ✨ NUEVAS FUNCIONES PARA GESTIÓN DE IMÁGENES ✨ ---

function handleSelectImagen(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById('producto-imagen-preview');
    const previewImg = previewContainer.querySelector('img');
    const btnEliminarFoto = document.getElementById('btn-eliminar-foto');

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewContainer.style.display = 'flex';
            if (btnEliminarFoto) btnEliminarFoto.style.display = 'none'; // No mostrar borrar en foto local nueva
        };
        reader.readAsDataURL(file);
    } else {
        previewImg.src = '';
        previewContainer.style.display = 'none';
    }
}

async function eliminarFotoProducto() {
    const productoId = document.getElementById('producto-id').value;
    if (!productoId) return;

    const result = await Swal.fire({
        title: '¿Eliminar foto?',
        text: 'La imagen se eliminará permanentemente del producto.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/productos/${productoId}/image`, {}, 'DELETE');
            mostrarNotificacion('Imagen eliminada con éxito.', 'success');

            // Limpiar UI
            const previewContainer = document.getElementById('producto-imagen-preview');
            const previewImg = previewContainer.querySelector('img');
            const btnEliminarFoto = document.getElementById('btn-eliminar-foto');
            const fileInput = document.getElementById('producto-imagen');

            previewImg.src = '';
            previewContainer.style.display = 'none';
            if (btnEliminarFoto) btnEliminarFoto.style.display = 'none';
            if (fileInput) fileInput.value = '';

            await fetchProductos(); // Recargar para ver el cambio en la tabla
        } catch (error) {
            mostrarNotificacion('Error al eliminar la imagen.', 'error');
        }
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
    const progCont = document.getElementById('importar-progreso-container');
    const progBar = document.getElementById('importar-progreso-barra');
    const progTexto = document.getElementById('importar-progreso-texto');
    const progPorc = document.getElementById('importar-progreso-porcentaje');
    const feedbackTexto = document.getElementById('importar-feedback-texto');

    const file = fileInput.files[0];
    if (!file) {
        mostrarNotificacion("Selecciona un archivo Excel (.xlsx).", "error");
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Importando...';
    feedbackContainer.className = 'importar-feedback info';
    feedbackTexto.innerHTML = '';
    
    try {
        // 1. Leer archivo localmente
        progTexto.textContent = "Leyendo archivo...";
        progCont.style.display = 'block';
        updateProgressBar(0);

        const dataArr = await readExcelFile(file);
        if (!dataArr || dataArr.length === 0) {
            throw new Error("El archivo está vacío o no es válido.");
        }

        const totalItems = dataArr.length;
        const batchSize = 50;
        const totalBatches = Math.ceil(totalItems / batchSize);
        let processedCount = 0;

        // 2. Procesar por lotes (Batch)
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, totalItems);
            const batch = dataArr.slice(start, end);

            progTexto.textContent = `Enviando lote ${i + 1} de ${totalBatches}...`;
            
            const response = await fetch(`/api/negocios/${appState.negocioActivoId}/importar/productos/batch`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: batch })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Error en lote ${i + 1}`);
            }

            processedCount += batch.length;
            const progress = Math.round((processedCount / totalItems) * 100);
            updateProgressBar(progress);
        }

        // 3. Finalización
        feedbackContainer.className = 'importar-feedback success';
        feedbackTexto.innerHTML = `<p>✅ <strong>¡Importación Exitosa!</strong> Se procesaron ${totalItems} productos correctamente.</p>`;
        mostrarNotificacion(`Importación completada: ${totalItems} productos`, "success");
        
        // Recargar inventario tras un breve delay
        setTimeout(() => {
            fetchProductos();
        }, 1500);

    } catch (error) {
        console.error("Batch Import Error:", error);
        feedbackContainer.className = 'importar-feedback error';
        feedbackTexto.innerHTML = `<p>❌ <strong>Error:</strong> ${error.message}</p>`;
        mostrarNotificacion(error.message, "error");
    } finally {
        boton.disabled = false;
        boton.textContent = 'Importar';
        loader.style.display = 'none';
        fileInput.value = '';
    }
}

/**
 * Utilidad para leer Excel usando SheetJS
 */
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Actualiza la UI de la barra de progreso
 */
function updateProgressBar(percent) {
    const progBar = document.getElementById('importar-progreso-barra');
    const progPorc = document.getElementById('importar-progreso-porcentaje');
    if (progBar) progBar.style.width = `${percent}%`;
    if (progPorc) progPorc.textContent = `${percent}%`;
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
    const result = await Swal.fire({
        title: '¿Desactivar producto?',
        text: 'El producto no aparecerá en ventas ni en el buscador, pero se mantendrá en registros históricos.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/productos/${productoId}`, {}, 'DELETE');
            mostrarNotificacion('Producto desactivado con éxito.', 'success');
            await fetchProductos(); // Recarga la lista
        } catch (error) {
            mostrarNotificacion('Error al desactivar el producto.', 'error');
        }
    }
};

export async function reactivarProducto(productoId) {
    try {
        await sendData(`/api/productos/${productoId}/reactivar`, {}, 'PUT');
        mostrarNotificacion('Producto reactivado con éxito.', 'success');
        await fetchProductos();
    } catch (error) {
        mostrarNotificacion('Error al reactivar el producto.', 'error');
    }
}

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

export async function verDetalleComprometido(productoId) {
    const modal = document.getElementById('modal-comprometido-detalle');
    const infoEl = document.getElementById('comprometido-producto-info');
    const tbody = document.querySelector('#tabla-comprometido-detalle tbody');

    if (!modal || !tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center"><i>Buscando pedidos...</i></td></tr>`;
    modal.style.display = 'flex';

    try {
        const data = await fetchData(`/api/productos/${productoId}/comprometido`);
        infoEl.textContent = data.producto_nombre;

        if (data.detalles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No se encontraron pedidos pendientes para este producto.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.detalles.map(d => {
            const fechaHR = d.hr_fecha ? new Date(d.hr_fecha).toLocaleDateString() : '-';
            const hrInfo = d.hoja_ruta_id
                ? `HR #${d.hoja_ruta_id} (${d.hr_vendedor || 'S/V'}) - ${fechaHR}`
                : '<span class="text-muted">Sin HR (Pendiente carga)</span>';

            return `<tr>
                <td class="fw-bold">Pedido #${d.pedido_id}</td>
                <td>${d.cliente_nombre || 'S/N'}</td>
                <td>${hrInfo}</td>
                <td><span class="badge ${d.pedido_estado === 'preparado' ? 'bg-info' : 'bg-warning'} text-dark">${d.pedido_estado}</span></td>
                <td class="text-end fw-bold">${d.cantidad} ${data.unidad_medida || 'un'}</td>
            </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al obtener detalles.</td></tr>`;
    }
}
window.verDetalleComprometido = verDetalleComprometido;

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

    // Lógica del buscador y filtro (resetea paginación)
    buscador.addEventListener('keyup', () => {
        currentPage = 1;
        renderProductos();
    });
    const filtroUbicacion = document.getElementById('filtro-ubicacion');
    if (filtroUbicacion) {
        filtroUbicacion.addEventListener('change', () => {
            currentPage = 1;
            renderProductos();
        });
    }

    const filtroCategoria = document.getElementById('filtro-categoria');
    if (filtroCategoria) {
        filtroCategoria.addEventListener('change', () => {
            currentPage = 1;
            renderProductos();
        });
    }

    const filtroEstado = document.getElementById('filtro-estado');
    if (filtroEstado) {
        filtroEstado.addEventListener('change', () => {
            currentPage = 1;
            fetchProductos(); // Recarga desde API según el estado
        });
    }

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

    // LISTENERS IMÁGENES
    const inputImagen = document.getElementById('producto-imagen');
    const btnEliminarFoto = document.getElementById('btn-eliminar-foto');
    if (inputImagen) inputImagen.onchange = handleSelectImagen;
    if (btnEliminarFoto) btnEliminarFoto.onclick = eliminarFotoProducto;

    // NUEVOS LISTENERS MASIVOS
    const btnBulkCat = document.getElementById('btn-bulk-categoria');
    const btnBulkDel = document.getElementById('btn-bulk-borrar');
    const btnBulkCan = document.getElementById('btn-bulk-cancelar');
    const btnBulkConfirmCat = document.getElementById('btn-confirmar-bulk-categoria');
    const closeModalBulkCat = document.getElementById('close-modal-bulk-cat');

    if (btnBulkCat) btnBulkCat.onclick = abrirModalBulkCategoria;
    if (btnBulkDel) btnBulkDel.onclick = bulkDeleteProductos;
    if (btnBulkCan) btnBulkCan.onclick = cancelBulkSelection;
    
    // Nueva Acción Masiva: Tipo
    const btnBulkTipo = document.getElementById('btn-bulk-tipo');
    if (btnBulkTipo) btnBulkTipo.onclick = abrirModalBulkTipo;
    const btnConfirmBulkTipo = document.getElementById('btn-confirmar-bulk-tipo');
    if (btnConfirmBulkTipo) btnConfirmBulkTipo.onclick = guardarBulkTipo;
    const closeModalBulkTipo = document.getElementById('close-modal-bulk-tipo');
    if (closeModalBulkTipo) closeModalBulkTipo.onclick = () => document.getElementById('modal-bulk-tipo').style.display = 'none';

    if (btnBulkConfirmCat) btnBulkConfirmCat.onclick = guardarBulkCategoria;
    if (closeModalBulkCat) closeModalBulkCat.onclick = () => document.getElementById('modal-bulk-categoria').style.display = 'none';

    // Registrar funciones globales
    window.abrirModalEditarProducto = abrirModalEditarProducto;
    window.borrarProducto = borrarProducto;
    window.reactivarProducto = reactivarProducto;
    window.verBitacoraProducto = verBitacoraProducto;
    window.abrirModalExportar = abrirModalExportar;
    window.changeProductPage = changeProductPage;
    window.addEventListener('click', (e) => {
        const modalBitacora = document.getElementById('modal-bitacora-producto');
        if (modalBitacora && e.target == modalBitacora) modalBitacora.style.display = 'none';
    });
}
