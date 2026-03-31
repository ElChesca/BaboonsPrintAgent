/* app/static/js/modules/resto_menu.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let categoriasCache = [];
let itemsMenuCache = [];
let listasPreciosCache = []; // NUEVO: Cache para listas de precios
let catSeleccionadaId = 'all';
let qrcode = null;

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
            const query = e.target.value.toLowerCase();
            renderizarItems(query);
        };
    }
}

async function cargarCategorias() {
    try {
        const idNegocio = appState.negocioActivoId;
        categoriasCache = await fetchData(`/api/negocios/${idNegocio}/menu/categorias`);
        renderizarTabsCategorias();
        poblarSelectCategorias();
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar categorías', 'error');
    }
}

function renderizarTabsCategorias() {
    const container = document.getElementById('categorias-tabs');
    if (!container) return;

    container.innerHTML = '';

    // Tab "Todos"
    const todosWrapper = document.createElement('div');
    todosWrapper.className = `category-pill-wrapper ${catSeleccionadaId === 'all' ? 'active' : ''}`;
    todosWrapper.innerHTML = `
        <button class="nav-link-premium" onclick="window.filtrarPorCategoria('all')">Todos</button>
    `;
    container.appendChild(todosWrapper);

    // Tabs de Categorías
    categoriasCache.forEach(c => {
        const wrapper = document.createElement('div');
        wrapper.className = `category-pill-wrapper ${catSeleccionadaId == c.id ? 'active' : ''}`;

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
    document.getElementById('cat-orden').value = cat.orden || 0;
    document.getElementById('cat-estacion').value = cat.estacion || 'cocina';
};

function poblarSelectCategorias() {
    const select = document.getElementById('item-categoria');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione una categoría</option>';
    categoriasCache.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

window.filtrarPorCategoria = (id) => {
    catSeleccionadaId = id;
    renderizarTabsCategorias();
    renderizarItems();
};

async function cargarItems() {
    const idNegocio = appState.negocioActivoId;
    const loading = document.getElementById('loading-menu');
    if (loading) loading.style.display = 'block';

    try {
        itemsMenuCache = await fetchData(`/api/negocios/${idNegocio}/menu/items`);
        if (loading) loading.style.display = 'none';
        actualizarEstadisticas();
        renderizarItems();
    } catch (error) {
        console.error(error);
        if (loading) loading.style.display = 'none';
        mostrarNotificacion('Error al cargar la carta', 'error');
    }
}

function renderizarItems(queryTerm = '') {
    const container = document.getElementById('menu-items-container');
    const noItems = document.getElementById('no-items');
    if (!container) return;

    container.innerHTML = '';

    let itemsFiltrados = itemsMenuCache;

    // Filtro por categoría
    if (catSeleccionadaId !== 'all') {
        itemsFiltrados = itemsFiltrados.filter(i => i.categoria_id == catSeleccionadaId);
    }

    // Filtro por búsqueda de texto
    if (queryTerm) {
        itemsFiltrados = itemsFiltrados.filter(i => 
            i.nombre.toLowerCase().includes(queryTerm) || 
            (i.descripcion && i.descripcion.toLowerCase().includes(queryTerm)) ||
            (i.sku && i.sku.toLowerCase().includes(queryTerm))
        );
    }

    if (itemsFiltrados.length === 0) {
        if (noItems) noItems.style.display = 'block';
    } else {
        if (noItems) noItems.style.display = 'none';
        itemsFiltrados.forEach(i => {
            const col = document.createElement('div');
            col.className = 'col animate__animated animate__fadeInUp';

            const imgUrl = i.imagen_url || 'static/img/icons/reportes.png';
            const statusClass = i.disponible ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
            const statusText = i.disponible ? 'Disponible' : 'Pausado';

            col.innerHTML = `
                <div class="card menu-card-premium h-100 shadow-sm border-0">
                    <div class="card-img-wrapper position-relative">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        <img src="${imgUrl}" alt="${i.nombre}" class="w-100 h-100 object-fit-cover" onerror="this.src='/static/img/icons/reportes.png'">
                        <div class="price-tag shadow-lg">$${parseFloat(i.precio).toLocaleString('es-AR')}</div>
                    </div>
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1 min-w-0">
                                <h5 class="fw-800 m-0 text-truncate mb-1" title="${i.nombre}">${i.nombre}</h5>
                                <div class="d-flex align-items-center gap-1">
                                    <span class="badge bg-light text-muted fw-600 x-small px-2 border">${i.categoria_nombre}</span>
                                    ${i.stock_control ? '<span class="badge bg-primary-soft text-primary x-small border border-primary border-opacity-25"><i class="fas fa-boxes"></i> Stock</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <p class="text-muted small mb-3 lh-sm" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 32px;">
                            ${i.descripcion || 'Sin descripción detallada.'}
                        </p>
                        <div class="d-flex gap-2 border-top pt-3 mt-auto">
                            <button class="btn-recipe-card" onclick="window.abrirModalReceta(${i.id})" title="Gestionar Receta">
                                <i class="fas fa-book-open"></i>
                            </button>
                            <button class="${i.disponible ? 'btn-pause-card' : 'btn-resume-card'} flex-grow-1" onclick="window.togglePausaItem(${i.id}, ${i.disponible})" title="${i.disponible ? 'Pausar' : 'Reanudar'}">
                                <i class="fas ${i.disponible ? 'fa-pause' : 'fa-play'} me-2"></i> <span class="small fw-700">${i.disponible ? 'Pausar' : 'Reanudar'}</span>
                            </button>
                            <button class="btn-edit-card" onclick="window.editarItem(${i.id})" title="Editar">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn-delete-card" onclick="window.eliminarItem(${i.id})" title="Eliminar">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    }
}

function actualizarEstadisticas() {
    const total = itemsMenuCache.length;
    const activos = itemsMenuCache.filter(i => i.disponible).length;
    const pausados = total - activos;
    // Stock bajo es una estimación si están vinculados
    const bajoStock = itemsMenuCache.filter(i => i.stock_control && i.cantidad < 5).length;

    document.getElementById('stat-total-platos').innerText = total;
    document.getElementById('stat-platos-activos').innerText = activos;
    document.getElementById('stat-platos-pausados').innerText = pausados;
    document.getElementById('stat-bajo-stock').innerText = bajoStock;
}

// Ventanas globales para modales
window.abrirModalCategoria = () => {
    const modal = document.getElementById('modal-categoria');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('form-categoria').reset();
        document.getElementById('cat-id').value = '';
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
        
        // Renderizar inputs para cada lista de precios
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

    // Ordenamos para que la lista default vaya siempre primero
    const listasOrdenadas = [...listasPreciosCache].sort((a, b) => (b.es_default ? 1 : 0) - (a.es_default ? 1 : 0));

    listasOrdenadas.forEach(l => {
        let precioVal = '';
        if (itemData) {
            const mapPrecio = (itemData.precios || []).find(p => p.lista_id == l.id);
            precioVal = mapPrecio ? mapPrecio.precio : (l.es_default ? itemData.precio : '');
        }

        container.innerHTML += `
            <div class="col-12">
                <div class="form-group-premium mb-3">
                    <label class="form-label-premium small ${l.es_default ? 'fw-800 text-primary' : 'opacity-75'}">
                        ${l.nombre} ${l.es_default ? '(Venta General / Base)' : '(Carta Especial)'}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text bg-white border-end-0 rounded-start-4"><i class="fas fa-tag ${l.es_default ? 'text-primary' : 'text-muted'}"></i></span>
                        <input type="number" class="form-control-glass ps-2 input-precio-lista" 
                               data-lista-id="${l.id}" 
                               value="${precioVal}" 
                               placeholder="${l.es_default ? 'Precio Estándar' : 'Precio Especial'}" 
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
        orden: parseInt(document.getElementById('cat-orden').value || 0),
        estacion: document.getElementById('cat-estacion').value
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
    const item = itemsMenuCache.find(i => i.id === id);
    if (!item) return;

    window.abrirModalItem();
    document.getElementById('modal-item-titulo').innerText = 'Editar Plato';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nombre').value = item.nombre;
    document.getElementById('item-categoria').value = item.categoria_id;
    document.getElementById('item-descripcion').value = item.descripcion || '';
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

window.eliminarItem = async (id) => {
    const result = await Swal.fire({
        title: '¿Eliminar ítem de la carta?',
        text: 'Esta acción quitará el plato/bebida de las opciones de venta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
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
    const item = itemsMenuCache.find(i => i.id === id);
    if (!item) return;

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
        // Buscamos productos que tengan tipo 'insumo' O categoría que empiece con "MP" o "Materia"
        insumosDisponiblesCache = todosLosProductos.filter(p => {
            const catNombre = (p.categoria_nombre || '').toLowerCase();
            const esMateriaPrima = catNombre.includes('materia prima') || catNombre.startsWith('mp');
            const esInsumo = (p.tipo_producto === 'insumo');
            return (esMateriaPrima || esInsumo) && p.activo !== false;
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
                <div class="x-small text-muted">Ref: $${parseFloat(r.costo_unitario || 0).toFixed(2)} por ${r.unidad || 'un'}</div>
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
        listasPreciosCache = await fetchData(`/api/negocios/${idNegocio}/menu/listas`);
        console.log("✅ Listas de precios cargadas:", listasPreciosCache.length);
    } catch (error) {
        console.error("Error cargando listas:", error);
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

window.crearNuevaLista = async () => {
    const nombre = document.getElementById('nueva-lista-nombre').value;
    if (!nombre) return mostrarNotificacion("Ingresá un nombre para la lista", "warning");

    try {
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas`, { nombre }, 'POST');
        mostrarNotificacion("Lista creada con éxito", "success");
        document.getElementById('nueva-lista-nombre').value = '';
        await cargarListas();
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
    if (!confirm("¿Estás seguro de eliminar esta lista? Los precios especiales guardados se perderán.")) return;
    
    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/menu/listas/${id}`, {}, 'DELETE');
        mostrarNotificacion("Lista eliminada", "info");
        await cargarListas();
        window.renderizarListasGestion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
};
