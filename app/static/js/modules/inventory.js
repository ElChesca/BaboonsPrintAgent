// static/js/modules/inventory.js (Versión Actualizada)

import { getCurrentUser, getAuthHeaders } from './auth.js';
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js'; // Usamos sendData para guardar
import { mostrarNotificacion } from './notifications.js';


//let productosCache = [];
// ✨ --- NUEVAS VARIABLES DE PAGINACIÓN --- ✨
let currentPage = 1;
const itemsPerPage = 20; // Puedes cambiar este número (ej. 10, 20, 50)


export function changeProductPage(newPage) {
    if (newPage < 1) return;
    currentPage = newPage;
    renderProductos();
}

function renderProductos() {
    const user = getCurrentUser();
    const isAdmin = user && user.rol === 'admin';
    const listaProductos = document.querySelector('#tabla-productos tbody');
    const headerRow = document.querySelector('#tabla-productos thead tr');
    const filtro = document.getElementById('buscador-productos')?.value.toLowerCase() || '';

    if (!listaProductos || !headerRow) return;

    // 1. Renderizar cabecera (Sin cambios)
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

    // 2. Filtrar productos (Sin cambios)
    const productosFiltrados = productosCache.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
        (p.sku && p.sku.toLowerCase().includes(filtro)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(filtro))
    );
    
    // ✨ 3. RENDERIZAR RESUMEN (NUEVO) ✨
    const summaryEl = document.getElementById('productos-summary');
    if (summaryEl) {
        let summaryText = `<strong>${productosFiltrados.length}</strong> productos encontrados`;
        if (filtro) {
            summaryText += ` (de <strong>${productosCache.length}</strong> productos totales)`;
        }
        summaryEl.innerHTML = summaryText;
    }

    // ✨ 4. CALCULAR PAGINACIÓN (NUEVO) ✨
    const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages; // Si estamos en una página que ya no existe, ir a la última
    } else if (totalPages === 0) {
        currentPage = 1;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productosPaginados = productosFiltrados.slice(startIndex, endIndex);

    // 5. Renderizar filas de la tabla (Ahora usa 'productosPaginados')
    listaProductos.innerHTML = '';
    productosPaginados.forEach(p => {
        // ... (el código de 'rowHTML' es el mismo que tenías) ...
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

    // ✨ 6. RENDERIZAR BOTONES DE PAGINACIÓN (NUEVO) ✨
    const paginationEl = document.getElementById('productos-pagination');
    if (paginationEl) {
        paginationEl.innerHTML = ''; // Limpiar botones anteriores
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
async function fetchProductos() {
    if (!appState.negocioActivoId) {
        productosCache = [];
        renderProductos();
        return;
    }
    try {
        productosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        currentPage = 1; // ✨ Resetear a la página 1 cada vez que se carga
        renderProductos();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los productos.', 'error');
    }
}

async function poblarSelectoresDelModal() {
    try {
        // 1. Hacemos los fetches igual que antes
        const [categorias, proveedores, unidades] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/unidades_medida`)
        ]);

        // 2. ✨ CAMBIO PRINCIPAL AQUÍ ✨
        // Adaptamos el renderizado del <select> de categorías
        const selectCat = document.getElementById('producto-categoria');
        if (selectCat) {
            selectCat.innerHTML = `<option value="">Seleccionar...</option>`;
            
            // Usamos los nuevos campos 'nombre_indentado' y 'ruta_categoria'
            // que nos envía el API que modificamos.
            categorias.forEach(cat => {
                selectCat.innerHTML += `
                    <option value="${cat.id}" title="${cat.ruta_categoria}">
                        ${cat.nombre_indentado}
                    </option>`;
            });
        }

        // 3. El <select> de proveedores no cambia
        const selectProv = document.getElementById('producto-proveedor');
        if (selectProv) {
            selectProv.innerHTML = `<option value="">Seleccionar...</option>`;
            proveedores.forEach(item => {
                selectProv.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
            });
        }
        
        // 4. El <select> de unidades de medida no cambia
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
// ✨ Referencias al nuevo loader y texto
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
// ✨ Mostrar loader y texto
    feedbackContainer.className = 'importar-feedback info';
    loader.style.display = 'block';
    feedbackTexto.innerHTML = '<p>Procesando archivo, esto puede tardar...</p>';
    
    const formData = new FormData();
    formData.append('archivo_productos', file);

    const url = `/api/negocios/${appState.negocioActivoId}/productos/importar`;

    try {
        // ✨ --- CORRECCIÓN CLAVE --- ✨
        // 1. Obtenemos todas las cabeceras (incluyendo 'Authorization')
        const headers = getAuthHeaders();
        
        // 2. ELIMINAMOS 'Content-Type'. Esto es crucial.
        //    El navegador ahora pondrá 'multipart/form-data'
        //    con el 'boundary' (límite) correcto por sí solo.
        delete headers['Content-Type'];
        delete headers['content-type']; // Por si acaso está en minúsculas

        // 3. Hacemos el fetch con las cabeceras corregidas
        const response = await fetch(url, {
            method: 'POST',
            headers: headers, // <-- Usamos las cabeceras ya limpias
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
        loader.style.display = 'none';
        boton.disabled = false;
        boton.textContent = 'Subir e Importar';
        fileInput.value = ''; // Limpiar el input de archivo
    }
}




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

// static/js/modules/inventory.js
// ✨ REEMPLAZAR ESTA FUNCIÓN COMPLETA ✨

export async function inicializarLogicaInventario() {
    const formProducto = document.getElementById('form-producto');
    const buscador = document.getElementById('buscador-productos');
    const btnAbrirModal = document.getElementById('btn-abrir-modal-producto');
    const modal = document.getElementById('modal-producto');
    const closeModalBtn = document.getElementById('close-modal-producto');
    
    // Si no encuentra el formulario principal, no hace nada
    if (!formProducto) return;

    // Lógica del modal de producto (sin cambios)
    btnAbrirModal.addEventListener('click', () => abrirModal());
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
    formProducto.addEventListener('submit', guardarProducto);

    buscador.addEventListener('keyup', () => {
        currentPage = 1;
        renderProductos();
    });

    // --- ✨ LÓGICA CORREGIDA PARA EL MODAL DE IMPORTACIÓN ---
    const modalImportar = document.getElementById('modal-importar-producto');
    const btnAbrirImportar = document.getElementById('btn-abrir-modal-importar');
    const btnCerrarImportar = document.getElementById('close-modal-importar');
    const formImportar = document.getElementById('form-importar-producto');

    if (modalImportar) {
        btnAbrirImportar.addEventListener('click', () => {
            // ✨ --- ESTA ES LA CORRECCIÓN --- ✨
            // Ya no borramos el HTML. Solo reseteamos los elementos.
            const feedbackContainer = document.getElementById('importar-feedback');
            const loader = document.getElementById('importar-loader');
            const feedbackTexto = document.getElementById('importar-feedback-texto');

            if (feedbackContainer) feedbackContainer.className = 'importar-feedback';
            if (loader) loader.style.display = 'none'; // Ocultamos el spinner
            if (feedbackTexto) feedbackTexto.innerHTML = ''; // Limpiamos el texto
            
            formImportar.reset();
            modalImportar.style.display = 'flex';
        });
        
        btnCerrarImportar.addEventListener('click', () => modalImportar.style.display = 'none');
        formImportar.addEventListener('submit', importarProductos);
        
        window.addEventListener('click', (e) => {
            if (e.target == modalImportar) modalImportar.style.display = 'none';
        });
    }
    // --- FIN DE LA CORRECCIÓN ---

    // Carga inicial (sin cambios)
    await poblarSelectoresDelModal();
    fetchProductos();
}