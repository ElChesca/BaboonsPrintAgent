import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let vendedores = [];
let zonas = [];

export async function inicializarVendedores() {
    const table = document.getElementById('tabla-vendedores');
    if (!table) return;

    await Promise.all([cargarVendedores(), cargarZonas()]);

    const form = document.getElementById('form-vendedor');
    if (form) form.onsubmit = guardarVendedor;

    window.abrirModalVendedor = abrirModalVendedor;
    window.cerrarModalVendedor = cerrarModalVendedor;
    window.editarVendedor = editarVendedor;
    window.editarZona = editarZona;         // legacy
    window.cerrarModalZona = cerrarModalZona; // legacy
    window.guardarZona = guardarZona;       // legacy

    // ABM Zonas buttons
    const btnNueva = document.getElementById('btn-nueva-zona');
    if (btnNueva) btnNueva.onclick = () => abrirModalZonaABM(null);

    const btnGuardar = document.getElementById('btn-guardar-zona-abm');
    if (btnGuardar) btnGuardar.onclick = guardarZonaABM;

    const closeBtns = [
        document.getElementById('close-zona-abm'),
        document.getElementById('close-zona-abm-footer')
    ];
    closeBtns.forEach(b => { if (b) b.onclick = cerrarModalZonaABM; });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modal-zona-abm');
        if (modal && e.target === modal) cerrarModalZonaABM();
    });
}

// ---- VENDEDORES ----

async function cargarVendedores() {
    try {
        vendedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
        renderVendedores();
    } catch (error) {
        console.error("Error vendedores:", error);
    }
}

