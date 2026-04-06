// app/static/js/modules/resto_mozo.js
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { formatearMoneda } from '../uiHelpers.js';
import { getCurrentUser } from './auth.js';

let mesasCache = [];
let categoriesCache = [];
let itemsCache = [];
let listasPreciosCache = []; // NUEVO: Cache para listas de precios
let mesaSeleccionada = null;
let orderDraft = []; // Items not yet sent
let activeComanda = null; // Comanda already in DB
let currentCategory = 'popular';
let isOpeningMesa = false; // ✨ Bloqueo doble click

// Salon Filters
let currentZone = 'all';
let filterEstado = 'all';
let filterMozoId = 'all';

// [NUEVO] Cache de Reservas para Alertas
let reservasHoyCache = [];
let avisoMinutosCache = 60; // Default por si falla la carga

export async function inicializarRestoMozo() {
    console.log("🚀 Inicializando Módulo Mozo POS (Comandas)...");

    // Display logged-in user name
    const user = getCurrentUser();
    if (user && user.nombre) {
        const nameEl = document.getElementById('mozo-user-name');
        if (nameEl) nameEl.innerText = `👤 ${user.nombre}`;
        const menuNameEl = document.getElementById('mozo-menu-user-name');
        if (menuNameEl) menuNameEl.innerText = user.nombre;
    }

    // Hamburger Side Menu
    const hamburgerBtn = document.getElementById('mozo-hamburger-btn');
    const sideMenu = document.getElementById('mozo-side-menu');
    const menuOverlay = document.getElementById('mozo-menu-overlay');
    if (hamburgerBtn && sideMenu) {
        hamburgerBtn.onclick = () => sideMenu.classList.add('open');
        if (menuOverlay) menuOverlay.onclick = () => sideMenu.classList.remove('open');
    }

    // UI Elements - Salon
    const btnRefresh = document.getElementById('btn-refresh-mesas');
    if (btnRefresh) btnRefresh.onclick = () => cargarMesas();

    const elFilterEstado = document.getElementById('filter-estado');
    if (elFilterEstado) {
        elFilterEstado.onchange = (e) => {
            filterEstado = e.target.value;
            renderMesas();
        };
    }

    const elFilterMozo = document.getElementById('filter-mozo');
    if (elFilterMozo) {
        elFilterMozo.onchange = (e) => {
            filterMozoId = e.target.value;
            renderMesas();
        };
    }

    // Zone tabs
    const zoneTabs = document.getElementById('zone-tabs');
    if (zoneTabs) {
        zoneTabs.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            zoneTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentZone = btn.dataset.zone;
            renderMesas();
        };
    }

    // UI Elements - POS
    const btnBackSalon = document.getElementById('btn-back-to-salon');
    if (btnBackSalon) btnBackSalon.onclick = () => showSalonView();

    const btnFinalize = document.getElementById('btn-finalize-order');
    if (btnFinalize) btnFinalize.onclick = () => enviarComanda();

    const btnCloseMesa = document.getElementById('btn-close-mesa');
    if (btnCloseMesa) btnCloseMesa.onclick = () => cerrarMesa();

    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.oninput = (e) => filterProducts(e.target.value);
    }

    const btnPaxEdit = document.getElementById('btn-pax-edit');
    if (btnPaxEdit) btnPaxEdit.onclick = () => editarPax();

    const btnPrintAccount = document.getElementById('btn-print-account');
    if (btnPrintAccount) btnPrintAccount.onclick = () => solicitarCuenta();

    const btnReprintComanda = document.getElementById('btn-reprint-comanda');
    if (btnReprintComanda) btnReprintComanda.onclick = () => reimprimirComanda();

    const btnSplitAccount = document.getElementById('btn-split-account');
    if (btnSplitAccount) btnSplitAccount.onclick = () => abrirModalDivision();

    const btnMoveMesa = document.getElementById('btn-move-mesa');
    if (btnMoveMesa) btnMoveMesa.onclick = () => moverMesa();

    // Mobile Bottom Sheet toggle 
    const panelHandle = document.getElementById('pos-panel-handle');
    if (panelHandle) {
        panelHandle.onclick = () => {
            const panel = document.getElementById('pos-order-panel');
            if (panel) panel.classList.toggle('expanded');
        };
    }

    const posListaSelector = document.getElementById('pos-lista-selector');
    if (posListaSelector) {
        posListaSelector.onchange = (e) => cambiarListaComanda(e.target.value);
    }

    // Category Selector - POS [NUEVO]
    const posCatSelector = document.getElementById('pos-category-selector');
    if (posCatSelector) {
        posCatSelector.onchange = (e) => {
            currentCategory = e.target.value;
            renderProducts();
        };
    }

    // Show mozo filter only for admin/superadmin
    const isAdmin = appState.userRol === 'superadmin' || appState.userRol === 'admin';
    const mozoFilterWrap = document.getElementById('filter-mozo-wrap');
    if (mozoFilterWrap && isAdmin) {
        mozoFilterWrap.style.display = '';
    }

    // Initial Load
    await Promise.all([
        cargarSectores(), // Cargar sectores oficiales para las pestañas
        cargarMesas(),
        cargarListasPrecios(), 
        cargarMenu(),
        cargarMozos(),
        cargarConfigReservasMozo() // Cargar config de alertas
    ]);

    // Intervalo de refresco de mesas
    const refreshInterval = setInterval(() => {
        if (window.location.hash === '#resto_mozo' && document.getElementById('salon-view').style.display !== 'none') {
            cargarMesas(true);
        } else if (window.location.hash !== '#resto_mozo') {
            clearInterval(refreshInterval);
        }
    }, 10000);

    // Intervalo de Notificaciones para Mozos (Aviso de "Listo")
    await cargarConfigImpresion(); // Cargar la IP del hub configurada
    await cargarNotificaciones(); // Load immediately
    startNotificationPolling();
}

let printHubIp = '';
async function cargarConfigImpresion() {
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`, { silent: true });
        printHubIp = (configs.resto_print_hub_ip || '').trim();
    } catch (e) { console.warn("No se pudo cargar la configuración de impresión", e); }
}

let notifiedItems = new Set();
let notifsCache = [];
let sectoresCache = []; // Cache de sectores oficiales

function startNotificationPolling() {
    setInterval(async () => {
        if (window.location.hash === '#resto_mozo') {
            await cargarNotificaciones();
        }
    }, 8000); // Cada 8 segundos
}

async function cargarNotificaciones() {
    try {
        const notifs = await fetchData(`/api/negocios/${appState.negocioActivoId}/mozo/notificaciones`);
        notifsCache = notifs || [];

        // Toast for NEW items only
        notifs.forEach(n => {
            if (!notifiedItems.has(n.id)) {
                mostrarNotificacion(`🔔 Mesa #${n.mesa_numero}: ¡${n.producto_nombre} LISTO!`, "success");
                notifiedItems.add(n.id);
                
                // 📳 Vibración (4 pulsos)
                if ("vibrate" in navigator) {
                    navigator.vibrate([200, 80, 200, 80, 200, 80, 200]);
                }

                // 🔊 Ding via Web Audio API (sin archivos externos)
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const playDing = (startTime) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, startTime);
                        osc.frequency.exponentialRampToValueAtTime(440, startTime + 0.4);
                        gain.gain.setValueAtTime(0.7, startTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
                        osc.start(startTime);
                        osc.stop(startTime + 0.6);
                    };
                    // 4 dings separados por 0.4s cada uno
                    playDing(ctx.currentTime);
                    playDing(ctx.currentTime + 0.7);
                    playDing(ctx.currentTime + 1.4);
                    playDing(ctx.currentTime + 2.1);
                } catch(e) {
                    console.warn("Web Audio API no disponible:", e.message);
                }
            }
        });

        // Update visual notification bar
        renderNotificationsBar();
    } catch (err) { 
        console.warn("Error polling notifs", err); 
    }
}

