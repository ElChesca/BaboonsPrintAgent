/* app/static/js/modules/resto_stats.js */
// Usamos las funciones globales de main.js para evitar errores de exportación modular
export async function inicializarRestoStats() {
    console.log("📊 Inicializando Dashboard de Estadísticas Restó...");
    
    // appState y fetchData están disponibles globalmente desde main.js
    if (typeof window.appState === 'undefined' || !window.appState.negocioActivoId) {
        console.warn("Falta appState o negocioActivoId para cargar estadísticas.");
        return;
    }

    try {
        const data = await window.fetchData(`/api/negocios/${window.appState.negocioActivoId}/stats`);
        
        renderResumen(data.resumen);
        renderRanking(data.ranking_staff);
        renderTopProductos(data.top_productos);
        renderMesasKPI(data.mesas_estado, data.pax_hoy, data.tiempo_promedio_min);
        
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        if (window.mostrarNotificacion) {
            window.mostrarNotificacion("No se pudieron cargar las estadísticas reales.", "error");
        }
    }
}

function renderResumen(resumen) {
    const montoEl = document.getElementById('stat-ventas-monto');
    const countEl = document.getElementById('stat-ventas-count');
    
    if (montoEl && window.formatCurrency) montoEl.innerText = window.formatCurrency(resumen.monto_total || 0);
    if (countEl) countEl.innerText = `${resumen.total_ventas || 0} tickets emitidos hoy`;
}

function renderMesasKPI(mesas, paxHoy, tiempoPromedio) {
    const libresEl = document.getElementById('stat-mesas-libres');
    const ocupadasEl = document.getElementById('stat-mesas-ocupadas');
    const paxEl = document.getElementById('stat-pax-count');
    const tiempoEl = document.getElementById('stat-tiempo-promedio');

    if (libresEl) libresEl.innerText = mesas.libre || 0;
    
    const ocupadasCount = (mesas.ocupada || 0) + (mesas.cuenta || 0) + (mesas.en_cobro || 0);
    if (ocupadasEl) ocupadasEl.innerText = ocupadasCount;
    
    if (paxEl) paxEl.innerText = paxHoy || 0;
    if (tiempoEl) tiempoEl.innerText = `${tiempoPromedio || 0} min`;
}

function renderRanking(ranking) {
    const container = document.getElementById('ranking-staff-list');
    if (!container) return;
    
    if (!ranking || ranking.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">Sin ventas registradas hoy</td></tr>`;
        return;
    }

    container.innerHTML = ranking.map(r => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-sm me-2 bg-light rounded-circle d-flex align-items-center justify-content-center" style="width:30px; height:30px;">
                        <i class="fas fa-user text-primary"></i>
                    </div>
                    <span>${r.nombre}</span>
                </div>
            </td>
            <td class="text-end fw-bold">${window.formatCurrency ? window.formatCurrency(r.total_vendido) : r.total_vendido}</td>
        </tr>
    `).join('');
}

function renderTopProductos(productos) {
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (!productos || productos.length === 0) {
        container.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">No hay platos servidos hoy</td></tr>`;
        return;
    }

    container.innerHTML = productos.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td class="text-end">
                <span class="badge bg-soft-info text-info me-2">${p.total_cantidad}</span>
            </td>
        </tr>
    `).join('');
}

// Mantener exposición global para el sistema de carga de main.js
window.inicializarRestoStats = inicializarRestoStats;
