import { fetchData, sendData } from '../api.js';
import { getCurrentUser, logout } from './auth.js';

let currentRoute = null;
let currentCart = [];
let productsCache = [];
let activeClientId = null;
let activeRouteId = null;
let editingOrderId = null; // ✨ Estado para saber si editamos
const formatProductName = (p) => p.alias ? `${p.alias} (${p.sku || p.nombre})` : p.nombre;

document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user) {
        // ✨ Redirigir al login del SPA (/#login) pasando el returnUrl
        const returnPath = '/static/seller.html';
        window.location.href = `/#login?returnUrl=${encodeURIComponent(returnPath)}`;
        return;
    }

    // Verificar rol (Redundancia de seguridad frontend)
    if (user.rol !== 'vendedor') {
        // window.location.href = '/static/dashboard.html'; 
    }

    document.getElementById('nombre-vendedor').innerText = user.nombre;

    // Fecha Hoy (Input Date)
    const dateInput = document.getElementById('fecha-ruta');
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    dateInput.value = localDate;

    // ✨ Evento Cambio de Fecha
    dateInput.addEventListener('change', (e) => {
        loadRoute(e.target.value);
    });

    // Exponer función de toggle globalmente
    window.toggleView = toggleView;

    window.logout = logout;
    window.cerrarModalPedido = cerrarModalPedido;
    window.confirmarPedido = confirmarPedido;
    // window.verMapaCompleto se reemplaza por toggleView('mapa')

    // ✨ Evento Cambio de Ruta (Multiples rutas)
    const routeSelector = document.getElementById('route-selector');
    if (routeSelector) {
        routeSelector.addEventListener('change', (e) => {
            loadRouteDetails(e.target.value);
        });
    }

    await loadRoute(localDate);
});

function loadTodayRoute() {
    const dateInput = document.getElementById('fecha-ruta');
    if (dateInput) loadRoute(dateInput.value);
}

let mapInstance = null;
let markersLayer = null;

function toggleView(view) {
    const listContainer = document.getElementById('lista-clientes');
    const mapContainer = document.getElementById('seller-map-container');
    const btnRuta = document.getElementById('nav-btn-ruta');
    const btnMapa = document.getElementById('nav-btn-mapa');

    if (view === 'ruta') {
        listContainer.style.display = 'block';
        mapContainer.style.display = 'none';
        btnRuta.classList.add('active');
        btnMapa.classList.remove('active');
    } else {
        listContainer.style.display = 'none';
        mapContainer.style.display = 'block';
        btnRuta.classList.remove('active');
        btnMapa.classList.add('active');

        // Inicializar mapa si no existe, o redimensionar
        setTimeout(() => {
            initMap();
        }, 100);
    }
}

function initMap() {
    if (!currentRoute || !currentRoute.items) return;

    if (!mapInstance) {
        mapInstance = L.map('seller-map-container').setView([-34.6037, -58.3816], 12); // Default BA
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);
        markersLayer = L.layerGroup().addTo(mapInstance);
    } else {
        mapInstance.invalidateSize(); // Fix render issues on hidden div
        markersLayer.clearLayers();
    }

    const bounds = [];

    currentRoute.items.forEach(item => {
        if (item.latitud && item.longitud) {
            const lat = parseFloat(item.latitud);
            const lng = parseFloat(item.longitud);

            let color = 'blue';
            if (item.visitado) color = 'orange';
            if (item.tiene_pedido) color = 'green';

            // Icono simple (podríamos usar custom icons luego)
            const marker = L.circleMarker([lat, lng], {
                color: color,
                fillColor: color,
                fillOpacity: 0.5,
                radius: 8
            }).addTo(markersLayer);

            marker.bindPopup(`
                <b>${item.cliente_nombre}</b><br>
                ${item.cliente_direccion}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="abrirModalPedidoSeller(${item.cliente_id}, '${item.cliente_nombre}', ${item.id})">
                    Pedido
                </button>
            `);

            bounds.push([lat, lng]);
        }
    });

    if (bounds.length > 0) {
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }
}

