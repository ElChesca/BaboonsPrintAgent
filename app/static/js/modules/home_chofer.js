import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';
import { mostrarNotificacion } from './notifications.js';

export function inicializarHomeChofer() {
    console.log("Inicializando App Chofer...");
    cargarLeafletJS(); // Precargar mapa
    cargarRutasChofer();

    document.getElementById('btn-volver-rutas').addEventListener('click', () => {
        document.getElementById('chofer-ruta-detalle').style.display = 'none';
        document.getElementById('chofer-rutas-list').style.display = 'block';
        cargarRutasChofer(); // Recargar listado por si hubo cambios
    });
}

// Variables para el mapa del chofer
let mapChofer = null;
let markersChofer = [];
let routeLineChofer = null;

// Variables para el tracking GPS
let isUnifiedMode = false;
let unifiedItems = [];

async function cargarLeafletJS() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function cargarRutasChofer() {
    const listContainer = document.getElementById('chofer-rutas-container');
    const loading = document.getElementById('chofer-loading-rutas');

    listContainer.innerHTML = '';
    loading.style.display = 'block';

    try {
        const rutas = await fetchData('/api/chofer/mis_rutas');
        loading.style.display = 'none';

        if (!rutas || rutas.length === 0) {
            listContainer.innerHTML = `
                <div class="alert alert-warning text-center">
                    <i class="fas fa-info-circle mb-2 fa-2x"></i><br>
                    No tienes hojas de ruta activas asignadas para hoy.
                </div>
            `;
            return;
        }

        // Si hay más de una ruta, mostrar botón de Rekorrido Unificado
        if (rutas.length > 1) {
            const unifiedBtn = document.createElement('div');
            unifiedBtn.className = 'card ruta-card p-3 mb-4 border-2 border-warning shadow-sm';
            unifiedBtn.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="bg-warning text-dark p-3 rounded-circle me-3">
                        <i class="fas fa-layer-group fa-2x"></i>
                    </div>
                    <div>
                        <h5 class="mb-0 fw-bold">Recorrido Unificado</h5>
                        <p class="mb-0 text-muted small">Ver todas las paradas de hoy (${rutas.length} rutas)</p>
                    </div>
                </div>
            `;
            unifiedBtn.onclick = () => abrirRecorridoUnificado(rutas);
            listContainer.appendChild(unifiedBtn);
        }

        rutas.forEach(ruta => {
            const card = document.createElement('div');
            card.className = 'card ruta-card p-3 mb-3';

            let badgeClass = ruta.estado === 'activa' ? 'bg-success' : (ruta.estado === 'borrador' ? 'bg-secondary' : 'bg-dark');
            let estadoTxt = ruta.estado.toUpperCase();

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0 fw-bold">HR #${ruta.id}</h5>
                    <span class="badge ${badgeClass}">${estadoTxt}</span>
                </div>
                <div class="text-muted small mb-2">
                    <i class="far fa-calendar-alt me-1"></i> ${ruta.fecha} <br>
                    <i class="fas fa-user-tie me-1"></i> Vendedor: ${ruta.vendedor_nombre || 'N/A'} <br>
                    <i class="fas fa-truck-moving me-1"></i> Vehículo: ${ruta.vehiculo_asignado || 'N/A'} (${ruta.vehiculo_patente || '-'})
                </div>
                <div class="d-flex justify-content-between mt-3 px-2 py-2 bg-light rounded shadow-sm">
                    <div class="text-center">
                        <div class="small text-muted mb-1">Carga</div>
                        <div class="fw-bold"><i class="fas fa-weight-hanging text-secondary"></i> ${ruta.peso_kg.toFixed(0)}kg</div>
                    </div>
                    <div class="text-center border-start ps-3">
                        <div class="small text-muted mb-1">Volumen</div>
                        <div class="fw-bold"><i class="fas fa-box-open text-secondary"></i> ${ruta.volumen_m3.toFixed(2)}m³</div>
                    </div>
                    <div class="text-center border-start ps-3">
                        <div class="small text-muted mb-1">Stops</div>
                        <div class="fw-bold"><i class="fas fa-map-marker-alt text-danger"></i> ${ruta.cantidad_pedidos || 0}</div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => abrirDetalleRuta(ruta.id, ruta.fecha));
            listContainer.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        loading.style.display = 'none';
        listContainer.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

async function abrirRecorridoUnificado(rutas) {
    isUnifiedMode = true;
    document.getElementById('chofer-rutas-list').style.display = 'none';
    const detalleView = document.getElementById('chofer-ruta-detalle');
    detalleView.style.display = 'block';

    document.getElementById('chofer-ruta-titulo').innerHTML = `<i class="fas fa-layer-group me-1"></i> Recorrido Unificado`;

    const container = document.getElementById('chofer-paradas-list');
    container.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin fa-2x text-muted"></i></div>';

    try {
        const data = await fetchData('/api/chofer/recorrido_unificado');
        unifiedItems = data.items;

        // Intentar organizar por cercanía si tenemos ubicación actual
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                unifiedItems = reordenarPorCercania(unifiedItems, latitude, longitude);
                actualizarVistaUnificada();
            }, () => {
                actualizarVistaUnificada();
            });
        } else {
            actualizarVistaUnificada();
        }

        // Iniciar tracking con el primer vehículo que encontremos
        const vehiculoId = rutas.find(r => r.vehiculo_id)?.vehiculo_id;
        if (vehiculoId) iniciarTrackingUbicacion(vehiculoId);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function actualizarVistaUnificada() {
    renderParadas(null, unifiedItems);
    dibujarMapaChofer(unifiedItems);
}

function reordenarPorCercania(items, myLat, myLng) {
    const visitados = items.filter(i => i.visitado);
    const pendientes = items.filter(i => !i.visitado);

    // Algoritmo de Vecino Más Cercano (Greedy) para pendientes
    const sortedPendientes = [];
    let currentPos = { lat: myLat, lng: myLng };

    while (pendientes.length > 0) {
        let nearestIdx = -1;
        let minDist = Infinity;

        pendientes.forEach((p, idx) => {
            if (!p.latitud || !p.longitud) {
                // Si no hay coords, lo mandamos al final
                if (nearestIdx === -1 && minDist === Infinity) nearestIdx = idx;
                return;
            }
            const d = Math.sqrt(Math.pow(p.latitud - currentPos.lat, 2) + Math.pow(p.longitud - currentPos.lng, 2));
            if (d < minDist) {
                minDist = d;
                nearestIdx = idx;
            }
        });

        const nearest = pendientes.splice(nearestIdx, 1)[0];
        sortedPendientes.push(nearest);
        if (nearest.latitud && nearest.longitud) {
            currentPos = { lat: nearest.latitud, lng: nearest.longitud };
        }
    }

    return [...visitados, ...sortedPendientes];
}

async function abrirDetalleRuta(hrId, fecha) {
    isUnifiedMode = false;
    document.getElementById('chofer-rutas-list').style.display = 'none';
    const detalleView = document.getElementById('chofer-ruta-detalle');
    detalleView.style.display = 'block';

    document.getElementById('chofer-ruta-titulo').innerHTML = `<i class="fas fa-route me-1"></i> HR #${hrId} - ${fecha}`;

    const container = document.getElementById('chofer-paradas-list');
    container.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin fa-2x text-muted"></i></div>';

    try {
        const rutaData = await fetchData(`/api/chofer/hoja_ruta/${hrId}`);
        renderParadas(hrId, rutaData.items);
        dibujarMapaChofer(rutaData.items);

        // Iniciar tracking si la ruta está activa o en borrador (si tiene vehículo)
        if (rutaData.vehiculo_id || appState.currentRutaVehiculoId) {
            iniciarTrackingUbicacion(rutaData.vehiculo_id || appState.currentRutaVehiculoId);
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="alert alert-danger">Error al cargar ruta: ${e.message}</div>`;
    }
}

function iniciarTrackingUbicacion(vehiculoId) {
    if (!vehiculoId || trackingInterval) return;

    currentVehiculoId = vehiculoId;
    console.log(`📡 Iniciando tracking para vehículo ID: ${vehiculoId}`);

    // Primer reporte inmediato
    reportarUbicacion();

    // Reportar cada 45 segundos
    trackingInterval = setInterval(reportarUbicacion, 45000);
}

function detenerTrackingUbicacion() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        console.log("🛑 Tracking detenido.");
    }
}

async function reportarUbicacion() {
    if (!currentVehiculoId) return;

    if (!navigator.geolocation) {
        console.warn("Geolocation no soportada");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
            await sendData(`/api/vehiculos/${currentVehiculoId}/ubicacion`, {
                latitud: latitude,
                longitud: longitude
            }, 'POST');
            console.log(`📍 Ubicación reportada: ${latitude}, ${longitude}`);
        } catch (e) {
            console.error("Error reportando ubicación:", e);
        }
    }, (error) => {
        console.error("Error obteniendo ubicación:", error);
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
}

function inicializarMapaChofer() {
    const mapDiv = document.getElementById('map-chofer-ruta');
    if (!mapDiv) return null;

    if (mapChofer) {
        if (!document.body.contains(mapChofer.getContainer())) {
            try { mapChofer.remove(); } catch (e) { }
            mapChofer = null;
        }
    }

    if (!mapChofer && window.L) {
        mapChofer = L.map('map-chofer-ruta').setView([-33.3017, -66.3378], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapChofer);
    }

    if (mapChofer) {
        setTimeout(() => mapChofer.invalidateSize(), 300);
    }
    return mapChofer;
}

function dibujarMapaChofer(items) {
    if (!inicializarMapaChofer()) return;

    // Limpiar capas anteriores
    markersChofer.forEach(m => mapChofer.removeLayer(m));
    markersChofer = [];
    if (routeLineChofer) {
        mapChofer.removeLayer(routeLineChofer);
        routeLineChofer = null;
    }

    const puntos = [];
    const bounds = L.latLngBounds();

    items.forEach((item, index) => {
        if (item.latitud && item.longitud) {
            const lat = parseFloat(item.latitud);
            const lng = parseFloat(item.longitud);
            puntos.push([lat, lng]);

            const color = item.visitado ? '#28a745' : '#007bff';
            const markerHtml = `
                <div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                    <span style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 14px;">${index + 1}</span>
                </div>
            `;
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: markerHtml,
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            });

            const dir = item.cliente_direccion ? item.cliente_direccion : 'Sin dirección';
            const telefono = item.cliente_telefono ? `<br><i class="fas fa-phone fa-fw text-success"></i> ${item.cliente_telefono}` : '';
            const zona = item.cliente_zona ? `<br><i class="fas fa-map text-info fa-fw"></i> Zona: ${item.cliente_zona}` : '';

            const popupHtml = `
                <div class="text-left" style="min-width: 140px;">
                    <b class="d-block mb-1 border-bottom pb-1">${index + 1}. ${item.cliente_nombre}</b>
                    <small class="text-muted d-block">
                        <i class="fas fa-map-marker-alt text-danger fa-fw"></i> ${dir}
                        ${telefono}
                        ${zona}
                    </small>
                </div>
            `;
            const marker = L.marker([lat, lng], { icon }).bindPopup(popupHtml);
            marker.addTo(mapChofer);
            markersChofer.push(marker);
            bounds.extend([lat, lng]);
        }
    });

    if (puntos.length > 1) {
        routeLineChofer = L.polyline(puntos, {
            color: '#0d6efd',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(mapChofer);
    }

    if (puntos.length > 0) {
        mapChofer.fitBounds(bounds, { padding: [30, 30] });
    }
}

function renderParadas(hrId, items) {
    const container = document.getElementById('chofer-paradas-list');
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="alert alert-warning text-center">La ruta no tiene paradas.</div>`;
        return;
    }

    items.forEach((item, index) => {
        const isVisitado = item.visitado;
        const pedido = item.pedido;

        let headerColor = isVisitado ? 'bg-success' : 'bg-primary';
        let pedidoStatus = '';
        if (pedido) {
            pedidoStatus = pedido.estado === 'entregado' ?
                '<span class="badge bg-success float-end mt-1"><i class="fas fa-check"></i> Pagado/Entregado</span>' :
                '';
        }

        // Armar HTML de productos
        let productosHTML = '';
        if (pedido && pedido.productos && pedido.productos.length > 0) {
            let lis = pedido.productos.map(p => `
                <li>
                    <span>${p.nombre}</span>
                    <span class="cant-badge">${p.cantidad}</span>
                </li>
            `).join('');

            productosHTML = `
                <div class="picking-box">
                    <div class="small fw-bold text-muted mb-2"><i class="fas fa-dolly"></i> Bajar en este cliente:</div>
                    <ul>${lis}</ul>
                </div>
            `;
        } else {
            productosHTML = `<div class="text-muted small mt-2 fst-italic"><i class="fas fa-info-circle"></i> No hay productos cargados en pedidos para este cliente. (Puede ser solo visita).</div>`;
        }

        const card = document.createElement('div');
        card.className = `card parada-card ${isVisitado ? 'visitado' : ''}`;

        card.innerHTML = `
            <div class="card-header bg-white border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
                <span class="badge ${headerColor} fs-6 rounded-circle" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                    ${index + 1}
                </span>
                ${pedidoStatus}
            </div>
            <div class="card-body pt-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5 class="card-title fw-bold mb-1">${item.cliente_nombre}</h5>
                        <h6 class="card-subtitle mb-2 text-muted small"><i class="fas fa-map-marker-alt"></i> ${item.cliente_direccion || 'Sin dirección'}</h6>
                    </div>
                    ${item.vendedor_nombre ? `<span class="badge bg-light text-dark border p-1" style="font-size: 0.7em;"><i class="fas fa-user-tag me-1"></i>${item.vendedor_nombre}</span>` : ''}
                </div>
                
                ${productosHTML}
                
                <div class="mt-4 pt-3 border-top text-center">
                    ${!isVisitado ? `
                        <button class="btn btn-warning w-100 fw-bold btn-lg shadow-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, true, this)">
                            <i class="fas fa-clipboard-check me-1"></i> Confirmar Bajada
                        </button>
                    ` : `
                        <button class="btn btn-outline-success w-100 fw-bold" disabled>
                            <i class="fas fa-check-circle me-1"></i> Bajada Confirmada
                        </button>
                        <button class="btn btn-link text-danger w-100 mt-2 btn-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, false, this)">
                            Deshacer visita
                        </button>
                    `}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Hacemos global la función para que el onclick del HTML la encuentre
window.marcarVisitaChofer = async function (hrId, itemId, estado, btn) {
    if (!confirm(estado ? "¿Confirmar que se bajó la mercadería en esta parada?" : "¿Deshacer la visita?")) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;

    try {
        await sendData(`/api/hoja_ruta/${hrId}/item/${itemId}`, { visitado: estado, observaciones: '' }, 'PUT');

        // Recargar paradas y mapa silenciosamente
        if (isUnifiedMode) {
            const data = await fetchData('/api/chofer/recorrido_unificado');
            unifiedItems = data.items;
            // Mantener el orden actual si es posible o simplemente refrescar
            actualizarVistaUnificada();
        } else {
            const rutaData = await fetchData(`/api/chofer/hoja_ruta/${hrId}`);
            renderParadas(hrId, rutaData.items);
            dibujarMapaChofer(rutaData.items);
        }

    } catch (e) {
        alert("Error al actualizar estado: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
