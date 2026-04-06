/* app/static/js/modules/resto_menu.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let categoriasCache = [];
let itemsMenuCache = [];
let listasPreciosCache = []; // NUEVO: Cache para listas de precios
let itemsOriginales = [];
let itemsFiltrados = [];
let categoriaActiva = 'all';
let destinosKDSCache = [];

let appStateMenu = {
    viewMode: 'table', 
    currentPage: 1,
    pageSize: 50,
    selectedIds: new Set()
};

// --- FUNCIÓN DE BLINDAJE PARA SELECCIÓN (Tolerante a tipos) ---
function estaSeleccionado(id) {
    if (!id) return false;
    const sId = String(id);
    const nId = Number(id);
    return appStateMenu.selectedIds.has(sId) || (!isNaN(nId) && appStateMenu.selectedIds.has(nId));
}

export async function inicializarRestoMenu() {
    console.log("🥘 Módulo de Carta Premium Inicializado");

    // Bind UI
    const btnNuevaCat = document.getElementById('btn-nueva-categoria');
    const btnNuevoPlato = document.getElementById('btn-nuevo-plato');
    const btnConfigQR = document.getElementById('btn-config-qr');
    const formCat = document.getElementById('form-categoria');
    const formItem = document.getElementById('form-item-menu');
    const chkStockControl = document.getElementById('item-stock-control');

    const btnConfigBranding = document.getElementById('btn-config-branding');
    if (btnConfigBranding) btnConfigBranding.onclick = () => window.abrirModalBranding();

    if (btnNuevaCat) btnNuevaCat.onclick = () => window.abrirModalCategoria();
    if (btnNuevoPlato) btnNuevoPlato.onclick = () => window.abrirModalItem();
    if (btnConfigQR) btnConfigQR.onclick = () => window.abrirModalQR();
    if (formCat) formCat.onsubmit = guardarCategoria;
    if (formItem) formItem.onsubmit = guardarItem;

    const formBranding = document.getElementById('form-branding-menu');
    if (formBranding) formBranding.onsubmit = guardarBranding;

    const btnAddInsumo = document.getElementById('btn-add-insumo-receta');
    if (btnAddInsumo) btnAddInsumo.onclick = agregarInsumoAReceta;

    if (chkStockControl) {
        chkStockControl.onchange = (e) => {
            const vinculo = document.getElementById('item-producto-vinculo');
            if (vinculo) vinculo.style.display = e.target.checked ? 'block' : 'none';
        };
    }

    await cargarCategorias();
    await cargarListas(); // Nueva carga inicial
    await cargarItems();

    // Nueva funcionalidad de búsqueda
    const inputBusqueda = document.getElementById('busqueda-platos');
    if (inputBusqueda) {
        inputBusqueda.oninput = (e) => {
            filtrarItems();
        };
    }

    // Bind especial de alineación
    window.alinearConInventario = alinearConInventario;
    window.cambiarVista = cambiarVista;
    window.cambiarPageSize = cambiarPageSize;
    window.cambiarPagina = cambiarPagina;
    window.deseleccionarTodo = deseleccionarTodo;
    
    // Acciones Masivas
    window.abrirBulkPrecio = abrirBulkPrecio;
    window.abrirBulkCategoria = abrirBulkCategoria;
    window.abrirBulkKDS = abrirBulkKDS;
    window.aplicarBulkPausa = aplicarBulkPausa;
}

function cambiarVista(mode) {
    appStateMenu.viewMode = mode;
    document.getElementById('view-cards').classList.toggle('active', mode === 'cards');
    document.getElementById('view-table').classList.toggle('active', mode === 'table');
    
    const cardsCont = document.getElementById('items-container');
    const tableCont = document.getElementById('table-view-container');
    
    if (mode === 'cards') {
        cardsCont.style.display = 'flex';
        tableCont.style.display = 'none';
    } else {
        cardsCont.style.display = 'none';
        tableCont.style.display = 'block';
    }
    renderizarContenido();
}

function cambiarPageSize(size) {
    appStateMenu.pageSize = parseInt(size);
    appStateMenu.currentPage = 1;
    renderizarContenido();
}

function cambiarPagina(p) {
    appStateMenu.currentPage = p;
    renderizarContenido();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarCategorias() {
    try {
        const idNegocio = appState.negocioActivoId;
        // Cargar destinos primero
        await cargarDestinosKDS();
        categoriasCache = await fetchData(`/api/negocios/${idNegocio}/menu/categorias`);
        renderizarTabsCategorias();
        poblarSelectCategorias();
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar categorías', 'error');
    }
}

async function cargarDestinosKDS() {
    try {
        const idNegocio = appState.negocioActivoId;
        destinosKDSCache = await fetchData(`/api/negocios/${idNegocio}/destinos-kds`);
    } catch (error) {
        console.warn("No se pudieron cargar destinos KDS:", error);
    }
}

function renderizarTabsCategorias() {
    const container = document.getElementById('categorias-tabs');
    if (!container) return;

    container.innerHTML = '';

    // Tab "Todos"
    const todosWrapper = document.createElement('div');
    todosWrapper.className = `category-pill-wrapper ${categoriaActiva === 'all' ? 'active' : ''}`;
    todosWrapper.innerHTML = `
        <button class="nav-link-premium" onclick="window.filtrarPorCategoria('all')">Todos</button>
    `;
    container.appendChild(todosWrapper);

    // Tabs de Categorías
    categoriasCache.forEach(c => {
        const wrapper = document.createElement('div');
        wrapper.className = `category-pill-wrapper ${categoriaActiva == c.id ? 'active' : ''}`;

        const tab = document.createElement('button');
        tab.className = 'nav-link-premium';
        tab.innerText = c.nombre;
        tab.onclick = () => window.filtrarPorCategoria(c.id);

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-category';
        editBtn.title = 'Editar Categoría';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.onclick = (e) => { 
            e.stopPropagation(); 
            window.editarCategoria(c.id); 
        };

        wrapper.appendChild(tab);
        wrapper.appendChild(editBtn);
        container.appendChild(wrapper);
    });
}

window.editarCategoria = (id) => {
    const cat = categoriasCache.find(c => c.id == id);
    if (!cat) return;

    window.abrirModalCategoria();
    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-nombre').value = cat.nombre;
    document.getElementById('cat-grupo').value = cat.grupo || '';
    document.getElementById('cat-orden').value = cat.orden || 0;
    document.getElementById('cat-estacion').value = cat.estacion || 'cocina';
    document.getElementById('cat-destino-id').value = cat.destino_id || '';
};

function poblarSelectCategorias() {
    const select = document.getElementById('item-categoria');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione una categoría</option>';
    categoriasCache.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    // Poblar selectores de Destinos KDS
    const selCatDest = document.getElementById('cat-destino-id');
    const selItemDest = document.getElementById('item-destino-kds');
    
    if (selCatDest) {
        selCatDest.innerHTML = '<option value="">-- Seleccionar --</option>';
        destinosKDSCache.forEach(d => {
            selCatDest.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
        });
    }

    if (selItemDest) {
        selItemDest.innerHTML = '<option value="">Heredado de categoría</option>';
        destinosKDSCache.forEach(d => {
            selItemDest.innerHTML += `<option value="${d.nombre}">${d.nombre}</option>`;
        });
    }
}

window.filtrarPorCategoria = (id) => {
    categoriaActiva = id;
    renderizarTabsCategorias();
    filtrarItems();
};

async function cargarItems() {
    const loading = document.getElementById('loading-menu');
    if (loading) loading.style.display = 'block';

    try {
        const url = `/api/negocios/${appState.negocioActivoId}/menu/items`;
        itemsOriginales = await fetchData(url);
        if (loading) loading.style.display = 'none';
        filtrarItems();
    } catch (error) {
        if (loading) loading.style.display = 'none';
        mostrarNotificacion(error.message, 'error');
    }
}

function filtrarItems() {
    const busqueda = document.getElementById('busqueda-platos')?.value.toLowerCase() || '';
    
    itemsFiltrados = itemsOriginales.filter(i => {
        const matchesCat = categoriaActiva === 'all' || i.categoria_id == categoriaActiva;
        const matchesSearch = i.nombre.toLowerCase().includes(busqueda) || 
                             (i.descripcion && i.descripcion.toLowerCase().includes(busqueda));
        return matchesCat && matchesSearch;
    });

    appStateMenu.currentPage = 1;
    renderizarContenido();
}

function renderizarContenido() {
    const container = document.getElementById('items-container');
    const tableBody = document.getElementById('table-items-body');
    const noItems = document.getElementById('no-items');
    
    if (!container) return;
    container.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';

    // Paginación
    const total = itemsFiltrados.length;
    const start = (appStateMenu.currentPage - 1) * appStateMenu.pageSize;
    const end = start + appStateMenu.pageSize;
    const itemsPagina = itemsFiltrados.slice(start, end);

    actualizarPaginationUI(total, start, end);
    actualizarEstadisticas();

    if (total === 0) {
        if (noItems) noItems.style.display = 'block';
        return;
    }
    if (noItems) noItems.style.display = 'none';

    if (appStateMenu.viewMode === 'cards') {
        renderizarCards(itemsPagina, container);
    } else if (tableBody) {
        renderizarTabla(itemsPagina, tableBody);
    }

    // Al final del renderizado, vinculamos los eventos de selección (Patrón Inventario)
    vincularEventosSeleccionMenu();
}

function renderizarCards(items, container) {
    items.forEach(i => {
        const col = document.createElement('div');
        col.className = 'col animate__animated animate__fadeInUp';

        const imgUrl = i.imagen_url || 'static/img/icons/reportes.png';
        const statusClass = i.disponible ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
        const statusText = i.disponible ? 'Activo' : 'Pausado';
        const isSelected = appStateMenu.selectedIds.has(Number(i.id));

        col.innerHTML = `
            <div class="card menu-card-compact menu-card h-100 shadow-sm border-0 ${isSelected ? 'selected' : ''}" data-id="${i.id}">
                <div class="card-img-wrapper position-relative" style="height: 120px;">
                    <div class="selection-overlay">
                        <input type="checkbox" class="form-check-input item-check" data-id="${i.id}" ${isSelected ? 'checked' : ''}>
                    </div>
                    <span class="status-badge x-small ${statusClass}">${statusText}</span>
                    <img src="${imgUrl}" alt="${i.nombre}" class="w-100 h-100 object-fit-cover" onerror="this.src='/static/img/icons/reportes.png'">
                    <div class="price-tag x-small shadow-sm">$${parseFloat(i.precio).toLocaleString('es-AR')}</div>
                </div>
                <div class="card-body p-2 d-flex flex-column">
                    <h6 class="fw-800 m-0 text-truncate mb-1" title="${i.nombre}">${i.nombre}</h6>
                    <div class="d-flex align-items-center gap-1 mb-2">
                        <span class="badge bg-light text-muted fw-600 xx-small px-1 border">${i.categoria_nombre}</span>
                        ${i.producto_id ? '<i class="fas fa-sync text-primary opacity-50 xx-small" title="Sincronizado"></i>' : ''}
                    </div>
                    <div class="d-flex gap-1 mt-auto">
                        <button class="btn btn-xs btn-outline-primary flex-grow-1 btn-action" data-action="receta" data-id="${i.id}" title="Ver Receta">
                            <i class="fas fa-calculator"></i>
                        </button>
                        <button class="btn btn-xs btn-outline-secondary btn-action" data-action="editar" data-id="${i.id}" title="Editar Plato">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

function renderizarTabla(items, tableBody) {
    items.forEach(i => {
        // Blindaje extra para el renderizado
        const isSelected = estaSeleccionado(i.id);
        const row = document.createElement('tr');
        row.className = `menu-row ${isSelected ? 'table-selected-premium' : ''}`;
        row.setAttribute('data-id', i.id);

        row.innerHTML = `
            <td>
                <div class="form-check custom-check">
                    <input type="checkbox" class="form-check-input item-check" 
                           data-id="${i.id}" ${isSelected ? 'checked' : ''}>
                </div>
            </td>
            <td>
                <img src="${i.imagen_url || '/static/img/icons/reportes.png'}" width="40" height="40" class="rounded object-fit-cover shadow-sm">
            </td>
            <td>
                <div class="fw-800 text-dark mb-0">${i.nombre}</div>
                <div class="text-muted x-small text-truncate" style="max-width: 250px;">${i.descripcion || 'Sin descripción'}</div>
            </td>
            <td><span class="badge bg-light text-muted border">${i.categoria_nombre}</span></td>
            <td class="fw-800">$${parseFloat(i.precio).toLocaleString('es-AR')}</td>
            <td>
                <span class="x-small ${i.destino_kds ? 'fw-800 text-dark' : 'text-muted fst-italic'}" title="${i.destino_kds ? 'Destino personalizado' : 'Heredado de la categoría'}">
                    ${i.destino_kds || i.categoria_destino || 'Cocina'}
                </span>
            </td>
            <td class="text-center">
                <span class="badge ${i.disponible ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'} x-small p-1 px-2 rounded-pill">
                    ${i.disponible ? 'Activo' : 'Pausado'}
                </span>
            </td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-light border btn-action" data-action="receta" data-id="${i.id}" title="Receta"><i class="fas fa-calculator"></i></button>
                    <button class="btn btn-sm btn-light border btn-action" data-action="editar" data-id="${i.id}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn btn-sm btn-light border text-danger btn-action" data-action="eliminar" data-id="${i.id}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function actualizarPaginationUI(total, start, end) {
    const totalPages = Math.ceil(total / appStateMenu.pageSize);
    const pagRange = document.getElementById('pag-range');
    const pagTotal = document.getElementById('pag-total');
    const pagList = document.getElementById('pagination-list');
    
    if (pagRange) pagRange.innerText = total > 0 ? `${start + 1}-${Math.min(end, total)}` : '0-0';
    if (pagTotal) pagTotal.innerText = total;
    if (pagList) {
        pagList.innerHTML = '';
        
        // Botón Anterior
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${appStateMenu.currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<button class="page-link" onclick="window.cambiarPagina(${appStateMenu.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
        pagList.appendChild(prevLi);

        // Páginas (limitado a 5 alrededor de la actual)
        let startPage = Math.max(1, appStateMenu.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let p = startPage; p <= endPage; p++) {
            const li = document.createElement('li');
            li.className = `page-item ${p === appStateMenu.currentPage ? 'active' : ''}`;
            li.innerHTML = `<button class="page-link" onclick="window.cambiarPagina(${p})">${p}</button>`;
            pagList.appendChild(li);
        }

        // Botón Siguiente
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${appStateMenu.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`;
        nextLi.innerHTML = `<button class="page-link" onclick="window.cambiarPagina(${appStateMenu.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
        pagList.appendChild(nextLi);
    }
}

function actualizarEstadisticas() {
    const total = itemsOriginales.length;
    const activos = itemsOriginales.filter(i => i.disponible).length;
    const pausados = total - activos;
    const bajoStock = itemsOriginales.filter(i => i.stock_control && (parseFloat(i.cantidad) || 0) < 5).length;

    if (document.getElementById('stat-total-platos')) document.getElementById('stat-total-platos').innerText = total;
    if (document.getElementById('stat-platos-activos')) document.getElementById('stat-platos-activos').innerText = activos;
    if (document.getElementById('stat-platos-pausados')) document.getElementById('stat-platos-pausados').innerText = pausados;
    if (document.getElementById('stat-bajo-stock')) document.getElementById('stat-bajo-stock').innerText = bajoStock;
}

// Ventanas globales para modales
window.abrirModalCategoria = () => {
    const modal = document.getElementById('modal-categoria');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('form-categoria').reset();
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-grupo').value = '';
        document.getElementById('cat-estacion').value = 'cocina';
    }
};

window.cerrarModalCategoria = () => {
    const modal = document.getElementById('modal-categoria');
    if (modal) modal.style.display = 'none';
};

window.abrirModalItem = async () => {
    const modal = document.getElementById('modal-item-menu');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-item-titulo').innerText = 'Nuevo Plato / Ítem';
        document.getElementById('form-item-menu').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('item-stock-control').checked = false;
        document.getElementById('item-producto-vinculo').style.display = 'none';
        
        // Asegurar listas cargadas ANTES de renderizar
        await cargarListas();
        renderizarInputsPreciosListas();
        
        cargarProductosParaVinculo();
    }
};

window.cerrarModalItem = () => {
    const modal = document.getElementById('modal-item-menu');
    if (modal) modal.style.display = 'none';
};

// --- MULTI-MENU / LISTAS DE PRECIOS LOGIC ---


window.abrirConfigResto = async () => {
    const modal = document.getElementById('modal-config-resto');
    if (modal) {
        modal.style.display = 'flex';
        renderizarAdminListas();
    }
};

window.cerrarConfigResto = () => {
    document.getElementById('modal-config-resto').style.display = 'none';
};

window.crearNuevaLista = async () => {
    const nombre = document.getElementById('nueva-lista-nombre').value;
    if (!nombre) return mostrarNotificacion("Ingresa un nombre para la carta", "warning");

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas`, { nombre }, 'POST');
        mostrarNotificacion("Nueva carta creada", "success");
        document.getElementById('nueva-lista-nombre').value = '';
        await cargarListas();
        renderizarAdminListas();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
};

function renderizarAdminListas() {
    const container = document.getElementById('contenedor-listas-admin');
    if (!container) return;
    container.innerHTML = '';

    listasPreciosCache.forEach(l => {
        container.innerHTML += `
            <div class="list-group-item d-flex justify-content-between align-items-center py-3">
                <div>
                    <span class="fw-800 text-dark">${l.nombre}</span>
                    ${l.es_default ? '<span class="badge bg-primary-soft text-primary ms-2 x-small">Predeterminada</span>' : ''}
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.eliminarLista(${l.id})" ${l.es_default ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function renderizarInputsPreciosListas(itemData = null) {
    const container = document.getElementById('listas-precios-container');
    if (!container) return;
    container.innerHTML = '';

    // Si el cache está vacío por un microsegundo, usamos al menos la Carta Base Virtual
    let listasAMostrar = [...listasPreciosCache];
    if (listasAMostrar.length === 0) {
        console.warn("⚠️ Cache de listas vacío al renderizar. Usando Default Fallback.");
        listasAMostrar = [{ id: 'base', nombre: 'Carta General', es_default: true }];
    }

    // Ordenamos: Default primero
    const listasOrdenadas = listasAMostrar.sort((a, b) => (b.es_default ? 1 : 0) - (a.es_default ? 1 : 0));

    listasOrdenadas.forEach(l => {
        let precioVal = '';
        if (itemData) {
            const mapPrecio = (itemData.precios || []).find(p => p.lista_id == l.id);
            // Fallback para el ID Base virtual si es el predeterminado
            const esBaseMap = (l.id === 'base' || l.es_default);
            
            // Prioridad: 
            // 1. Precio específico de la tabla menu_item_precios para esta lista
            // 2. Si es la lista BASE/Default, usamos el precio maestro del item
            // 3. Cadena vacía
            const valFromList = mapPrecio ? mapPrecio.precio : null;
            const valFromBase = esBaseMap ? (parseFloat(itemData.precio) || 0) : '';
            precioVal = (valFromList !== null) ? valFromList : valFromBase;
        }

        container.innerHTML += `
            <div class="col-md-6">
                <div class="price-list-card ${l.es_default ? 'border-primary' : ''}">
                    <div class="d-flex align-items-center mb-2">
                        <div class="list-icon-sm ${l.es_default ? 'bg-primary text-white' : 'bg-light text-muted'}">
                            <i class="fas ${l.es_default ? 'fa-star' : 'fa-list-ul'}"></i>
                        </div>
                        <div class="ms-2">
                            <div class="fw-800 x-small text-dark text-uppercase ls-1">${l.nombre}</div>
                            <div class="text-muted x-small">${l.es_default ? 'Precio Base' : 'Precio Especial'}</div>
                        </div>
                    </div>
                    <div class="price-input-wrapper">
                        <span class="currency-symbol">$</span>
                        <input type="number" 
                               class="form-control-price input-precio-lista" 
                               data-lista-id="${l.id}" 
                               value="${precioVal}" 
                               placeholder="0.00" 
                               step="0.01">
                    </div>
                </div>
            </div>
        `;
    });
}

window.ejecutarSetupResto = async () => {
    const result = await Swal.fire({
        title: '¿Configurar Entorno?',
        text: 'Esto creará las categorías estándar (Desayunos, Almuerzos...) y asegurará la estructura de precios.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, ejecutar setup',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/negocios/${appState.negocioActivoId}/menu/setup-default`, {}, 'POST');
            mostrarNotificacion("Setup completado con éxito", "success");
            window.cerrarConfigResto();
            await cargarCategorias();
            await cargarListas();
            renderizarTabsCategorias();
        } catch (error) {
            mostrarNotificacion(error.message, "error");
        }
    }
};

// --- QR LOGIC ---

window.abrirModalQR = () => {
    const modal = document.getElementById('modal-qr-menu');
    const container = document.getElementById('qrcode-container');
    const selector = document.getElementById('qr-lista-selector');
    if (!modal) return;

    modal.style.display = 'flex';
    
    // Poblar selector de listas
    if (selector) {
        selector.innerHTML = '<option value="">Carta General / Base</option>';
        listasPreciosCache.forEach(l => {
            if (!l.es_default) {
                selector.innerHTML += `<option value="${l.id}">${l.nombre}</option>`;
            }
        });
    }

    window.actualizarURLQR();
};

window.actualizarURLQR = () => {
    const container = document.getElementById('qrcode-container');
    const selector = document.getElementById('qr-lista-selector');
    const listaId = selector ? selector.value : '';
    
    container.innerHTML = ''; // Limpiar previo

    const protocol = window.location.protocol;
    const host = window.location.host;
    let url = `${protocol}//${host}/carta?id=${appState.negocioActivoId}`;
    
    if (listaId) {
        url += `&lista=${listaId}`;
    }
    
    document.getElementById('qr-url-text').value = url;
    document.getElementById('btn-ver-menu-publico').href = url;

    // Generar QR
    setTimeout(() => {
        new QRCode(container, {
            text: url,
            width: 250,
            height: 250,
            colorDark : "#1e293b",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }, 100);
};

window.cerrarModalQR = () => {
    document.getElementById('modal-qr-menu').style.display = 'none';
};

window.copiarURLMenu = () => {
    const input = document.getElementById('qr-url-text');
    input.select();
    document.execCommand('copy');
    mostrarNotificacion("URL copiada al portapapeles", "success");
};

window.descargarQR = () => {
    const qrImg = document.querySelector('#qrcode-container img');
    if (!qrImg) return;
    
    const link = document.createElement('a');
    link.href = qrImg.src;
    link.download = `QR_Menu_${appState.negocioActivoId}_${document.getElementById('qr-lista-selector').value || 'Gral'}.png`;
    link.click();
};

async function cargarProductosParaVinculo() {
    const select = document.getElementById('item-producto-id');
    if (!select || select.options.length > 1) return;

    try {
        const idNegocio = appState.negocioActivoId;
        const productos = await fetchData(`/api/negocios/${idNegocio}/productos`);
        productos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = `${p.nombre} (${p.sku || 'S/N'})`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Error cargando productos para vínculo:", error);
    }
}

async function guardarCategoria(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.disabled = true;

    const id = document.getElementById('cat-id').value;
    const data = {
        nombre: document.getElementById('cat-nombre').value,
        grupo: document.getElementById('cat-grupo').value.trim() || null,
        orden: parseInt(document.getElementById('cat-orden').value || 0),
        estacion: document.getElementById('cat-estacion').value,
        destino_id: document.getElementById('cat-destino-id').value || null
    };

    const idNegocio = appState.negocioActivoId;
    const url = id ? `/api/menu/categorias/${id}` : `/api/negocios/${idNegocio}/menu/categorias`;
    const method = id ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion('Categoría guardada', 'success');
        window.cerrarModalCategoria();
        await cargarCategorias();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function guardarItem(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.disabled = true;

    const id = document.getElementById('item-id').value;
    const stockChecked = document.getElementById('item-stock-control').checked;

    // Recolectar precios por lista
    const preciosListas = [];
    document.querySelectorAll('.input-precio-lista').forEach(input => {
        const p = parseFloat(input.value);
        if (!isNaN(p)) {
            preciosListas.push({
                lista_id: parseInt(input.dataset.listaId),
                precio: p
            });
        }
    });

    const data = {
        nombre: document.getElementById('item-nombre').value,
        precio: preciosListas.find(p => {
            const list = listasPreciosCache.find(l => l.id == p.lista_id);
            return list && list.es_default;
        })?.precio || 0, // El precio base es el de la lista default
        categoria_id: parseInt(document.getElementById('item-categoria').value),
        descripcion: document.getElementById('item-descripcion').value,
        destino_kds: document.getElementById('item-destino-kds').value || null,
        imagen_url: document.getElementById('item-imagen').value,
        disponible: document.getElementById('item-disponible').checked,
        stock_control: stockChecked,
        producto_id: stockChecked ? parseInt(document.getElementById('item-producto-id').value) : null,
        precios_listas: preciosListas // Enviamos el array completo
    };

    const idNegocio = appState.negocioActivoId;
    const url = id ? `/api/menu/items/${id}` : `/api/negocios/${idNegocio}/menu/items`;
    const method = id ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion('Plato guardado con éxito', 'success');
        window.cerrarModalItem();
        await cargarItems();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

window.editarItem = async (id) => {
    console.log("✏️ window.editarItem llamado con ID:", id, "Tipo:", typeof id);
    const item = itemsOriginales.find(i => i.id == id);
    if (!item) {
        console.warn("⚠️ No se encontró el ítem en itemsOriginales:", id);
        return;
    }

    // Asegurar que las listas estén cargadas antes de mostrar el modal
    if (listasPreciosCache.length === 0) {
        await cargarListas();
    }

    window.abrirModalItem();
    document.getElementById('modal-item-titulo').innerText = 'Editar Plato';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nombre').value = item.nombre;
    document.getElementById('item-categoria').value = item.categoria_id;
    document.getElementById('item-descripcion').value = item.descripcion || '';
    document.getElementById('item-destino-kds').value = item.destino_kds || '';
    document.getElementById('item-imagen').value = item.imagen_url || '';
    document.getElementById('item-disponible').checked = !!item.disponible;

    document.getElementById('item-stock-control').checked = !!item.stock_control;
    document.getElementById('item-producto-vinculo').style.display = item.stock_control ? 'block' : 'none';
    
    // Cargar precios específicos para este item
    try {
        const itemFull = await fetchData(`/api/menu/items/${id}`);
        renderizarInputsPreciosListas(itemFull);
    } catch (error) {
        console.error("Error al cargar detalles de precios:", error);
        renderizarInputsPreciosListas(item);
    }

    if (item.producto_id) {
        document.getElementById('item-producto-id').value = item.producto_id.toString();
    }
};

async function alinearConInventario() {
    const result = await Swal.fire({
        title: '¿Alinear con Inventario?',
        text: 'Esto sincronizará todos los "Productos Finales" masivamente. Ideal para importar listas de +1000 productos.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, sincronizar todo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4361ee'
    });

    if (result.isConfirmed) {
        try {
            // 1. Obtener lista completa
            Swal.fire({
                title: 'Analizando Inventario...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/menu/sync-inventory/list`);
            
            if (!productos.length) {
                return Swal.fire('Sin productos', 'No se encontraron productos de tipo "Final" para sincronizar.', 'info');
            }

            // 2. Procesar por lotes
            const batchSize = 50;
            const total = productos.length;
            let procesados = 0;

            Swal.fire({
                title: 'Sincronizando Menú',
                html: `Procesando <b>0</b> de ${total} productos...<br><br><div class="progress rounded-pill" style="height: 10px;"><div id="sync-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%"></div></div>`,
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    // Update function
                }
            });

            for (let i = 0; i < total; i += batchSize) {
                const batch = productos.slice(i, i + batchSize);
                await sendData(`/api/negocios/${appState.negocioActivoId}/menu/sync-inventory/batch`, { productos: batch }, 'POST');
                
                procesados += batch.length;
                const percent = Math.round((procesados / total) * 100);
                
                // Actualizar UI de SweetAlert
                const progressChild = document.getElementById('sync-progress');
                if (progressChild) progressChild.style.width = percent + '%';
                const htmlContainer = Swal.getHtmlContainer();
                if (htmlContainer) {
                   const b = htmlContainer.querySelector('b');
                   if (b) b.innerText = procesados;
                }
            }

            await cargarCategorias();
            await cargarItems();
            Swal.fire('¡Éxito!', `Se sincronizaron ${total} productos correctamente.`, 'success');

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- SELECCIÓN Y ACCIONES MASIVAS (Mismo motor que Inventario) ---
function vincularEventosSeleccionMenu() {
    const checkAll = document.getElementById('check-all-menu');
    const rowChecks = document.querySelectorAll('.item-check');
    const menuRows = document.querySelectorAll('.menu-row');
    const menuCards = document.querySelectorAll('.menu-card');

    if (checkAll) {
        checkAll.onchange = (e) => {
            const checked = e.target.checked;
            rowChecks.forEach(cb => {
                const id = cb.getAttribute('data-id');
                cb.checked = checked;
                if (checked) appStateMenu.selectedIds.add(Number(id));
                else {
                    appStateMenu.selectedIds.delete(Number(id));
                    appStateMenu.selectedIds.delete(String(id));
                }
            });
            actualizarBulkBar();
            renderizarContenido(); 
        };
    }

    rowChecks.forEach(cb => {
        cb.onchange = (e) => {
            const id = cb.getAttribute('data-id');
            const isChecked = e.target.checked;
            
            if (isChecked) {
                appStateMenu.selectedIds.add(Number(id));
            } else {
                appStateMenu.selectedIds.delete(Number(id));
                appStateMenu.selectedIds.delete(String(id));
                if (checkAll) checkAll.checked = false;
            }
            
            actualizarBulkBar();
            
            const container = e.target.closest('.menu-row') || e.target.closest('.menu-card');
            if (container) {
                if (isChecked) container.classList.add(appStateMenu.viewMode === 'table' ? 'table-selected-premium' : 'selected');
                else container.classList.remove('table-selected-premium', 'selected');
            }
        };
    });

    const toggleSelection = (id, element) => {
        if (!id || !element) return;
        const isCurrentlySelected = estaSeleccionado(id);
        const checkbox = element.querySelector('.item-check');
        
        if (isCurrentlySelected) {
            appStateMenu.selectedIds.delete(Number(id));
            appStateMenu.selectedIds.delete(String(id));
            if (checkbox) checkbox.checked = false;
            element.classList.remove('table-selected-premium', 'selected');
        } else {
            appStateMenu.selectedIds.add(Number(id));
            if (checkbox) checkbox.checked = true;
            element.classList.add(appStateMenu.viewMode === 'table' ? 'table-selected-premium' : 'selected');
        }
        actualizarBulkBar();
    };

    // --- DELEGACIÓN DE EVENTOS (MAESTRO) ---
    
    // 1. Delegador para la TABLA
    const tableBody = document.getElementById('table-items-body');
    if (tableBody) {
        tableBody.onclick = (e) => {
            console.log("🖱️ Tabla clickeada", e.target);
            const row = e.target.closest('tr');
            const id = row?.getAttribute('data-id');
            if (!id) return;

            // Acción de Botón?
            const btn = e.target.closest('.btn-action');
            if (btn) {
                console.log("🎯 Botón de acción detectado", btn.getAttribute('data-action'), id);
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                if (action === 'editar') {
                    if (typeof window.editarItem === 'function') window.editarItem(id);
                    else console.error("❌ window.editarItem no es una función");
                }
                else if (action === 'receta') {
                    if (typeof window.abrirModalReceta === 'function') window.abrirModalReceta(id);
                    else console.error("❌ window.abrirModalReceta no es una función");
                }
                else if (action === 'eliminar') {
                    if (typeof window.eliminarItem === 'function') window.eliminarItem(id);
                    else console.error("❌ window.eliminarItem no es una función");
                }
                return;
            }

            // Checkbox?
            if (e.target.classList.contains('item-check')) {
                console.log("✅ Checkbox clickeado", id);
                e.stopPropagation();
                toggleSelection(id, row);
                return;
            }

            // Click en fila (Selección)
            if (e.target.closest('a') || e.target.closest('button')) return;
            console.log("📂 Fila seleccionada", id);
            toggleSelection(id, row);
        };
    }

    // 2. Delegador para los CARDS
    const cardsCont = document.getElementById('items-container');
    if (cardsCont) {
        cardsCont.onclick = (e) => {
            const card = e.target.closest('.menu-card');
            if (!card) return;
            const id = card.getAttribute('data-id');

            // Acción de Botón?
            const btn = e.target.closest('.btn-action');
            if (btn) {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                if (action === 'editar') window.editarItem(id);
                else if (action === 'receta') window.abrirModalReceta(id);
                return;
            }

            // Checkbox?
            if (e.target.classList.contains('item-check')) {
                toggleSelection(id, card);
                return;
            }

            // Click en tarjeta
            if (e.target.closest('a') || e.target.closest('button')) return;
            toggleSelection(id, card);
        };
    }
}

function deseleccionarTodo() {
    appStateMenu.selectedIds.clear();
    const master = document.getElementById('check-all-menu');
    if (master) master.checked = false;
    actualizarBulkBar();
    renderizarContenido();
}

function actualizarBulkBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const label = document.getElementById('selected-count');
    const count = appStateMenu.selectedIds.size;
    
    if (count > 0) {
        bar.style.display = 'block';
        label.innerText = `${count} seleccionados`;
    } else {
        bar.style.display = 'none';
    }
}

// === CONFIGURACIÓN PREMIUM SWEETALERT ===
const swalPremium = {
    customClass: {
        popup: 'baboons-swal-popup',
        title: 'baboons-swal-title',
        input: 'baboons-swal-input',
        confirmButton: 'swal-btn-confirm shadow-sm hover-up',
        cancelButton: 'swal-btn-cancel'
    },
    buttonsStyling: false
};

async function abrirBulkPrecio() {
    const { value: precio } = await Swal.fire({
        ...swalPremium,
        title: 'Actualizar Precios',
        input: 'text',
        inputLabel: 'Ej: "+10%" para subir un 10%, "-5%" para bajar, o "2500" para precio fijo.',
        showCancelButton: true,
        confirmButtonText: 'Aplicar Cambios',
        cancelButtonText: 'Cerrar'
    });

    if (precio) {
        aplicarBulkUpdate('precio', precio);
    }
}

async function abrirBulkCategoria() {
    console.log("📦 abrirBulkCategoria llamado");
    if (appStateMenu.selectedIds.size === 0) return mostrarNotificacion('Seleccioná platos primero', 'warning');
    
    // Necesitamos las categorías para el select
    try {
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/menu/categorias`);
        const inputOptions = {};
        res.forEach(c => { inputOptions[c.id] = c.nombre; });

        const { value: catId } = await Swal.fire({
            ...swalPremium,
            title: 'Mover de Categoría',
            input: 'select',
            inputOptions: inputOptions,
            inputPlaceholder: 'Seleccioná una categoría...',
            showCancelButton: true,
            confirmButtonText: 'Mover Seleccionados',
            cancelButtonText: 'Cancelar'
        });

        if (catId) {
            aplicarBulkUpdate('categoria_id', catId);
        }
    } catch (e) { mostrarNotificacion(e.message, 'error'); }
}

async function abrirBulkKDS() {
    if (appStateMenu.selectedIds.size === 0) return mostrarNotificacion('Seleccioná platos primero', 'warning');

    const result = await Swal.fire({
        ...swalPremium,
        title: 'Destino KDS',
        input: 'text',
        inputLabel: 'Ubicación (Ej: Cocina, Barra, Horno)',
        inputPlaceholder: 'Dejar vacío para heredar...',
        showCancelButton: true,
        confirmButtonText: 'Guardar Destino',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        aplicarBulkUpdate('destino_kds', result.value.trim() || null);
    }
}

async function aplicarBulkPausa(estado) {
    const result = await Swal.fire({
        ...swalPremium,
        title: `¿${estado ? 'Activar' : 'Pausar'} ítems?`,
        html: `Se procesarán <strong>${appStateMenu.selectedIds.size}</strong> elementos seleccionados.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: estado ? 'Sí, Activar' : 'Sí, Pausar',
        cancelButtonText: 'Volver'
    });
    if (result.isConfirmed) {
        aplicarBulkUpdate('disponible', estado);
    }
}

async function aplicarBulkUpdate(field, value) {
    Swal.fire({ 
        ...swalPremium,
        title: 'Actualizando...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });
    try {
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/menu/bulk-update`, {
            ids: Array.from(appStateMenu.selectedIds),
            field, value
        }, 'POST');
        
        mostrarNotificacion(res.message, 'success');
        deseleccionarTodo();
        await cargarItems();
        Swal.close();
    } catch (e) {
        Swal.fire({
            ...swalPremium,
            title: 'Error', 
            text: e.message, 
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
    }
}

window.eliminarItem = async (id) => {
    const result = await Swal.fire({
        ...swalPremium,
        title: '¿Eliminar de la carta?',
        text: 'Esta acción quitará el plato/bebida de todas las listas de venta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Mantenlo'
    });

    if (result.isConfirmed) {
        try {
            await sendData(`/api/menu/items/${id}`, {}, 'DELETE');
            mostrarNotificacion('Eliminado', 'success');
            await cargarItems();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }
};

// --- RECETAS LOGIC ---

let currentItemRecetaId = null;
let recetaData = [];
let insumosDisponiblesCache = [];

window.abrirModalReceta = async (id) => {
    console.log("🧪 window.abrirModalReceta llamado con ID:", id);
    const item = itemsOriginales.find(i => i.id == id);
    if (!item) {
        console.warn("⚠️ No se encontró el ítem para receta en itemsOriginales:", id);
        return;
    }

    currentItemRecetaId = id;
    document.getElementById('receta-item-nombre').innerText = item.nombre;
    document.getElementById('receta-item-precio').innerText = `$${parseFloat(item.precio).toLocaleString('es-AR')}`;
    
    const modal = document.getElementById('modal-receta');
    modal.style.display = 'flex';

    await cargarInsumosParaReceta();
    await cargarDetalleReceta(id);
};

window.cerrarModalReceta = () => {
    document.getElementById('modal-receta').style.display = 'none';
};

async function cargarInsumosParaReceta() {
    const select = document.getElementById('receta-insumo-id');
    if (!select) return;

    try {
        const idNegocio = appState.negocioActivoId;
        
        // 🔄 Cargamos SIEMPRE datos frescos del inventario
        const todosLosProductos = await fetchData(`/api/negocios/${idNegocio}/productos`, { silent: true });
        
        // 🎯 FILTRO INTELIGENTE MEJORADO:
        // Buscamos productos que sean materia_prima O insumo
        insumosDisponiblesCache = todosLosProductos.filter(p => {
            const tipo = (p.tipo_producto || '').toLowerCase();
            const esMateriaPrima = tipo === 'materia_prima' || tipo === 'materia prima';
            const esInsumo = tipo === 'insumo';
            const catNombre = (p.categoria_nombre || '').toLowerCase();
            const esSugeridoCat = catNombre.includes('materia') || catNombre.startsWith('mp');
            
            return (esMateriaPrima || esInsumo || esSugeridoCat) && p.activo !== false;
        });

        // Ordenamos por nombre
        insumosDisponiblesCache.sort((a, b) => a.nombre.localeCompare(b.nombre));

        select.innerHTML = '<option value="">Elegir Insumo / Materia Prima...</option>';
        if (insumosDisponiblesCache.length === 0) {
            select.innerHTML = '<option value="">⚠️ No hay Insumos/MP activos configurados</option>';
            console.warn("Filtro de insumos dio 0 resultados. Categorías encontradas:", todosLosProductos.map(p => p.categoria_nombre));
        }

        insumosDisponiblesCache.forEach(p => {
            const lblUnidad = p.unidad_medida || 'un';
            const precioCosto = parseFloat(p.precio_costo || p.precio_compra || 0); // Tomamos costo si existe
            select.innerHTML += `<option value="${p.id}" data-precio="${precioCosto}" data-unidad="${lblUnidad}">${p.nombre} (${lblUnidad}) - $${precioCosto.toLocaleString('es-AR')}</option>`;
        });
    } catch (error) {
        console.error("Error cargando insumos:", error);
    }
}

async function cargarDetalleReceta(itemId) {
    const body = document.getElementById('receta-items-body');
    body.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando ingredientes...</td></tr>';

    try {
        recetaData = await fetchData(`/api/menu/items/${itemId}/receta`);
        renderizarTablaReceta();
    } catch (error) {
        console.error(error);
        body.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No se pudo cargar la receta.</td></tr>';
    }
}

function renderizarTablaReceta() {
    const body = document.getElementById('receta-items-body');
    const labelTotal = document.getElementById('receta-costo-total');
    body.innerHTML = '';
    
    let costoTotal = 0;

    if (recetaData.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted small italic">Este plato aún no tiene ingredientes cargados.</td></tr>';
    }

    recetaData.forEach(r => {
        const row = document.createElement('tr');
        const costo = parseFloat(r.cantidad) * parseFloat(r.costo_unitario || 0);
        costoTotal += costo;

        row.innerHTML = `
            <td>
                <div class="fw-700 text-dark">${r.insumo_nombre}</div>
                <div class="x-small text-muted">Costo Ref: $${parseFloat(r.costo_unitario || 0).toFixed(2)} / ${r.unidad || 'un'}</div>
            </td>
            <td class="text-center">
                <span class="badge bg-light text-dark border px-3 py-2 rounded-3 fw-800">${r.cantidad} ${r.unidad || ''}</span>
            </td>
            <td class="text-end fw-700 text-dark">
                $${costo.toLocaleString('es-AR', {minimumFractionDigits: 2})}
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-link text-danger p-0" onclick="window.quitarInsumoReceta(${r.id})">
                    <i class="fas fa-minus-circle fa-lg"></i>
                </button>
            </td>
        `;
        body.appendChild(row);
    });

    labelTotal.innerText = `$${costoTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

    // Cálculo de utilidad/margen si existe el precio
    const precioVenta = parseFloat(document.getElementById('receta-item-precio').innerText.replace('$', '').replace(/\./g, '').replace(',', '.'));
    const marginBox = document.getElementById('receta-profit-margin');
    if (marginBox) {
        const utilidad = precioVenta - costoTotal;
        const porc = precioVenta > 0 ? (utilidad / precioVenta * 100).toFixed(1) : 0;
        marginBox.innerHTML = `Utilidad: <strong>$${utilidad.toLocaleString('es-AR')} (${porc}%)</strong>`;
        marginBox.className = utilidad > 0 ? 'text-success small fw-700' : 'text-danger small fw-700';
    }
}

async function agregarInsumoAReceta() {
    const select = document.getElementById('receta-insumo-id');
    const inputQty = document.getElementById('receta-insumo-qty');
    
    const insumoId = select.value;
    const cantidad = parseFloat(inputQty.value);

    if (!insumoId || !cantidad || cantidad <= 0) {
        mostrarNotificacion("Selecciona un insumo y cantidad válida", "warning");
        return;
    }

    try {
        const payload = {
            insumo_id: parseInt(insumoId),
            cantidad: cantidad,
            unidad: select.options[select.selectedIndex].dataset.unidad
        };

        await sendData(`/api/menu/items/${currentItemRecetaId}/receta`, payload, 'POST');
        mostrarNotificacion("Ingrediente añadido", "success");
        inputQty.value = '';
        await cargarDetalleReceta(currentItemRecetaId);
    } catch (error) {
        mostrarNotificacion("Error al añadir ingrediente", "error");
    }
}

window.quitarInsumoReceta = async (recetaId) => {
    try {
        await sendData(`/api/menu/recetas/${recetaId}`, {}, 'DELETE');
        mostrarNotificacion("Ingrediente quitado", "info");
        await cargarDetalleReceta(currentItemRecetaId);
    } catch (error) {
        mostrarNotificacion("Error al quitar ingrediente", "error");
    }
};

window.togglePausaItem = async (id, disponibleActual) => {
    try {
        await sendData(`/api/menu/items/${id}`, { disponible: !disponibleActual }, 'PUT');
        mostrarNotificacion(disponibleActual ? 'Plato pausado' : 'Plato reanudado', 'info');
        await cargarItems();
    } catch (error) {
        mostrarNotificacion("Error al cambiar estado", "error");
    }
};

window.abrirModalBranding = async () => {
    const modal = document.getElementById('modal-branding-menu');
    if (!modal) return;
    
    try {
        const neg = await fetchData(`/api/negocios/${appState.negocioActivoId}`);
        document.getElementById('branding-logo-url').value = neg.logo_url_resto || '';
        document.getElementById('branding-fondo-url').value = neg.fondo_url_resto || '';
        document.getElementById('branding-instagram').value = neg.instagram_url_resto || '';
        document.getElementById('branding-facebook').value = neg.facebook_url_resto || '';
        document.getElementById('branding-direccion').value = neg.direccion_resto || '';
        document.getElementById('branding-telefono').value = neg.telefono_resto || '';
        modal.style.display = 'flex';
    } catch (error) {
        mostrarNotificacion("Error al cargar configuración", "error");
    }
};

window.cerrarModalBranding = () => {
    document.getElementById('modal-branding-menu').style.display = 'none';
};

async function guardarBranding(e) {
    e.preventDefault();
    const data = {
        logo_url_resto: document.getElementById('branding-logo-url').value,
        fondo_url_resto: document.getElementById('branding-fondo-url').value,
        instagram_url_resto: document.getElementById('branding-instagram').value,
        facebook_url_resto: document.getElementById('branding-facebook').value,
        direccion_resto: document.getElementById('branding-direccion').value,
        telefono_resto: document.getElementById('branding-telefono').value
    };
    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}`, data, 'PUT');
        mostrarNotificacion("Marca actualizada con éxito", "success");
        window.cerrarModalBranding();
    } catch (error) {
        mostrarNotificacion("Error al guardar marca", "error");
    }
}

// --- LIST MANAGEMENT LOGIC ---

async function cargarListas() {
    try {
        const idNegocio = appState.negocioActivoId;
        console.log("📡 Cargando listas para negocio:", idNegocio);
        listasPreciosCache = await fetchData(`/api/negocios/${idNegocio}/menu/listas`, { silent: true });
        console.log("✅ Listas de precios cargadas con éxito:", listasPreciosCache);
    } catch (error) {
        console.error("❌ Error cargando listas:", error);
    }
}

window.abrirModalListas = () => {
    document.getElementById('modal-listas').style.display = 'flex';
    window.renderizarListasGestion();
};

window.cerrarModalListas = () => {
    document.getElementById('modal-listas').style.display = 'none';
};

window.renderizarListasGestion = () => {
    const container = document.getElementById('listas-container');
    if (!container) return;

    container.innerHTML = '';
    listasPreciosCache.forEach(l => {
        const item = document.createElement('div');
        item.className = 'glass-card p-3 rounded-4 mb-2 d-flex justify-content-between align-items-center border';
        item.innerHTML = `
            <div>
                <h6 class="mb-0 fw-800">${l.nombre} ${l.es_default ? '<span class="badge bg-primary-soft text-primary ms-2 x-small">Base</span>' : ''}</h6>
                <p class="text-muted small mb-0">${l.mensaje_banner || 'Sin mensaje de bienvenida'}</p>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-blur-dark btn-sm rounded-circle" onclick="window.configurarExperienciaLista(${l.id})" title="Configurar Banner y Mensaje">
                    <i class="fas fa-magic"></i>
                </button>
                ${!l.es_default ? `
                    <button class="btn btn-outline-danger btn-sm rounded-circle" onclick="window.eliminarLista(${l.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(item);
    });
};

window.crearNuevaLista = async (mode = 'standard') => {
    const inputId = mode === 'setup' ? 'nueva-lista-nombre-setup' : 'nueva-lista-nombre';
    const nombre = document.getElementById(inputId).value;
    if (!nombre) return mostrarNotificacion("Ingresá un nombre para la lista", "warning");

    try {
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas`, { nombre }, 'POST');
        mostrarNotificacion("Lista creada con éxito", "success");
        document.getElementById(inputId).value = '';
        await cargarListas();
        if (mode === 'setup') {
            // Si estuviéramos en el modal setup, refrescaríamos su lista específica si existiera
        }
        window.renderizarListasGestion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
};

window.configurarExperienciaLista = (id) => {
    const l = listasPreciosCache.find(x => x.id == id);
    if (!l) return;

    document.getElementById('edit-lista-id').value = l.id;
    document.getElementById('edit-lista-nombre').value = l.nombre;
    document.getElementById('edit-lista-mensaje').value = l.mensaje_banner || '';
    document.getElementById('edit-lista-banner').value = l.banner_url || '';

    document.getElementById('modal-editar-lista').style.display = 'flex';
};

window.cerrarModalEditarLista = () => {
    document.getElementById('modal-editar-lista').style.display = 'none';
};

document.getElementById('form-editar-lista').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-lista-id').value;
    const payload = {
        nombre: document.getElementById('edit-lista-nombre').value,
        mensaje_banner: document.getElementById('edit-lista-mensaje').value,
        banner_url: document.getElementById('edit-lista-banner').value
    };

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas/${id}`, payload, 'PUT');
        mostrarNotificacion("Configuración guardada", "success");
        window.cerrarModalEditarLista();
        await cargarListas();
        window.renderizarListasGestion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
};

window.eliminarLista = async (id) => {
    const result = await Swal.fire({
        ...swalPremium,
        title: '¿Eliminar lista?',
        text: "Los precios especiales guardados en esta lista se perderán permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
    
    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas/${id}`, {}, 'DELETE');
        mostrarNotificacion("Lista eliminada", "info");
        await cargarListas();
        window.renderizarListasGestion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
};
