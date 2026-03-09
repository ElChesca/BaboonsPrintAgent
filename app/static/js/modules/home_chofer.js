import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';
import { mostrarNotificacion } from './notifications.js';

let todasLasRutas = [];

// Variables para el mapa del chofer
let mapChofer = null;
let markersChofer = [];
let routeLineChofer = null;

// Variables para el tracking GPS
let isUnifiedMode = false;
let unifiedItems = [];
let selectedHrIds = []; // IDs de HRs seleccionadas en modo unificado
let trackingInterval = null;
let currentVehiculoId = null;
let motivosReboteCache = []; // Caché de motivos de rebote
let currentEntregaItems = []; // Items actuales en el modal de entrega

export function inicializarHomeChofer() {
    console.log("Inicializando App Chofer...");
    cargarLeafletJS(); // Precargar mapa
    cargarRutasChofer();
    cargarMotivosRebote();

    document.getElementById('btn-volver-rutas').addEventListener('click', () => {
        document.getElementById('chofer-ruta-detalle').style.display = 'none';
        document.getElementById('chofer-rutas-list').style.display = 'block';
        cargarRutasChofer(); // Recargar listado por si hubo cambios
    });

    const filterEl = document.getElementById('filtro-rutas-pedidos');
    if (filterEl) {
        filterEl.addEventListener('change', (e) => {
            aplicarFiltroRutas(e.target.value);
        });
    }
}

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
        todasLasRutas = await fetchData('/api/chofer/mis_rutas');
        loading.style.display = 'none';

        const filterVal = document.getElementById('filtro-rutas-pedidos')?.value || 'todas';
        aplicarFiltroRutas(filterVal);

    } catch (e) {
        console.error(e);
        loading.style.display = 'none';
        listContainer.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function aplicarFiltroRutas(filtro) {
    let rutasFiltradas = todasLasRutas;
    if (filtro === 'con_pedidos') {
        rutasFiltradas = todasLasRutas.filter(r => (r.cantidad_pedidos || 0) > 0);
    }
    renderRutasList(rutasFiltradas);
}

function renderRutasList(rutas) {
    const listContainer = document.getElementById('chofer-rutas-container');
    listContainer.innerHTML = '';

    if (!rutas || rutas.length === 0) {
        listContainer.innerHTML = `
            <div class="alert alert-warning text-center">
                <i class="fas fa-info-circle mb-2 fa-2x"></i><br>
                No hay hojas de ruta que coincidan con el filtro.
            </div>
        `;
        return;
    }

    // Si hay más de una ruta, mostrar botón de Recorrido Unificado
    if (rutas.length > 1) {
        const unifiedBtn = document.createElement('div');
        unifiedBtn.className = 'card ruta-card p-3 mb-4 border-2 border-warning shadow-sm cursor-pointer';
        unifiedBtn.style.cursor = 'pointer';
        unifiedBtn.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="bg-warning text-dark p-3 rounded-circle me-3">
                    <i class="fas fa-layer-group fa-2x"></i>
                </div>
                <div>
                    <h5 class="mb-0 fw-bold">Recorrido Unificado</h5>
                    <p class="mb-0 text-muted small">Seleccionar y unificar rutas (${rutas.length} disponibles)</p>
                </div>
                <div class="ms-auto">
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>
            </div>
        `;
        unifiedBtn.onclick = () => mostrarModalSeleccionRutas(rutas);
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
}

async function cargarMotivosRebote(negocioId = null) {
    // Si ya tenemos motivos y el negocioId coincide (o no se pasó), no recargar
    if (motivosReboteCache.length > 0 && (!negocioId || motivosReboteCache[0]?.negocio_id === parseInt(negocioId))) return;

    try {
        let finalNegocioId = negocioId;
        if (!finalNegocioId) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                finalNegocioId = user.negocio_id;
            }
        }

        if (finalNegocioId) {
            console.log("Cargando motivos de rebote para negocio:", finalNegocioId);
            const data = await fetchData(`/api/negocios/${finalNegocioId}/motivos_rebote`);
            // Guardar con el ID del negocio para validación posterior
            motivosReboteCache = data.map(m => ({ ...m, negocio_id: parseInt(finalNegocioId) }));
        }
    } catch (e) {
        console.error("Error cargando motivos de rebote", e);
    }
}

function mostrarModalSeleccionRutas(rutas) {
    // Ocultar la lista de rutas y mostrar pantalla de selección propia (sin Bootstrap Modal)
    document.getElementById('chofer-rutas-list').style.display = 'none';

    // Limpiar contenedor previo si existe
    const existente = document.getElementById('chofer-seleccion-view');
    if (existente) existente.remove();

    const seleccionView = document.createElement('div');
    seleccionView.id = 'chofer-seleccion-view';
    seleccionView.innerHTML = `
        <div class="chofer-header bg-dark text-white p-3 shadow-sm d-flex justify-content-between align-items-center"
             style="position: sticky; top: 0; z-index: 100;">
            <h5 class="mb-0 fw-bold"><i class="fas fa-layer-group me-2 text-warning"></i>Seleccionar Rutas</h5>
            <button class="btn btn-outline-light btn-sm rounded-pill" id="btn-cancelar-seleccion">
                <i class="fas fa-arrow-left me-1"></i>Volver
            </button>
        </div>
        <div class="container pb-5 pt-3">
            <p class="text-muted small mb-3">Elegí las hojas de ruta que querés unificar:</p>
            <div id="lista-rutas-seleccion">
                ${rutas.map(r => `
                    <div class="card mb-3 shadow-sm" style="border-radius:12px; cursor:pointer;"
                         onclick="this.querySelector('input').click()">
                        <div class="card-body d-flex align-items-center gap-3 py-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox"
                                   value="${r.id}" id="check-hr-${r.id}" checked
                                   style="width:1.4em;height:1.4em;" onclick="event.stopPropagation()">
                            <label class="form-check-label d-block mb-0 w-100" for="check-hr-${r.id}" style="cursor:pointer;">
                                <span class="fw-bold fs-6">HR #${r.id}</span>
                                <span class="text-muted ms-2 small">${r.fecha}</span><br>
                                <small class="text-muted">
                                    <i class="fas fa-user-tie me-1"></i>${r.vendedor_nombre || 'N/A'} &nbsp;
                                    <i class="fas fa-map-marker-alt me-1 text-danger"></i>${r.cantidad_pedidos || 0} paradas
                                </small>
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3">
                <button class="btn btn-warning fw-bold w-100 btn-lg shadow" id="btn-confirmar-unificado">
                    <i class="fas fa-layer-group me-2"></i>Unificar Seleccionadas
                </button>
            </div>
        </div>
    `;

    // Insertar la vista dentro del contenedor principal de la app chofer
    const mainEl = document.getElementById('chofer-main-content') || document.getElementById('driver-app-container');
    mainEl.parentNode.insertBefore(seleccionView, mainEl);

    // Botón volver
    document.getElementById('btn-cancelar-seleccion').addEventListener('click', () => {
        seleccionView.remove();
        document.getElementById('chofer-rutas-list').style.display = 'block';
    });

    // Botón confirmar
    document.getElementById('btn-confirmar-unificado').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#lista-rutas-seleccion input[type=checkbox]:checked');
        const idsSeleccionados = [...checkboxes].map(cb => parseInt(cb.value));

        if (idsSeleccionados.length === 0) {
            alert('Seleccioná al menos una hoja de ruta.');
            return;
        }

        seleccionView.remove();
        const rutasSeleccionadas = rutas.filter(r => idsSeleccionados.includes(r.id));
        abrirRecorridoUnificado(rutasSeleccionadas, idsSeleccionados);
    });
}


async function abrirRecorridoUnificado(rutas, hrIds) {
    isUnifiedMode = true;
    selectedHrIds = hrIds || rutas.map(r => r.id);

    document.getElementById('chofer-rutas-list').style.display = 'none';
    const detalleView = document.getElementById('chofer-ruta-detalle');
    detalleView.style.display = 'block';

    const cantRutas = rutas.length;
    document.getElementById('chofer-ruta-titulo').innerHTML = `<i class="fas fa-layer-group me-1"></i> Recorrido Unificado (${cantRutas} ruta${cantRutas > 1 ? 's' : ''})`;

    const container = document.getElementById('chofer-paradas-list');
    container.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin fa-2x text-muted"></i></div>';

    try {
        const queryStr = selectedHrIds.map(id => `hr_ids=${id}`).join('&');
        const data = await fetchData(`/api/chofer/recorrido_unificado?${queryStr}`);
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

        // Determinar qué botón mostrar: "Confirmar Entrega" (si hay pedido) o "Confirmar Bajada" (solo visita)
        const btnAccion = !isVisitado ? (
            pedido ? `
                <button class="btn btn-primary w-100 fw-bold btn-lg shadow-sm" onclick='abrirModalEntregaChofer(${hrId || item.hoja_ruta_id || 0}, ${item.hoja_ruta_item_id}, ${JSON.stringify(pedido).replace(/'/g, "&apos;")})'>
                    <i class="fas fa-hand-holding-usd me-1"></i> Confirmar Bajada
                </button>
            ` : `
                <button class="btn btn-warning w-100 fw-bold btn-lg shadow-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, true, this)">
                    <i class="fas fa-clipboard-check me-1"></i> Confirmar Bajada
                </button>
            `
        ) : `
            <button class="btn btn-outline-success w-100 fw-bold" disabled>
                <i class="fas fa-check-circle me-1"></i> ${pedido ? 'Entrega Confirmada' : 'Bajada Confirmada'}
            </button>
            <button class="btn btn-link text-danger w-100 mt-2 btn-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, false, this)">
                <i class="fas fa-undo"></i> Deshacer bajada
            </button>
        `;

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
                        <h6 class="card-subtitle mb-1 text-muted small"><i class="fas fa-map-marker-alt"></i> ${item.cliente_direccion || 'Sin dirección'}</h6>
                        ${pedido ? `<div class="badge bg-info text-white mb-2" style="font-size:0.7em;">Pedido #${pedido.pedido_id || pedido.id}</div>` : ''}
                    </div>
                </div>
                
                ${productosHTML}
                
                <div class="mt-4 pt-3 border-top text-center">
                    ${btnAccion}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// --- LOGICA ENTREGA CON REBOTE (Copiada/Adaptada de seller.js) ---

window.abrirModalEntregaChofer = async function (hrId, itemId, pedido) {
    // Asegurar que tenemos motivos de rebote (usando el negocio_id del pedido si el usuario no tiene)
    await cargarMotivosRebote(pedido.negocio_id);

    document.getElementById('entrega-pedido-id').value = pedido.pedido_id || pedido.id;
    document.getElementById('entrega-hr-id').value = hrId;
    document.getElementById('entrega-item-id').value = itemId;
    document.getElementById('entrega-cliente-nombre').innerText = `Bajada: ${pedido.cliente_nombre || 'Cliente'}`;

    // Guardar total original
    const montoTotalEl = document.getElementById('entrega-monto-total');
    montoTotalEl.dataset.original = pedido.total;
    montoTotalEl.innerText = `$${pedido.total.toLocaleString()}`;

    // Cargar items del pedido para ajuste parcial
    const itemsContainer = document.getElementById('entrega-items-container');
    itemsContainer.innerHTML = '';

    currentEntregaItems = pedido.productos.map(p => ({
        producto_id: p.producto_id,
        nombre: p.nombre,
        cantidad_original: p.cantidad,
        cantidad_actual: p.cantidad,
        precio_unitario: p.precio_unitario || 0,
        motivo_rebote_id: null
    }));

    currentEntregaItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'card border-0 shadow-sm mb-2 p-2 bg-light';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div style="flex:1; min-width:0;">
                    <div class="fw-bold small text-truncate" style="line-height:1.2;">${item.nombre}</div>
                    <div class="text-muted" style="font-size:0.65rem;">Orig: ${item.cantidad_original} u. | $${item.precio_unitario}</div>
                </div>
                <div class="d-flex align-items-center gap-2 bg-white border rounded-pill px-2 py-1 shadow-sm">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="updateQtyEntrega(${index}, -1)"><i class="fas fa-minus-circle fa-lg"></i></button>
                    <span class="fw-bold small" style="min-width:25px; text-align:center;">${item.cantidad_actual}</span>
                    <button class="btn btn-sm btn-link text-success p-0" onclick="updateQtyEntrega(${index}, 1)" ${item.cantidad_actual >= item.cantidad_original ? 'disabled' : ''}><i class="fas fa-plus-circle fa-lg"></i></button>
                </div>
            </div>
            <div id="rebote-section-${index}" class="${item.cantidad_actual < item.cantidad_original ? '' : 'd-none'} pt-1 border-top mt-1">
                <div class="d-flex align-items-center gap-1">
                    <small class="text-danger fw-bold" style="font-size: 0.65rem;">REBOTE:</small>
                    <select class="form-select form-select-sm p-0 px-2" style="font-size: 0.7rem; height: 24px;" onchange="updateMotivoRebote(${index}, this.value)">
                        <option value="">Seleccione motivo...</option>
                        ${motivosReboteCache.map(m => `<option value="${m.id}">${m.descripcion || m.nombre || 'Motivo'}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });

    document.getElementById('chofer-modal-entrega').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.cerrarModalEntregaChofer = function () {
    document.getElementById('chofer-modal-entrega').style.display = 'none';
    document.body.style.overflow = 'auto';
};

window.updateQtyEntrega = function (index, delta) {
    const item = currentEntregaItems[index];
    const nuevaCant = item.cantidad_actual + delta;

    if (nuevaCant >= 0 && nuevaCant <= item.cantidad_original) {
        item.cantidad_actual = nuevaCant;

        // Mostrar/ocultar selección de motivo si bajó de la cantidad original
        const reboteSection = document.getElementById(`rebote-section-${index}`);
        if (item.cantidad_actual < item.cantidad_original) {
            reboteSection.classList.remove('d-none');
        } else {
            reboteSection.classList.add('d-none');
            item.motivo_rebote_id = null; // Limpiar motivo
        }

        renderEntregaItemsList();
        recalcularTotalEntrega();
    }
};

window.updateMotivoRebote = function (index, motivoId) {
    currentEntregaItems[index].motivo_rebote_id = motivoId ? parseInt(motivoId) : null;
};

function renderEntregaItemsList() {
    const itemsContainer = document.getElementById('entrega-items-container');
    itemsContainer.innerHTML = '';

    currentEntregaItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'card border-0 shadow-sm mb-2 p-2 bg-light';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div style="flex:1; min-width:0;">
                    <div class="fw-bold small text-truncate" style="line-height:1.2;">${item.nombre}</div>
                    <div class="text-muted" style="font-size:0.65rem;">Orig: ${item.cantidad_original} u. | $${item.precio_unitario}</div>
                </div>
                <div class="d-flex align-items-center gap-2 bg-white border rounded-pill px-2 py-1 shadow-sm">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="updateQtyEntrega(${index}, -1)"><i class="fas fa-minus-circle fa-lg"></i></button>
                    <span class="fw-bold small" style="min-width:25px; text-align:center;">${item.cantidad_actual}</span>
                    <button class="btn btn-sm btn-link text-success p-0" onclick="updateQtyEntrega(${index}, 1)" ${item.cantidad_actual >= item.cantidad_original ? 'disabled' : ''}><i class="fas fa-plus-circle fa-lg"></i></button>
                </div>
            </div>
            <div id="rebote-section-${index}" class="${item.cantidad_actual < item.cantidad_original ? '' : 'd-none'} pt-1 border-top mt-1">
                <div class="d-flex align-items-center gap-1">
                    <small class="text-danger fw-bold" style="font-size: 0.65rem;">REBOTE:</small>
                    <select class="form-select form-select-sm p-0 px-2" style="font-size: 0.7rem; height: 24px;" onchange="updateMotivoRebote(${index}, this.value)">
                        <option value="">Seleccione motivo...</option>
                        ${motivosReboteCache.map(m => `<option value="${m.id}" ${m.id === item.motivo_rebote_id ? 'selected' : ''}>${m.descripcion || m.nombre || 'Motivo'}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
}

function recalcularTotalEntrega() {
    let nuevoTotal = 0;
    currentEntregaItems.forEach(i => {
        nuevoTotal += (i.cantidad_actual * i.precio_unitario);
    });
    document.getElementById('entrega-monto-total').innerText = `$${nuevoTotal.toLocaleString()}`;
}

window.confirmarEntregaChoferBackend = async function () {
    const pedidoId = document.getElementById('entrega-pedido-id').value;
    const hrId = document.getElementById('entrega-hr-id').value;
    const itemId = document.getElementById('entrega-item-id').value;
    // Para choferes, por ahora el pago se asume "Efectivo" (o se rendirá después)
    const metodoPago = 'Efectivo';

    // Validar motivos de rebote si hay ajustes
    for (let item of currentEntregaItems) {
        if (item.cantidad_actual < item.cantidad_original && !item.motivo_rebote_id) {
            Swal.fire('Faltan datos', `Debe seleccionar un motivo de rebote para: ${item.nombre}`, 'warning');
            return;
        }
    }

    const payload = {
        solo_bajada: true,
        items_ajustados: currentEntregaItems.reduce((acc, i) => {
            acc[i.producto_id] = i.cantidad_actual;
            return acc;
        }, {}),
        motivos_ajustados: currentEntregaItems.reduce((acc, i) => {
            if (i.motivo_rebote_id) acc[i.producto_id] = i.motivo_rebote_id;
            return acc;
        }, {})
    };

    try {
        Swal.fire({ title: 'Procesando bajada...', didOpen: () => Swal.showLoading() });

        await sendData(`/api/pedidos/${pedidoId}/entregar`, payload, 'POST');

        Swal.fire({
            icon: 'success',
            title: 'Bajada Exitosa',
            text: 'Se ha registrado la bajada de mercadería y los rebotes (si aplica).',
            timer: 2000,
            showConfirmButton: false
        });

        cerrarModalEntregaChofer();

        // Refrescar vista
        if (isUnifiedMode) {
            const queryStr = selectedHrIds.map(id => `hr_ids=${id}`).join('&');
            const data = await fetchData(`/api/chofer/recorrido_unificado?${queryStr}`);
            unifiedItems = data.items;
            actualizarVistaUnificada();
        } else {
            const fecha = document.getElementById('chofer-ruta-titulo').innerText.split(' - ')[1] || '';
            abrirDetalleRuta(hrId, fecha);
        }

    } catch (e) {
        console.error(e);
        Swal.fire('Error', e.message || 'No se pudo confirmar la entrega', 'error');
    }
};

// Hacemos global la función para que el onclick del HTML la encuentre
window.marcarVisitaChofer = async function (hrId, itemId, estado, btn) {
    if (!confirm(estado ? "¿Confirmar que se bajó la mercadería en esta parada?" : "¿Deshacer la bajada de mercadería?")) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;

    try {
        await sendData(`/api/hoja_ruta/${hrId}/item/${itemId}`, { visitado: estado, observaciones: '' }, 'PUT');

        // Recargar paradas y mapa silenciosamente
        if (isUnifiedMode) {
            const queryStr = selectedHrIds.length > 0
                ? selectedHrIds.map(id => `hr_ids=${id}`).join('&')
                : '';
            const data = await fetchData(`/api/chofer/recorrido_unificado${queryStr ? '?' + queryStr : ''}`);
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