function renderNotificationsBar() {
    const pill = document.getElementById('mozo-notif-pill');
    const bar = document.getElementById('mozo-notifs-bar');
    const list = document.getElementById('mozo-notifs-list');
    const countEl = document.getElementById('mozo-notifs-count');
    const textEl = document.getElementById('mozo-notif-pill-text');

    if (notifsCache.length === 0) {
        // Idle state
        if (pill) {
            pill.classList.remove('has-notifs');
            if (textEl) textEl.innerText = 'Sin pedidos listos';
            if (countEl) countEl.style.display = 'none';
        }
        if (bar) bar.style.display = 'none';
        return;
    }

    // Active state
    if (pill) {
        pill.classList.add('has-notifs');
        if (textEl) textEl.innerText = `${notifsCache.length} pedido${notifsCache.length > 1 ? 's' : ''} listo${notifsCache.length > 1 ? 's' : ''}!`;
        if (countEl) {
            countEl.style.display = 'flex';
            countEl.innerText = notifsCache.length;
        }
    }

    if (list) {
        list.innerHTML = notifsCache.map(n => `
            <div class="notif-item">
                <span class="notif-item-mesa">Mesa ${n.mesa_numero}</span>
                <span class="notif-item-product">${n.producto_nombre}</span>
                <span class="notif-item-qty">x${Math.round(n.cantidad)}</span>
                <button class="notif-item-btn" onclick="entregarItemDesdeNotif(${n.id})" title="Marcar entregado">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        `).join('');
    }
}

window.toggleNotifsList = function() {
    const bar = document.getElementById('mozo-notifs-bar');
    if (!bar) return;
    
    if (bar.style.display === 'none' || !bar.style.display) {
        if (notifsCache.length > 0) {
            bar.style.display = '';
            bar.classList.add('expanded');
        }
    } else {
        bar.style.display = 'none';
        bar.classList.remove('expanded');
    }
};

window.entregarItemDesdeNotif = async function(detalleId) {
    try {
        await sendData(`/api/comandas/detalle/${detalleId}/estado`, { estado: 'entregado' }, 'PUT');
        mostrarNotificacion("Producto entregado ✓", "success");
        notifsCache = notifsCache.filter(n => n.id !== detalleId);
        renderNotificationsBar();
    } catch (err) {
        console.error(err);
        mostrarNotificacion("Error al marcar como entregado", "error");
    }
};

async function cargarMesas(silent = false) {
    if (!appState.negocioActivoId) return;

    try {
        const mesas = await fetchData(`/api/negocios/${appState.negocioActivoId}/mesas`);
        mesasCache = mesas;
        renderMesas();

        const updatedAt = document.getElementById('salon-updated-at');
        if (updatedAt) {
            updatedAt.innerText = `Sincronizado: ${new Date().toLocaleTimeString()}`;
        }
        
        // [NUEVO] Refrescar reservas silenciosamente con las mesas
        refrescarReservasHoy();
    } catch (error) {
        console.error("Error cargando mesas:", error);
        if (!silent) mostrarNotificacion("Error al actualizar salón", "error");
    }
}

async function cargarConfigReservasMozo() {
    try {
        const config = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas/config`);
        if (config) avisoMinutosCache = config.aviso_apertura_min || 60;
    } catch (e) { console.warn("No se pudo cargar config de reservas para mozo", e); }
}

async function refrescarReservasHoy() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/reservas?fecha=${hoy}`);
        reservasHoyCache = (res || []).filter(r => r.estado !== 'cancelada' && r.estado !== 'completada');
    } catch (e) { console.warn("Error refrescando reservas hoy", e); }
}

function buscarReservaCercana(mesaId) {
    if (!mesaId || reservasHoyCache.length === 0) return null;
    
    const ahora = new Date();
    // Encontrar reservas para esta mesa
    const resMesa = reservasHoyCache.filter(r => String(r.mesa_id) === String(mesaId));
    
    for (let r of resMesa) {
        // Parsear hora reserva (formato HH:mm)
        const [h, m] = r.hora_reserva.split(':');
        const fechaRes = new Date();
        fechaRes.setHours(parseInt(h), parseInt(m), 0, 0);
        
        const difMs = fechaRes - ahora;
        const difMin = difMs / (1000 * 60);
        
        // Si la reserva es en el futuro y dentro del rango de aviso
        if (difMin > -15 && difMin <= avisoMinutosCache) {
            return r;
        }
    }
    return null;
}

async function cargarMenu() {
    try {
        // Si hay una comanda activa, traer los items con los precios de SU lista
        const listaId = activeComanda ? (activeComanda.lista_id || '') : '';
        const urlItems = `/api/negocios/${appState.negocioActivoId}/menu/items${listaId ? `?lista_id=${listaId}` : ''}`;

        const [cats, items] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/menu/categorias`),
            fetchData(urlItems)
        ]);
        categoriesCache = cats;
        itemsCache = items;
        renderCategories();
    } catch (error) {
        console.error("Error cargando menú:", error);
    }
}

async function cargarListasPrecios() {
    try {
        listasPreciosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/menu/listas`);
        renderizarSelectorListasPos();
    } catch (error) {
        console.error("Error cargando listas de precios:", error);
    }
}

function renderizarSelectorListasPos() {
    const select = document.getElementById('pos-lista-selector');
    if (!select) return;

    select.innerHTML = listasPreciosCache.map(l => `
        <option value="${l.id}">${l.nombre}${l.es_default ? ' (General)' : ''}</option>
    `).join('');
}

async function cambiarListaComanda(nuevaListaId) {
    if (!activeComanda || !nuevaListaId) return;
    
    // Si es la misma, no hacer nada
    if (activeComanda.lista_id == nuevaListaId) return;

    const lista = listasPreciosCache.find(l => l.id == nuevaListaId);
    
    const { isConfirmed } = await Swal.fire({
        title: '¿Cambiar Carta?',
        text: `Se aplicarán los precios de la carta "${lista.nombre}" a los platos que agregues a partir de ahora.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5'
    });

    if (!isConfirmed) {
        // Revertir selector
        document.getElementById('pos-lista-selector').value = activeComanda.lista_id || '';
        return;
    }

    try {
        document.getElementById('pos-loading').style.display = 'flex';
        await sendData(`/api/comandas/${activeComanda.id}/lista`, { lista_id: nuevaListaId }, 'PUT');
        
        activeComanda.lista_id = nuevaListaId;
        mostrarNotificacion(`Carta switched to: ${lista.nombre}`, "success");
        
        // Recargar menú para traer nuevos precios
        await cargarMenu();
        
        // Actualizar precios en el DRAFT (opcional pero recomendado)
        orderDraft.forEach(draftItem => {
            const menuProduct = itemsCache.find(i => i.id === draftItem.id);
            if (menuProduct) {
                draftItem.precio = menuProduct.precio;
            }
        });
        
        renderOrderSummary();
    } catch (err) {
        console.error(err);
        mostrarNotificacion("Error al cambiar la lista de precios", "error");
        document.getElementById('pos-lista-selector').value = activeComanda.lista_id || '';
    } finally {
        document.getElementById('pos-loading').style.display = 'none';
    }
}

function renderMesas() {
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;

    renderZoneTabs();

    const mesasFiltradas = mesasCache.filter(mesa => {
        const mesaEstado = (mesa.estado || 'libre').toLowerCase();
        const mesaMozoId = mesa.mozo_id ? String(mesa.mozo_id) : 'none';
        const matchZona = currentZone === 'all' || mesa.zona === currentZone;
        const matchEstado = filterEstado === 'all' || mesaEstado === filterEstado.toLowerCase();
        const matchMozo = filterMozoId === 'all' || mesaMozoId === String(filterMozoId);
        return matchZona && matchEstado && matchMozo;
    });

    if (mesasFiltradas.length === 0) {
        grid.innerHTML = `
            <div class="col-12 py-5 text-center text-muted">
                <i class="fas fa-search mb-3" style="font-size: 2rem; opacity: 0.3;"></i>
                <p>No hay mesas que coincidan con los filtros</p>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.resetFilters()">Limpiar Filtros</button>
            </div>
        `;
        return;
    }

    // 🔄 RECONCILIACIÓN INTELIGENTE (SMOOTH REFRESH)
    // 1. Marcar elementos actuales para control de borrado
    const existingNodes = Array.from(grid.querySelectorAll('.mesa-item-v3'));
    const idsPresentes = new Set(mesasFiltradas.map(m => String(m.id)));

    // 2. Limpiar el mensaje de "No hay mesas" si existía
    if (grid.querySelector('.col-12.py-5')) grid.innerHTML = '';

    // 3. Iterar sobre las mesas filtradas
    mesasFiltradas.forEach(mesa => {
        let div = grid.querySelector(`.mesa-item-v3[data-id="${mesa.id}"]`);
        const estado = (mesa.estado || 'libre').toLowerCase();
        
        const contentHTML = `
            <div class="mesa-zone">${mesa.zona || 'Salón Principal'}</div>
            <div class="mesa-num">${mesa.numero}</div>
            <div class="mesa-footer">
                <span><i class="fas fa-users me-1"></i> ${mesa.comanda_pax || mesa.capacidad || 0}</span>
                ${estado !== 'libre' ? `<span><i class="fas fa-user me-1"></i> ${mesa.active_mozo_nombre ? mesa.active_mozo_nombre.split(' ')[0] : (mesa.mozo_fijo_nombre ? mesa.mozo_fijo_nombre.split(' ')[0] : 'Ocupada')}</span>` : '<span>Libre</span>'}
            </div>
            ${estado === 'en_cobro' ? '<div class="mesa-badge-cuenta" style="position:absolute; top:5px; right:5px; background:white; color:#d97706; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fas fa-file-invoice-dollar"></i></div>' : ''}
        `;

        if (!div) {
            // No existe: Crear nuevo
            div = document.createElement('div');
            div.dataset.id = mesa.id;
            div.className = `mesa-item-v3 ${estado}`;
            div.innerHTML = contentHTML;
            div.onclick = () => selectMesa(mesa);
            grid.appendChild(div);
        } else {
            // Ya existe: Actualizar solo si cambió algo (evitar flash)
            const targetClass = `mesa-item-v3 ${estado}`;
            if (div.className !== targetClass) div.className = targetClass;
            
            // Comparación simple de HTML para decidir si actualizar contenido
            // (Podríamos ser más granulares por performance, pero esto ya corta el flasheo del layout)
            const sanitizedNewHTML = contentHTML.replace(/\s/g, '');
            const sanitizedOldHTML = div.innerHTML.replace(/\s/g, '');
            if (sanitizedNewHTML !== sanitizedOldHTML) {
                div.innerHTML = contentHTML;
            }
            
            // Re-vincular click con data actualizada
            div.onclick = () => selectMesa(mesa);
        }
    });

    // 4. Eliminar mesas que ya no deberían estar (filtros o borradas)
    existingNodes.forEach(node => {
        if (!idsPresentes.has(node.dataset.id)) {
            node.remove();
        }
    });
}

async function cargarSectores() {
    try {
        sectoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/sectores`);
    } catch (err) {
        console.error("Error al cargar sectores:", err);
    }
}