async function loadRoute(dateStr) {
    try {
        const user = getCurrentUser();
        if (!user.vendedor_id) {
            renderErrorState({ message: "No tienes un perfil de vendedor asignado." });
            document.getElementById('lista-clientes').innerHTML = `
                    <div class="alert alert-danger text-center m-3">
                        <i class="fas fa-user-slash fa-2x mb-2"></i><br>
                        <strong>Perfil Incompleto</strong><br>
                        Tu usuario no está vinculado a un vendedor.<br>
                        <small>Contacta a administración para vincular tu email.</small>
                    </div>`;
            return;
        }

        // Buscar hojas de ruta
        const data = await fetchData(`/api/negocios/${user.negocio_id}/hoja_ruta?vendedor_id=${user.vendedor_id}&fecha=${dateStr}`);

        // Filtrar rutas EXACTAS de la fecha (la API puede traer ordenadas pero aseguremos match)
        // La API /hoja_ruta filtra por fecha si se pasa param fecha, así que 'data' son las de ese día.
        const rutasDelDia = data;

        // Actualizar contador visual
        const badgeContador = document.getElementById('contador-rutas');
        if (rutasDelDia.length > 0) {
            badgeContador.innerText = rutasDelDia.length;
            badgeContador.style.display = 'inline-block';
            badgeContador.className = 'badge bg-primary rounded-pill';
        } else {
            badgeContador.style.display = 'none';
        }

        // Manejo de Múltiples Rutas
        const selector = document.getElementById('route-selector');
        selector.innerHTML = '';

        if (rutasDelDia.length === 0) {
            selector.style.display = 'none';
            renderNoRoute();
            return;
        }

        if (rutasDelDia.length > 1) {
            // Mostrar selector
            selector.style.display = 'block';
            rutasDelDia.forEach((r, idx) => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.text = `Ruta #${r.id} (${r.estado})`;
                selector.appendChild(opt);
            });
            // Si ya hay una activa seleccionada en el selector, usarla, sino la primera
            // Pero como estamos recargando la fecha, tomamos la primera por defecto (o la más 'Activa')
            const prioritaria = rutasDelDia.find(r => r.estado === 'activa') || rutasDelDia[0];
            selector.value = prioritaria.id;
            loadRouteDetails(prioritaria.id);
        } else {
            // Solo una
            selector.style.display = 'none';
            loadRouteDetails(rutasDelDia[0].id);
        }

    } catch (error) {
        console.error(error);
        renderErrorState(error);
    }
}

async function loadRouteDetails(id) {
    try {
        activeRouteId = id;

        // 1. Cargar detalle Hoja Ruta
        const detalle = await fetchData(`/api/hoja_ruta/${id}`);

        // 2. Cargar Pedidos de esta Ruta (Para saber qué entregar)
        // Usamos el negocio del user actual.
        const user = getCurrentUser();
        const pedidos = await fetchData(`/api/negocios/${user.negocio_id}/pedidos?hoja_ruta_id=${id}`);
        // Mapeamos para rápido acceso (Soporta múltiples pedidos por cliente)
        detalle.pedidosMap = {};
        if (pedidos) {
            pedidos.forEach(p => {
                if (!detalle.pedidosMap[p.cliente_id]) detalle.pedidosMap[p.cliente_id] = [];
                detalle.pedidosMap[p.cliente_id].push(p);
            });
        }

        // Actualizar Badge de Estado
        document.getElementById('estado-ruta-badge').innerText = detalle.estado.toUpperCase();
        document.getElementById('estado-ruta-badge').className = `badge ${detalle.estado === 'activa' ? 'bg-success text-white' : 'bg-warning text-dark'} border`;

        // ✨ ALERTA VISUAL: Si está en borrador
        const alertContainer = document.getElementById('estado-ruta-alert');
        if (detalle.estado === 'borrador') {
            if (!alertContainer) {
                const alertDiv = document.createElement('div');
                alertDiv.id = 'estado-ruta-alert';
                alertDiv.className = 'alert alert-warning text-center small p-2 mt-2 mx-3 mb-0';
                alertDiv.innerHTML = '<i class="fas fa-lock"></i> <b>Ruta en Espera</b>. Contacta al encargado para iniciar.';
                document.getElementById('nav-header').after(alertDiv);
            } else {
                alertContainer.style.display = 'block';
            }
        } else {
            if (alertContainer) alertContainer.style.display = 'none';
        }

        currentRoute = detalle;
        renderClients(detalle.items, detalle.pedidosMap);
        updateStats(detalle.items);

        if (document.getElementById('seller-map-container').style.display === 'block') {
            setTimeout(initMap, 100);
        }

    } catch (error) {
        console.error("Error loading route details", error);
        renderErrorState(error);
    }
}

