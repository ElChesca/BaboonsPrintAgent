// app/static/js/modules/resto_cocina.js
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

let pendingItems = [];
let kdsInterval = null;
let estacionActual = 'cocina'; 
let viewMode = 'grid'; // 'grid' o 'kanban'
let unifyByTable = false;
let sortMode = 'tiempo'; // 'tiempo' o 'mesa'
let mesaFilter = "";
let tiempoFilter = "all"; // 'all', 1, 2, 3

/**
 * Permite forzar la estación desde el cargador de módulos (main.js)
 */
export function setKDSStation(estacion) {
    console.log(`📡 Estación KDS establecida en: ${estacion}`);
    estacionActual = estacion.toLowerCase();
}

export async function inicializarRestoCocina() {
    console.log("🔥 Monitor de Producción KDS Inicializado...");
    
    // Cargar preferencias guardadas
    viewMode = localStorage.getItem('kds_view_mode') || 'grid';
    unifyByTable = localStorage.getItem('kds_unify_tables') === 'true';

    // Actualizar UI de botones
    actualizarBotonesVista();

    // Display user name and icon based on station
    const user = getCurrentUser();
    if (user && user.nombre) {
        const nameEl = document.getElementById('kds-user-name');
        const iconPrefix = estacionActual === 'bar' ? '🍹' : (estacionActual === 'dolce' ? '🍰' : '👨‍🍳');
        if (nameEl) {
            nameEl.innerText = `${iconPrefix} ${user.nombre}`;
            // Remove previous station classes and add current
            nameEl.classList.remove('badge-cocina', 'badge-bar', 'badge-dolce');
            nameEl.classList.add(`badge-${estacionActual}`);
        }
    }
    
    // Dynamic Branding (Title & Station Name)
    const mainTitleEl = document.getElementById('kds-main-title');
    const stationNameEl = document.getElementById('kds-station-name');
    const brandIconI = document.querySelector('.kds-brand-icon i');

    if (mainTitleEl) mainTitleEl.innerText = `KDS ${estacionActual.toUpperCase()}`;
    
    if (stationNameEl) {
        const titulos = {
            'cocina': 'Monitor de Cocina',
            'bar': 'Monitor de Barra / Bebidas',
            'dolce': 'Monitor Dolce (Cafetería y Pastas)'
        };
        stationNameEl.innerText = titulos[estacionActual] || 'Monitor de Producción';
    }

    if (brandIconI) {
        const icons = {
            'cocina': 'fa-fire-alt',
            'bar': 'fa-cocktail',
            'dolce': 'fa-ice-cream'
        };
        brandIconI.className = `fas ${icons[estacionActual] || 'fa-fire-alt'}`;
    }

    // Initial Load
    await cargarPendientes();

    // Loop
    startKDSPolling();
}

function actualizarBotonesVista() {
    document.querySelectorAll('.kds-view-btn').forEach(btn => btn.classList.remove('active'));
    
    if (viewMode === 'grid') document.getElementById('btn-view-grid')?.classList.add('active');
    if (viewMode === 'kanban') document.getElementById('btn-view-kanban')?.classList.add('active');
    
    const btnUnify = document.getElementById('btn-unify-tables');
    if (btnUnify) {
        if (unifyByTable) btnUnify.classList.add('active');
        else btnUnify.classList.remove('active');
    }
}

export function cambiarVistaKDS(mode) {
    viewMode = mode;
    localStorage.setItem('kds_view_mode', mode);
    actualizarBotonesVista();
    renderKDS();
}
window.cambiarVistaKDS = cambiarVistaKDS;

export function toggleUnificarMesas() {
    unifyByTable = !unifyByTable;
    localStorage.setItem('kds_unify_tables', unifyByTable);
    actualizarBotonesVista();
    renderKDS();
}
window.toggleUnificarMesas = toggleUnificarMesas;

