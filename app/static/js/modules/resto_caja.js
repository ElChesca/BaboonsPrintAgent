// app/static/js/modules/resto_caja.js
import { appState, formatCurrency } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let intervalocaja = null;
let historialReciente = [];

/**
 * 🚀 Monitor de Caja (Desktop Full-Mode)
 */
export function inicializarRestoCaja() {
    console.log("🖥️ Monitor de Caja Desktop inicializado");
    
    // Configurar Navegación interna
    configurarNavbarInterna();
    
    // Carga inicial
    cargarCobrosPendientes();
    
    // Polling de refresco (12s)
    if (intervalocaja) clearInterval(intervalocaja);
    intervalocaja = setInterval(() => {
        if (window.location.hash.includes('resto_caja')) {
            cargarCobrosPendientes(true);
        } else {
            clearInterval(intervalocaja);
        }
    }, 12000);
}

function configurarNavbarInterna() {
    const userDisplay = document.getElementById('caja-user-display');
    const userStr = localStorage.getItem('user');
    if (userDisplay && userStr) {
        const user = JSON.parse(userStr);
        userDisplay.textContent = user.nombre || 'Cajero';
    }

    // Botón Volver (admins y adicionistas)
    const btnVolver = document.getElementById('btn-caja-volver');
    if (btnVolver) {
        const rolesConVolver = ['admin', 'superadmin', 'adicionista', 'cajero'];
        if (rolesConVolver.includes((appState.userRol || '').toLowerCase())) {
            btnVolver.style.display = 'flex';
            btnVolver.onclick = () => window.location.hash = 'home_resto';
        }
    }

    // Botón Logout
    const btnLogout = document.getElementById('btn-caja-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (window.logout) window.logout();
            else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.reload();
            }
        };
    }
}

async function cargarCobrosPendientes(silent = false) {
    if (!appState.negocioActivoId) return;
    
    try {
        const comandas = await fetchData(`/api/negocios/${appState.negocioActivoId}/comandas/pendientes-cobro`);
        actualizarUICaja(comandas || []);
    } catch (error) {
        console.error("Error cargando monitoreo de caja:", error);
        if (!silent) mostrarNotificacion("Error al actualizar monitor", "error");
    }
}

function actualizarUICaja(comandas) {
    const grid = document.getElementById('caja-pendientes-grid');
    const emptyState = document.getElementById('caja-list-empty');
    const countDisplay = document.getElementById('caja-count-pendientes');

    if (countDisplay) countDisplay.textContent = comandas.length;

    if (comandas.length === 0) {
        if (grid) grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (grid) {
            grid.style.display = 'grid';
            renderizarCobros(comandas);
        }
    }
}

function renderizarCobros(comandas) {
    const grid = document.getElementById('caja-pendientes-grid');
    grid.innerHTML = comandas.map(cmd => `
        <div class="cobro-card animate__animated animate__fadeInUp">
            <div class="cc-header">
                <div>
                    <div class="cc-mesa">Mesa ${cmd.mesa_numero}</div>
                    <div class="cc-mozo">
                        <i class="fas fa-user-tie"></i> ${cmd.mozo_nombre || 'S/D'}
                    </div>
                </div>
                <div class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-size: 0.7rem;">
                    ${cmd.zona_nombre || 'Salón'}
                </div>
            </div>
            
            <div class="cc-ticket-sim">
                <div class="cc-row">
                    <span>Monto Comanda</span>
                    <span>${formatCurrency(cmd.total)}</span>
                </div>
                <div class="cc-row">
                    <span>Items pedidos</span>
                    <span>${cmd.items_count || '-'}</span>
                </div>
                <div class="cc-row total">
                    <span>TOTAL A COBRAR</span>
                    <span>${formatCurrency(cmd.total)}</span>
                </div>
            </div>

            <button class="btn-cobrar-now" onclick="procesarCobroCaja('${cmd.id}', ${cmd.total}, ${cmd.mesa_numero})">
                FINALIZAR COBRO <i class="fas fa-chevron-right ms-2"></i>
            </button>
        </div>
    `).join('');
}

window.procesarCobroCaja = async function(comandaId, total, mesaNum) {
    // Importamos la lógica de pago centralizada para mantener consistencia
    try {
        const { setupPaymentLogic } = await import('./resto_mozo.js');
        
        setupPaymentLogic(comandaId, total, mesaNum, async (successData) => {
            if (successData) {
                // Registrar en historial local de la sesión del monitor
                historialReciente.unshift({
                    mesa: mesaNum,
                    total: total,
                    fecha: new Date().toLocaleTimeString(),
                    id: comandaId
                });
                
                if (historialReciente.length > 10) historialReciente.pop();
                actualizarPanelHistorial();
                
                // Refrescar el monitor
                cargarCobrosPendientes(true);
            }
        });
    } catch (err) {
        console.error("Error al cargar lógica de cobro:", err);
        mostrarNotificacion("Error al iniciar módulo de pago", "error");
    }
};

function actualizarPanelHistorial() {
    const panel = document.getElementById('caja-historial-reciente');
    if (!panel) return;

    if (historialReciente.length === 0) {
        panel.innerHTML = '<p class="text-muted text-center small py-3">Sin cierres recientes</p>';
        return;
    }

    panel.innerHTML = historialReciente.map(v => `
        <div class="hist-item animate__animated animate__fadeInLeft">
            <div class="hi-top">
                <span>Mesa ${v.mesa}</span>
                <span class="text-success">${formatCurrency(v.total)}</span>
            </div>
            <div class="hi-bottom">
                Finalizado: ${v.fecha}
            </div>
        </div>
    `).join('');
}