function renderErrorState(error) {
    document.getElementById('lista-clientes').innerHTML = `
        <div class="text-center output-error p-4">
            <i class="fas fa-exclamation-triangle text-danger fa-2x mb-2"></i>
            <h6 class="text-danger fw-bold">Error cargando ruta</h6>
            <p class="small text-muted">${error.message || 'Error de conexión'}</p>
            <button class="btn btn-outline-primary btn-sm rounded-pill mt-2" onclick="location.reload()">
                <i class="fas fa-sync-alt me-1"></i> Reintentar
            </button>
        </div>
    `;
    document.getElementById('estado-ruta-badge').innerText = 'Error';
    document.getElementById('estado-ruta-badge').className = 'badge bg-danger';
}


// ... (al inicio, dentro de loadRouteDetails o init)
async function checkFinancialStatus() {
    try {
        const user = getCurrentUser();
        if (!user) return;

        const data = await fetchData(`/api/negocios/${user.negocio_id}/caja/estado`);
        const cajaCerrada = data.estado === 'cerrada';

        const alertContainer = document.getElementById('caja-alerta-global');

        if (cajaCerrada) {
            if (!alertContainer) {
                const div = document.createElement('div');
                div.id = 'caja-alerta-global';
                div.className = 'alert alert-danger text-center fw-bold m-0 rounded-0 fixed-top';
                div.style.zIndex = '9999';
                div.innerHTML = '<i class="fas fa-cash-register me-2"></i>CAJA CERRADA - No se pueden realizar cobros';
                document.body.prepend(div);
                // Ajustar padding del body para que no tape
                document.body.style.paddingTop = '50px';
            }
        } else {
            if (alertContainer) {
                alertContainer.remove();
                document.body.style.paddingTop = '0';
            }
        }

        return cajaCerrada;
    } catch (e) {
        console.error("Error verificando caja", e);
        return false; // Asumimos abierta si falla check para no bloquear por error de red, el backend validará igual
    }
}

// Modificar loadRoute para llamar a esto
// ...