export function cambiarEstacion(nueva) {
    estacionActual = nueva;

    // Update UI active state
    document.querySelectorAll('.kds-station-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-station-${nueva}`);
    if (btn) btn.classList.add('active');

    cargarPendientes();
}
window.cambiarEstacion = cambiarEstacion;

export function cambiarOrden(mode) {
    sortMode = mode;
    document.querySelectorAll('.kds-filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-sort-${mode}`)?.classList.add('active');
    renderKDS();
}
window.cambiarOrden = cambiarOrden;

export function filtrarMesa(val) {
    mesaFilter = val.trim();
    renderKDS();
}
window.filtrarMesa = filtrarMesa;

export function filtrarTiempo(tiempo) {
    tiempoFilter = tiempo;
    
    // UI Update
    document.querySelectorAll('.kds-filter-btn[onclick*="filtrarTiempo"]').forEach(btn => btn.classList.remove('active'));
    
    const targetId = tiempo === 'all' ? 'btn-tiempo-all' : `btn-tiempo-${tiempo}`;
    document.getElementById(targetId)?.classList.add('active');
    
    renderKDS();
}
window.filtrarTiempo = filtrarTiempo;

function startKDSPolling() {
    if (kdsInterval) clearInterval(kdsInterval);

    kdsInterval = setInterval(() => {
        const h = window.location.hash;
        if (h === '#resto_cocina' || h === '#resto_bar' || h === '#resto_dolce') {
            cargarPendientes(true);
        } else {
            clearInterval(kdsInterval);
            kdsInterval = null;
        }
    }, 10000); // 10s refresh

    // Register active timers for cards
    setInterval(() => {
        const h = window.location.hash;
        if (h === '#resto_cocina' || h === '#resto_bar' || h === '#resto_dolce') {
            actualizarRelojes();
        }
    }, 1000);
}

async function cargarPendientes(silent = false) {
    if (!appState.negocioActivoId) return;

    try {
        const data = await fetchData(`/api/negocios/${appState.negocioActivoId}/cocina/pendientes?estacion=${estacionActual}`);
        pendingItems = data;
        renderKDS();

    } catch (error) {
        console.error("Error KDS:", error);
        if (!silent) mostrarNotificacion("Error al sincronizar producción", "error");
    }

    // ✨ APLICAR TEMA VISUAL DINÁMICO
    aplicarTemaEstacion();
}

async function aplicarTemaEstacion() {
    const negId = appState.negocioActivoId;
    if (!negId) return;

    try {
        // En un entorno productivo, cachearíamos esto o vendría en el init context
        const configs = await fetchData(`/api/negocios/${negId}/configuraciones`);
        const themeColor = configs[`resto_station_color_${estacionActual}`] || '#f0883e';
        
        const root = document.getElementById('kds-app');
        if (root) {
            root.style.setProperty('--kds-warning', themeColor);
            root.style.setProperty('--kds-accent', themeColor);
            root.style.setProperty('--kds-cooking', themeColor);
            
            // Actualizar gradiente del icono de acuerdo al tema
            const icon = root.querySelector('.kds-brand-icon');
            if (icon) icon.style.background = `linear-gradient(135deg, ${themeColor}, #000)`;
        }
    } catch (e) { }
}
window.cargarPendientes = cargarPendientes;

function renderKDS() {
    const container = document.getElementById('kds-orders-container');
    if (!container) return;

    if (pendingItems.length === 0) {
        container.innerHTML = `
            <div class="kds-empty">
                <div class="kds-empty-icon">
                    <i class="fas fa-check-double"></i>
                </div>
                <h2>¡Todo al día!</h2>
                <p>No hay comandas pendientes en ${estacionActual}.</p>
            </div>`;
        actualizarStats({ total: 0, cooking: 0 });
        return;
    }

    // --- PROCESAMIENTO, FILTRADO Y ORDENAMIENTO ---
    const allGroups = [];
    const groups = {};
    
    pendingItems.forEach(item => {
        // [NUEVO] DOBLE SEGURIDAD: Filtrar por estación también en el frontend por si el backend fallara
        const itemEst = (item.categoria_estacion || 'cocina').toLowerCase();
        if (itemEst !== estacionActual.toLowerCase()) {
            return; 
        }

        // Filtro por Mesa
        if (mesaFilter && String(item.mesa_numero) !== mesaFilter) return;

        // [NUEVO] Filtro por Tiempo
        if (tiempoFilter !== 'all' && item.tiempo != tiempoFilter) return;

        const key = unifyByTable ? `mesa-${item.mesa_numero}` : `comanda-${item.comanda_id}`;
        
        if (!groups[key]) {
            groups[key] = {
                id: key,
                comanda_id: item.comanda_id,
                mesa: item.mesa_numero,
                pax: item.num_comensales,
                openedAt: new Date(item.pedido_fecha).getTime(),
                mozo: item.mozo_nombre || 'Mozo',
                items: [],
                status: 'pending'
            };
            allGroups.push(groups[key]);
        }
        
        // Consolidación de items por producto para vista unificada
        const productKey = `${item.producto_id}-${item.detalle_estado}`;
        let existingItem = groups[key].items.find(i => `${i.producto_id}-${i.detalle_estado}` === productKey);
        
        if (unifyByTable && existingItem) {
            existingItem.cantidad = parseFloat(existingItem.cantidad) + parseFloat(item.cantidad);
            // Guardamos el detalle_id original para poder actualizarlo luego
            if (!existingItem.relatedIds) existingItem.relatedIds = [existingItem.detalle_id];
            existingItem.relatedIds.push(item.detalle_id);
        } else {
            item.relatedIds = [item.detalle_id];
            groups[key].items.push(item);
        }

        if (item.detalle_estado === 'cocinando') {
            groups[key].status = 'cooking';
        }

        // Mantener la hora de apertura más antigua para el cronómetro del grupo
        const itemTime = new Date(item.pedido_fecha).getTime();
        if (itemTime < groups[key].openedAt) groups[key].openedAt = itemTime;

        // [NUEVO] Seguir el tiempo predominante (mínimo tiempo pendiente)
        if (!groups[key].dominantTiempo || item.tiempo < groups[key].dominantTiempo) {
            if (item.detalle_estado !== 'listo') {
                groups[key].dominantTiempo = item.tiempo;
            }
        }
    });

    // Post-procesamiento de grupos para detectar disparos
    Object.values(groups).forEach(group => {
        if (!group.dominantTiempo) group.dominantTiempo = 1; // Fallback

        // Chequear si T1 está todo listo para disparar T2
        const itemsT1 = group.items.filter(i => i.tiempo == 1);
        const allT1Ready = itemsT1.length > 0 && itemsT1.every(i => i.detalle_estado === 'listo');
        if (allT1Ready) {
            group.nextCourseReady = true;
        }
    });

    // APLICAR ORDENAMIENTO
    if (sortMode === 'tiempo') {
        allGroups.sort((a, b) => a.openedAt - b.openedAt);
    } else if (sortMode === 'mesa') {
        allGroups.sort((a, b) => {
            const valA = String(a.mesa);
            const valB = String(b.mesa);
            const numA = parseInt(valA.replace(/\D/g, '')) || 0;
            const numB = parseInt(valB.replace(/\D/g, '')) || 0;
            if (numA !== numB) return numA - numB;
            return valA.localeCompare(valB);
        });
    }

    // Limpiar mensaje de "Todo al día" o estructuras previas si hay datos
    if (allGroups.length > 0) {
        const emptyMsg = container.querySelector('.kds-empty');
        if (emptyMsg) container.innerHTML = '';
    }

    if (viewMode === 'kanban') {
        renderKanbanView(allGroups, container);
    } else {
        renderGridView(allGroups, container);
    }

    actualizarStats({
        total: allGroups.length,
        cooking: allGroups.filter(g => g.status === 'cooking').length
    });
}

function renderGridView(groups, container) {
    // Configurar el container como board normal (grilla)
    container.classList.remove('kanban-active');
    
    // Si veníamos de Kanban, tenemos que limpiar la estructura interna
    if (container.querySelector('.kds-kanban-board')) {
        container.innerHTML = '';
        container.className = 'kds-board';
    }

    const existingIds = new Set();
    const now = Date.now();

    groups.forEach(group => {
        const divId = `kds-card-${group.id}`;
        existingIds.add(divId);
        let card = document.getElementById(divId);
        
        const diffMin = Math.floor((now - group.openedAt) / 60000);
        let prioClass = (diffMin >= 15) ? 'prio-high' : (diffMin >= 8 ? 'prio-medium' : 'prio-low');
        const isCooking = group.status === 'cooking';
        
        // Dynamic labels and icons
        const stationConfig = {
            'cocina': { prepareIcon: 'fa-fire', prepareText: 'PREPARAR TODO', dispatchIcon: 'fa-check-double', dispatchText: 'DESPACHAR' },
            'bar': { prepareIcon: 'fa-wine-glass-alt', prepareText: 'PREPARAR', dispatchIcon: 'fa-concierge-bell', dispatchText: 'SERVIR' },
            'dolce': { prepareIcon: 'fa-coffee', prepareText: 'PREPARAR', dispatchIcon: 'fa-utensils', dispatchText: 'ENTREGAR' }
        };
        const config = stationConfig[estacionActual] || stationConfig['cocina'];

        const cardContentHTML = `
            <div class="kds-card-head">
                <div class="kds-card-mesa">
                    <span class="kds-mesa-badge"><i class="fas fa-hashtag"></i> MESA ${group.mesa}</span>
                    <span class="kds-mozo-tag"><i class="fas fa-user-tie"></i> ${group.mozo}</span>
                </div>
                <div class="kds-card-meta">
                    <span class="kds-timer" data-start="${group.openedAt}"><i class="fas fa-stopwatch"></i> ${diffMin} min</span>
                    <span class="kds-pax-tag"><i class="fas fa-users"></i> ${group.pax} pax</span>
                </div>
            </div>
            <div class="kds-card-items">
                ${group.items.map(item => `
                    <div class="kds-item ${item.detalle_estado === 'cocinando' ? 'is-cooking' : ''} ${item.detalle_estado === 'listo' ? 'is-done' : ''}">
                        <div class="kds-item-qty">${Math.round(item.cantidad)}</div>
                        <div class="kds-item-info">
                            <span class="kds-item-name">
                                <span class="kds-tiempo-badge tiempo-${item.tiempo || 1}">T${item.tiempo || 1}</span>
                                ${item.producto_nombre}
                                ${item.parent_detalle_id ? `<span class="badge-combo-link"><i class="fas fa-link"></i> COMBO</span>` : ''}
                            </span>
                            ${item.pedido_observaciones ? `<span class="kds-item-note"><i class="fas fa-exclamation-circle"></i> ${item.pedido_observaciones}</span>` : ''}
                        </div>
                        <span class="kds-item-status"><i class="fas ${item.detalle_estado === 'cocinando' ? 'fa-spinner fa-spin' : (item.detalle_estado === 'listo' ? 'fa-check' : 'fa-clock')}"></i></span>
                    </div>
                `).join('')}
            </div>
            <div class="kds-card-actions">
                ${!isCooking ? `
                    <button class="kds-action-btn btn-prepare" onclick="window.updateGrupoEstado('${group.id}', 'cocinando')">
                        <i class="fas ${config.prepareIcon}"></i> ${config.prepareText}
                    </button>
                ` : `
                    <button class="kds-action-btn btn-dispatch" onclick="window.updateGrupoEstado('${group.id}', 'listo')">
                        <i class="fas ${config.dispatchIcon}"></i> ${config.dispatchText}
                    </button>
                `}
            </div>
        `;

        if (!card) {
            card = document.createElement('div');
            card.id = divId;
            const tiempoClass = `tiempo-${group.dominantTiempo || 1}`;
            const readyClass = group.nextCourseReady ? 'tiempo-ready' : '';
            card.className = `kds-card ${prioClass} ${isCooking ? 'is-cooking' : ''} ${tiempoClass} ${readyClass} slide-in-top`;
            card.innerHTML = cardContentHTML;
            container.appendChild(card);
        } else {
            const tiempoClass = `tiempo-${group.dominantTiempo || 1}`;
            const readyClass = group.nextCourseReady ? 'tiempo-ready' : '';
            card.className = `kds-card ${prioClass} ${isCooking ? 'is-cooking' : ''} ${tiempoClass} ${readyClass}`;
            if (card.innerHTML.replace(/\s/g, '') !== cardContentHTML.replace(/\s/g, '')) {
                card.innerHTML = cardContentHTML;
            }
        }
    });

    // Eliminar comandas que ya no existen
    Array.from(container.children).forEach(child => {
        if (child.id && child.id.startsWith('kds-card-') && !existingIds.has(child.id)) {
            child.remove();
        }
    });
}

function renderKanbanView(groups, container) {
    if (container.className !== 'kds-board kanban-active') {
        container.className = 'kds-board kanban-active'; 
        container.innerHTML = '';
    }
    
    // Crear la estructura de columnas si no existe
    let kanbanBoard = container.querySelector('.kds-kanban-board');
    if (!kanbanBoard) {
        container.innerHTML = `
            <div class="kds-kanban-board">
                <div class="kds-kanban-column kds-column-todo">
                    <div class="kds-column-header">
                        <div class="kds-column-title"><i class="fas fa-clock"></i> Pendientes</div>
                        <span class="kds-column-badge" id="badge-todo">0</span>
                    </div>
                    <div class="kanban-list" id="list-todo"></div>
                </div>
                <div class="kds-kanban-column kds-column-doing">
                    <div class="kds-column-header">
                        <div class="kds-column-title"><i class="fas fa-fire"></i> En Proceso</div>
                        <span class="kds-column-badge" id="badge-doing">0</span>
                    </div>
                    <div class="kanban-list" id="list-doing"></div>
                </div>
            </div>
        `;
        kanbanBoard = container.querySelector('.kds-kanban-board');
    }

    const listTodo = document.getElementById('list-todo');
    const listDoing = document.getElementById('list-doing');
    const now = Date.now();

    // Separar grupos por estado
    const todoGroups = groups.filter(g => g.status === 'pending');
    const doingGroups = groups.filter(g => g.status === 'cooking');

    document.getElementById('badge-todo').innerText = todoGroups.length;
    document.getElementById('badge-doing').innerText = doingGroups.length;

        // Dynamic labels and icons
        const stationConfig = {
            'cocina': { prepareIcon: 'fa-fire', prepareText: 'COMENZAR', dispatchIcon: 'fa-check-double', dispatchText: 'LISTO' },
            'bar': { prepareIcon: 'fa-wine-glass-alt', prepareText: 'PREPARAR', dispatchIcon: 'fa-concierge-bell', dispatchText: 'SERVIR' },
            'dolce': { prepareIcon: 'fa-coffee', prepareText: 'PREPARAR', dispatchIcon: 'fa-utensils', dispatchText: 'LISTO' }
        };
        const config = stationConfig[estacionActual] || stationConfig['cocina'];

        const renderList = (groupsList, element) => {
            const existingIds = new Set();
            groupsList.forEach(group => {
                const divId = `kanban-card-${group.id}`;
                existingIds.add(divId);
                let card = document.getElementById(divId);
                
                const diffMin = Math.floor((now - group.openedAt) / 60000);
                
                const cardHTML = `
                    <div class="kds-card-head py-2 px-3">
                        <div class="d-flex justify-content-between w-100 align-items-center">
                            <span class="kds-mesa-badge" style="font-size: 0.85rem; padding: 3px 8px;">MESA ${group.mesa}</span>
                            <span class="kds-timer" style="font-size: 0.9rem;" data-start="${group.openedAt}"><i class="fas fa-clock"></i> ${diffMin}m</span>
                        </div>
                    </div>
                    <div class="px-3 py-2 bg-black bg-opacity-10">
                        ${group.items.map(i => `
                            <div class="mb-1 fw-700 ${i.detalle_estado === 'listo' ? 'text-muted text-decoration-line-through' : ''}" style="font-size: 1.1rem;">
                               <span class="badge bg-secondary me-1" style="font-size: 0.7rem;">T${i.tiempo || 1}</span>
                               ${Math.round(i.cantidad)}x <span class="text-white">${i.producto_nombre}</span>
                               ${i.parent_detalle_id ? `<span class="badge-combo-link-sm"><i class="fas fa-link"></i> COMBO</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-2">
                        <button class="kds-action-btn ${group.status === 'pending' ? 'btn-prepare' : 'btn-dispatch'} py-2"
                                style="font-size: 0.9rem;"
                                onclick="window.updateGrupoEstado('${group.id}', '${group.status === 'pending' ? 'cocinando' : 'listo'}')">
                            ${group.status === 'pending' ? `<i class="fas ${config.prepareIcon}"></i> ${config.prepareText}` : `<i class="fas ${config.dispatchIcon}"></i> ${config.dispatchText}`}
                        </button>
                    </div>
                `;

            if (!card) {
                card = document.createElement('div');
                card.id = divId;
                card.className = `kds-card mb-3 slide-in-top`;
                card.innerHTML = cardHTML;
                element.appendChild(card);
            } else {
                if (card.innerHTML.replace(/\s/g, '') !== cardHTML.replace(/\s/g, '')) {
                    card.innerHTML = cardHTML;
                }
            }
        });
        
        Array.from(element.children).forEach(c => {
            if (c.id && !existingIds.has(c.id)) c.remove();
        });
    };

    renderList(todoGroups, listTodo);
    renderList(doingGroups, listDoing);
}

function actualizarStats(stats) {
    const totalEl = document.getElementById('stats-total');
    const cookingEl = document.getElementById('stats-cooking');
    if (totalEl) totalEl.innerText = stats.total;
    if (cookingEl) cookingEl.innerText = stats.cooking;
}

function actualizarRelojes() {
    const now = Date.now();
    document.querySelectorAll('.kds-timer').forEach(el => {
        const start = parseInt(el.dataset.start);
        const diff = Math.floor((now - start) / 60000);
        el.innerHTML = `<i class="fas fa-stopwatch"></i> ${diff} min`;

        el.classList.remove('is-danger', 'is-warn');
        if (diff >= 15) {
            el.classList.add('is-danger');
        } else if (diff >= 8) {
            el.classList.add('is-warn');
        }
    });
}

window.updateGrupoEstado = async (compositeId, nuevoEstado) => {
    try {
        // Encontrar los items que pertenecen a este grupo compuesto (ya sea por mesa o comanda)
        const itemsToUpdate = pendingItems.filter(item => {
            const key = unifyByTable ? `mesa-${item.mesa_numero}` : `comanda-${item.comanda_id}`;
            return key === compositeId;
        });

        if (itemsToUpdate.length === 0) return;

        const idsToUpdate = [];
        itemsToUpdate.forEach(item => {
            if (item.relatedIds) {
                idsToUpdate.push(...item.relatedIds);
            } else {
                idsToUpdate.push(item.detalle_id);
            }
        });

        const promises = idsToUpdate.map(id => 
            sendData(`/api/comandas/detalle/${id}/estado`, { estado: nuevoEstado }, 'PUT')
        );

        await Promise.all(promises);
        
        if (nuevoEstado === 'listo') {
           const mesa = itemsToUpdate[0].mesa_numero;
           mostrarNotificacion(`Mesa #${mesa} despachada`, 'success');
        }

        await cargarPendientes(true);
    } catch (error) {
        console.error("Error updating group status:", error);
        mostrarNotificacion("Error al actualizar estado", "error");
    }
};