function renderVendedores() {
    const tbody = document.querySelector('#tabla-vendedores tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    vendedores.forEach(v => {
        const tr = document.createElement('tr');
        const empleadoInfo = v.nombre_empleado
            ? `<span class="badge bg-info text-dark" style="font-size: 0.85em"><i class="fas fa-link"></i> ${v.nombre_empleado} ${v.apellido_empleado}</span>`
            : '<span class="text-muted small">No vinculado</span>';

        const zona = zonas.find(z => z.id === v.zona_id);
        const zonaHtml = zona
            ? `<span style="display:inline-flex;align-items:center;gap:6px;">
                    <span style="width:12px;height:12px;border-radius:50%;background:${zona.color};display:inline-block;"></span>
                    ${zona.nombre}
               </span>`
            : '<span class="text-muted small">Sin zona</span>';

        tr.innerHTML = `
            <td>${v.nombre}</td>
            <td>${empleadoInfo}</td>
            <td>${v.telefono || '-'}</td>
            <td>${v.email || '-'}</td>
            <td>${zonaHtml}</td>
            <td>${v.activo ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="editarVendedor(${v.id})">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalVendedor() {
    document.getElementById('form-vendedor').reset();
    document.getElementById('vendedor-id').value = '';
    document.getElementById('modal-titulo').innerText = 'Nuevo Vendedor';

    // Poblar selector de zona
    poblarSelectZonaVendedor();

    document.getElementById('modal-vendedor').style.display = 'block';
}

function cerrarModalVendedor() {
    document.getElementById('modal-vendedor').style.display = 'none';
}

function poblarSelectZonaVendedor(zonaIdActual = null) {
    const select = document.getElementById('zona-vendedor');
    if (!select) return;
    select.innerHTML = '<option value="">-- Sin Zona --</option>';
    zonas.forEach(z => {
        const sel = z.id == zonaIdActual ? 'selected' : '';
        select.innerHTML += `<option value="${z.id}" ${sel}>${z.nombre}</option>`;
    });
}

function editarVendedor(id) {
    const v = vendedores.find(x => x.id === id);
    if (!v) return;

    document.getElementById('vendedor-id').value = v.id;
    document.getElementById('nombre-vendedor').value = v.nombre;
    document.getElementById('telefono-vendedor').value = v.telefono || '';
    document.getElementById('email-vendedor').value = v.email || '';
    document.getElementById('activo-vendedor').checked = v.activo;
    document.getElementById('password-vendedor').value = '';

    poblarSelectZonaVendedor(v.zona_id);

    document.getElementById('modal-titulo').innerText = 'Editar Vendedor';
    document.getElementById('modal-vendedor').style.display = 'block';
}

async function guardarVendedor(e) {
    e.preventDefault();
    const id = document.getElementById('vendedor-id').value;
    const data = {
        nombre: document.getElementById('nombre-vendedor').value,
        telefono: document.getElementById('telefono-vendedor').value,
        email: document.getElementById('email-vendedor').value,
        activo: document.getElementById('activo-vendedor').checked,
        password: document.getElementById('password-vendedor').value || null,
        zona_id: document.getElementById('zona-vendedor').value || null
    };

    try {
        if (id) {
            await sendData(`/api/vendedores/${id}`, data, 'PUT');
            mostrarNotificacion('Vendedor actualizado', 'success');
        } else {
            await sendData(`/api/negocios/${appState.negocioActivoId}/vendedores`, data, 'POST');
            mostrarNotificacion('Vendedor creado', 'success');
        }
        cerrarModalVendedor();
        await cargarVendedores();
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al guardar', 'error');
    }
}

// ---- ZONAS ABM ----

async function cargarZonas() {
    try {
        zonas = await fetchData(`/api/negocios/${appState.negocioActivoId}/zonas`);
        renderTablaZonas();
    } catch (error) {
        console.error("Error zonas:", error);
    }
}

function renderTablaZonas() {
    const tbody = document.querySelector('#tabla-zonas tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!zonas || zonas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No hay zonas definidas aún. Creá la primera.</td></tr>';
        return;
    }

    zonas.forEach(z => {
        const tienePoligono = !!z.poligono_geografico;
        tbody.innerHTML += `
            <tr>
                <td><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${z.color || '#3388ff'};border:2px solid #fff;box-shadow:0 0 0 1px #ccc;"></span></td>
                <td><strong>${z.nombre}</strong></td>
                <td style="color:#666;font-size:0.9em;">${z.descripcion || '-'}</td>
                <td><span class="badge bg-secondary">${z.total_clientes || 0} clientes</span></td>
                <td>${tienePoligono ? '<span class="badge bg-success"><i class="fas fa-check"></i> Definido</span>' : '<span class="badge bg-warning text-dark">Sin polígono</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="window.editarZonaABM(${z.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="window.eliminarZona(${z.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// --- MAPA EN MODAL ABM ---

let mapZonaABM = null;
let drawnItemsABM = null;

function initMapZonaABM() {
    if (mapZonaABM) {
        mapZonaABM.invalidateSize();
        return;
    }

    mapZonaABM = L.map('mapa-zona-abm').setView([-33.30, -66.33], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(mapZonaABM);

    drawnItemsABM = new L.FeatureGroup();
    mapZonaABM.addLayer(drawnItemsABM);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItemsABM },
        draw: {
            polygon: { shapeOptions: { color: document.getElementById('zona-color').value } },
            rectangle: { shapeOptions: { color: document.getElementById('zona-color').value } },
            polyline: false, circle: false, marker: false, circlemarker: false
        }
    });
    mapZonaABM.addControl(drawControl);

    mapZonaABM.on(L.Draw.Event.CREATED, (event) => {
        drawnItemsABM.clearLayers();
        drawnItemsABM.addLayer(event.layer);
    });

    // Update color on change
    document.getElementById('zona-color').addEventListener('input', () => {
        const color = document.getElementById('zona-color').value;
        drawnItemsABM.getLayers().forEach(l => {
            if (l.setStyle) l.setStyle({ color });
        });
    });
}

function abrirModalZonaABM(zonaId) {
    const modal = document.getElementById('modal-zona-abm');
    document.getElementById('zona-nombre').value = '';
    document.getElementById('zona-color').value = '#3388ff';
    document.getElementById('zona-descripcion').value = '';
    document.getElementById('zona-id-editar').value = zonaId || '';

    if (zonaId) {
        const z = zonas.find(x => x.id === zonaId);
        if (z) {
            document.getElementById('titulo-modal-zona-abm').textContent = `Editar Zona: ${z.nombre}`;
            document.getElementById('zona-nombre').value = z.nombre;
            document.getElementById('zona-color').value = z.color || '#3388ff';
            document.getElementById('zona-descripcion').value = z.descripcion || '';
        }
    } else {
        document.getElementById('titulo-modal-zona-abm').textContent = 'Nueva Zona';
    }

    modal.style.display = 'flex';

    setTimeout(() => {
        initMapZonaABM();
        drawnItemsABM.clearLayers();

        if (zonaId) {
            const z = zonas.find(x => x.id === zonaId);
            if (z && z.poligono_geografico) {
                try {
                    const geoJson = JSON.parse(z.poligono_geografico);
                    const layer = L.geoJSON(geoJson, {
                        style: { color: z.color || '#3388ff' }
                    }).getLayers()[0];
                    if (layer) {
                        drawnItemsABM.addLayer(layer);
                        mapZonaABM.fitBounds(layer.getBounds());
                    }
                } catch (e) { console.error("Error parsing polygon", e); }
            }
        }
        mapZonaABM.invalidateSize();
    }, 150);
}

function cerrarModalZonaABM() {
    document.getElementById('modal-zona-abm').style.display = 'none';
}

async function guardarZonaABM() {
    const nombre = document.getElementById('zona-nombre').value.trim();
    if (!nombre) {
        mostrarNotificacion('El nombre de la zona es obligatorio', 'warning');
        return;
    }

    const color = document.getElementById('zona-color').value;
    const descripcion = document.getElementById('zona-descripcion').value.trim();
    const zonaIdEditar = document.getElementById('zona-id-editar').value;

    let poligonoJson = null;
    if (drawnItemsABM && drawnItemsABM.getLayers().length > 0) {
        const layer = drawnItemsABM.getLayers()[0];
        poligonoJson = JSON.stringify(layer.toGeoJSON());
    }

    const payload = { nombre, color, descripcion, poligono_geografico: poligonoJson };
    const btn = document.getElementById('btn-guardar-zona-abm');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        if (zonaIdEditar) {
            await sendData(`/api/zonas/${zonaIdEditar}`, payload, 'PUT');
            mostrarNotificacion('Zona actualizada con éxito', 'success');
        } else {
            await sendData(`/api/negocios/${appState.negocioActivoId}/zonas`, payload, 'POST');
            mostrarNotificacion('Zona creada con éxito', 'success');
        }
        cerrarModalZonaABM();
        await cargarZonas();
        renderVendedores(); // Refrescar también la tabla de vendedores (muestra zona)
    } catch (error) {
        mostrarNotificacion('Error al guardar la zona', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Zona';
    }
}

window.editarZonaABM = (id) => abrirModalZonaABM(id);

window.eliminarZona = async (id) => {
    const zona = zonas.find(z => z.id === id);
    if (!zona) return;

    const confirmado = await Swal.fire({
        title: `¿Eliminar "${zona.nombre}"?`,
        text: `Los ${zona.total_clientes || 0} clientes asignados quedarán sin zona.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmado.isConfirmed) return;

    try {
        await sendData(`/api/zonas/${id}`, {}, 'DELETE');
        mostrarNotificacion('Zona eliminada', 'success');
        await cargarZonas();
        renderVendedores();
    } catch (error) {
        mostrarNotificacion('Error al eliminar', 'error');
    }
};

// ---- LEGACY (compatibilidad con el modal-zona antiguo, ahora redirige al ABM) ----

let mapZona = null;
let drawnItems = new L.FeatureGroup();
let currentVendedorIdForZone = null;

function editarZona(id) {
    // Redirect to new ABM
    const v = vendedores.find(x => x.id === id);
    if (!v) return;
    currentVendedorIdForZone = id;
    document.getElementById('nombre-vendedor-zona').innerText = v.nombre;
    document.getElementById('color-zona').value = v.color || '#3388ff';
    document.getElementById('modal-zona').style.display = 'block';
    initMapZonaLegacy();
    drawnItems.clearLayers();
    if (v.zona_geografica) {
        try {
            const geoJson = JSON.parse(v.zona_geografica);
            const layer = L.geoJSON(geoJson).getLayers()[0];
            if (layer instanceof L.Polygon) { layer.addTo(drawnItems); mapZona.fitBounds(layer.getBounds()); }
        } catch (e) { console.error(e); }
    } else { mapZona.setView([-33.30, -66.33], 13); }
    setTimeout(() => mapZona.invalidateSize(), 200);
}

function cerrarModalZona() { document.getElementById('modal-zona').style.display = 'none'; }

function initMapZonaLegacy() {
    if (mapZona) return;
    mapZona = L.map('mapa-zona').setView([-33.30, -66.33], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapZona);
    drawnItems = new L.FeatureGroup();
    mapZona.addLayer(drawnItems);
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: { polygon: true, rectangle: true, polyline: false, circle: false, marker: false, circlemarker: false }
    });
    mapZona.addControl(drawControl);
    mapZona.on(L.Draw.Event.CREATED, (event) => { drawnItems.clearLayers(); drawnItems.addLayer(event.layer); });
}

async function guardarZona() {
    if (!currentVendedorIdForZone) return;
    const layers = drawnItems.getLayers();
    let zonaJson = layers.length > 0 ? JSON.stringify(layers[0].toGeoJSON()) : null;
    const color = document.getElementById('color-zona').value;
    const v = vendedores.find(x => x.id === currentVendedorIdForZone);
    const data = { nombre: v.nombre, telefono: v.telefono, email: v.email, activo: v.activo, zona_geografica: zonaJson, color };
    try {
        await sendData(`/api/vendedores/${currentVendedorIdForZone}`, data, 'PUT');
        mostrarNotificacion('Zona guardada', 'success');
        v.zona_geografica = zonaJson; v.color = color;
        cerrarModalZona();
    } catch (error) {
        mostrarNotificacion('Error al guardar zona', 'error');
    }
}
