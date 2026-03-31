// app/static/js/modules/resto_cocina.js
import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

let pendingItems = [];
let kdsInterval = null;
let estacionActual = 'cocina';

export async function inicializarRestoCocina() {
    console.log("🔥 Monitor de Producción KDS Inicializado...");

    // Display cocinero name
    const user = getCurrentUser();
    if (user && user.nombre) {
        const nameEl = document.getElementById('kds-user-name');
        if (nameEl) nameEl.innerText = `👨‍🍳 ${user.nombre}`;
    }

    // Initial Load
    await cargarPendientes();

    // Loop
    startKDSPolling();
}

export function cambiarEstacion(nueva) {
    estacionActual = nueva;

    // Update UI active state
    document.querySelectorAll('.kds-station-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-station-${nueva}`);
    if (btn) btn.classList.add('active');

    cargarPendientes();
}
window.cambiarEstacion = cambiarEstacion;

function startKDSPolling() {
    if (kdsInterval) clearInterval(kdsInterval);

    kdsInterval = setInterval(() => {
        if (window.location.hash === '#resto_cocina') {
            cargarPendientes(true);
        } else {
            clearInterval(kdsInterval);
            kdsInterval = null;
        }
    }, 10000); // 10s refresh

    // Register active timers for cards
    setInterval(() => {
        if (window.location.hash === '#resto_cocina') {
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

    // Group items by comanda_id
    const groups = {};
    pendingItems.forEach(item => {
        if (!groups[item.comanda_id]) {
            groups[item.comanda_id] = {
                id: item.comanda_id,
                mesa: item.mesa_numero,
                pax: item.num_comensales,
                openedAt: new Date(item.pedido_fecha).getTime(),
                mozo: item.mozo_nombre || 'Mozo',
                items: [],
                status: 'pending'
            };
        }
        groups[item.comanda_id].items.push(item);
        
        if (item.detalle_estado === 'cocinando') {
            groups[item.comanda_id].status = 'cooking';
        }
    });

    const sortedGroups = Object.values(groups)
        .filter(g => g.items.some(i => i.detalle_estado !== 'listo'))
        .sort((a, b) => a.openedAt - b.openedAt);

    // 🔄 RECONCILIACIÓN (SMOOTH REFRESH)
    const existingIds = new Set();
    const now = Date.now();

    // Eliminar el mensaje de "Todo al día" si existe
    if (container.querySelector('.kds-empty')) container.innerHTML = '';

    sortedGroups.forEach(group => {
        existingIds.add(`comanda-${group.id}`);
        let card = document.getElementById(`comanda-${group.id}`);
        
        const diffMin = Math.floor((now - group.openedAt) / 60000);
        let prioClass = (diffMin >= 15) ? 'prio-high' : (diffMin >= 8 ? 'prio-medium' : 'prio-low');
        const isCooking = group.status === 'cooking';
        const isBar = estacionActual === 'bar';

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
                        <div class="kds-item-left">
                            <div class="kds-item-qty">${Math.round(item.cantidad)}</div>
                            <div class="kds-item-info">
                                <span class="kds-item-name">${item.producto_nombre}</span>
                                ${item.pedido_observaciones ? `<span class="kds-item-note"><i class="fas fa-exclamation-circle"></i> ${item.pedido_observaciones}</span>` : ''}
                            </div>
                        </div>
                        <span class="kds-item-status"><i class="fas ${item.detalle_estado === 'cocinando' ? 'fa-spinner fa-spin' : (item.detalle_estado === 'listo' ? 'fa-check' : 'fa-clock')}"></i></span>
                    </div>
                `).join('')}
            </div>
            <div class="kds-card-actions">
                ${!isCooking ? `
                    <button class="kds-action-btn btn-prepare" onclick="window.updateComandaEstado(${group.id}, 'cocinando')">
                        <i class="fas ${isBar ? 'fa-wine-glass-alt' : 'fa-fire'}"></i> ${isBar ? 'PREPARAR' : 'PREPARAR TODO'}
                    </button>
                ` : `
                    <button class="kds-action-btn btn-dispatch" onclick="window.updateComandaEstado(${group.id}, 'listo')">
                        <i class="fas ${isBar ? 'fa-concierge-bell' : 'fa-check-double'}"></i> ${isBar ? 'SERVIR' : 'DESPACHAR'}
                    </button>
                `}
            </div>
        `;

        if (!card) {
            // Nueva comanda: Crear elemento
            card = document.createElement('div');
            card.id = `comanda-${group.id}`;
            card.className = `kds-card ${prioClass} ${isCooking ? 'is-cooking' : ''} slide-in-top`;
            card.innerHTML = cardContentHTML;
            container.appendChild(card);
        } else {
            // Actualizar solo si cambió el contenido relevante (o forzar actualización suave)
            const targetPrio = `kds-card ${prioClass} ${isCooking ? 'is-cooking' : ''}`;
            if (card.className !== targetPrio) card.className = targetPrio;
            
            // Reconciliación interna de items y botones
            const head = card.querySelector('.kds-card-head');
            if (head) {
                const mesaBadge = head.querySelector('.kds-mesa-badge');
                if (mesaBadge) mesaBadge.innerHTML = `<i class="fas fa-hashtag"></i> MESA ${group.mesa}`;
            }
            
            const itemsCont = card.querySelector('.kds-card-items');
            const newItemsHTML = group.items.map(item => `
                <div class="kds-item ${item.detalle_estado === 'cocinando' ? 'is-cooking' : ''} ${item.detalle_estado === 'listo' ? 'is-done' : ''}">
                    <div class="kds-item-left">
                        <div class="kds-item-qty">${Math.round(item.cantidad)}</div>
                        <div class="kds-item-info">
                            <span class="kds-item-name">${item.producto_nombre}</span>
                            ${item.pedido_observaciones ? `<span class="kds-item-note"><i class="fas fa-exclamation-circle"></i> ${item.pedido_observaciones}</span>` : ''}
                        </div>
                    </div>
                    <span class="kds-item-status"><i class="fas ${item.detalle_estado === 'cocinando' ? 'fa-spinner fa-spin' : (item.detalle_estado === 'listo' ? 'fa-check' : 'fa-clock')}"></i></span>
                </div>
            `).join('');

            if (itemsCont && itemsCont.innerHTML.replace(/\s/g, '') !== newItemsHTML.replace(/\s/g, '')) {
                itemsCont.innerHTML = newItemsHTML;
            }

            const actionsCont = card.querySelector('.kds-card-actions');
            const newActionsHTML = !isCooking ? `
                <button class="kds-action-btn btn-prepare" onclick="window.updateComandaEstado(${group.id}, 'cocinando')">
                    <i class="fas ${isBar ? 'fa-wine-glass-alt' : 'fa-fire'}"></i> ${isBar ? 'PREPARAR' : 'PREPARAR TODO'}
                </button>
            ` : `
                <button class="kds-action-btn btn-dispatch" onclick="window.updateComandaEstado(${group.id}, 'listo')">
                    <i class="fas ${isBar ? 'fa-concierge-bell' : 'fa-check-double'}"></i> ${isBar ? 'SERVIR' : 'DESPACHAR'}
                </button>
            `;

            if (actionsCont && actionsCont.innerHTML.replace(/\s/g, '') !== newActionsHTML.replace(/\s/g, '')) {
                actionsCont.innerHTML = newActionsHTML;
            }
        }
    });

    // Eliminar comandas que ya no existen
    Array.from(container.children).forEach(child => {
        if (child.id && child.id.startsWith('comanda-') && !existingIds.has(child.id)) {
            child.remove();
        }
    });

    actualizarStats({
        total: sortedGroups.length,
        cooking: sortedGroups.filter(g => g.status === 'cooking').length
    });
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

window.updateComandaEstado = async (comandaId, nuevoEstado) => {
    try {
        const items = pendingItems.filter(i => i.comanda_id === comandaId);
        if (items.length === 0) return;

        const promises = items.map(item => 
            sendData(`/api/comandas/detalle/${item.detalle_id}/estado`, { estado: nuevoEstado }, 'PUT')
        );

        await Promise.all(promises);

        if (nuevoEstado === 'listo') {
            mostrarNotificacion(`Mesa #${items[0].mesa_numero} despachada`, 'success');
        }

        await cargarPendientes(true);
    } catch (error) {
        console.error("Error updating KDS status:", error);
        mostrarNotificacion("Error al actualizar estado", "error");
    }
};