// Modificar abrirModalEntregaSeller para validar esto antes de abrir
window.abrirModalEntregaSeller = async function (pedido) {
    const cajaCerrada = await checkFinancialStatus();
    if (cajaCerrada) {
        Swal.fire({
            icon: 'warning',
            title: '¡Caja Cerrada!',
            text: 'No se pueden realizar cobros en este momento.',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    document.getElementById('entrega-pedido-id').value = pedido.id;
    // Guardar total original en data-attribute para cálculos
    const montoTotalEl = document.getElementById('entrega-monto-total');
    montoTotalEl.dataset.original = pedido.total;
    montoTotalEl.innerText = `$${pedido.total.toLocaleString()}`;

    // Reset Descuento
    const inputDesc = document.getElementById('entrega-descuento-pct');
    if (inputDesc) {
        inputDesc.value = '';
        document.getElementById('container-nuevo-total').classList.add('d-none');
    }

    // Resumen breve items si backend lo trae
    const resumenDiv = document.getElementById('entrega-resumen-items');
    if (pedido.detalles_resumen) {
        resumenDiv.innerText = pedido.detalles_resumen;
        resumenDiv.classList.remove('d-none');
    } else {
        resumenDiv.classList.add('d-none');
    }

    // Configurar botón EDITAR
    const btnEditar = document.getElementById('btn-editar-pedido-cobro');
    btnEditar.onclick = () => {
        cerrarModalEntrega();
        window.abrirModalPedidoSeller(pedido.cliente_id, pedido.cliente_nombre, null, pedido.id);
    };

    document.getElementById('modal-confirmar-entrega').style.display = 'block';
}


function renderNoRoute() {
    document.getElementById('no-route-alert').style.display = 'block';
    document.getElementById('lista-clientes').innerHTML = '';
    document.getElementById('estado-ruta-badge').innerText = 'Sin Asignar';
    document.getElementById('estado-ruta-badge').className = 'badge bg-secondary';
}

function renderClients(items, pedidosMap = {}) {
    const container = document.getElementById('lista-clientes');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4">No hay clientes en esta ruta.</div>';
        return;
    }

    items.forEach((item, index) => {
        const clientPedidos = pedidosMap[item.cliente_id] || [];

        // Estados Lógicos (Cualquier pedido que sea pendiente/entregado/en_camino)
        const tienePedidoPendiente = clientPedidos.some(p => p.estado === 'pendiente');
        const tienePedidoEnCamino = clientPedidos.some(p => p.estado === 'en_camino' || p.estado === 'preparado');
        const tienePedidoEntregado = clientPedidos.some(p => p.estado === 'entregado');

        let statusClass = 'pendiente';
        let statusIcon = '<i class="far fa-circle text-muted"></i>';
        let statusText = 'Pendiente';
        let actionButtonHTML = '';

        // ✨ REGLA DE NEGOCIO: 
        // - En BORRADOR y ACTIVA se pueden crear/editar pedidos (Preventa + Autoventa)
        // - En ACTIVA se pueden entregar (Cobrar)
        const canAddOrder = currentRoute.estado === 'borrador' || currentRoute.estado === 'activa';
        const canDeliver = currentRoute.estado === 'activa';
        const disabledAdd = !canAddOrder ? 'disabled' : '';
        const disabledDeliver = !canDeliver ? 'disabled' : '';

        // Botón persistent de Agregar Pedido (Autoventa)
        const addOrderBtn = `
            <button class="btn btn-primary btn-action shadow-sm" ${disabledAdd} onclick="abrirModalPedidoSeller(${item.cliente_id}, '${item.cliente_nombre}', ${item.id})">
                <i class="fas fa-cart-plus"></i>
            </button>
        `;

        if (tienePedidoEntregado && !tienePedidoEnCamino && !tienePedidoPendiente) {
            statusClass = 'con-pedido'; // Todo entregado
            statusIcon = '<i class="fas fa-check-double text-success"></i>';
            statusText = 'Todo Entregado';
            actionButtonHTML = `<button class="btn btn-success btn-action shadow-sm" disabled><i class="fas fa-check"></i></button> ${addOrderBtn}`;
        } else if (tienePedidoEnCamino || tienePedidoPendiente) {
            statusClass = 'pendiente';
            statusIcon = '<i class="fas fa-box-open text-primary"></i>';
            statusText = 'Pendientes';

            // Generar botones para pedidos "A Entregar" o "Tomados"
            clientPedidos.forEach(p => {
                const pJson = JSON.stringify(p).replace(/'/g, "&#39;");
                if (p.estado === 'en_camino' || p.estado === 'preparado') {
                    actionButtonHTML += `
                        <button class="btn btn-primary shadow-sm fw-bold px-3 py-2 rounded-pill mb-1" style="min-width:110px" ${disabledDeliver} onclick='abrirModalEntregaSeller(${pJson})'>
                            <i class="fas fa-hand-holding-usd me-1"></i> $${p.total.toLocaleString()}
                        </button>
                    `;
                } else if (p.estado === 'pendiente') {
                    if (currentRoute.estado === 'activa') {
                        actionButtonHTML += `
                            <button class="btn btn-primary shadow-sm fw-bold px-3 py-2 rounded-pill mb-1" style="min-width:110px" onclick='abrirModalEntregaSeller(${pJson})'>
                                <i class="fas fa-hand-holding-usd me-1"></i> $${p.total.toLocaleString()}
                            </button>
                        `;
                    } else {
                        actionButtonHTML += `
                            <button class="btn btn-info shadow-sm text-white fw-bold px-3 py-2 rounded-pill mb-1" style="min-width:110px" ${disabledAdd} onclick="abrirModalPedidoSeller(${item.cliente_id}, '${item.cliente_nombre}', ${item.id}, ${p.id})">
                                <i class="fas fa-edit me-1"></i> $${p.total.toLocaleString()}
                            </button>
                        `;
                    }
                }
            });
            actionButtonHTML += addOrderBtn;
        } else if (item.visitado) {
            statusClass = 'visitado';
            statusIcon = '<i class="fas fa-walking text-warning"></i>';
            statusText = 'Visitado';
            actionButtonHTML = addOrderBtn;
        } else {
            // Normal sin pedido ni visita
            actionButtonHTML = `
                ${addOrderBtn}
                 <button class="btn btn-outline-warning btn-action ms-2" ${disabledAdd} onclick="marcarVisitaSeller(${item.id})">
                    <i class="fas fa-eye"></i>
                </button>
            `;
        }

        const div = document.createElement('div');
        div.className = `card-cliente ${statusClass}`;
        const opacity = currentRoute.estado !== 'activa' ? 'opacity-50' : '';

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center ${opacity}">
                <div class="d-flex gap-3 align-items-center" style="flex: 1; min-width: 0;">
                    <div class="fw-bold text-muted small">#${index + 1}</div>
                    <div style="flex: 1; min-width: 0;">
                        <h6 class="mb-0 fw-bold text-dark text-truncate">${item.cliente_nombre}</h6>
                        <small class="text-muted d-block text-truncate"><i class="fas fa-map-marker-alt me-1"></i> ${item.cliente_direccion || 'Sin dirección'}</small>
                        ${clientPedidos.some(p => p.estado === 'entregado') ? `<div class="text-success small fw-bold mt-1">✓ Pagos Recibidos</div>` : ''}
                    </div>
                </div>
                <div class="d-flex align-items-center ms-2">
                     ${actionButtonHTML}
                </div>
            </div>
            <div class="mt-2 d-flex justify-content-between align-items-center">
                 <span class="status-badge bg-light border">${statusIcon} ${statusText}</span>
                 ${item.observaciones ? `<small class="text-muted italic"><i class="fas fa-comment ms-2"></i> Obs</small>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function updateStats(items) {
    const pendientes = items.filter(i => !i.visitado && !i.tiene_pedido && !i.tiene_venta).length;
    const completados = items.length - pendientes;
    const conPedido = items.filter(i => i.tiene_pedido || i.tiene_venta).length;

    document.getElementById('stat-pendientes').innerText = pendientes;
    document.getElementById('stat-pedidos').innerText = conPedido;

    const prog = items.length > 0 ? Math.round((completados / items.length) * 100) : 0;
    document.getElementById('stat-progreso').innerText = `${prog}%`;
}

// --- LOGICA PEDIDOS ---

window.abrirModalPedidoSeller = async (clienteId, nombre, itemId, pedidoId = null) => {
    activeClientId = clienteId;
    currentCart = [];
    editingOrderId = pedidoId;
    document.getElementById('modal-cliente-nombre').innerText = nombre;

    // ✨ Si se provee pedidoId, cargar datos para edición
    if (editingOrderId) {
        try {
            Swal.fire({ title: 'Cargando pedido...', didOpen: () => Swal.showLoading() });
            const detalle = await fetchData(`/api/pedidos/${editingOrderId}`);
            document.getElementById('pedido-obs').value = detalle.observaciones || '';
            currentCart = detalle.detalles.map(d => ({
                id: d.producto_id,
                nombre: d.producto_nombre,
                precio: d.precio_unitario,
                cantidad: d.cantidad,
                bonificacion: d.bonificacion || 0
            }));
            document.getElementById('modal-cliente-nombre').innerHTML = `${nombre} <span class="badge bg-warning text-dark ms-2">Editando</span>`;
            Swal.close();
        } catch (e) {
            console.error("Error cargando pedido para edición:", e);
            Swal.close();
        }
    } else {
        document.getElementById('pedido-obs').value = '';
    }

    document.getElementById('seller-modal-pedido').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderCart();

    // Setup Search
    const searchInput = document.getElementById('prod-search');
    searchInput.value = '';
    searchInput.focus();

    searchInput.oninput = debounce(async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('prod-results').className = 'list-group mb-3 shadow-sm d-none';
            return;
        }

        const user = getCurrentUser();
        const results = await fetchData(`/api/negocios/${user.negocio_id}/productos/buscar?query=${q}&cliente_id=${clienteId}`);
        renderSearchResults(results);
    }, 400);
};

function renderSearchResults(products) {
    const container = document.getElementById('prod-results');
    container.innerHTML = '';
    container.className = 'list-group mb-3 shadow-sm';

    if (products.length === 0) {
        container.innerHTML = '<div class="list-group-item text-muted small">No se encontraron productos</div>';
        return;
    }

    products.forEach(p => {
        const item = document.createElement('button');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3';
        item.onclick = () => addToCart(p);
        item.innerHTML = `
            <div>
                <div class="fw-bold text-dark text-wrap" style="line-height:1.2">${formatProductName(p)}</div>
                <small class="text-muted">Stock: ${p.stock}</small>
            </div>
            <div class="fw-bold text-primary">$${p.precio_final.toLocaleString()}</div>
        `;
        container.appendChild(item);
    });
}

function addToCart(product) {
    const existing = currentCart.find(i => i.id === product.id);
    if (existing) {
        existing.cantidad++;
    } else {
        currentCart.push({
            id: product.id,
            nombre: formatProductName(product), // Guardamos nombre formateado
            precio: product.precio_final,
            cantidad: 1
        });
    }

    // Clear search
    document.getElementById('prod-search').value = '';
    document.getElementById('prod-results').className = 'd-none';

    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';

    let total = 0;

    if (currentCart.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted small"><i class="fas fa-shopping-basket fa-2x mb-2 opacity-50"></i><br>Agrega productos para comenzar</div>';
    } else {
        currentCart.forEach((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;

            const div = document.createElement('div');
            div.className = 'card border-0 shadow-sm';
            div.innerHTML = `
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div style="flex:1">
                        <div class="fw-bold small text-wrap" style="line-height:1.2">${item.nombre}</div>
                        <div class="text-primary small fw-bold">$${item.precio}</div>
                    </div>
                    <div class="d-flex align-items-center gap-2 bg-light rounded-pill px-2 py-1">
                        <i class="fas fa-minus text-danger" style="cursor:pointer" onclick="updateQty(${index}, -1)"></i>
                        <span class="fw-bold small" style="width:20px; text-center;">${item.cantidad}</span>
                        <i class="fas fa-plus text-success" style="cursor:pointer" onclick="updateQty(${index}, 1)"></i>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    document.getElementById('cart-total').innerText = `$ ${total.toLocaleString()}`;
}

window.updateQty = (index, delta) => {
    const item = currentCart[index];
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        currentCart.splice(index, 1);
    }
    renderCart();
};

async function confirmarPedido() {
    if (currentCart.length === 0) {
        Swal.fire('Carrito vacío', 'Agrega productos antes de confirmar.', 'warning');
        return;
    }

    const obs = document.getElementById('pedido-obs').value;
    const user = getCurrentUser();

    // Estructura Data
    const payload = {
        cliente_id: activeClientId,
        hoja_ruta_id: activeRouteId, // Vinculamos a la ruta actual
        observaciones: obs,
        detalles: currentCart.map(i => ({
            producto_id: i.id,
            cantidad: i.cantidad,
            precio_unitario: i.precio
        }))
    };

    try {
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

        let res;
        if (editingOrderId) {
            // ✨ PUT: Actualizar
            res = await sendData(`/api/pedidos/${editingOrderId}`, payload, 'PUT');
        } else {
            // POST: Crear
            res = await sendData(`/api/negocios/${user.negocio_id}/pedidos`, payload, 'POST');
        }

        Swal.fire({
            icon: 'success',
            title: '¡Pedido Enviado!',
            text: 'Se ha registrado correctamente.',
            timer: 1500,
            showConfirmButton: false
        });

        cerrarModalPedido();
        loadTodayRoute(); // Recargar ruta para actualizar estados

    } catch (e) {
        console.error(e);
        if (e.message && e.message.includes('BORRADOR')) {
            Swal.fire({
                icon: 'info',
                title: 'Ruta no iniciada',
                text: 'Esta Hoja de Ruta aún está en borrador. Pide al encargado que confirme la salida (Picking) para poder tomar pedidos.',
                confirmButtonText: 'Entendido'
            });
        } else {
            Swal.fire('Error', e.message || 'No se pudo crear el pedido', 'error');
        }
    }
}

function cerrarModalPedido() {
    document.getElementById('seller-modal-pedido').style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.marcarVisitaSeller = async (itemId) => {
    const { value: obs } = await Swal.fire({
        title: 'Marcar Visita',
        input: 'text',
        inputLabel: 'Observaciones (opcional)',
        inputPlaceholder: 'Ej: Cliente no estaba...',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Visita'
    });

    if (obs !== undefined) { // Si no dio cancelar
        try {
            await sendData(`/api/hoja_ruta/${activeRouteId}/item/${itemId}`, {
                visitado: true,
                observaciones: obs
            }, 'PUT');
            loadTodayRoute();
        } catch (e) {
            showError("Error al marcar visita");
        }
    }
};

window.abrirModalEntregaSeller = async function (pedido) {
    const cajaCerrada = await checkFinancialStatus();
    if (cajaCerrada) {
        Swal.fire({
            icon: 'warning',
            title: '¡Caja Cerrada!',
            text: 'No se pueden realizar cobros en este momento.',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    document.getElementById('entrega-pedido-id').value = pedido.id;

    // Guardar total original y datos del pedido
    const montoTotalEl = document.getElementById('entrega-monto-total');
    montoTotalEl.dataset.original = pedido.total;
    montoTotalEl.innerText = `$${pedido.total.toLocaleString()}`;

    // Cargar items del pedido para ajuste parcial
    const itemsContainer = document.getElementById('entrega-items-container');
    itemsContainer.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</div>';

    // Almacenamos los items actuales para el recalculo
    window.currentEntregaItems = [];

    try {
        const detalle = await fetchData(`/api/pedidos/${pedido.id}`);
        itemsContainer.innerHTML = '';

        window.currentEntregaItems = detalle.detalles.map(d => ({
            producto_id: d.producto_id,
            nombre: d.producto_nombre,
            cantidad_original: d.cantidad,
            cantidad_actual: d.cantidad,
            precio_unitario: d.precio_unitario,
            bonificacion: d.bonificacion || 0
        }));

        window.currentEntregaItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'card border-0 shadow-sm mb-2';
            div.innerHTML = `
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div style="flex:1; min-width:0;">
                            <div class="fw-bold small text-truncate">${item.nombre}</div>
                            <div class="text-muted" style="font-size:0.7rem;">Precio: $${item.precio_unitario}</div>
                        </div>
                        <div class="d-flex align-items-center gap-2 bg-white border rounded-pill px-2 py-1">
                            <button class="btn btn-sm btn-link text-danger p-0" onclick="updateQtyEntrega(${index}, -1)"><i class="fas fa-minus-circle"></i></button>
                            <span class="fw-bold small" style="min-width:25px; text-align:center;">${item.cantidad_actual}</span>
                            <button class="btn btn-sm btn-link text-success p-0" onclick="updateQtyEntrega(${index}, 1)" ${item.cantidad_actual >= item.cantidad_original ? 'disabled' : ''}><i class="fas fa-plus-circle"></i></button>
                        </div>
                    </div>
                    <!-- ✨ Campo Bonificación por Item -->
                    <div class="d-flex align-items-center justify-content-end gap-2 border-top pt-1">
                        <small class="text-muted fw-bold" style="font-size: 0.65rem;">BONIF (U):</small>
                        <input type="number" class="form-control form-control-sm text-center fw-bold border-info" 
                               style="width: 60px; height: 26px; font-size: 0.75rem;" 
                               value="${item.bonificacion}" min="0" max="${item.cantidad_actual}"
                               onchange="updateBonifEntrega(${index}, this.value)">
                    </div>
                </div>
            `;
            itemsContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Error cargando items para entrega", e);
        itemsContainer.innerHTML = '<div class="alert alert-danger small p-2">Error al cargar productos. Recarga la página.</div>';
    }

    // Reset Descuento
    const inputDesc = document.getElementById('entrega-descuento-pct');
    if (inputDesc) {
        inputDesc.value = '';
        document.getElementById('container-nuevo-total').classList.add('d-none');
    }

    document.getElementById('modal-confirmar-entrega').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

window.updateQtyEntrega = (index, delta) => {
    const item = window.currentEntregaItems[index];
    const nuevaCant = item.cantidad_actual + delta;

    if (nuevaCant >= 0 && nuevaCant <= item.cantidad_original) {
        item.cantidad_actual = nuevaCant;
        // Si bajamos la cantidad por debajo de la bonificación, bajamos la bonificación
        if (item.bonificacion > nuevaCant) {
            item.bonificacion = nuevaCant;
        }

        renderEntregaItems(); // Refrescamos lista para ver cambios de inputs
        recalcularTotalEntrega();
    }
};

window.updateBonifEntrega = (index, val) => {
    const item = window.currentEntregaItems[index];
    let newBonif = parseFloat(val || 0);

    // Validar que no bonifique más de lo que entrega
    if (newBonif > item.cantidad_actual) newBonif = item.cantidad_actual;
    if (newBonif < 0) newBonif = 0;

    item.bonificacion = newBonif;
    recalcularTotalEntrega();
};

function renderEntregaItems() {
    const itemsContainer = document.getElementById('entrega-items-container');
    itemsContainer.innerHTML = '';
    window.currentEntregaItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'card border-0 shadow-sm mb-2';
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="flex:1; min-width:0;">
                        <div class="fw-bold small text-truncate">${item.nombre}</div>
                        <div class="text-muted" style="font-size:0.7rem;">Precio: $${item.precio_unitario}</div>
                    </div>
                    <div class="d-flex align-items-center gap-2 bg-white border rounded-pill px-2 py-1">
                        <button class="btn btn-sm btn-link text-danger p-0" onclick="updateQtyEntrega(${index}, -1)"><i class="fas fa-minus-circle"></i></button>
                        <span class="fw-bold small" style="min-width:25px; text-align:center;">${item.cantidad_actual}</span>
                        <button class="btn btn-sm btn-link text-success p-0" onclick="updateQtyEntrega(${index}, 1)" ${item.cantidad_actual >= item.cantidad_original ? 'disabled' : ''}><i class="fas fa-plus-circle"></i></button>
                    </div>
                </div>
                <div class="d-flex align-items-center justify-content-end gap-2 border-top pt-1">
                    <small class="text-muted fw-bold" style="font-size: 0.65rem;">BONIF (U):</small>
                    <input type="number" class="form-control form-control-sm text-center fw-bold border-info" 
                           style="width: 60px; height: 26px; font-size: 0.75rem;" 
                           value="${item.bonificacion}" min="0" max="${item.cantidad_actual}"
                           onchange="updateBonifEntrega(${index}, this.value)">
                </div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
}

window.recalcularTotalEntrega = () => {
    // Calcular subtotal de items (considerando bonificaciones si existen)
    let subtotalItems = 0;
    window.currentEntregaItems.forEach(item => {
        // La bonificación se resta de la cantidad entregada
        const cantFinal = Math.max(0, item.cantidad_actual - item.bonificacion);
        subtotalItems += cantFinal * item.precio_unitario;
    });

    // Aplicar descuento porcentual general
    const pctDesc = parseFloat(document.getElementById('entrega-descuento-pct')?.value || 0);
    const totalConDesc = subtotalItems * (1 - (pctDesc / 100));

    // Actualizar visualización
    const montoTotalEl = document.getElementById('entrega-monto-total');
    montoTotalEl.innerText = `$${totalConDesc.toLocaleString()}`;
    montoTotalEl.dataset.actualTotal = totalConDesc; // Guardamos para el backend

    if (pctDesc > 0) {
        document.getElementById('container-nuevo-total').classList.remove('d-none');
        document.getElementById('entrega-nuevo-total').innerText = `Subtotal: $${subtotalItems.toLocaleString()}`;
    } else {
        document.getElementById('container-nuevo-total').classList.add('d-none');
    }
};

window.cerrarModalEntrega = function () {
    document.getElementById('modal-confirmar-entrega').style.display = 'none';
}

window.confirmarEntregaBackend = async function () {
    const pedidoId = document.getElementById('entrega-pedido-id').value;
    const metodoPago = document.querySelector('input[name="metodoPago"]:checked').value;
    const pctDesc = parseFloat(document.getElementById('entrega-descuento-pct')?.value || 0);

    // Preparar datos desde window.currentEntregaItems
    const itemsAjustados = {};
    const bonificacionesAjustadas = {};
    let subtotalReal = 0;

    window.currentEntregaItems.forEach(item => {
        const prodIdStr = item.producto_id.toString();
        itemsAjustados[prodIdStr] = item.cantidad_actual;
        bonificacionesAjustadas[prodIdStr] = item.bonificacion;

        // El subtotal real (antes de descuento general) considera (Cant - Bonif)
        const subItem = Math.max(0, item.cantidad_actual - item.bonificacion) * item.precio_unitario;
        subtotalReal += subItem;
    });

    const descuentoValor = subtotalReal * (pctDesc / 100);
    const finalTotal = subtotalReal - descuentoValor;

    try {
        const btn = document.querySelector('#modal-confirmar-entrega .btn-success');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        }

        const response = await sendData(`/api/pedidos/${pedidoId}/entregar`, {
            metodo_pago: metodoPago,
            descuento: descuentoValor,
            items_ajustados: itemsAjustados,
            bonificaciones_ajustadas: bonificacionesAjustadas,
            motivo_devolucion: 'Rechazo Parcial en Entrega'
        }, 'POST');

        // Success
        Swal.fire({
            icon: 'success',
            title: '¡Entrega Exitosa!',
            text: `Cobro registrado en ${metodoPago}`,
            showConfirmButton: true,
            confirmButtonText: '<i class="fab fa-whatsapp"></i> Enviar Recibo',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#25D366'
        }).then((result) => {
            if (result.isConfirmed) {
                const itemRuta = currentRoute.items.find(i => i.cliente_id === activeClientId);
                const nombreStr = itemRuta ? itemRuta.cliente_nombre : 'Cliente';

                import('./whatsapp.js').then(m => {
                    m.whatsapp.enviarRecibo(nombreStr, finalTotal, response.venta_id || pedidoId, metodoPago);
                });
            }
            loadTodayRoute();
        });

        if (response.notificaciones && response.notificaciones.length > 0) {
            console.log("Stock Warnings:", response.notificaciones);
        }

        cerrarModalEntrega();

    } catch (error) {
        console.error(error);
        if (error.message && (error.message.includes('caja') || error.message.includes('Caja'))) {
            cerrarModalEntrega();
            Swal.fire({
                icon: 'warning',
                title: '¡Caja Cerrada!',
                text: 'La caja se encuentra cerrada. No se pueden registrar cobros.',
                confirmButtonColor: '#ffc107',
                confirmButtonText: 'Entendido'
            });
            checkFinancialStatus();
        } else {
            Swal.fire('Error', error.message || 'No se pudo registrar la entrega', 'error');
        }
    } finally {
        const btn = document.querySelector('#modal-confirmar-entrega .btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'CONFIRMAR RENDICIÓN PAGO';
        }
    }
}

function showError(msg) {
    Swal.fire('Ops!', msg, 'error');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