function renderZoneTabs() {
    const zoneTabs = document.getElementById('zone-tabs');
    if (!zoneTabs) return;

    // Obtener zonas de los sectores oficiales
    let zonas = sectoresCache.map(s => s.nombre);
    
    // Si no hay sectores oficiales, deducir de las mesas (retrocompatibilidad)
    if (zonas.length === 0) {
        zonas = [...new Set(mesasCache.map(m => m.zona).filter(z => z))];
    }

    // Evitar re-renderizar si son las mismas zonas (optimizacion simple)
    const currentBtns = Array.from(zoneTabs.querySelectorAll('button')).map(b => b.dataset.zone).filter(z => z !== 'all');
    if (zonas.length === currentBtns.length && zonas.every((z, i) => z === currentBtns[i])) {
        zoneTabs.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zone === currentZone);
        });
        return;
    }

    zoneTabs.innerHTML = `<button class="${currentZone === 'all' ? 'active' : ''}" data-zone="all">🏠 Todas</button>`;
    zonas.forEach(zona => {
        const btn = document.createElement('button');
        btn.className = currentZone === zona ? 'active' : '';
        btn.dataset.zone = zona;
        btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${zona}`;
        zoneTabs.appendChild(btn);
    });
}

async function cargarMozos() {
    try {
        // Asumiendo que existe este endpoint o similar para obtener los vendedores del negocio
        const mozos = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
        const select = document.getElementById('filter-mozo');
        if (!select) return;

        select.innerHTML = '<option value="all">Todos los Mozos</option>';
        mozos.forEach(mozo => {
            const opt = document.createElement('option');
            opt.value = mozo.id;
            opt.innerText = mozo.nombre;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Error cargando mozos:", error);
    }
}

window.resetFilters = () => {
    currentZone = 'all';
    filterEstado = 'all';
    filterMozoId = 'all';
    
    const elFilterEstado = document.getElementById('filter-estado');
    if (elFilterEstado) elFilterEstado.value = 'all';
    
    const elFilterMozo = document.getElementById('filter-mozo');
    if (elFilterMozo) elFilterMozo.value = 'all';
    
    // Update zone tabs active state
    const zoneTabs = document.getElementById('zone-tabs');
    if (zoneTabs) {
        zoneTabs.querySelectorAll('button').forEach(b => {
            b.classList.toggle('active', b.dataset.zone === 'all');
        });
    }

    renderMesas();
};

function renderCategories() {
    const select = document.getElementById('pos-category-selector');
    if (!select) return;

    // Mantener las opciones básicas (Popular y All) y agregar las dinámicas
    const optionsHtml = `
        <option value="popular" ${currentCategory === 'popular' ? 'selected' : ''}>⭐ Más Pedidos (Top 20)</option>
        <option value="all" ${currentCategory === 'all' ? 'selected' : ''}>Todos los productos</option>
        ${categoriesCache.filter(c => c.activo).map(cat => `
            <option value="${cat.id}" ${currentCategory == cat.id ? 'selected' : ''}>${cat.nombre}</option>
        `).join('')}
    `;
    select.innerHTML = optionsHtml;

    renderProducts();
}

async function renderProducts(filter = '') {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin opacity-50"></i></div>';

    let filtered = [];

    // LÓGICA DE TOP 20
    if (currentCategory === 'popular') {
        try {
            const listaId = activeComanda ? (activeComanda.lista_id || '') : '';
            filtered = await fetchData(`/api/negocios/${appState.negocioActivoId}/menu/top-pedidos${listaId ? `?lista_id=${listaId}` : ''}`);
        } catch (err) {
            console.error("Error cargando populares:", err);
            filtered = [];
        }
    } else {
        filtered = itemsCache.filter(i => i.disponible);
        if (currentCategory !== 'all') {
            filtered = filtered.filter(i => i.categoria_id == currentCategory);
        }
    }

    if (filter) {
        filtered = filtered.filter(i => i.nombre.toLowerCase().includes(filter.toLowerCase()));
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="text-center py-5 text-muted">No se encontraron productos</div>';
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'prod-list-item';
        div.innerHTML = `
            <div class="prod-info">
                <div class="prod-name">${item.nombre}</div>
                <div class="prod-price">${formatearMoneda(item.precio)}</div>
            </div>
            <button class="prod-add-btn">
                <i class="fas fa-plus"></i>
            </button>
        `;
        div.onclick = () => addToDraft(item);
        grid.appendChild(div);
    });
}

function addToDraft(item) {
    const existing = orderDraft.find(i => i.id === item.id);
    if (existing) {
        existing.cantidad++;
    } else {
        orderDraft.push({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: 1
        });
    }
    renderOrderSummary();
}
let _refetchingComanda = false;

function renderOrderSummary() {
    const container = document.getElementById('current-order-list');
    if (!container) return;

    const detalles = (activeComanda && Array.isArray(activeComanda.detalles)) ? activeComanda.detalles : [];

    // Always sync handle mini-total with panel data
    function syncHandle(total, itemCount) {
        const miniTotal = document.getElementById('pos-order-total-mini');
        if (miniTotal) miniTotal.innerText = formatearMoneda(total);
        const orderCount = document.getElementById('pos-order-count');
        if (orderCount) orderCount.innerText = `${itemCount} items`;
        document.getElementById('pos-order-total').innerText = formatearMoneda(total);
    }

    // Re-fetch detalles ONLY if comanda has a total > 0 but detalles came empty
    if (activeComanda && activeComanda.id && detalles.length === 0 && orderDraft.length === 0 
        && parseFloat(activeComanda.total || 0) > 0 && !_refetchingComanda) {
        _refetchingComanda = true;
        fetchData(`/api/comandas/${activeComanda.id}`).then(res => {
            _refetchingComanda = false;
            if (res && Array.isArray(res.detalles) && res.detalles.length > 0) {
                activeComanda = res;
                renderOrderSummary(); // Re-render with populated detalles
            } else {
                // Re-fetch confirmed detalles is truly empty — show empty state
                container.innerHTML = `
                    <div class="empty-order-msg py-5 text-center text-muted">
                        <i class="fas fa-shopping-basket fa-3x mb-3 opacity-25"></i>
                        <p>No hay productos cargados</p>
                    </div>`;
                syncHandle(0, 0);
            }
        }).catch(() => { 
            _refetchingComanda = false;
            container.innerHTML = `
                <div class="empty-order-msg py-5 text-center text-muted">
                    <i class="fas fa-shopping-basket fa-3x mb-3 opacity-25"></i>
                    <p>No hay productos cargados</p>
                </div>`;
            syncHandle(0, 0);
        });
        
        container.innerHTML = `
            <div class="empty-order-msg py-4 text-center text-muted">
                <i class="fas fa-spinner fa-spin fa-2x mb-3 opacity-50"></i>
                <p>Cargando detalle...</p>
            </div>`;
        return;
    }

    if (orderDraft.length === 0 && detalles.length === 0) {
        container.innerHTML = `
            <div class="empty-order-msg py-5 text-center text-muted">
                <i class="fas fa-shopping-basket fa-3x mb-3 opacity-25"></i>
                <p>No hay productos cargados</p>
            </div>`;
        syncHandle(0, 0);
        return;
    }

    let html = '';
    let total = 0;

    // 1. Render Active Comanda (Already sent)
    if (detalles.length > 0) {
        html += '<p class="text-muted small fw-bold mb-2">✅ Enviado a Cocina</p>';
        detalles.forEach(item => {
            const subtotal = parseFloat(item.subtotal) || (parseFloat(item.precio_unitario) * parseFloat(item.cantidad));
            total += subtotal;
            const isArrived = ['pendiente', 'cocinando', 'listo'].includes(item.estado);
            const canDeliver = item.estado === 'listo' || !item.estacion;

            html += `
                <div class="order-item-v2 ${isArrived ? 'pending' : 'delivered'}" style="opacity: ${isArrived ? '1' : '0.6'}">
                    <div class="oi-left">
                        <span class="oi-name">${item.producto_nombre || item.nombre || 'Item'} ${item.notas ? `<small>(${item.notas})</small>` : ''}</span>
                        <span class="oi-price">${formatearMoneda(item.precio_unitario)} x${Math.round(item.cantidad)}</span>
                        <div class="oi-status mt-1">
                            ${item.estado === 'cocinando' ?
                                `<span class="badge bg-warning-subtle text-warning border-warning" style="font-size:0.6rem">🔥 COCINANDO</span>` :
                            item.estado === 'listo' ?
                                `<span class="badge bg-info-subtle text-info" style="font-size:0.6rem">✅ LISTO</span>` :
                            item.estado === 'entregado' || item.estado === 'cobrado' ?
                                `<span class="badge bg-success-subtle text-success border-success" style="font-size:0.6rem">ENTREGADO</span>` :
                                `<span class="badge bg-secondary-subtle text-secondary" style="font-size:0.6rem">⏳ PENDIENTE</span>`
                            }
                        </div>
                    </div>
                    <div class="oi-qty d-flex align-items-center">
                        <span class="fw-800">${Math.round(item.cantidad)}</span>
                        ${ (isArrived && canDeliver) ? `
                            <button class="btn btn-sm ms-2 p-0 d-flex align-items-center justify-content-center" 
                                    style="height:26px; width:26px; border-radius:8px; background:linear-gradient(135deg,#10b981,#059669); color:white; border:none;" 
                                    onclick="window.entregarItem(${item.id})" title="Marcar como entregado">
                                <i class="fas fa-check" style="font-size:0.65rem"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        const listosParaEntregar = detalles.filter(d => (d.estado === 'listo' || !d.estacion) && ['pendiente', 'cocinando', 'listo'].includes(d.estado));
        if (listosParaEntregar.length > 0) {
            html += `
                <div class="mt-3 mb-2 px-2">
                    <button class="btn btn-sm btn-outline-success w-100 rounded-pill fw-700" style="font-size: 0.75rem" onclick="window.entregarTodo()">
                        <i class="fas fa-truck-loading me-1"></i> Entregar ${listosParaEntregar.length} Listo(s)
                    </button>
                </div>
            `;
        }
    }

    // 2. Render Draft (To be sent)
    if (orderDraft.length > 0) {
        html += '<p class="text-muted small fw-bold mb-2 mt-4">Por enviar (No guardado)</p>';
        orderDraft.forEach((item, index) => {
            total += (item.precio * item.cantidad);
            html += `
                <div class="order-item-v2 draft">
                    <div class="oi-left">
                        <span class="oi-name text-primary">${item.nombre}</span>
                        <span class="oi-price">${formatearMoneda(item.precio)}</span>
                    </div>
                    <div class="oi-qty">
                        <button class="qty-btn" onclick="window.updateDraftQty(${index}, -1)">-</button>
                        <span class="fw-bold">${item.cantidad}</span>
                        <button class="qty-btn" onclick="window.updateDraftQty(${index}, 1)">+</button>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    const draftCount = orderDraft.reduce((sum, i) => sum + i.cantidad, 0);
    const sentCount = detalles.length;
    syncHandle(total, draftCount + sentCount);
}

window.updateDraftQty = (index, delta) => {
    orderDraft[index].cantidad += delta;
    if (orderDraft[index].cantidad <= 0) {
        orderDraft.splice(index, 1);
    }
    renderOrderSummary();
}

window.toggleOrderListCollapse = () => {
    const list = document.getElementById('current-order-list');
    const panel = document.getElementById('pos-order-panel');
    const icon = document.getElementById('collapse-icon');
    if (list && panel) {
        panel.classList.toggle('detail-collapsed');
        list.classList.toggle('collapsed');
        if (icon) {
            if (list.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-down';
            }
        }
    }
}

async function selectMesa(mesa) {
    if (isOpeningMesa) return;
    isOpeningMesa = true;

    try {
        const user = getCurrentUser();
        mesaSeleccionada = mesa;
        orderDraft = [];
        activeComanda = null;
        const estadoMesa = (mesa.estado || 'libre').toLowerCase();

        if (estadoMesa !== 'libre' && mesa.comanda_id) {
            document.getElementById('pos-loading').style.display = 'flex';
            try {
                const success = await cargarComandaDeMesa(mesa.id);
                if (success) {
                    showPOSView();
                    
                    const btnCloseMesa = document.getElementById('btn-close-mesa');
                    if (btnCloseMesa) {
                        const isAdmin = ['admin', 'superadmin', 'adicionista', 'cajero'].includes((appState.userRol || '').toLowerCase());
                        if (estadoMesa === 'en_cobro') {
                            btnCloseMesa.innerHTML = '<i class="fas fa-cash-register me-1"></i> FINALIZAR COBRO';
                            btnCloseMesa.disabled = !isAdmin;
                        } else {
                            btnCloseMesa.innerHTML = '<i class="fas fa-file-invoice-dollar me-2"></i> PEDIR CUENTA';
                            btnCloseMesa.disabled = false;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                mostrarNotificacion("Error al abrir comanda", "error");
            } finally {
                document.getElementById('pos-loading').style.display = 'none';
            }
            return;
        }

        if (estadoMesa === 'libre' || !mesa.comanda_id) {
            const mozos = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
            const { value: formValues } = await Swal.fire({
                title: `Mesa ${mesa.numero}`,
                html: `<div class="text-start p-2">
                    <label class="small fw-bold">Mozo</label>
                    <select id="swal-mozo-id" class="form-select mb-3">
                        ${mozos.map(m => `<option value="${m.id}" ${m.id == user.id ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                    </select>
                    <label class="small fw-bold">Comensales</label>
                    <input type="number" id="swal-pax" class="form-control" value="1" min="1">
                </div>`,
                preConfirm: () => ({
                    mozoId: document.getElementById('swal-mozo-id').value,
                    pax: document.getElementById('swal-pax').value,
                    listaId: listasPreciosCache.find(l => l.es_default)?.id || ''
                }),
                showCancelButton: true
            });
            if (formValues) {
                await abrirComanda(mesa.id, formValues.pax, formValues.mozoId, formValues.listaId);
            }
        } else {
            // Sincronización
            const success = await cargarComandaDeMesa(mesa.id);
            if (success) {
                showPOSView();
            } else {
                console.warn("Fallo al cargar comanda para mesa:", mesa);
                const { isConfirmed } = await Swal.fire({
                    title: 'Error de Sincronización',
                    text: `La mesa figura ocupada pero no pudimos recuperar su pedido. ¿Deseas liberar la mesa manualmente?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, liberar mesa',
                    confirmButtonColor: '#e74c3c'
                });
                if (isConfirmed) {
                    try {
                        await sendData(`/api/comandas/reset-mesa/${mesa.id}`, {}, { method: 'POST' });
                        mostrarNotificacion("Mesa liberada", "success");
                        cargarMesas(false);
                    } catch (err) {
                        mostrarNotificacion("No se pudo liberar", "error");
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        isOpeningMesa = false;
    }
}

async function abrirComanda(mesaId, pax, mozoId, listaId) {
    try {
        const payload = {
            mesa_id: mesaId,
            mozo_id: mozoId,
            num_comensales: pax,
            lista_id: listaId // Enviamos la carta seleccionada
        };
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/mesas/${mesaId}/comanda`, payload);
        activeComanda = res;
        
        // Recargar el menú para asegurar que los precios coincidan con la carta elegida
        await cargarMenu();
        
        showPOSView();
        mostrarNotificacion("Mesa abierta (Comanda creada)", "success");
        cargarMesas(true); // Refrescar el salón
    } catch (error) {
        mostrarNotificacion("Error al abrir mesa", "error");
    }
}

async function cargarComandaDeMesa(mesaId) {
    const mesa = mesasCache.find(m => m.id == mesaId);
    if (!mesa || !mesa.comanda_id) return false;

    try {
        const res = await fetchData(`/api/comandas/${mesa.comanda_id}`);
        // Guarantee detalles is always an array
        if (!Array.isArray(res.detalles)) {
            res.detalles = [];
        }
        activeComanda = res;
        console.log('📋 Comanda cargada:', { id: res.id, total: res.total, detalles: res.detalles.length });
        return true;
    } catch (error) {
        console.error('Error cargando comanda:', error);
        return false;
    }
}

function showPOSView() {
    document.getElementById('pos-mesa-name').innerText = `Mesa ${mesaSeleccionada.numero}`;
    document.getElementById('pax-count').innerText = activeComanda ? activeComanda.num_comensales : 0;

    document.getElementById('salon-view').style.display = 'none';
    document.getElementById('pos-view').style.display = 'flex';
    renderOrderSummary();
}

function showSalonView() {
    document.getElementById('salon-view').style.display = 'block';
    document.getElementById('pos-view').style.display = 'none';
    cargarMesas(true);
}

async function enviarComanda() {
    if (!activeComanda) {
        mostrarNotificacion("Error: No hay una comanda activa vinculada a esta mesa.", "error");
        return;
    }

    if (orderDraft.length === 0) {
        mostrarNotificacion("No hay items nuevos para enviar", "info");
        return;
    }

    const btnFinalize = document.getElementById('btn-finalize-order');
    if (btnFinalize) btnFinalize.disabled = true;

    document.getElementById('pos-loading').style.display = 'flex';
    try {
        const payload = {
            detalles: orderDraft.map(i => ({
                menu_item_id: i.id,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                nombre: i.nombre
            }))
        };

        const res = await sendData(`/api/comandas/${activeComanda.id}/items`, payload, 'POST');

        if (res.print_jobs && Array.isArray(res.print_jobs)) {
            for (const job of res.print_jobs) {
                await imprimirRemoto(job);
            }
        }

        mostrarNotificacion("Comanda enviada a cocina", "success");
        orderDraft = [];
        
        // Regresar al salón automáticamente después de enviar
        showSalonView();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al enviar comanda", "error");
    } finally {
        document.getElementById('pos-loading').style.display = 'none';
        if (btnFinalize) btnFinalize.disabled = false;
    }
}

function filterProducts(query) {
    renderProducts(query);
}

async function editarPax() {
    if (!activeComanda) return;

    const { value: pax } = await Swal.fire({
        title: 'Editar Cubiertos',
        input: 'number',
        inputLabel: 'Nueva cantidad de comensales',
        inputValue: activeComanda.num_comensales,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar'
    });

    if (pax && pax != activeComanda.num_comensales) {
        try {
            await sendData(`/api/comandas/${activeComanda.id}/pax`, { num_comensales: pax }, 'PUT');
            activeComanda.num_comensales = pax;
            document.getElementById('pax-count').innerText = pax;
            mostrarNotificacion("Cubiertos actualizados", "success");
        } catch (error) {
            mostrarNotificacion("Error al actualizar cubiertos", "error");
        }
    }
}

async function solicitarCuenta() {
    if (!activeComanda) return;

    // 1. Verificar ítems que NO estén en manos del cliente (estado 'entregado' o 'cobrado')
    const noEntregados = activeComanda.detalles.filter(d => 
        ['pendiente', 'cocinando', 'listo'].includes(d.estado)
    );

    if (noEntregados.length > 0) {
        await Swal.fire({
            title: '¡Acción Bloqueada!',
            html: `
                <div class="text-start">
                    <p class="mb-2">No podés pedir la cuenta con productos pendientes o en preparación:</p>
                    <ul class="small text-danger">
                        ${noEntregados.map(i => `<li>${i.cantidad}x ${i.producto_nombre} (${i.estado})</li>`).join('')}
                    </ul>
                    <p class="mb-0 mt-2 fw-700">Completá la entrega para poder generar la cuenta.</p>
                </div>
            `,
            icon: 'error'
        });
        return;
    }

    // 2. Preguntar si quiere enviar lo pendiente antes de imprimir
    if (orderDraft.length > 0) {
        const confirm = await Swal.fire({
            title: 'Hay items sin enviar',
            text: '¿Deseas enviar los productos pendientes antes de generar la cuenta?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, enviar e imprimir',
            denyButtonText: 'Imprimir sin enviar',
            cancelButtonText: 'Cancelar',
            showDenyButton: true
        });

        if (confirm.isDismissed) return;
        if (confirm.isConfirmed) {
            await enviarComanda();
        }
    }

    try {
        document.getElementById('pos-loading').style.display = 'flex';
        
        // A. Cambiar estado de mesa a 'en_cobro' y obtener trabajo de impresión
        const res = await sendData(`/api/comandas/${activeComanda.id}/solicitar-cuenta`, {}, 'POST');

        if (res.print_job) {
            await imprimirRemoto(res.print_job);
        } else {
            // Fallback: Si no hay impresora configurada, usar el método tradicional de iframe
            const data = await fetchData(`/api/comandas/${activeComanda.id}`);
            imprimirTicket(data);
        }
        
        mostrarNotificacion("Mesa marcada 'En Cobro'. Informe a caja.", "success");
        showSalonView();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al solicitar cuenta", "error");
    } finally {
        document.getElementById('pos-loading').style.display = 'none';
    }
}

async function reimprimirComanda() {
    if (!activeComanda) return;

    const { isConfirmed } = await Swal.fire({
        title: 'Reimprimir Comanda',
        text: '¿Deseas enviar la comanda completa a cocina/barra nuevamente?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Reimprimir',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
        document.getElementById('pos-loading').style.display = 'flex';
        const res = await sendData(`/api/comandas/${activeComanda.id}/reimprimir`, {}, 'POST');

        if (res.print_jobs && Array.isArray(res.print_jobs)) {
            for (const job of res.print_jobs) {
                await imprimirRemoto(job);
            }
            mostrarNotificacion("Reimpresión enviada", "success");
        } else {
            mostrarNotificacion("No se generaron trabajos de impresión", "warning");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al reimprimir comanda", "error");
    } finally {
        document.getElementById('pos-loading').style.display = 'none';
    }
}

async function imprimirRemoto(job) {
    if (!job || !job.ip || !job.payload) return;
    
    // Transformar al formato exacto que espera el agente local Baboons Hub
    const agentPayload = {
        ip_destino: job.ip,
        id_orden: job.payload.id_orden || ("CMD-" + Math.floor(Math.random() * 10000)),
        ...job.payload
    };

    // Asegurar compatibilidad de claves de items (nombre vs name, observaciones vs notes)
    if (Array.isArray(agentPayload.items)) {
        agentPayload.items = agentPayload.items.map(it => ({
            qty: it.qty || it.cantidad,
            nombre: it.nombre || it.name || "Producto",
            observaciones: it.observaciones || it.notes || it.notas || ""
        }));
    }
    
    const agentUrl = printHubIp ? `http://${printHubIp}:5001` : 'http://localhost:5001';
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Si estamos en PRODUCCION (HTTPS), no intentamos la impresión directa al agente local
    // porque los navegadores bloquean peticiones Inseguras (HTTP) desde sitios Seguros (HTTPS).
    // Confiamos 100% en la Cola Cloud que el Agente PC leerá por polling.
    if (!isLocalhost) {
        console.log("☁️ Entorno de producción detectado. Confiando en la Cola Cloud para impresión.");
        return; 
    }
    
    console.log("🚀 Enviando impresión local/hub (Formato Agente):", agentPayload);
    try {
        const response = await fetch(`${agentUrl}/api/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
            signal: AbortSignal.timeout(2000) // Solo esperamos 2s
        });
        
        if (!response.ok) throw new Error("Error en el agente de impresión");
        console.log("✅ Impresión exitosa en " + job.ip);
    } catch (err) {
        console.warn("⚠️ Impresión directa falló o fue bloqueada (CORS/Mixed Content). El Agente Cloud lo procesará.");
    }
}

function imprimirTicket(comanda) {
    const negocio = appState.negociosCache.find(n => String(n.id) === String(appState.negocioActivoId)) || { nombre: 'Baboons Restó' };

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    let itemsHtml = '';
    const itemsValidos = (comanda.detalles || []).filter(d => d.estado !== 'anulado');
    let subtotalFinal = 0;

    itemsValidos.forEach(item => {
        const sub = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
        subtotalFinal += sub;
        itemsHtml += `
            <tr>
                <td style="padding: 5px 0;">${item.producto_nombre || 'Item'} x ${item.cantidad}</td>
                <td style="text-align: right;">${formatearMoneda(sub)}</td>
            </tr>
        `;
    });

    const htmlContent = `
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0; padding: 10px; font-size: 14px; }
                .text-center { text-align: center; }
                .hr { border-bottom: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                .total { font-weight: bold; font-size: 18px; }
                .footer { font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <h3>${negocio.nombre}</h3>
                <p>CONTROL DE MESA - NO VÁLIDO COMO FACTURA</p>
                <div class="hr"></div>
                <p>Mesa: ${mesaSeleccionada.numero} | Pax: ${comanda.num_comensales}</p>
                <p>Mozo: ${comanda.mozo_nombre}</p>
                <p>Fecha: ${new Date().toLocaleString()}</p>
                <div class="hr"></div>
            </div>
            <table>
                ${itemsHtml}
            </table>
            <div class="hr"></div>
            <div style="display: flex; justify-content: space-between;" class="total">
                <span>TOTAL:</span>
                <span>${formatearMoneda(subtotalFinal)}</span>
            </div>
            <div class="hr"></div>
            <div class="text-center footer">
                <p>GRACIAS POR SU VISITA</p>
            </div>
        </body>
        </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
}

async function cerrarMesa() {
    if (!activeComanda || !activeComanda.detalles) return;

    const estadoMesa = (mesaSeleccionada.estado || 'libre').toLowerCase();

    // FLUJO 1: Mozo solicita cuenta
    if (estadoMesa !== 'en_cobro') {
        solicitarCuenta();
        return;
    }

    // FLUJO 2: Adicionista/Admin cobra
    const isAdmin = ['admin', 'superadmin', 'adicionista', 'cajero'].includes((appState.userRol || '').toLowerCase());
    if (!isAdmin) {
        Swal.fire({
            title: 'Solo Adicionistas',
            text: 'Esta mesa está en proceso de cobro. Solo el encargado de caja puede finalizarla.',
            icon: 'info'
        });
        return;
    }

    await setupPaymentLogic(activeComanda.id, activeComanda.total, mesaSeleccionada.numero, () => {
        showSalonView();
    });
}

/**
 * 💳 Lógica Central de Cobro (Compartida entre Mozo y Monitor Adicionista)
 * Mejorada con campos de tarjeta y Mercado Pago Point PDV.
 */
export async function setupPaymentLogic(comandaId, totalVenta, mesaNum, onCompleteCallback = null) {
    let pollingInterval = null;

    // 🛡️ Asegurar Negocio ID (Desde appState o localStorage si no cargó)
    const negId = appState.negocioActivoId || localStorage.getItem('negocioId') || localStorage.getItem('negocioActivoId');
    if (!negId) {
        Swal.fire('Error Grave', 'No se pudo detectar el ID del negocio activo. Por favor, refresque la página.', 'error');
        return;
    }

    // 🔍 Verificar si Mercado Pago está configurado
    let mpConfigured = false;
    try {
        const configStatus = await fetchData(`/api/negocios/${negId}/mp/config-status`);
        mpConfigured = configStatus && configStatus.configured;
    } catch (err) {
        console.warn("No se pudo verificar configuración de MP:", err);
    }

    const { value: paymentData } = await Swal.fire({
        title: `Finalizar Cobro - Mesa #${mesaNum}`,
        width: '450px',
        html: `
            <div class="text-start">
                <p class="mb-3 text-center">Total a Cobrar: <b style="font-size:1.6rem; color:#10b981;">${formatearMoneda(totalVenta)}</b></p>
                
                ${mpConfigured ? `
                <div class="badge bg-success w-100 mb-3 p-2 animate__animated animate__fadeIn" style="border-radius:10px; font-size:0.85rem;">
                    <i class="fas fa-check-circle me-1"></i> TERMINAL POINT CONFIGURADA
                </div>
                ` : ''}

                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">MÉTODO DE PAGO:</label>
                    <select id="swal-metodo-pago" class="form-select shadow-sm" style="border-radius:12px; height:50px; font-weight:700;">
                        ${mpConfigured ? `
                            <option value="MP Transferencia/QR">📱 MP Transferencia/QR</option>
                            <option value="Mercado Pago Point">📟 Mercado Pago Point (Posnet)</option>
                            <option value="Efectivo" selected>💵 Efectivo</option>
                        ` : `
                            <option value="Efectivo" selected>💵 Efectivo</option>
                        `}
                        <option value="Tarjeta de Crédito" style="display:none;">💳 Tarjeta de Crédito (Uso Interno)</option>
                        ${!mpConfigured ? `
                            <option value="MP Transferencia/QR">📱 MP Transferencia/QR</option>
                            <option value="Mercado Pago Point">📲 Mercado Pago Point (PDV)</option>
                        ` : ''}
                        <option value="Transferencia">🏦 Bancaria / Transferencia</option>
                        <option value="Cuenta Corriente">📑 Cuenta Corriente</option>
                        <option value="Mixto">🔀 Mixto</option>
                    </select>
                </div>

                <!-- Panel Detalles de Tarjeta -->
                <div id="swal-panel-tarjeta" style="display:none; background:#f0f9ff; padding:15px; border-radius:12px; border:1px solid #bae6fd; margin-top:10px;" class="animate__animated animate__fadeIn">
                    <p class="small fw-bold text-primary mb-2 border-bottom pb-1"><i class="fas fa-credit-card me-1"></i> Datos de la Tarjeta</p>
                    <div class="row g-2">
                        <div class="col-7">
                            <label class="small text-muted">Marca</label>
                            <select id="swal-t-marca" class="form-select form-select-sm">
                                <option value="Visa">Visa</option>
                                <option value="Mastercard">Mastercard</option>
                                <option value="Maestro">Maestro</option>
                                <option value="Cabal">Cabal</option>
                                <option value="American Express">Amex</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div class="col-5">
                            <label class="small text-muted">Últimos 4</label>
                            <input type="text" id="swal-t-u4" class="form-control form-control-sm" placeholder="0000" maxlength="4">
                        </div>
                        <div class="col-6">
                            <label class="small text-muted">Lote</label>
                            <input type="text" id="swal-t-lote" class="form-control form-control-sm" placeholder="000">
                        </div>
                        <div class="col-6">
                            <label class="small text-muted">Cupón/Op</label>
                            <input type="text" id="swal-t-cupon" class="form-control form-control-sm" placeholder="0000">
                        </div>
                    </div>
                </div>

                <!-- Panel QR status -->
                <div id="swal-panel-qr" style="display:none; text-align:center; padding:15px; background:#fff; border-radius:15px; border:2px dashed #0093d1; margin-top:10px;" class="animate__animated animate__fadeIn">
                    <p class="small fw-bold text-primary mb-2">Escaneá este código para pagar</p>
                    <div id="qr-container" style="background:#fff; padding:10px; display:inline-block; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                        <img src="https://www.mercadopago.com/instore/merchant/qr/128283501/9a2d963407b448e99d6c036b1b524fe4d19721034ef7472aba7e792cf0f9dad8.png" style="width:220px; height:auto;" alt="QR Mercado Pago">
                    </div>
                    <div class="mt-3">
                        <div class="spinner-grow spinner-grow-sm text-primary" role="status"></div>
                        <span class="small text-muted ms-1">Esperando confirmación...</span>
                    </div>
                    <button type="button" id="btn-cancelar-qr" class="btn btn-outline-danger btn-sm mt-3 w-100 rounded-pill shadow-sm">
                        <i class="fas fa-times me-1"></i> Cancelar Operación QR
                    </button>
                </div>

                <!-- Panel Point status -->
                <div id="swal-panel-point" style="display:none; background:#f0fdf4; padding:20px; border-radius:12px; border:1px solid #bbf7d0; margin-top:10px; text-align:center;" class="animate__animated animate__pulse animate__infinite">
                    <div class="spinner-border text-success mb-2" role="status"></div>
                    <p class="mb-0 fw-bold text-success">Esperando acción en el Point...</p>
                    <small class="text-muted">Deslice, inserte o acerque la tarjeta al dispositivo.</small>
                </div>

                <div id="swal-panel-mixto" style="display:none; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; margin-top:10px;">
                    <p class="small fw-bold text-primary mb-2 border-bottom pb-1">Desglose de Pago Mixto</p>
                    <div class="row g-2">
                        <div class="col-6">
                            <label class="small text-muted">Efectivo ($)</label>
                            <input type="number" id="swal-monto-ef" class="form-control" value="0" step="0.01">
                        </div>
                        <div class="col-6">
                            <label class="small text-muted">Mercado Pago ($)</label>
                            <input type="number" id="swal-monto-mp" class="form-control" value="0" step="0.01">
                        </div>
                        <div class="col-12">
                            <label class="small text-muted">Cuenta Corriente ($)</label>
                            <input type="number" id="swal-monto-cc" class="form-control" value="0" step="0.01">
                        </div>
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            const select = document.getElementById('swal-metodo-pago');
            const panelTarjeta = document.getElementById('swal-panel-tarjeta');
            const panelMixto = document.getElementById('swal-panel-mixto');

            const iniciarFlujoPagoExpress = async (metodo) => {
                const isQR = (metodo === 'MP Transferencia/QR');
                try {
                    Swal.resetValidationMessage();
                    if (isQR) document.getElementById('swal-panel-qr').style.display = 'block';
                    else document.getElementById('swal-panel-point').style.display = 'block';
                    
                    select.disabled = true;
                    const endpoint = isQR ? `/api/negocios/${negId}/mp/qr/create` : `/api/negocios/${negId}/mp/create-intent`;
                    const external_ref = `CMD_${comandaId}_${Math.random().toString(36).substring(7).toUpperCase()}`;
                    
                    const intentRes = await sendData(endpoint, { amount: totalVenta, description: `Mesa ${mesaNum}`, external_reference: external_ref });
                    if (intentRes.error) throw new Error(intentRes.error);
                    
                    const pollingId = isQR ? (intentRes.external_reference || external_ref) : intentRes.id;
                    
                    if (pollingInterval) clearInterval(pollingInterval);
                    pollingInterval = setInterval(async () => {
                        try {
                            if (!pollingId) { clearInterval(pollingInterval); return; }
                            const statusRes = await fetchData(`/api/negocios/${negId}/mp/intent/${pollingId}`);
                            if (statusRes.status === 'finished') {
                                clearInterval(pollingInterval);
                                // Simular el envío del payload final
                                const finalPayload = { 
                                    metodo_pago: metodo,
                                    mp_payment_intent_id: pollingId,
                                    tarjeta_marca: isQR ? 'MP QR' : (statusRes.payment?.type || 'MP Point')
                                };
                                Swal.clickConfirm();
                                // Guardamos temporalmente en el botón para que preConfirm lo use
                                select.dataset.finalPayload = JSON.stringify(finalPayload);
                            } else if (statusRes.status === 'canceled' || statusRes.status === 'error') {
                                clearInterval(pollingInterval);
                                Swal.showValidationMessage('Operación cancelada en el dispositivo.');
                                select.disabled = false;
                                document.getElementById('swal-panel-qr').style.display = 'none';
                                document.getElementById('swal-panel-point').style.display = 'none';
                            }
                        } catch (err) { console.warn('Polling...'); }
                    }, 3000);
                } catch (err) {
                    Swal.showValidationMessage(`Error MP: ${err.message}`);
                    select.disabled = false;
                }
            };

            select.onchange = (e) => {
                const val = e.target.value;
                panelTarjeta.style.display = (val.includes('Tarjeta')) ? 'block' : 'none';
                panelMixto.style.display = (val === 'Mixto') ? 'block' : 'none';
                
                if (val === 'MP Transferencia/QR' || val === 'Mercado Pago Point') {
                    Swal.getConfirmButton().style.display = 'none';
                    iniciarFlujoPagoExpress(val);
                } else {
                    Swal.getConfirmButton().style.display = 'inline-block';
                    if (pollingInterval) clearInterval(pollingInterval);
                    document.getElementById('swal-panel-qr').style.display = 'none';
                    document.getElementById('swal-panel-point').style.display = 'none';
                }
            };

            // Botón cancelar QR (Limpia la caja física)
            document.getElementById('btn-cancelar-qr').onclick = async () => {
                try {
                    if (pollingInterval) clearInterval(pollingInterval);
                    await sendData(`/api/negocios/${negId}/mp/qr/cancel`, {}, 'DELETE');
                    document.getElementById('swal-panel-qr').style.display = 'none';
                    document.getElementById('swal-metodo-pago').value = 'Efectivo';
                    document.getElementById('swal-metodo-pago').dispatchEvent(new Event('change'));
                    mostrarNotificacion("Operación QR cancelada y caja liberada", "info");
                } catch (err) {
                    console.error("Error al cancelar QR:", err);
                }
            };
        },
        preConfirm: async () => {
             const m = document.getElementById('swal-metodo-pago').value;
             const payload = { metodo_pago: m };

             if (m === 'Mixto') {
                 const ef = parseFloat(document.getElementById('swal-monto-ef').value) || 0;
                 const mp = parseFloat(document.getElementById('swal-monto-mp').value) || 0;
                 const cc = parseFloat(document.getElementById('swal-monto-cc').value) || 0;
                 if (Math.abs((ef + mp + cc) - totalVenta) > 1) {
                     Swal.showValidationMessage(`La suma (${formatearMoneda(ef+mp+cc)}) debe coincidir con el total (${formatearMoneda(totalVenta)})`);
                     return false;
                 }
                 Object.assign(payload, { monto_efectivo: ef, monto_mp: mp, monto_cta_cte: cc });
             }

             if (m.includes('Tarjeta')) {
                 payload.tarjeta_marca = document.getElementById('swal-t-marca').value;
                 payload.tarjeta_ultimos_4 = document.getElementById('swal-t-u4').value;
                 payload.tarjeta_lote = document.getElementById('swal-t-lote').value;
                 payload.tarjeta_cupon = document.getElementById('swal-t-cupon').value;
             }

             if (m === 'Mercado Pago Point' || m === 'MP Transferencia/QR') {
                 try {
                     const loadedPayload = select.dataset.finalPayload ? JSON.parse(select.dataset.finalPayload) : null;
                     if (loadedPayload) return loadedPayload;
                     Swal.showValidationMessage('Esperando confirmación de pago...');
                     return false;
                 } catch (err) { return false; }
             }
             return payload;
        },
        showCancelButton: true,
        confirmButtonText: '✅ Registrar Cobro',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'premium-swal-v2',
            confirmButton: 'rounded-pill px-4',
            cancelButton: 'rounded-pill px-4'
        }
    });

    if (paymentData) {
        try {
            // Mostrar loader
            const loader = document.getElementById('pos-loading');
            if (loader) loader.style.display = 'flex';
            else Swal.showLoading();

            const res = await sendData(`/api/comandas/${comandaId}/finalizar-cobro`, paymentData, 'POST');
            
            if (loader) loader.style.display = 'none';

            await Swal.fire({
                title: '¡Cobro Exitoso!',
                text: `Mesa liberada correctamente. Venta #${res.venta_id || ''}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'premium-swal-v2' }
            });

            if (onCompleteCallback) onCompleteCallback(res);
            
        } catch (error) {
            const loader = document.getElementById('pos-loading');
            if (loader) loader.style.display = 'none';
            console.error(error);
            mostrarNotificacion(error.message || "Error al procesar cobro", "error");
        }
    } else {
        // Si cancelaron el modal de SWAL, asegurarnos de limpiar cualquier polling
        if (pollingInterval) clearInterval(pollingInterval);
    }
}
async function abrirModalDivision() {
    if (!activeComanda || !activeComanda.detalles) return;

    const pendientes = activeComanda.detalles.filter(d => d.estado !== 'anulado' && d.estado !== 'cobrado');

    if (pendientes.length === 0) {
        mostrarNotificacion("No hay ítems pendientes de pago", "info");
        return;
    }

    let itemsHtml = `
        <div class="split-selector-list text-start" style="max-height: 300px; overflow-y: auto;">
            ${pendientes.map(item => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                    <div style="flex: 1;">
                        <input type="checkbox" class="form-check-input me-2 split-item-check" 
                               id="check-${item.id}" data-id="${item.id}" data-max="${item.cantidad}">
                        <label for="check-${item.id}" class="small fw-bold">${item.producto_nombre}</label>
                    </div>
                    <div class="d-flex align-items-center" style="width: 100px;">
                        <input type="number" class="form-control form-control-sm split-item-qty" 
                               id="qty-${item.id}" value="${item.cantidad}" min="1" max="${item.cantidad}" 
                               style="width: 70px;" disabled>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: 'Dividir Cuenta',
        html: itemsHtml,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Procesar Pago Parcial',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const checks = document.querySelectorAll('.split-item-check');
            checks.forEach(c => {
                c.onchange = (e) => {
                    const id = e.target.dataset.id;
                    document.getElementById(`qty-${id}`).disabled = !e.target.checked;
                };
            });
        },
        preConfirm: () => {
            const selected = [];
            const checks = document.querySelectorAll('.split-item-check:checked');
            checks.forEach(c => {
                const id = c.dataset.id;
                const qty = document.getElementById(`qty-${id}`).value;
                selected.push({ id: parseInt(id), cantidad: parseFloat(qty) });
            });
            if (selected.length === 0) {
                Swal.showValidationMessage('Debes seleccionar al menos un producto');
            }
            return selected;
        }
    });

    if (formValues) {
        document.getElementById('pos-loading').style.display = 'flex';
        try {
            const res = await sendData(`/api/comandas/${activeComanda.id}/pago-parcial`, { items: formValues }, 'POST');

            await Swal.fire({
                title: 'Pago Parcial Exitoso',
                text: `Venta #${res.venta_id} registrada. ${res.comanda_finalizada ? 'Mesa liberada.' : 'Mesa pendiente.'}`,
                icon: 'success'
            });

            if (res.comanda_finalizada) {
                showSalonView();
            } else {
                await cargarComandaDeMesa(mesaSeleccionada.id);
                renderOrderSummary();
            }
        } catch (error) {
            console.error(error);
            mostrarNotificacion("Error al procesar pago parcial", "error");
        } finally {
            document.getElementById('pos-loading').style.display = 'none';
        }
    }
}

async function moverMesa() {
    console.log("🔄 Click en Mover Mesa (Comanda:", activeComanda ? activeComanda.id : 'null', ")");
    if (!activeComanda) {
        mostrarNotificacion("Debe abrir una mesa para mover su comanda", "warning");
        return;
    }

    // Listar solo las mesas LIBRES (excepto la actual)
    const mesasLibres = mesasCache.filter(m => m.id != mesaSeleccionada.id && (m.estado === 'libre' || !m.comanda_id));

    if (mesasLibres.length === 0) {
        mostrarNotificacion("No hay mesas libres disponibles", "warning");
        return;
    }

    const { value: nuevaMesaId } = await Swal.fire({
        title: 'Cambiar de Mesa',
        text: 'Seleccioná la mesa de destino para esta comanda:',
        input: 'select',
        inputOptions: mesasLibres.reduce((acc, m) => {
            acc[m.id] = `Mesa ${m.numero} (${m.zona || 'Salón'})`;
            return acc;
        }, {}),
        inputPlaceholder: 'Seleccioná una mesa...',
        showCancelButton: true,
        confirmButtonText: '🔄 Confirmar Cambio',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4361ee',
        customClass: { popup: 'premium-swal-v2' }
    });

    if (nuevaMesaId) {
        try {
            document.getElementById('pos-loading').style.display = 'flex';
            const res = await sendData(`/api/comandas/${activeComanda.id}/mover-mesa`, { nueva_mesa_id: nuevaMesaId }, 'PUT');
            
            await Swal.fire({
                title: '✅ ¡Hecho!',
                text: `Mesa cambiada correctamente a la #${res.mesa_numero}`,
                icon: 'success',
                confirmButtonColor: '#4361ee',
                customClass: { popup: 'premium-swal-v2' }
            });
            
            // Actualizar estado local y volver al salón
            showSalonView();
        } catch (error) {
            console.error(error);
            mostrarNotificacion("Error al cambiar de mesa", "error");
        } finally {
            document.getElementById('pos-loading').style.display = 'none';
        }
    }
}
async function entregarItem(detalleId) {
    try {
        await sendData(`/api/comandas/detalle/${detalleId}/estado`, { estado: 'entregado' }, 'PUT');
        mostrarNotificacion("Producto entregado", "success");
        await cargarComandaDeMesa(mesaSeleccionada.id);
        renderOrderSummary();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al marcar como entregado", "error");
    }
}
window.entregarItem = entregarItem;

async function entregarTodo() {
    if (!activeComanda || !activeComanda.detalles) return;
    
    // Only deliver items that are 'listo' OR have no station, and are not yet delivered/closed
    const listos = activeComanda.detalles.filter(d => 
        (d.estado === 'listo' || !d.estacion) && 
        ['pendiente', 'cocinando', 'listo'].includes(d.estado)
    );
    
    if (listos.length === 0) return;

    document.getElementById('pos-loading').style.display = 'flex';
    try {
        for (const item of listos) {
            await sendData(`/api/comandas/detalle/${item.id}/estado`, { estado: 'entregado' }, 'PUT');
        }
        mostrarNotificacion(`Se entregaron ${listos.length} ítem(s)`, "success");
        await cargarComandaDeMesa(mesaSeleccionada.id);
        renderOrderSummary();
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al entregar ítems", "error");
    } finally {
        document.getElementById('pos-loading').style.display = 'none';
    }
}
window.entregarTodo = entregarTodo;

// ---- HISTÓRICO DE COMANDAS ----
async function abrirHistoricoComandasMozo() {
    // Close side menu
    const sideMenu = document.getElementById('mozo-side-menu');
    if (sideMenu) sideMenu.classList.remove('open');

    try {
        const comandas = await fetchData(`/api/negocios/${appState.negocioActivoId}/comandas?estado=cerrada&limit=50`);
        
        let rows = '';
        if (!comandas || comandas.length === 0) {
            rows = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No hay comandas cerradas hoy</td></tr>`;
        } else {
            comandas.forEach(c => {
                const fecha = new Date(c.fecha_apertura || c.created_at);
                const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                rows += `
                    <tr>
                        <td style="font-weight:800; color:#4f46e5;">Mesa ${c.mesa_numero || '?'}</td>
                        <td>${c.mozo_nombre || '-'}</td>
                        <td>${hora}</td>
                        <td style="font-weight:700;">${formatearMoneda(c.total || 0)}</td>
                        <td><span style="background:#dcfce7; color:#16a34a; padding:2px 8px; border-radius:20px; font-size:0.7rem; font-weight:700;">Cerrada</span></td>
                    </tr>`;
            });
        }

        await Swal.fire({
            title: '📋 Histórico de Comandas',
            html: `
                <div style="max-height:55vh; overflow-y:auto; margin: 0 -20px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead>
                            <tr style="background:#f1f5f9; text-align:left;">
                                <th style="padding:10px 12px; font-weight:700; color:#64748b;">Mesa</th>
                                <th style="padding:10px 8px; font-weight:700; color:#64748b;">Mozo</th>
                                <th style="padding:10px 8px; font-weight:700; color:#64748b;">Hora</th>
                                <th style="padding:10px 8px; font-weight:700; color:#64748b;">Total</th>
                                <th style="padding:10px 8px; font-weight:700; color:#64748b;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `,
            width: '95%',
            showConfirmButton: true,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#4f46e5',
            customClass: {
                popup: 'premium-swal-v2'
            }
        });
    } catch (err) {
        console.error('Error cargando histórico:', err);
        mostrarNotificacion('No se pudo cargar el histórico', 'error');
    }
}
window.abrirHistoricoComandasMozo = abrirHistoricoComandasMozo;
