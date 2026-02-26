import { fetchData } from '../api.js';
import { appState } from '../main.js';

let map = null;
let markers = [];
let clientes = []; // Cache

export async function inicializarMapaClientes() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return; // Guard

    // Cargar Leaflet JS si no existe
    if (!window.L) {
        await cargarLeafletJS();
    }

    // Cargar Vendedores para el filtro
    await cargarFiltroVendedores();

    // Inicializar Mapa
    initMap();

    // Cargar Clientes y poner pines
    await cargarClientesMapa();

    window.recargarMapa = cargarClientesMapa;
}

function cargarLeafletJS() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
        script.crossOrigin = "";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Cache de colores de vendedores
let vendedoresColores = {};

async function cargarFiltroVendedores() {
    try {
        const vendedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
        const select = document.getElementById('mapa-vendedor-filter');
        // Mantener la primera opcion
        select.innerHTML = '<option value="">Todos los vendedores</option>';
        vendedores.forEach(v => {
            select.innerHTML += `<option value="${v.id}">${v.nombre}</option>`;
            // Guardar color
            if (v.id && v.color) {
                vendedoresColores[v.id] = v.color;
            }
        });
    } catch (e) {
        console.error("Error filtro vendedores:", e);
    }
}

function initMap() {
    // Si ya existe instancia, destruir o reusar (Leaflet no deja init sobre container existente con instancia)
    if (map) {
        map.remove();
        map = null;
    }

    // Coordenadas default (San Luis, Argentina o donde sea el negocio)
    // Podríamos usar la geoloc del negocio si la tuviéramos
    map = L.map('map').setView([-33.29, -66.33], 13); // San Luis aprox

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

async function cargarClientesMapa() {
    const filtroVendedor = document.getElementById('mapa-vendedor-filter').value;

    // Limpiar marcadores viejos
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    try {
        // Obtenemos todos los clientes (idealmente la API soportaría filtros de geojson)
        // Usamos limit alto para traer todos y evitar paginación por defecto
        if (clientes.length === 0) {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes?limit=10000`);
            clientes = response.data || response; // Handle both structures
        }

        const validos = clientes.filter(c => c.latitud && c.longitud);

        // Filter by seller (frontend filter for now, or request backend filter)
        let filtrados = validos;
        if (filtroVendedor) {
            filtrados = validos.filter(c => String(c.vendedor_id) === String(filtroVendedor));
        }

        markers = []; // Reset markers array
        const group = L.featureGroup();

        filtrados.forEach(c => {
            const popupContent = `
                <strong>${c.nombre}</strong><br>
                ${c.direccion || ''}<br>
                <small>${c.actividad || '-'}</small>
            `;

            // Determinar color
            let color = "#007bff"; // Azul default
            if (c.vendedor_id && vendedoresColores[c.vendedor_id]) {
                color = vendedoresColores[c.vendedor_id];
            }

            const marker = L.circleMarker([c.latitud, c.longitud], {
                radius: 6,
                fillColor: color,
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).bindPopup(popupContent);

            marker.addTo(map);
            markers.push(marker);
            marker.addTo(group);
        });

        // ZONAS VENDEDORES
        await cargarZonasVendedores(filtroVendedor);

        // Fit bounds if we have markers
        if (markers.length > 0) {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

    } catch (error) {
        console.error("Error mapa:", error);
    }
}

// Globales para el HTML
window.recargarMapa = cargarClientesMapa;
window.toggleZonas = toggleZonas;

let zonasLayers = [];

async function cargarZonasVendedores(filtroVendedorId) {
    // Limpiar zonas viejas
    limpiarZonas();

    // Check toggle
    const mostrar = document.getElementById('toggle-zonas')?.checked;
    if (!mostrar) return;

    try {
        const vendedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);

        vendedores.forEach(v => {
            if (filtroVendedorId && String(v.id) !== String(filtroVendedorId)) return;

            if (v.zona_geografica) {
                try {
                    const geoJson = JSON.parse(v.zona_geografica);
                    const layer = L.geoJSON(geoJson, {
                        style: {
                            color: v.color || '#3388ff',
                            weight: 2,
                            opacity: 0.6,
                            fillOpacity: 0.2
                        },
                        // Truco para que quede detrás de los pines: usar tilePane o shadowPane. 
                        // O mejor, usar un pane custom si quisiéramos ser muy prolijos.
                        // 'overlayPane' es el default (z-index 400), 'markerPane' es 600.
                        // Si usamos L.geoJSON va al overlayPane. Los circleMarker también están en overlayPane pero se dibujan luego.
                        // Para asegurar, podemos usar bringToBack().
                    }).bindPopup(`<strong>Zona: ${v.nombre}</strong>`);

                    layer.addTo(map);
                    layer.bringToBack(); // IMPORTANTE: Enviar al fondo
                    zonasLayers.push(layer);
                } catch (e) {
                    console.error("Error drawing zona", e);
                }
            }
        });
    } catch (e) {
        console.error("Error loading zonas", e);
    }
}

function limpiarZonas() {
    zonasLayers.forEach(l => map.removeLayer(l));
    zonasLayers = [];
}

function toggleZonas() {
    const filtro = document.getElementById('mapa-vendedor-filter').value;
    const mostrar = document.getElementById('toggle-zonas').checked;

    if (mostrar) {
        cargarZonasVendedores(filtro);
    } else {
        limpiarZonas();
    }
}
