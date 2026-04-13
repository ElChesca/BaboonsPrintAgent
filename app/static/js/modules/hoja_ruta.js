import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';
import { getCurrentUser } from './auth.js';
// Dynamic version-safe lazy loaders for cross-module features
const vMod = new URL(import.meta.url).search || "";
async function getLogistica() { return await import(`./logistica.js${vMod}`); }

window.abrirModoRepartidor = async (hrId) => (await getLogistica()).abrirModoRepartidor(hrId);
window.cerrarModoRepartidor = async () => (await getLogistica()).cerrarModoRepartidor();
window.abrirModalEntrega = async (...args) => (await getLogistica()).abrirModalEntrega(...args);
window.cerrarModalEntrega = async () => (await getLogistica()).cerrarModalEntrega();
window.confirmarEntregaBackend = async () => (await getLogistica()).confirmarEntregaBackend();

window.cerrarModalLiquidacion = () => {
    const modal = document.getElementById('modal-liquidacion-hr');
    if (modal) modal.style.setProperty('display', 'none', 'important');
};

// ✨ ASIGNACIONES GLOBALES AL INICIO: Asegura que las funciones existan incluso antes de inicializar
window.abrirModalHojaRuta = abrirModalHojaRuta;
window.cerrarModalHojaRuta = cerrarModalHojaRuta;
window.verDetalleHR = verDetalleHR;
window.volverListaHR = volverListaHR;
window.marcarVisitado = marcarVisitado;
window.limpiarRutaTemporal = limpiarRutaTemporal;
window.quitarDeRuta = quitarDeRuta;
window.moverParada = moverParada;
window.agregarARuta = agregarARuta;
window.confirmarReparto = confirmarReparto;
window.cargarHojasRuta = cargarHojasRuta;
window.abrirModalLiquidacion = abrirModalLiquidacion;
window.finalizarLiquidacion = finalizarLiquidacion;
window.exportarPickingPDF = exportarPickingPDF;
window.verPedidoCliente = verPedidoCliente;
window.repetirHojaRuta = repetirHojaRuta;
window.editarHojaRuta = editarHojaRuta;
window.cambiarPaginaHR = cambiarPaginaHR;
window.eliminarHojaRuta = eliminarHojaRuta;
window.abrirMapaRecorrido = abrirMapaRecorrido;
window.exportarPickingHR_PDF = exportarPickingHR_PDF;

let hojasRuta = [];
let vendedoresCache = [];
let vehiculosCache = [];
let clientesCache = [];
let choferesCache = [];
let mapHR, markersHR = [];
let mapModalHR, markersModalHR = [];
let mapFullRecorrido, markersFullRecorrido = [];
let rutaTemporal = [];
let hojaRutaEditandoId = null;
let hrPaginaActual = 0;
const HR_POR_PAGINA = 50;

// Leaflet ya se carga en index.html de forma síncrona

async function inicializarMapaHojaRuta() {
    if (!window.L) {
        console.error("Leaflet NO cargado. Abortando mapa.");
        return;
    }

    // ✨ LÓGICA DEFENSIVA: Evitar mapas fantasma o contenedores obsoletos
    const container = document.getElementById('map-hoja-ruta');
    if (!container) return;

    if (mapHR) {
        // Si el contenedor guardado en el objeto mapa no es el que está en el DOM actual (por el innerHTML)
        if (!document.body.contains(mapHR.getContainer())) {
            try { mapHR.remove(); } catch (e) { }
            mapHR = null;
        }
    }

    if (mapHR) {
        setTimeout(() => mapHR.invalidateSize(), 200);
        return;
    }

    mapHR = L.map('map-hoja-ruta', { rotate: false }).setView([-33.3017, -66.3378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapHR);
}

export async function inicializarHojaRuta() {
    const filtroFecha = document.getElementById('filtro-fecha-hr');
    if (filtroFecha) {
        filtroFecha.value = "";
        filtroFecha.onchange = cargarHojasRuta;
    }

    // Bind Main Hoja Ruta Tabs
    const mainTabs = document.querySelectorAll('#hojaRutaTabs .nav-link');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabEl = e.currentTarget;
            const targetId = tabEl.getAttribute('data-tab');
            if (!targetId) return;

            mainTabs.forEach(t => t.classList.remove('active'));
            tabEl.classList.add('active');

            // Ocultar todas las pestañas antes de mostrar la elegida
            document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');

            const targetElement = document.getElementById(`tab-${targetId}`);
            if (targetElement) {
                targetElement.style.display = 'block';
            }

            // Si se abrió la pestaña de control de carga, inicializarla
            if (targetId === 'control-carga') {
                if (window.inicializarControlCargaHR) window.inicializarControlCargaHR();
                else if (window.inicializarControlCarga) window.inicializarControlCarga();
            }
            if (targetId === 'inventario-movil') {
                if (window.inicializarInventarioMovil) window.inicializarInventarioMovil();
            }
        });
    });

    window.inicializarInventarioMovil = inicializarInventarioMovil;
    window.cargarStockVehiculo = cargarStockVehiculo;

    // Ya no establecemos fecha de hoy por defecto para mostrar "Todas"
    filtroFecha.value = "";
    filtroFecha.onchange = cargarHojasRuta;

    // Red de seguridad: Asegurar que el negocio esté cargado
    if (!appState.negocioActivoId) {
        console.warn("Retraso en appState. Reintentando carga en 500ms...");
        setTimeout(inicializarHojaRuta, 500);
        return;
    }

    await Promise.all([cargarHojasRuta(), cargarVendedores(), cargarVehiculos(), cargarChoferes()]);


    const form = document.getElementById('form-hoja-ruta');
    if (form) form.onsubmit = crearHojaRuta;

    const buscaCliente = document.getElementById('buscar-cliente-hr');
    const sugerencias = document.getElementById('sugerencias-clientes-hr');

    if (buscaCliente) {
        buscaCliente.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            renderMarcadoresModal(query);
            renderListaClientesZona(query); // ✨ ACTUALIZAR LA LISTA VIRTUAL DE LA ZONA TAMBIÉN

            if (query.length < 2) {
                if (sugerencias) sugerencias.style.display = 'none';
                return;
            }

            const matches = clientesCache.filter(c =>
                c.id.toString().includes(query) ||
                c.nombre.toLowerCase().includes(query) ||
                (c.direccion && c.direccion.toLowerCase().includes(query))
            ).slice(0, 10);

            if (matches.length > 0) {
                sugerencias.innerHTML = matches.map(c => `
                    <div class="p-2 border-bottom suggestion-item" style="cursor:pointer;" onclick="window.agregarARuta(${c.id}); document.getElementById('buscar-cliente-hr').value=''; document.getElementById('sugerencias-clientes-hr').style.display='none';">
                        <div class="d-flex justify-content-between">
                            <span class="fw-bold text-dark">${c.nombre}</span>
                            <span class="badge bg-light text-dark border">#${c.id}</span>
                        </div>
                        <small class="text-muted">${c.direccion || 'Sin dirección'}</small>
                    </div>
                `).join('');
                sugerencias.style.display = 'block';
            } else {
                sugerencias.innerHTML = '<div class="p-3 text-center text-muted">No se encontraron clientes</div>';
                sugerencias.style.display = 'block';
            }
        };

        document.addEventListener('click', (e) => {
            if (!buscaCliente.contains(e.target) && !sugerencias.contains(e.target)) {
                sugerencias.style.display = 'none';
            }
        });
    }
}

async function cargarVehiculos() {
    try {
        vehiculosCache = await fetchData(`/api/vehiculos?negocio_id=${appState.negocioActivoId}`);
        const select = document.getElementById('select-vehiculo-picking');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccionar vehículo --</option>';
        vehiculosCache.forEach(v => {
            if (v.activo) {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.innerText = `${v.patente} (${v.modelo}) - Cap: ${v.capacidad_kg}kg / ${v.capacidad_volumen_m3}m³`;
                select.appendChild(opt);
            }
        });
    } catch (e) {
        console.error("Error cargando vehículos", e);
    }
}

async function cargarVendedores() {
    vendedoresCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
    const select = document.getElementById('select-vendedor-hr');
    if (!select) return;

    const user = getCurrentUser();
    select.innerHTML = '<option value="">Seleccione Vendedor...</option>';
    vendedoresCache.forEach(v => {
        if (v.activo) select.innerHTML += `<option value="${v.id}">${v.nombre}</option>`;
    });

    // ✨ EVENTO: Al cambiar vendedor, recargar clientes filtrados
    select.onchange = async () => {
        const vId = select.value;
        const zona = document.getElementById('select-zona-hr')?.value || null;
        await cargarClientes(vId || null, zona);
    };

    if (user && user.rol === 'vendedor' && user.vendedor_id) {
        select.value = user.vendedor_id;
        select.disabled = true;
        // ✨ Simular evento change para cargar clientes del vendedor
        select.dispatchEvent(new Event('change'));
    }
}

async function cargarChoferes() {
    try {
        const empleados = await fetchData(`/api/empleados?negocio_id=${appState.negocioActivoId}`);
        choferesCache = empleados.filter(e => e.rol === 'chofer' && e.activo);
        const select = document.getElementById('select-chofer-hr');
        if (!select) return;

        select.innerHTML = '<option value="">-- Por defecto del vehículo --</option>';
        choferesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = `${c.nombre} ${c.apellido}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Error cargando choferes", e);
    }
}

async function cargarClientes(vendedorId = null, zona = null) {
    let url = `/api/negocios/${appState.negocioActivoId}/clientes?limit=10000`;
    if (vendedorId) url += `&vendedor_id=${vendedorId}`;
    if (zona) url += `&zona=${encodeURIComponent(zona)}`;
    const response = await fetchData(url);
    clientesCache = response.data || response;
}

async function cargarHojasRuta() {
    const fecha = document.getElementById('filtro-fecha-hr').value;
    try {
        let url = `/api/negocios/${appState.negocioActivoId}/hoja_ruta`;
        const params = new URLSearchParams();
        if (fecha) params.append('fecha', fecha);

        // Paginar solo si no hay fecha (cuando se ven "Todas")
        if (!fecha) {
            params.append('limit', HR_POR_PAGINA);
            params.append('offset', hrPaginaActual * HR_POR_PAGINA);
        }

        if (params.toString()) url += `?${params.toString()}`;

        hojasRuta = await fetchData(url);
        renderHojasRuta();
        actualizarPaginacionHR(fecha);
    } catch (error) {
        console.error(error);
    }
}

function actualizarPaginacionHR(conFecha) {
    const pnl = document.getElementById('paginacion-hr');
    if (!pnl) return;

    if (conFecha) {
        pnl.setAttribute('style', 'display: none !important');
        return;
    }

    pnl.setAttribute('style', 'display: flex !important');
    const label = document.getElementById('label-pagina-hr');
    if (label) label.textContent = `Página ${hrPaginaActual + 1}`;

    const btnPrev = document.getElementById('btn-prev-hr');
    const btnNext = document.getElementById('btn-next-hr');

    if (btnPrev) btnPrev.disabled = hrPaginaActual === 0;
    if (btnNext) btnNext.disabled = hojasRuta.length < HR_POR_PAGINA;
}

async function cambiarPaginaHR(delta) {
    hrPaginaActual = Math.max(0, hrPaginaActual + delta);
    await cargarHojasRuta();
    // Scroll al tope de la tabla
    document.getElementById('lista-hojas-ruta')?.scrollIntoView({ behavior: 'smooth' });
}

window.toggleFiltroEstadoHR = function () {
    // Al cambiar filtros manuales, reseteamos a pág 1 para no perdernos
    hrPaginaActual = 0;
    renderHojasRuta();
};

function renderHojasRuta() {
    const tbody = document.querySelector('#tabla-hr tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const showActiva = document.getElementById('btn-check-activa')?.checked ?? true;
    const showBorrador = document.getElementById('btn-check-borrador')?.checked ?? true;
    const showFinalizada = document.getElementById('btn-check-finalizada')?.checked ?? false;

    const hojasFiltradas = hojasRuta.filter(hr => {
        if (hr.estado === 'activa' && showActiva) return true;
        if (hr.estado === 'borrador' && showBorrador) return true;
        if (hr.estado === 'finalizada' && showFinalizada) return true;
        return false;
    });

    hojasFiltradas.forEach(hr => {
        const tr = document.createElement('tr');
        const badgeClass = {
            'borrador': 'bg-secondary',
            'activa': 'bg-primary',
            'finalizada': 'bg-success'
        }[hr.estado] || 'bg-info';

        let fechaLegible = hr.fecha;
        if (hr.fecha && hr.fecha.includes('-')) {
            const [y, m, d] = hr.fecha.split('-');
            fechaLegible = `${d}/${m}/${y}`;
        }

        const totalImporte = hr.total_pedidos || 0;
        const porCobrar = (hr.cant_pedidos || 0) - (hr.cant_entregados || 0);
        const progresoPedidos = hr.cant_pedidos > 0
            ? Math.round((hr.cant_entregados / hr.cant_pedidos) * 100)
            : 0;
        const progressClass = progresoPedidos === 100 ? 'bg-success' : (progresoPedidos > 0 ? 'bg-primary' : 'bg-secondary');

        tr.innerHTML = `
            <td class="fw-bold">${hr.id}</td>
            <td>${fechaLegible}</td>
            <td>${hr.vendedor_nombre}</td>
            <td>${hr.vehiculo_patente ? `<span class="badge bg-dark">${hr.vehiculo_patente}</span>` : '<span class="text-muted small">—</span>'}</td>
            <td class="text-center">${hr.cant_clientes || 0}</td>
            <td class="text-center">${hr.cant_pedidos || 0}</td>
            <td class="text-end fw-bold text-primary">$${totalImporte.toLocaleString()}</td>
            <td class="text-center">
                <div class="d-flex align-items-center justify-content-center gap-2">
                    <span class="small fw-bold">${hr.cant_entregados || 0}/${hr.cant_pedidos || 0}</span>
                    <div class="progress" style="width: 50px; height: 6px;">
                        <div class="progress-bar ${progressClass}" style="width: ${progresoPedidos}%"></div>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <span class="badge ${porCobrar > 0 ? 'bg-warning text-dark' : 'bg-light text-muted border'}">
                    ${porCobrar}
                </span>
            </td>
            <td><span class="badge ${badgeClass}">${hr.estado.toUpperCase()}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="window.verDetalleHR(${hr.id})" title="Ver Reparto"><i class="fas fa-eye"></i></button>
                ${(hr.estado === 'borrador' || hr.estado === 'activa') ? `<button class="btn btn-sm btn-outline-warning" onclick="window.editarHojaRuta(${hr.id})" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                <button class="btn btn-sm btn-outline-secondary" onclick="window.repetirHojaRuta(${hr.id})" title="Repetir esta ruta"><i class="fas fa-copy"></i></button>
                ${hr.cant_pedidos === 0 ? `<button class="btn btn-sm btn-outline-danger" onclick="window.eliminarHojaRuta(${hr.id})" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function eliminarHojaRuta(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Se eliminará la Hoja de Ruta #${id}. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        const { isConfirmed: doubleConfirmed } = await Swal.fire({
            title: 'Confirmación Final',
            text: 'Presiona el botón para confirmar definitivamente la eliminación.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Eliminar definitivamente',
            cancelButtonText: 'No, mejor no'
        });

        if (doubleConfirmed) {
            try {
                const response = await sendData(`/api/hoja_ruta/${id}`, {}, 'DELETE');
                if (response.error) {
                    Swal.fire('Error', response.error, 'error');
                } else {
                    Swal.fire('Eliminada', 'La hoja de ruta ha sido eliminada.', 'success');
                    cargarHojasRuta();
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Hubo un error al eliminar la hoja de ruta.', 'error');
            }
        }
    }
}


async function abrirModalHojaRuta() {
    hojaRutaEditandoId = null; // Reset modo creación
    document.getElementById('modal-hoja-ruta').style.display = 'block';

    // ✨ RESETEAR UI: Habilitar selector de vendedor para nueva hoja
    const selectorVendedor = document.getElementById('select-vendedor-hr');
    selectorVendedor.disabled = false;
    selectorVendedor.value = "";

    // Cargar zonas disponibles en el select
    const selectZona = document.getElementById('select-zona-hr');
    if (selectZona && selectZona.options.length <= 1) {
        try {
            const zonas = await fetchData(`/api/negocios/${appState.negocioActivoId}/zonas`);
            selectZona.innerHTML = '<option value="">-- Todas las Zonas --</option>';
            zonas.forEach(z => {
                const opt = document.createElement('option');
                opt.value = z.id;
                opt.textContent = z.nombre;
                selectZona.appendChild(opt);
            });
        } catch (e) {
            console.warn('No se pudieron cargar las zonas', e);
        }
    }

    // Evento filtro zona: al cambiar zona, recargar clientes y renderizar panel
    if (selectZona && !selectZona._zonaBindDone) {
        selectZona._zonaBindDone = true;
        selectZona.onchange = async () => {
            const zona = selectZona.value || null;
            const vendedorId = selectorVendedor.value || null;
            await cargarClientes(vendedorId, zona);
            renderListaClientesZona();
        };
    }

    // ✨ FIX: Cargar todos los clientes al abrir el modal
    await cargarClientes();
    renderListaClientesZona();

    document.getElementById('detalle-titulo-modal').innerText = 'Nueva Hoja de Ruta Pro';
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    document.getElementById('fecha-hr').value = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
    rutaTemporal = [];
    renderListaTemporal();

    // ✨ Mapa eliminado del modal — los clientes se seleccionan por búsqueda o zona
}

// ✨ REPETIR HOJA DE RUTA: Duplica las paradas y abre el modal para editar
async function repetirHojaRuta(id) {
    if (!confirm(`¿Duplicar la Hoja de Ruta #${id}?\n\nSe crearán las mismas paradas con fecha de hoy. Los pedidos anteriores NO se copian.`)) return;

    try {
        const res = await fetchData(`/api/hoja_ruta/${id}/duplicar`, { method: 'POST' });
        mostrarNotificacion(`Ruta duplicada como HR #${res.id}. Podés editarla ahora.`, 'success');
        cargarHojasRuta(); // Refrescar lista
        // Abrir el modal de edición con la nueva HR (usa la editarHojaRuta original)
        await editarHojaRuta(res.id);
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al duplicar la hoja de ruta', 'error');
    }
}

function renderMarcadoresModal(filtro = null, ajustarZoom = false) {
    // ✨ El Minimapa del Modal fue retirado para optimizar la carga
    // Esta función se mantiene vacía para no romper otras llamadas en el código original.
}

function agregarARuta(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (cliente && !rutaTemporal.some(r => r.id === id)) {
        rutaTemporal.push({
            id: cliente.id,
            nombre: cliente.nombre,
            direccion: cliente.direccion,
            lat: cliente.latitud ? parseFloat(cliente.latitud) : null,
            lng: cliente.longitud ? parseFloat(cliente.longitud) : null
        });
        renderListaTemporal();

        const q = document.getElementById('buscar-cliente-hr') ? document.getElementById('buscar-cliente-hr').value.trim() : '';
        renderListaClientesZona(q); // refrescar estado "añadido" con el filtro actual
    }
}

// ── Panel de clientes filtrados por zona (panel izquierdo del modal) ──────────
function renderListaClientesZona(filtroText = '') {
    const panel = document.getElementById('lista-clientes-zona');
    if (!panel) return;

    if (!clientesCache.length) {
        panel.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-spinner fa-spin me-1"></i> Cargando clientes...</p>';
        return;
    }

    const selectZona = document.getElementById('select-zona-hr');
    const zonaId = selectZona ? selectZona.value : null;

    if (!zonaId && !filtroText) {
        panel.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-search fa-3x mb-3 text-light"></i>
                <p>Seleccione una <b>Zona</b> o use el <b>buscador</b> para mostrar clientes.</p>
                <small>Evitamos cargar todos los clientes de golpe.</small>
            </div>
        `;
        return;
    }

    const filtrados = clientesCache.filter(c => {
        if (filtroText) {
            const f = filtroText.toLowerCase();
            return c.nombre.toLowerCase().includes(f) ||
                (c.direccion && c.direccion.toLowerCase().includes(f)) ||
                c.id.toString().includes(f);
        }
        return true;
    });

    if (filtrados.length === 0) {
        panel.innerHTML = '<p class="text-muted text-center py-4">No se encontraron clientes</p>';
        return;
    }

    const MAX_VISIBLES = 150;
    const limitados = filtrados.slice(0, MAX_VISIBLES);

    let html = limitados.map(c => {
        const estaEnRuta = rutaTemporal.some(r => r.id === c.id);
        return `
        <div class="d-flex justify-content-between align-items-center px-2 py-1 mb-1 rounded ${estaEnRuta ? 'bg-success bg-opacity-10 border border-success' : 'bg-white border'}">
            <div class="text-truncate me-2" style="max-width:70%;">
                <strong class="d-block text-truncate small">${c.nombre}</strong>
                <small class="text-muted">${c.direccion || 'Sin dirección'}</small>
            </div>
            <button type="button" class="btn btn-sm ${estaEnRuta ? 'btn-success' : 'btn-outline-primary'}" 
                onclick="window.agregarARuta(${c.id})" ${estaEnRuta ? 'disabled' : ''} style="min-width:70px;">
                ${estaEnRuta ? '<i class="fas fa-check"></i> OK' : '<i class="fas fa-plus"></i> Agregar'}
            </button>
        </div>`;
    }).join('');

    if (filtrados.length > MAX_VISIBLES) {
        html += `<div class="text-center text-muted small mt-2 py-2 border-top">
                    <i class="fas fa-info-circle"></i> Hay ${filtrados.length - MAX_VISIBLES} clientes más. Refine su búsqueda.
                 </div>`;
    }

    panel.innerHTML = html;
}

window._agregarTodosDeZona = function () {
    clientesCache.forEach(c => {
        if (!rutaTemporal.some(r => r.id === c.id)) {
            rutaTemporal.push({
                id: c.id,
                nombre: c.nombre,
                direccion: c.direccion,
                lat: c.latitud ? parseFloat(c.latitud) : null,
                lng: c.longitud ? parseFloat(c.longitud) : null
            });
        }
    });
    renderListaTemporal();
    const q = document.getElementById('buscar-cliente-hr') ? document.getElementById('buscar-cliente-hr').value.trim() : '';
    renderListaClientesZona(q);
};


function renderListaTemporal() {
    const list = document.getElementById('lista-paradas-orden');
    const counter = document.getElementById('contador-paradas');
    if (!list) return;

    list.innerHTML = '';
    counter.innerText = rutaTemporal.length;

    if (rutaTemporal.length === 0) {
        list.innerHTML = '<li class="list-group-item text-center text-muted py-4">No hay clientes seleccionados aún</li>';
        return;
    }

    rutaTemporal.forEach((c, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div class="d-flex align-items-center overflow-hidden">
                <span class="parada-index">${index + 1}</span>
                <div class="text-truncate">
                    <strong class="d-block text-truncate">${c.nombre}</strong>
                    <small class="text-muted d-block text-truncate">${c.direccion}</small>
                </div>
            </div>
            <div class="d-flex gap-1 ms-2">
                <div class="btn-group-vertical">
                    <span class="btn-orden" onclick="window.moverParada(${index}, -1)"><i class="fas fa-chevron-up"></i></span>
                    <span class="btn-orden" onclick="window.moverParada(${index}, 1)"><i class="fas fa-chevron-down"></i></span>
                </div>
                <button type="button" class="btn btn-sm btn-link text-danger" onclick="window.quitarDeRuta(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        list.appendChild(li);
    });
    window.dibujarRutaModal(); // ✨ Asegurar que la línea se actualice al reordenar
}

let routeLineModal = null;
window.dibujarRutaModal = () => {
    // ✨ El Minimapa del Modal fue retirado.
};

function moverParada(index, dir) {
    const newIndex = index + dir;
    if (newIndex >= 0 && newIndex < rutaTemporal.length) {
        const temp = rutaTemporal[index];
        rutaTemporal[index] = rutaTemporal[newIndex];
        rutaTemporal[newIndex] = temp;
        renderListaTemporal();
    }
}

function quitarDeRuta(index) {
    rutaTemporal.splice(index, 1);
    renderListaTemporal();

    const q = document.getElementById('buscar-cliente-hr') ? document.getElementById('buscar-cliente-hr').value.trim() : '';
    renderMarcadoresModal(q);
    renderListaClientesZona(q); // ✨ FIX: Actualizar botones de la lista
}

function limpiarRutaTemporal() {
    rutaTemporal = [];
    renderListaTemporal();
    renderMarcadoresModal(null, true); // Resetear zoom al limpiar
}

/**
 * Ordena la ruta usando el algoritmo del Vecino Más Cercano (Nearest Neighbor)
 */
function optimizarRuta() {
    if (rutaTemporal.length < 2) {
        mostrarNotificacion('Se necesitan al menos 2 paradas para optimizar.', 'info');
        return;
    }

    // Filtramos puntos con coordenadas
    const conCoords = rutaTemporal.filter(p => p.lat !== null && p.lng !== null);
    const sinCoords = rutaTemporal.filter(p => p.lat === null || p.lng === null);

    if (conCoords.length < 2) {
        mostrarNotificacion('La mayoría de los clientes no tienen coordenadas para optimizar.', 'warning');
        return;
    }
    // Algoritmo Greedy: Empezamos por el primero de la lista actual (asumimos que es el punto de partida o el primero deseado)
    let rutaOptima = [conCoords[0]];
    let pendientes = conCoords.slice(1);

    while (pendientes.length > 0) {
        let ultimo = rutaOptima[rutaOptima.length - 1];
        let masCercanoIndex = -1;
        let distMinima = Infinity;

        for (let i = 0; i < pendientes.length; i++) {
            let p = pendientes[i];
            // Distancia Euclidiana simple (suficiente para distancias cortas locales)
            let d = Math.sqrt(Math.pow(p.lat - ultimo.lat, 2) + Math.pow(p.lng - ultimo.lng, 2));
            if (d < distMinima) {
                distMinima = d;
                masCercanoIndex = i;
            }
        }

        if (masCercanoIndex !== -1) {
            rutaOptima.push(pendientes[masCercanoIndex]);
            pendientes.splice(masCercanoIndex, 1);
        } else {
            break; // Should not happen
        }
    }

    // Reconstruimos la ruta: Primero la optimizada, luego los que no tenían coords al final
    rutaTemporal = [...rutaOptima, ...sinCoords];
    renderListaTemporal();
    mostrarNotificacion('Ruta reordenada por cercanía.', 'success');
}

// Globalizar
window.optimizarRuta = optimizarRuta;

function cerrarModalHojaRuta() {
    document.getElementById('modal-hoja-ruta').style.display = 'none';
}

async function crearHojaRuta(e) {
    e.preventDefault();
    if (rutaTemporal.length === 0) {
        mostrarNotificacion('Seleccione al menos un cliente en el mapa o lista', 'warning');
        return;
    }

    const selectChofer = document.getElementById('select-chofer-hr');

    const data = {
        vendedor_id: document.getElementById('select-vendedor-hr').value,
        chofer_id: selectChofer && selectChofer.value ? selectChofer.value : null,
        fecha: document.getElementById('fecha-hr').value,
        items: rutaTemporal.map(c => c.id)
    };

    try {
        if (hojaRutaEditandoId) {
            await sendData(`/api/hoja_ruta/${hojaRutaEditandoId}`, data, 'PUT');
            mostrarNotificacion('Hoja de ruta actualizada con éxito', 'success');
        } else {
            await sendData(`/api/negocios/${appState.negocioActivoId}/hoja_ruta`, data, 'POST');
            mostrarNotificacion('Hoja de ruta creada con éxito', 'success');
        }
        cerrarModalHojaRuta();
        cargarHojasRuta();
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al crear la hoja de ruta', 'error');
    }
}

async function verDetalleHR(id) {
    try {
        hojaRutaActualId = id; // Track current HR for vehicle assignment
        const detalle = await fetchData(`/api/hoja_ruta/${id}`);

        // Iniciar refresco automático de tracking si está activa
        iniciarRefrescoTracking(detalle);

        document.getElementById('lista-hojas-ruta').style.display = 'none';
        document.getElementById('detalle-hoja-ruta').style.display = 'block';

        document.getElementById('detalle-vendedor').innerText = detalle.vendedor_nombre;
        let fechaLegible = detalle.fecha;
        if (detalle.fecha && detalle.fecha.includes('-')) {
            const [y, m, d] = detalle.fecha.split('-');
            fechaLegible = `${d}/${m}/${y}`;
        }
        document.getElementById('detalle-fecha').innerText = fechaLegible;

        // ✨ Mostrar Estado y Botón de Confirmación
        const headerAcciones = document.getElementById('detalle-acciones-cabecera');
        if (headerAcciones) {
            const badgeClass = { 'borrador': 'bg-secondary', 'activa': 'bg-primary', 'finalizada': 'bg-success' }[detalle.estado] || 'bg-info';
            headerAcciones.innerHTML = `
                <span class="badge ${badgeClass} me-2">${detalle.estado.toUpperCase()}</span>
                ${detalle.estado === 'borrador' ? `
                    <button class="btn btn-sm btn-${detalle.carga_actual.peso_kg > 0 ? 'success' : 'primary'}" onclick="window.confirmarReparto(${id}, ${detalle.carga_actual.peso_kg})">
                        <i class="fas ${detalle.carga_actual.peso_kg > 0 ? 'fa-boxes' : 'fa-truck'}"></i> 
                        ${detalle.carga_actual.peso_kg > 0 ? 'Preparar Picking y Salida' : 'Iniciar Recorrido / Salida'}
                    </button>
                ` : ''}
                <div class="d-flex gap-1 flex-wrap">
                    <button class="btn btn-sm btn-outline-dark" onclick="window.exportarPickingHR_PDF(${id})" title="Imprimir PDF"><i class="fas fa-print"></i></button>
                    <button class="btn btn-sm btn-outline-primary fw-bold" onclick="window.abrirMapaRecorrido(${id})">
                        <i class="fas fa-map-marked-alt me-1"></i> Ver Mapa
                    </button>
                ${detalle.estado === 'activa' ? `
                    <button class="btn btn-sm btn-success fw-bold px-3 shadow-sm" onclick="window.abrirModoRepartidor(${id})">
                        <i class="fas fa-motorcycle me-2"></i>Modo Repartidor
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.abrirModalLiquidacion(${id}, 'activa')"><i class="fas fa-flag-checkered"></i> Liquidar</button>
                ` : ''}
                ${detalle.estado === 'finalizada' ? `<button class="btn btn-sm btn-outline-success" onclick="window.abrirModalLiquidacion(${id}, 'finalizada')"><i class="fas fa-check-double"></i> Ver Liquidación</button>` : ''}
                </div>
            `;
        }

        // --- Actualizar info de Vehículo y Carga ---
        const infoVehiculo = document.getElementById('hr-detail-vehiculo');
        if (infoVehiculo) {
            infoVehiculo.innerText = detalle.vehiculo_patente ? `${detalle.vehiculo_patente} (${detalle.vehiculo_modelo})` : 'Sin vehículo asignado';
        }

        // --- Cargar Choferes en Detalle Rápido ---
        const selectDetailChofer = document.getElementById('hr-detail-chofer');
        if (selectDetailChofer) {
            selectDetailChofer.innerHTML = '<option value="">-- Vehículo --</option>';
            choferesCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.innerText = `${c.nombre} ${c.apellido}`;
                selectDetailChofer.appendChild(opt);
            });
            // Setear el actual
            selectDetailChofer.value = detalle.chofer_id || "";
            // Deshabilitar si está finalizada
            selectDetailChofer.disabled = (detalle.estado === 'finalizada');
        }

        const pesoMax = detalle.capacidad_kg || 0;
        const volMax = detalle.capacidad_volumen_m3 || 0;
        const pesoActual = detalle.carga_actual.peso_kg;
        const volActual = detalle.carga_actual.volumen_m3;

        const percPeso = pesoMax > 0 ? Math.min((pesoActual / pesoMax) * 100, 100) : 0;
        const percVol = volMax > 0 ? Math.min((volActual / volMax) * 100, 100) : 0;

        document.getElementById('hr-carga-peso').innerText = pesoActual.toFixed(1);
        document.getElementById('hr-carga-peso-max').innerText = `/ ${pesoMax} Kg`;
        const barPeso = document.getElementById('hr-carga-peso-bar');
        barPeso.style.width = `${percPeso}%`;
        barPeso.className = `progress-bar ${percPeso > 90 ? 'bg-danger' : (percPeso > 70 ? 'bg-warning' : 'bg-success')}`;

        document.getElementById('hr-carga-vol').innerText = volActual.toFixed(2);
        document.getElementById('hr-carga-vol-max').innerText = `/ ${volMax} m³`;
        const barVol = document.getElementById('hr-carga-vol-bar');
        barVol.style.width = `${percVol}%`;
        barVol.className = `progress-bar ${percVol > 90 ? 'bg-danger' : (percVol > 70 ? 'bg-warning' : 'bg-info')}`;

        await inicializarMapaHojaRuta();

        markersHR.forEach(m => mapHR.removeLayer(m));
        markersHR = [];
        if (window.routeLineHR) mapHR.removeLayer(window.routeLineHR);
        if (window.markerVehiculoHR) mapHR.removeLayer(window.markerVehiculoHR);
        window.markerVehiculoHR = null;

        const puntos = [];
        const tbody = document.querySelector('#tabla-detalle-items tbody');
        tbody.innerHTML = '';

        // Aseguramos que los items se procesen en orden de "parada" (orden asc)
        const itemsOrdenados = detalle.items.sort((a, b) => a.orden - b.orden);

        itemsOrdenados.forEach(item => {
            const tr = document.createElement('tr');
            const hasCoords = item.latitud && item.longitud;

            let color = '#007bff';
            let label = item.orden + 1;

            if (item.tiene_pedido) {
                color = '#6f42c1';
            } else if (item.tiene_venta) {
                color = '#28a745';
            } else if (item.visitado) {
                color = '#fd7e14';
            }

            // ... (marker logic omitted for brevity if unchanged, but I need to be careful with replace context)
            // Actually, I will just replace the tr.innerHTML part and the new function at the end or proper place.

            // Re-constructing the loop part is cleaner
            if (hasCoords) {
                const lat = parseFloat(item.latitud);
                const lng = parseFloat(item.longitud);
                puntos.push([lat, lng]);

                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color:${color};" class="marker-pin"></div><i class="marker-label">${label}</i>`,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                });

                const marker = L.marker([lat, lng], { icon }).addTo(mapHR)
                    .bindPopup(`
                        <div class="p-2">
                            <strong class="d-block">${item.cliente_nombre}</strong>
                            <small class="text-muted d-block">${item.cliente_direccion || ''}</small>
                            <hr class="my-1">
                            <span class="badge ${item.tiene_venta ? 'bg-success' : 'bg-warning'} text-white">
                                <i class="fas ${item.tiene_venta ? 'fa-shopping-cart' : 'fa-times'}"></i>
                                ${item.tiene_venta ? 'Venta Realizada' : 'Sin Venta'}
                            </span>
                        </div>
                    `);
                markersHR.push(marker);
            }

            const horaVisita = item.fecha_visita ? new Date(item.fecha_visita).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

            // ✨ CLICKABLE ICON FOR PEDIDOS
            const iconPedido = item.tiene_pedido
                ? `<i class="fas fa-box text-primary ms-1" style="cursor:pointer" onclick="verPedidoCliente(${item.cliente_id}, ${id})" title="Ver Detalle de Pedido"></i>`
                : '';

            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <span class="badge rounded-circle me-1" style="background-color:${color}; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${item.orden + 1}</span>
                    </div>
                </td>
                <td>
                    <strong>${item.cliente_nombre}</strong>
                    ${item.tiene_venta ? '<i class="fas fa-check-circle text-success ms-1" title="Venta Realizada"></i>' : ''}
                    ${item.total_pedidos_cliente > 1 ? `<span class="badge bg-light text-primary border ms-1" title="${item.total_pedidos_cliente} pedidos">${item.total_pedidos_cliente} pack</span>` : ''}
                    ${iconPedido}
                </td>
                <td><small class="text-muted">${item.cliente_direccion || ''}</small>
                    ${hasCoords ? `<a href="javascript:void(0)" onclick="centrarEnCliente(${item.latitud}, ${item.longitud})" class="ms-1">📍</a>` : ''}
                </td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" ${item.visitado ? 'checked' : ''} onchange="marcarVisitado(${id}, ${item.id}, this.checked)">
                        <small class="d-block text-muted" style="font-size:10px">${horaVisita !== '-' ? `<i class="far fa-clock"></i> ${horaVisita}` : ''}</small>
                    </div>
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm" value="${item.observaciones || ''}" onblur="marcarVisitado(${id}, ${item.id}, null, this.value)" placeholder="Notas...">
                </td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-xs btn-outline-info" onclick="verHistorialCliente(${item.cliente_id}, '${item.cliente_nombre.replace(/'/g, "\\'")}')" title="Historial"><i class="fas fa-history"></i></button>
                        <button class="btn btn-xs btn-success" onclick="abrirModalPedido(${item.cliente_id}, '${item.cliente_nombre.replace(/'/g, "\\'")}', ${id})" title="Cargar Pedido"><i class="fas fa-cart-plus"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // ✨ Definir función de historial localmente o globalizarla
        window.verHistorialCliente = async (clienteId, nombre) => {
            document.getElementById('historial-cliente-nombre').innerText = `Historial: ${nombre}`;
            const tbody = document.querySelector('#tabla-historial-cliente tbody');
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
            document.getElementById('modal-historial-cliente').style.display = 'flex';

            try {
                // Buscamos pedidos y ventas recientes para este cliente
                const [resPedidos, ventas] = await Promise.all([
                    fetchData(`/api/negocios/${appState.negocioActivoId}/pedidos?cliente_id=${clienteId}`),
                    fetchData(`/api/negocios/${appState.negocioActivoId}/ventas?cliente_id=${clienteId}`)
                ]);

                const pedidos = resPedidos.pedidos || [];

                const combined = [
                    ...pedidos.map(p => ({
                        fecha: p.fecha,
                        tipo: '📦 Pedido',
                        monto: p.total,
                        estado: p.estado,
                        vendedor: p.vendedor_nombre,
                        hoja_id: p.hoja_ruta_id
                    })),
                    ...ventas.map(v => ({
                        fecha: v.fecha,
                        tipo: '💰 Venta',
                        monto: v.total,
                        estado: 'completada',
                        vendedor: '-',
                        hoja_id: null
                    }))
                ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

                if (combined.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Sin actividad previa</td></tr>';
                } else {
                    tbody.innerHTML = combined.map(c => {
                        let badgeClass = 'bg-secondary';
                        if (c.estado === 'pendiente') badgeClass = 'bg-warning text-dark';
                        if (c.estado === 'entregado' || c.estado === 'completada') badgeClass = 'bg-success';
                        if (c.estado === 'anulado') badgeClass = 'bg-danger';

                        const hrLabel = c.hoja_id ? `<span class="badge bg-light text-dark border ms-1">HR #${c.hoja_id}</span>` : '';

                        return `
                        <tr>
                            <td><small>${new Date(c.fecha).toLocaleDateString()}</small></td>
                            <td>
                                ${c.tipo} ${hrLabel}<br>
                                <small class="text-muted" style="font-size: 0.75rem;">Reparto: ${c.vendedor}</small>
                            </td>
                            <td class="fw-bold">$${c.monto.toLocaleString()}</td>
                            <td><span class="badge ${badgeClass}" style="font-size: 0.7rem;">${c.estado.toUpperCase()}</span></td>
                        </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error(err);
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar historial</td></tr>';
            }
        };

        if (puntos.length > 0) {
            window.routeLineHR = L.polyline(puntos, {
                color: '#2980b9',
                weight: 5,
                opacity: 0.7,
                dashArray: '10, 10',
                lineJoin: 'round'
            }).addTo(mapHR);
        }

        // ✨ Dibujar Camioncito si hay ubicación
        if (detalle.vehiculo_lat && detalle.vehiculo_lng) {
            const truckIcon = L.divIcon({
                className: 'truck-marker-icon',
                html: '<i class="fas fa-truck-moving" style="color: #2c3e50; font-size: 24px; text-shadow: 0 0 3px #fff;"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            window.markerVehiculoHR = L.marker([detalle.vehiculo_lat, detalle.vehiculo_lng], { icon: truckIcon })
                .addTo(mapHR)
                .bindPopup(`<b>Ubicación del Chofer</b><br>Actualizado: ${detalle.vehiculo_gps_ts || 'Recientemente'}`);
        }

        window.centrarEnCliente = (lat, lng) => {
            if (mapHR) {
                mapHR.setView([lat, lng], 17);
                markersHR.find(m => m.getLatLng().lat == lat && m.getLatLng().lng == lng)?.openPopup();
            }
        };

        setTimeout(() => {
            mapHR.invalidateSize();
            if (puntos.length > 0) {
                const bounds = L.latLngBounds(puntos);
                mapHR.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            }
        }, 200);
    } catch (error) {
        console.error(error);
    }
}

async function abrirMapaRecorrido(id) {
    try {
        const detalle = await fetchData(`/api/hoja_ruta/${id}`);
        const modal = document.getElementById('modal-mapa-recorrido');
        if (!modal) {
            console.error("❌ No se encontró #modal-mapa-recorrido");
            return;
        }
        modal.style.display = 'block';

        if (!window.L) {
            console.error("❌ Leaflet (L) no está cargado globalmente.");
            mostrarNotificacion("Error: Librería de mapas no disponible", "error");
            return;
        }

        if (mapFullRecorrido) {
            try { mapFullRecorrido.remove(); } catch (e) { }
            mapFullRecorrido = null;
        }

        mapFullRecorrido = L.map('map-full-recorrido').setView([-33.3017, -66.3378], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapFullRecorrido);

        const puntos = [];
        markersFullRecorrido = [];

        // Aseguramos orden correcto para dibujar la línea
        const itemsOrdenados = detalle.items.sort((a, b) => a.orden - b.orden);

        itemsOrdenados.forEach(item => {
            if (item.latitud && item.longitud) {
                const lat = parseFloat(item.latitud);
                const lng = parseFloat(item.longitud);
                puntos.push([lat, lng]);

                let color = '#007bff';
                if (item.tiene_pedido) color = '#6f42c1';
                else if (item.tiene_venta) color = '#28a745';
                else if (item.visitado) color = '#fd7e14';

                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color:${color};" class="marker-pin"></div><i class="marker-label">${item.orden + 1}</i>`,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                });

                const marker = L.marker([lat, lng], { icon }).addTo(mapFullRecorrido)
                    .bindPopup(`<b>${item.cliente_nombre}</b><br>${item.cliente_direccion || ''}`);
                markersFullRecorrido.push(marker);
            }
        });

        if (puntos.length > 1) {
            L.polyline(puntos, {
                color: '#2980b9',
                weight: 5,
                opacity: 0.7,
                dashArray: '10, 10',
                lineJoin: 'round'
            }).addTo(mapFullRecorrido);
        }

        setTimeout(() => {
            mapFullRecorrido.invalidateSize();
            if (puntos.length > 0) {
                mapFullRecorrido.fitBounds(L.latLngBounds(puntos), { padding: [50, 50] });
            }
        }, 300);

    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar el mapa de recorrido', 'error');
    }
}

window.abrirMapaRecorrido = abrirMapaRecorrido;

window.cerrarModalVerPedido = function() {
    const modal = document.getElementById('modal-ver-pedido');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
    }
};

async function verPedidoCliente(clienteId, hojaRutaId) {
    try {
        console.log("🛠️ [DEBUG] verPedidoCliente iniciado:", { clienteId, hojaRutaId });
        
        const modal = document.getElementById('modal-ver-pedido');
        if (!modal) {
            console.error("❌ [DEBUG] No se encontró el modal #modal-ver-pedido");
            mostrarNotificacion("Error técnico: Modal no encontrado", "error");
            return;
        }

        // Limpiar contenido previo
        document.getElementById('ver-pedido-items').innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Cargando detalles...</td></tr>';
        document.getElementById('ver-pedido-id').innerText = '...';
        document.getElementById('ver-pedido-total').innerText = '$ 0.00';

        // Asegurar que esté en el body para el z-index
        document.body.appendChild(modal);

        modal.style.setProperty('display', 'flex', 'important');
        modal.style.zIndex = "9999";
        
        console.log("🛠️ [DEBUG] Modal display set to flex. Consultando API...");

        const negocioId = appState.negocioActivoId;
        if (!negocioId) {
            console.error("❌ [DEBUG] negocioActivoId es nulo");
        }

        const urlBusqueda = `/api/negocios/${negocioId}/pedidos?hoja_ruta_id=${hojaRutaId}&cliente_id=${clienteId}`;
        const res = await fetchData(urlBusqueda);
        const pedidos = res.pedidos || [];

        if (!pedidos || pedidos.length === 0) {
            modal.style.setProperty('display', 'none', 'important');
            mostrarNotificacion('No se encontró el pedido vinculado.', 'warning');
            return;
        }

        const selectorContainer = document.getElementById('ver-pedido-selector-container');
        const selectorList = document.getElementById('ver-pedido-selector-list');

        // ✨ MANEJO DE MÚLTIPLES PEDIDOS (AQUÍ EN LA VISTA)
        if (pedidos.length > 1) {
            selectorList.innerHTML = pedidos.map(p => `
                <button class="btn btn-sm rounded-pill px-3 fw-bold btn-selector-pedido" 
                        id="btn-sel-pedido-${p.id}"
                        onclick="cargarDetallePedidoIndividual(${p.id})">
                    #${p.id}
                </button>
            `).join('');
            selectorContainer.style.display = 'block';
        } else {
            selectorContainer.style.display = 'none';
        }

        // Cargar el primero por defecto
        await cargarDetallePedidoIndividual(pedidos[0].id);

    } catch (error) {
        console.error("Error en verPedidoCliente:", error);
        mostrarNotificacion(error.message || 'Error cargando detalle del pedido', 'error');
        // Ocultar si falló la carga inicial
        const modal = document.getElementById('modal-ver-pedido');
        if (modal) modal.style.display = 'none';
    }
}

// Función auxiliar para cargar un pedido específico en el modal abierto
async function cargarDetallePedidoIndividual(pedidoId) {
    try {
        const pedido = await fetchData(`/api/pedidos/${pedidoId}`);
        
        // Actualizar UI básica
        document.getElementById('ver-pedido-id').innerText = pedido.id;
        document.getElementById('ver-pedido-cliente').innerText = pedido.cliente_nombre;
        document.getElementById('ver-pedido-fecha').innerText = new Date(pedido.fecha).toLocaleString();
        
        // ✨ Defensa contra total nulo o indefinido
        const totalFinal = typeof pedido.total === 'number' ? pedido.total : parseFloat(pedido.total || 0);
        document.getElementById('ver-pedido-total').innerText = `$ ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        
        document.getElementById('ver-pedido-obs').innerText = pedido.observaciones || 'Sin observaciones';

        // Actualizar Tabla
        const tbody = document.getElementById('ver-pedido-items');
        tbody.innerHTML = '';

        if (pedido.detalles && Array.isArray(pedido.detalles)) {
            pedido.detalles.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="ps-4">${d.producto_nombre || 'Producto'}</td>
                    <td class="text-center fw-bold">${d.cantidad}</td>
                    <td class="text-end text-muted small">$${parseFloat(d.precio_unitario).toLocaleString()}</td>
                    <td class="text-end pe-4 fw-bold">$${parseFloat(d.subtotal).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Este pedido no tiene productos registrados</td></tr>';
        }

        // Resaltar botón en el selector si existe
        document.querySelectorAll('.btn-selector-pedido').forEach(btn => {
            btn.classList.replace('btn-primary', 'btn-outline-primary');
            btn.classList.add('btn-outline-primary');
        });
        const activeBtn = document.getElementById(`btn-sel-pedido-${pedidoId}`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-outline-primary');
            activeBtn.classList.add('btn-primary');
        }

    } catch (e) {
        console.error("Error al cargar detalle individual", e);
        mostrarNotificacion('No se pudo cargar el detalle del pedido seleccionado', 'error');
    }
}

// Globalizar la función de carga individual para el onclick
window.cargarDetallePedidoIndividual = cargarDetallePedidoIndividual;


// ✨ ASIGNAR CHOFER DIRECTO EN RUTA ACTIVA
window.asignarChoferDirecto = async function (choferId) {
    if (!hojaRutaActualId) return;

    // Mostramos un pequeño indicador de carga en el select
    const select = document.getElementById('hr-detail-chofer');
    select.disabled = true;

    try {
        const data = {
            chofer_id: choferId || null
        };

        await sendData(`/api/hoja_ruta/${hojaRutaActualId}/chofer`, data, 'PUT');
        mostrarNotificacion('Chofer asignado correctamente.', 'success');
        cargarHojasRuta(); // refrescar fondo
    } catch (e) {
        console.error(e);
        mostrarNotificacion('Error al asignar chofer: ' + e.message, 'error');
        // Revertir UI
        select.value = "";
    } finally {
        select.disabled = false;
    }
}

window.editarHojaRuta = async function (id) {
    if (!id) return;
    hojaRutaEditandoId = id;
    document.getElementById('modal-hoja-ruta').style.display = 'block';

    try {
        const hr = await fetchData(`/api/hoja_ruta/${id}`);
        document.getElementById('detalle-titulo-modal').innerHTML = '<i class="fas fa-edit"></i> Editar Hoja de Ruta Pro';

        // Cargar datos cabecera
        const selectorVendedor = document.getElementById('select-vendedor-hr');
        selectorVendedor.value = hr.vendedor_id;
        selectorVendedor.disabled = true; // ✨ BLOQUEAR cambio de vendedor en edición

        document.getElementById('fecha-hr').value = hr.fecha;
        if (document.getElementById('select-chofer-hr')) {
            document.getElementById('select-chofer-hr').value = hr.chofer_id || "";
        }

        // ✨ CARGAR CLIENTES del vendedor para que aparezcan en el mapa/búsqueda
        await cargarClientes(hr.vendedor_id);

        rutaTemporal = hr.items.map(item => ({
            id: item.cliente_id,
            nombre: item.cliente_nombre,
            direccion: item.cliente_direccion,
            lat: item.latitud ? parseFloat(item.latitud) : null,
            lng: item.longitud ? parseFloat(item.longitud) : null
        }));

        renderListaTemporal();

        // El Minimapa del Modal de Edición fue retirado para optimizar rendimiento/espacio.
        // No inicializar `mapModalHR` aquí.

    } catch (e) {
        console.error(e);
        mostrarNotificacion('Error cargando ruta para editar', 'error');
        cerrarModalHojaRuta();
    }
}

function volverListaHR() {
    document.getElementById('detalle-hoja-ruta').style.display = 'none';
    document.getElementById('lista-hojas-ruta').style.display = 'block';

    // Asegurar que cerramos cualquier modal de liquidación abierto
    const modalLiq = document.getElementById('modal-liquidacion-hr');
    if (modalLiq) modalLiq.style.display = 'none';

    detenerRefrescoTracking();
}

let trackingRefreshInterval = null;
function iniciarRefrescoTracking(detalle) {
    detenerRefrescoTracking();
    if (detalle.estado !== 'activa') return;

    console.log("🚛 Iniciando refresco de tracking para HR #" + detalle.id);
    trackingRefreshInterval = setInterval(async () => {
        const detalleEl = document.getElementById('detalle-hoja-ruta');
        if (!detalleEl || detalleEl.style.display === 'none') {
            detenerRefrescoTracking();
            return;
        }
        try {
            const fresh = await fetchData(`/api/hoja_ruta/${detalle.id}`);
            if (fresh.vehiculo_lat && fresh.vehiculo_lng && mapHR) {
                if (window.markerVehiculoHR) {
                    window.markerVehiculoHR.setLatLng([fresh.vehiculo_lat, fresh.vehiculo_lng]);
                    window.markerVehiculoHR.setPopupContent(`<b>Ubicación del Chofer</b><br>Actualizado: ${fresh.vehiculo_gps_ts || 'Recientemente'}`);
                } else {
                    const truckIcon = L.divIcon({
                        className: 'truck-marker-icon',
                        html: '<i class="fas fa-truck-moving" style="color: #2c3e50; font-size: 24px; text-shadow: 0 0 3px #fff;"></i>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    window.markerVehiculoHR = L.marker([fresh.vehiculo_lat, fresh.vehiculo_lng], { icon: truckIcon })
                        .addTo(mapHR)
                        .bindPopup(`<b>Ubicación del Chofer</b><br>Actualizado: ${fresh.vehiculo_gps_ts || 'Recientemente'}`);
                }
            }
        } catch (e) {
            console.warn("Error refreshing tracking:", e);
        }
    }, 30000); // Cada 30 segundos
}

function detenerRefrescoTracking() {
    if (trackingRefreshInterval) {
        clearInterval(trackingRefreshInterval);
        trackingRefreshInterval = null;
        console.log("🚛 Tracking refresco detenido.");
    }
}

async function marcarVisitado(hrId, itemId, checked, obs) {
    const row = event.target.closest('tr');
    const chk = row.querySelector('input[type="checkbox"]').checked;
    const txt = row.querySelector('input[type="text"]').value;

    try {
        await sendData(`/api/hoja_ruta/${hrId}/item/${itemId}`, {
            visitado: chk,
            observaciones: txt
        }, 'PUT');
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error actualizando item', 'error');
    }
}

async function editarHojaRuta(id) {
    try {
        const detalle = await fetchData(`/api/hoja_ruta/${id}`);
        hojaRutaEditandoId = id;

        document.getElementById('modal-hoja-ruta').style.display = 'block';
        document.getElementById('detalle-titulo-modal').innerText = 'Editando Hoja de Ruta Pro';

        const selectorVendedor = document.getElementById('select-vendedor-hr');
        selectorVendedor.value = detalle.vendedor_id;
        // Permitir cambio de vendedor solo si es admin/superadmin
        selectorVendedor.disabled = (appState.userRol === 'vendedor');

        document.getElementById('fecha-hr').value = detalle.fecha;
        if (document.getElementById('select-chofer-hr')) {
            document.getElementById('select-chofer-hr').value = detalle.chofer_id || "";
        }

        // ✨ CARGAR ZONAS en el selector (igual que al crear)
        const selectZona = document.getElementById('select-zona-hr');
        if (selectZona) {
            selectZona.innerHTML = '<option value="">-- Todas las Zonas --</option>';
            try {
                const zonas = await fetchData(`/api/negocios/${appState.negocioActivoId}/zonas`);
                zonas.forEach(z => {
                    const opt = document.createElement('option');
                    opt.value = z.id;
                    opt.textContent = z.nombre;
                    selectZona.appendChild(opt);
                });
            } catch (e) {
                console.warn('No se pudieron cargar las zonas', e);
            }

            // Bindear el evento de cambio de zona (resetear flag para que se pueda reenlazar)
            selectZona._zonaBindDone = false;
            selectZona._zonaBindDone = true;
            selectZona.onchange = async () => {
                const zona = selectZona.value || null;
                const vendedorId = selectorVendedor.value || null;
                await cargarClientes(vendedorId, zona);
                renderListaClientesZona();
            };
        }

        // ✨ CARGAR CLIENTES del vendedor para que aparezcan en la búsqueda/zona
        await cargarClientes(detalle.vendedor_id);

        rutaTemporal = detalle.items.map(item => ({
            id: item.cliente_id,
            nombre: item.cliente_nombre,
            direccion: item.cliente_direccion,
            lat: item.latitud ? parseFloat(item.latitud) : null,
            lng: item.longitud ? parseFloat(item.longitud) : null
        }));

        renderListaTemporal();
        renderListaClientesZona(); // Mostrar panel de clientes listo para filtrar
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error cargando hoja para editar', 'error');
    }
}

// Globalizar (YA ESTÁN ARRIBA, PERO SE MANTIENEN ALGUNOS POR COMPATIBILIDAD)
function confirmarReparto(id, peso = 0) {
    return abrirModalPicking(id, peso);
}
// Las demás ya son funciones y fueron globalizadas al inicio del archivo.

let pickingCargaReferencia = { peso: 0, vol: 0 };

async function abrirModalPicking(id, peso = 0) {
    if (peso <= 0) {
        // ✨ FLUJO PREVENTA: Confirmación simple sin vehículo
        let isConfirmed = false;

        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: '¿Iniciar Recorrido?',
                text: "Se activará la hoja de ruta para que el vendedor pueda cargar pedidos.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, Iniciar Salida'
            });
            isConfirmed = result.isConfirmed;
        } else {
            // Fallback nativo
            isConfirmed = confirm("¿Iniciar Recorrido? Se activará la hoja de ruta para que el vendedor pueda cargar pedidos.");
        }

        if (isConfirmed) {
            try {
                // Solo cambiamos estado a activa
                await sendData(`/api/hoja_ruta/${id}/estado`, { estado: 'activa' }, 'PUT');

                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Recorrido Iniciado. App Vendedor Habilitada.', 'success');
                } else {
                    alert('Recorrido Iniciado. App Vendedor Habilitada.');
                }

                if (typeof cargarHojasRuta === 'function') cargarHojasRuta();
                // Si el detalle está abierto, recargarlo
                if (document.getElementById('detalle-hoja-ruta') && document.getElementById('detalle-hoja-ruta').style.display === 'block') {
                    if (typeof verDetalleHR === 'function') verDetalleHR(id);
                }
            } catch (error) {
                console.error(error);
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Error al iniciar recorrido', 'error');
                } else {
                    alert('Error al iniciar recorrido');
                }
            }
        }
        return;
    }

    // ✨ FLUJO REPARTO: Modal con vehículo y control de carga
    const hr = hojasRuta.find(h => h.id === id);
    if (!hr) return;

    document.getElementById('picking-hr-id').value = id;
    document.getElementById('select-vehiculo-picking').value = "";
    document.getElementById('picking-carga-preview').style.display = 'none';

    // Obtenemos carga actual del detalle (ya calculada por el backend)
    try {
        const det = await fetchData(`/api/hoja_ruta/${id}`);
        pickingCargaReferencia.peso = det.carga_actual.peso_kg;
        pickingCargaReferencia.vol = det.carga_actual.volumen_m3;

        document.getElementById('modal-picking-hr').style.display = 'flex';
    } catch (e) {
        mostrarNotificacion('Error al obtener datos de carga', 'error');
    }
}

function actualizarCargaEnPicking(vehiculoId) {
    if (!vehiculoId) {
        document.getElementById('picking-carga-preview').style.display = 'none';
        return;
    }

    const v = vehiculosCache.find(veh => veh.id == vehiculoId);
    if (!v) return;

    document.getElementById('picking-carga-preview').style.display = 'block';

    const pMax = v.capacidad_kg || 0;
    const vMax = v.capacidad_volumen_m3 || 0;
    const pAct = pickingCargaReferencia.peso;
    const vAct = pickingCargaReferencia.vol;

    const percP = pMax > 0 ? (pAct / pMax) * 100 : 0;
    const percV = vMax > 0 ? (vAct / vMax) * 100 : 0;

    document.getElementById('picking-label-peso').innerText = `${pAct.toFixed(1)} / ${pMax} Kg`;
    const barP = document.getElementById('picking-bar-peso');
    barP.style.width = `${Math.min(percP, 100)}%`;
    barP.className = `progress-bar ${percP > 100 ? 'bg-danger' : (percP > 80 ? 'bg-warning' : 'bg-success')}`;

    document.getElementById('picking-label-vol').innerText = `${vAct.toFixed(2)} / ${vMax} m³`;
    const barV = document.getElementById('picking-bar-vol');
    barV.style.width = `${Math.min(percV, 100)}%`;
    barV.className = `progress-bar ${percV > 100 ? 'bg-danger' : (percV > 80 ? 'bg-warning' : 'bg-info')}`;

    document.getElementById('picking-alert-sobrecarga').style.display = (percP > 100 || percV > 100) ? 'block' : 'none';
}

async function ejecutarConfirmarReparto() {
    const id = document.getElementById('picking-hr-id').value;
    const vehiculoId = document.getElementById('select-vehiculo-picking').value;

    if (!vehiculoId) {
        mostrarNotificacion('Debe seleccionar un vehículo para iniciar el picking', 'warning');
        return;
    }

    try {
        // Primero asignamos el vehículo y luego cambiamos el estado
        await sendData(`/api/hoja_ruta/${id}`, { vehiculo_id: vehiculoId }, 'PUT');
        await sendData(`/api/hoja_ruta/${id}/estado`, { estado: 'activa' }, 'PUT');

        mostrarNotificacion('Picking iniciado. Hoja de ruta activa.', 'success');
        document.getElementById('modal-picking-hr').style.display = 'none';
        cargarHojasRuta();
        if (document.getElementById('detalle-hoja-ruta').style.display === 'block') {
            verDetalleHR(id);
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al confirmar reparto', 'error');
    }
}

// --- MÓDULO DE PEDIDOS INTEGRADO ---
let pedidoTemporal = [];

async function abrirModalPedido(clienteId, clienteNombre, hrId) {
    pedidoTemporal = [];
    document.getElementById('pedido-cliente-id').value = clienteId;
    document.getElementById('pedido-cliente-nombre').innerText = clienteNombre;
    document.getElementById('pedido-hr-id').value = hrId;
    document.getElementById('buscar-producto-pedido').value = '';
    document.getElementById('obs-pedido-modal').value = '';

    // ✨ Mostrar quién carga el pedido (Feedback Visual)
    const user = getCurrentUser();
    console.log("Cargando pedido como:", user.nombre, "ID Vendedor:", user.vendedor_id);

    renderItemsPedido();
    document.getElementById('modal-pedido-hr').style.display = 'flex';

    // Configurar buscador de productos
    const buscador = document.getElementById('buscar-producto-pedido');
    const sugerencias = document.getElementById('sugerencias-productos-pedido');

    buscador.oninput = async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            sugerencias.style.display = 'none';
            return;
        }

        try {
            const prods = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos/buscar?query=${query}&cliente_id=${clienteId}`);
            if (prods.length > 0) {
                sugerencias.innerHTML = prods.map(p => `
                    <div class="p-2 border-bottom suggestion-item d-flex justify-content-between" style="cursor:pointer;" onclick="agregarProductoPedido(${p.id}, '${p.nombre}', ${p.precio_final})">
                        <div>
                            <div class="fw-bold text-dark">${p.nombre}</div>
                            <small class="text-muted">Stock: ${p.stock}</small>
                        </div>
                        <div class="text-primary fw-bold">$${p.precio_final.toLocaleString()}</div>
                    </div>
                `).join('');
                sugerencias.style.display = 'block';
            } else {
                sugerencias.innerHTML = '<div class="p-2 text-center text-muted">No se encontraron productos</div>';
                sugerencias.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
        }
    };
}

window.cerrarModalPedido = () => {
    document.getElementById('modal-pedido-hr').style.display = 'none';
};

window.agregarProductoPedido = (id, nombre, precio) => {
    const existe = pedidoTemporal.find(p => p.producto_id === id);
    if (existe) {
        existe.cantidad++;
    } else {
        pedidoTemporal.push({ producto_id: id, nombre, precio_unitario: precio, cantidad: 1 });
    }
    document.getElementById('buscar-producto-pedido').value = '';
    document.getElementById('sugerencias-productos-pedido').style.display = 'none';
    renderItemsPedido();
};

function renderItemsPedido() {
    const tbody = document.querySelector('#tabla-items-pedido tbody');
    let total = 0;
    tbody.innerHTML = '';
    pedidoTemporal.forEach((item, index) => {
        const bonif = item.bonificacion || 0;
        const cantCobrada = Math.max(0, item.cantidad - bonif);
        const subt = cantCobrada * item.precio_unitario;
        total += subt;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="max-width:180px;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.82rem;" title="${item.nombre}">${item.nombre}</div>
                ${bonif > 0 ? `<small class="text-success" style="font-size:0.7rem;">✓ cobra ${cantCobrada} de ${item.cantidad}</small>` : ''}
            </td>
            <td class="text-center" style="padding:4px;">
                <input type="number" step="any" min="0" class="form-control form-control-sm px-1" style="width:58px; text-align:center;" value="${item.cantidad}" onchange="actualizarCantPedido(${index}, this.value)">
            </td>
            <td class="text-end" style="font-size:0.8rem; white-space:nowrap;">$${item.precio_unitario.toLocaleString()}</td>
            <td class="text-center" style="padding:4px;">
                <input type="number" min="0" step="1" class="form-control form-control-sm px-1" style="width:50px; text-align:center;" value="${bonif}" onchange="actualizarBonifPedido(${index}, this.value)" title="Unidades bonificadas">
            </td>
            <td class="text-end fw-bold text-${bonif > 0 ? 'success' : 'dark'}" style="font-size:0.82rem; white-space:nowrap;">
                $${subt.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
            </td>
            <td style="padding:2px;"><button class="btn btn-link btn-sm text-danger p-0" onclick="quitarDePedido(${index})">×</button></td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('total-pedido-modal').innerText = `$ ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

window.actualizarCantPedido = (index, cant) => {
    pedidoTemporal[index].cantidad = parseFloat(cant) || 0;
    renderItemsPedido();
};

window.actualizarBonifPedido = (index, bonif) => {
    pedidoTemporal[index].bonificacion = parseFloat(bonif) || 0;
    renderItemsPedido();
};

// Registro global inmediato (no espera a inicializarHojaRuta)
window.repetirHojaRuta = async (id) => {
    if (!confirm(`¿Duplicar la Hoja de Ruta #${id}?\n\nSe crearán las mismas paradas con fecha de hoy. Los pedidos anteriores NO se copian.`)) return;
    try {
        const res = await fetchData(`/api/hoja_ruta/${id}/duplicar`, { method: 'POST' });
        mostrarNotificacion(`Ruta duplicada como HR #${res.id}. Podés editarla ahora.`, 'success');
        cargarHojasRuta();
        await editarHojaRuta(res.id);
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al duplicar la hoja de ruta', 'error');
    }
};

window.quitarDePedido = (index) => {
    pedidoTemporal.splice(index, 1);
    renderItemsPedido();
};

async function guardarPedidoRuta() {
    if (pedidoTemporal.length === 0) {
        mostrarNotificacion('El pedido está vacío', 'warning');
        return;
    }

    // Calcular total con unidades bonificadas: se cobra (cantidad - bonif) × precio
    const detallesCargados = pedidoTemporal.map(item => {
        const bonif = item.bonificacion || 0;
        const cantCobrada = Math.max(0, item.cantidad - bonif);
        const subtotal = cantCobrada * item.precio_unitario;
        return {
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            bonificacion: bonif,
            subtotal: subtotal
        };
    });
    const total = detallesCargados.reduce((acc, item) => acc + item.subtotal, 0);

    const data = {
        cliente_id: document.getElementById('pedido-cliente-id').value,
        hoja_ruta_id: document.getElementById('pedido-hr-id').value,
        observaciones: document.getElementById('obs-pedido-modal').value,
        detalles: detallesCargados,
        total: total
    };

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/pedidos`, data, 'POST');
        mostrarNotificacion('Pedido guardado con éxito', 'success');
        cerrarModalPedido();
        verDetalleHR(data.hoja_ruta_id); // Recargar detalle para mostrar el éxito
    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al guardar el pedido', 'error');
    }
}

// Globalizar necesarias
window.abrirModalPedido = abrirModalPedido;
window.guardarPedidoRuta = guardarPedidoRuta;

// --- LIQUIDACIÓN DE RUTA ---
let resumenLiqActual = null;

async function abrirModalLiquidacion(id, estadoActual) {
    document.getElementById('liq-hr-id').value = id;
    const headerDisplay = document.getElementById('liq-hr-id-display');
    if (headerDisplay) headerDisplay.textContent = `HR #${id}`;
    const btnFinalizar = document.getElementById('btn-finalizar-liq');
    if (btnFinalizar) btnFinalizar.style.display = estadoActual === 'activa' ? 'block' : 'none';

    let modal = document.getElementById('modal-liquidacion-hr');
    if (!modal) {
        console.error("❌ No se encontró #modal-liquidacion-hr");
        mostrarNotificacion("Error: Modal de liquidación no encontrado", "error");
        return;
    }

    // Reparent to body if not already there
    if (modal.parentElement !== document.body) {
        console.log("📍 [Liquidar] Reparenting modal to body...");
        document.body.appendChild(modal);
    }

    const tbody = document.querySelector('#tabla-liq-productos tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="text-center">Calculando...</td></tr>';

    // Abrir modal y asegurar visibilidad absoluta
    console.log("📑 [Liquidar] Abriendo modal...");
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('z-index', '9999', 'important');
    modal.style.setProperty('background', 'rgba(15, 23, 42, 0.85)', 'important');
    modal.style.setProperty('backdrop-filter', 'blur(10px)', 'important');
    modal.style.setProperty('padding', '20px', 'important');

    const inner = modal.querySelector('.modal-content') || modal.firstElementChild;
    if (inner) {
        inner.style.setProperty('max-width', '1200px', 'important');
        inner.style.setProperty('width', '100%', 'important');
        inner.style.setProperty('margin', 'auto', 'important');
        inner.style.setProperty('border-radius', '20px', 'important');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    resumenLiqActual = null;

    try {
        const resumen = await fetchData(`/api/hoja_ruta/${id}/resumen_liquidacion`);
        resumenLiqActual = resumen;

        // Pilar 1 & 3: Totales Principales
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setVal('liq-stats-visitas', `${resumen.visitas.visitados} / ${resumen.visitas.total_clientes}`);
        setVal('liq-stats-dif-precios', `$ ${resumen.pilares.diferencia_por_precios.toLocaleString()}`);


        // ✨ New: Order Stats
        if (resumen.pedidos_stats) {
            setVal('liq-stats-pedidos', `${resumen.pedidos_stats.pedidos_entregados} / ${resumen.pedidos_stats.total_pedidos}`);
        } else {
            setVal('liq-stats-pedidos', '- / -');
        }
        setVal('liq-total-final-rendir', `$ ${resumen.pilares.total_vendido.toLocaleString()}`);

        // ✨ NUEVO: Desglose Monetario Global (para ver cuánto es EF, MP, CC)
        const dg = resumen.pilares.desglose_global || resumen.desglose_global || {};
        const dgParts = [];
        if (dg.total_ef > 0) dgParts.push(`<span class="text-success fw-bold">EF: $${dg.total_ef.toLocaleString()}</span>`);
        if (dg.total_mp > 0) dgParts.push(`<span class="text-primary fw-bold">MP: $${dg.total_mp.toLocaleString()}</span>`);
        if (dg.total_ctacte > 0) dgParts.push(`<span class="text-warning fw-bold">CC: $${dg.total_ctacte.toLocaleString()}</span>`);
        if (dg.total_transf > 0) dgParts.push(`<span class="text-info fw-bold">TR: $${dg.total_transf.toLocaleString()}</span>`);
        
        const elDesglose = document.getElementById('liq-total-desglose-linea');
        if (elDesglose) {
            elDesglose.innerHTML = dgParts.length > 0 ? dgParts.join(' | ') : 'Sin cobros registrados';
        }

        // Pilar 1: Mercadería Entregada
        if (!resumen.productos || resumen.productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center">No se entregó mercadería</td></tr>';
        } else {
            tbody.innerHTML = resumen.productos.map(p => `
                <tr>
                    <td>${p.producto}</td>
                    <td class="text-center fw-bold">${p.cantidad_total}</td>
                </tr>
            `).join('');
        }

        // Pilar 2: Mercadería a Devolver (Físico)
        const tbodyDevolucion = document.querySelector('#tabla-liq-devolucion-fisica tbody');
        if (tbodyDevolucion) {
            const aDevolver = resumen.pilares.mercaderia_a_devolver;
            if (!aDevolver || aDevolver.length === 0) {
                tbodyDevolucion.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Sin mercadería para devolver</td></tr>';
            } else {
                tbodyDevolucion.innerHTML = aDevolver.map(p => `
                    <tr>
                        <td>${p.producto}</td>
                        <td class="text-center fw-bold text-orange">${p.cantidad_a_devolver}</td>
                    </tr>
                `).join('');
            }
        }

        // --- Render Rebotes (Detalle de motivos) ---
        const tbodyRebotes = document.querySelector('#tabla-liq-rebotes tbody');
        if (tbodyRebotes) {
            if (!resumen.rebotes || resumen.rebotes.length === 0) {
                tbodyRebotes.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hubo rechazos / mermas en este reparto</td></tr>';
            } else {
                tbodyRebotes.innerHTML = resumen.rebotes.map(r => `
                    <tr>
                        <td>${r.producto}</td>
                        <td class="text-danger small">${r.motivo}</td>
                        <td class="text-center fw-bold text-danger">${r.cantidad_total}</td>
                    </tr>
                `).join('');
            }
        }

        // ✨ NUEVO: Advertencia de Pedidos Pendientes
        const warningContainer = document.getElementById('liq-warning-pendientes');
        if (warningContainer) {
            const pendientes = resumen.pilares.pedidos_pendientes || [];
            if (pendientes.length > 0) {
                warningContainer.innerHTML = `
                    <div class="alert alert-warning p-1 px-2 small mb-2 border-warning shadow-sm" style="background: #fff9e6; border-radius: 8px;">
                        <span class="fw-bold text-dark"><i class="fas fa-exclamation-triangle me-1"></i> ¡Pedidos sin Procesar!</span>
                        Hay <strong>${pendientes.length}</strong> pedido(s) que siguen en estado "${pendientes[0].estado.toUpperCase()}":
                        <ul class="mb-0 mt-1 px-3">
                            ${pendientes.slice(0, 2).map(p => `<li>${p.cliente} ($${p.total.toLocaleString()})</li>`).join('')}
                            ${pendientes.length > 2 ? `<li>... y otros ${pendientes.length - 2} más</li>` : ''}
                        </ul>
                        <p class="mb-0 mt-1 text-muted italic" style="font-size: 0.7rem;">Si no los marcás como entregados, el sistema asumirá que la mercadería volvió al depósito.</p>
                    </div>
                `;
                warningContainer.style.display = 'block';
            } else {
                warningContainer.style.display = 'none';
            }
        }

        // ✨ NUEVO: Resumen de Cobros (Cómo se cobró, quién y cuándo)
        const seccionCobro = document.getElementById('seccion-como-cobro');
        const tbodyCobros = document.getElementById('tbody-liq-cobros');
        const infoCard = document.getElementById('liq-cobro-info-card');
        const horarioBadge = document.getElementById('liq-cobro-horario');

        if (seccionCobro && tbodyCobros) {
            const cobros = resumen.resumen_cobros || [];
            const infoCobro = resumen.info_cobro;

            if (cobros.length > 0) {
                seccionCobro.style.display = 'block';

                const iconoMetodo = (metodo) => {
                    const m = (metodo || '').toLowerCase();
                    if (m.includes('efectivo')) return '<i class="fas fa-money-bill-wave text-success me-2"></i>';
                    if (m.includes('mercado') || m.includes('mp')) return '<i class="fas fa-qrcode text-primary me-2"></i>';
                    if (m.includes('cuenta') || m.includes('cte')) return '<i class="fas fa-file-invoice-dollar text-warning me-2"></i>';
                    if (m.includes('mixto')) return '<i class="fas fa-layer-group text-info me-2"></i>';
                    return '<i class="fas fa-credit-card text-secondary me-2"></i>';
                };

                const colorBadge = (metodo) => {
                    const m = (metodo || '').toLowerCase();
                    if (m.includes('efectivo')) return 'bg-success';
                    if (m.includes('mercado') || m.includes('mp')) return 'bg-primary';
                    if (m.includes('cuenta') || m.includes('cte')) return 'bg-warning text-dark';
                    if (m.includes('mixto')) return 'bg-info';
                    return 'bg-secondary';
                };

                tbodyCobros.innerHTML = cobros.map(c => {
                    const cant = c.cantidad_pedidos || 0;
                    const pedidosText = cant > 0 ? 
                        `<span class="badge bg-light text-dark border">${cant} pedido${cant !== 1 ? 's' : ''}</span>` :
                        `<span class="badge bg-light text-muted border" style="font-weight: normal; opacity: 0.7;">Complemento de pago</span>`;

                    return `
                    <tr>
                        <td class="ps-4">
                            <div class="d-flex align-items-center">
                                <div class="method-icon-box me-3">
                                    ${iconoMetodo(c.metodo_pago)}
                                </div>
                                <span class="badge ${colorBadge(c.metodo_pago)} rounded-pill px-3">${c.metodo_pago || 'N/D'}</span>
                            </div>
                        </td>
                        <td class="text-center">
                            ${pedidosText}
                        </td>
                        <td class="pe-4 text-end">
                            <div class="fw-bold text-success" style="font-size: 1.1rem;">
                                $ ${parseFloat(c.total_metodo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                        </td>
                    </tr>`;
                }).join('');

                // ✨ NUEVO: Actualizar también el mini-desglose lateral (Sidebar)
                const miniDesglose = document.getElementById('liq-desglose-cobros-list');
                if (miniDesglose) {
                    const dg = resumen.pilares.desglose_global || resumen.desglose_global || {};
                    const items = [];
                    if (dg.total_ef > 0) items.push({ n: 'Efectivo', v: dg.total_ef });
                    if (dg.total_mp > 0) items.push({ n: 'Mercado Pago', v: dg.total_mp });
                    if (dg.total_ctacte > 0) items.push({ n: 'Cuenta Corriente', v: dg.total_ctacte });
                    if (dg.total_transf > 0) items.push({ n: 'Transferencia', v: dg.total_transf });

                    if (items.length > 0) {
                        miniDesglose.innerHTML = items.map(c => `
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="text-muted"><i class="fas fa-caret-right me-1"></i>${c.n}</span>
                                <span class="fw-bold">$ ${c.v.toLocaleString()}</span>
                            </div>
                        `).join('');
                    } else {
                        // Fallback a resumen_cobros si desglose_global está en 0 (retrocompatibilidad)
                        miniDesglose.innerHTML = cobros.map(c => `
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="text-muted"><i class="fas fa-caret-right me-1"></i>${c.metodo_pago}</span>
                                <span class="fw-bold">$ ${parseFloat(c.total_metodo).toLocaleString('es-AR')}</span>
                            </div>
                        `).join('');
                    }
                }

                if (infoCard && infoCobro) {
                    const fmtFecha = (f) => {
                        if (!f) return '—';
                        const d = new Date(f);
                        return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    };

                    if (horarioBadge && infoCobro.primer_cobro) {
                        horarioBadge.textContent = `${fmtFecha(infoCobro.primer_cobro)} → ${fmtFecha(infoCobro.ultimo_cobro)}`;
                    }

                    infoCard.innerHTML = `
                        <div class="d-flex align-items-center mb-2 border-bottom pb-2">
                            <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px; height:40px; min-width:40px;">
                                <i class="fas fa-user-check text-success"></i>
                            </div>
                            <div>
                                <h6 class="fw-bold mb-0" style="font-size:0.9rem;">${infoCobro.cobrado_por || 'Usuario'}</h6>
                                <small class="text-muted d-block" style="font-size:0.75rem;">Responsable del Cobro</small>
                            </div>
                        </div>
                        <div class="small text-muted" style="font-size:0.75rem;">
                            <div class="d-flex justify-content-between mb-1">
                                <span><i class="fas fa-clock me-1"></i>Primer cobro:</span>
                                <strong>${fmtFecha(infoCobro.primer_cobro)}</strong>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span><i class="fas fa-check-double me-1"></i>Último cobro:</span>
                                <strong>${fmtFecha(infoCobro.ultimo_cobro)}</strong>
                            </div>
                        </div>
                    `;
                }
            } else {
                seccionCobro.style.display = 'none';
                const miniDesglose = document.getElementById('liq-desglose-cobros-list');
                if (miniDesglose) miniDesglose.innerHTML = '<div class="text-center text-muted py-2 italic font-sm">Sin cobros registrados</div>';
            }
        }

    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error cargando resumen de liquidación', 'error');
    }
}

async function finalizarLiquidacion() {
    const id = document.getElementById('liq-hr-id').value;
    if (!confirm('¿Seguro que desea finalizar este reparto? No podrá cargar más datos.')) return;

    try {
        await sendData(`/api/hoja_ruta/${id}/estado`, { estado: 'finalizada' }, 'PUT');
        mostrarNotificacion('Ruta finalizada con éxito', 'success');
        document.getElementById('modal-liquidacion-hr').style.display = 'none';
        verDetalleHR(id); // Recargar vista
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al finalizar ruta', 'error');
    }
}

function exportarLiquidacionPDF() {
    if (!resumenLiqActual) {
        mostrarNotificacion('No hay datos para exportar', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        mostrarNotificacion('Librería PDF no cargada', 'error');
        return;
    }

    const doc = new jsPDF();
    const id = document.getElementById('liq-hr-id').value;

    doc.setFontSize(18);
    doc.text(`Liquidación de Reparto - HR #${id}`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 28);

    // Comparativa de Totales
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Contable de Rendición:", 14, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Teórico HR (Cargado):`, 14, 48);
    doc.text(`$ ${resumenLiqActual.pilares.total_original.toLocaleString()}`, 100, 48, { align: 'right' });

    doc.setTextColor(200, 0, 0);
    doc.text(`(-) Pedidos No Entregados:`, 14, 54);
    doc.text(`$ ${resumenLiqActual.pilares.total_no_entregados.toLocaleString()}`, 100, 54, { align: 'right' });

    doc.text(`(-) Rebotes / Rechazos Parciales:`, 14, 60);
    doc.text(`$ ${resumenLiqActual.pilares.total_rebotes.toLocaleString()}`, 100, 60, { align: 'right' });

    doc.setTextColor(0, 128, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`(=) TOTAL VENDIDO (Neto):`, 14, 68);
    doc.text(`$ ${resumenLiqActual.pilares.total_vendido.toLocaleString()}`, 100, 68, { align: 'right' });

    // ✨ NUEVO: Desglose de Cobros en PDF
    let cobroY = 74;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    if (resumenLiqActual.resumen_cobros && resumenLiqActual.resumen_cobros.length > 0) {
        resumenLiqActual.resumen_cobros.forEach(c => {
            doc.text(`> ${c.metodo_pago}:`, 20, cobroY);
            doc.text(`$ ${c.total_metodo.toLocaleString()}`, 100, cobroY, { align: 'right' });
            cobroY += 5;
        });
    }

    doc.setTextColor(0, 0, 255);
    doc.setFontSize(10);
    doc.text(`(+) Diferencia por Precios:`, 14, cobroY);
    doc.text(`$ ${resumenLiqActual.pilares.diferencia_por_precios.toLocaleString()}`, 100, cobroY, { align: 'right' });
    cobroY += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(`Visitas: ${resumenLiqActual.visitas.visitados} de ${resumenLiqActual.visitas.total_clientes}`, 120, 48);

    // Pilar 1: Mercadería Entregada
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Mercadería Entregada (Pilar 1)", 14, cobroY + 10);
    const headers1 = [["Producto", "Cantidad Entregada"]];
    const data1 = resumenLiqActual.productos.map(p => [p.producto, p.cantidad_total]);

    doc.autoTable({
        startY: cobroY + 14,
        head: headers1,
        body: data1,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 }
    });

    // Pilar 2: Mercadería a Devolver
    let nextY = doc.lastAutoTable.finalY + 10;
    if (nextY > 240) { doc.addPage(); nextY = 20; }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. Mercadería a Devolver (Pilar 2 - Stock Físico)", 14, nextY);
    const headers2 = [["Producto", "Stock a Devolver"]];
    const data2 = resumenLiqActual.pilares.mercaderia_a_devolver.map(p => [p.producto, p.cantidad_a_devolver]);

    doc.autoTable({
        startY: nextY + 4,
        head: headers2,
        body: data2,
        theme: 'striped',
        headStyles: { fillColor: [243, 156, 18], textColor: 255 },
        styles: { fontSize: 9 }
    });

    doc.save(`Liquidacion_HR_${id}.pdf`);
}


// --- GENERACIÓN DE PICKING LIST GENERAL (PDF) ---
function exportarPickingPDF() {
    try {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            mostrarNotificacion('Librería PDF no cargada (jsPDF)', 'error');
            return;
        }
        const doc = new jsPDF();
        const fecha = document.getElementById('filtro-fecha-pedidos').value;

        doc.setFontSize(18);
        doc.text("Picking List - Preparación de Carga", 14, 20);

        doc.setFontSize(11);
        doc.text(`Fecha de Reparto: ${fecha}`, 14, 30);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 35);

        const headers = [["Producto", "Pend.", "Prep.", "Total a Cargar"]];
        const data = [];

        const rows = document.querySelectorAll('#tabla-consolidado-items tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 4) {
                data.push([
                    cols[0].innerText,
                    cols[1].innerText,
                    cols[2].innerText,
                    cols[3].innerText
                ]);
            }
        });

        if (data.length === 0) {
            mostrarNotificacion('No hay datos para exportar', 'warning');
            return;
        }

        doc.autoTable({
            startY: 45,
            head: headers,
            body: data,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 10 }
        });

        doc.save(`PickingList_${fecha}.pdf`);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al generar Picking List', 'error');
    }
}

// --- GENERACIÓN DE PICKING LIST PARA HOJA DE RUTA ---
async function exportarPickingHR_PDF(id) {
    try {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            mostrarNotificacion('Librería PDF no cargada (jsPDF)', 'error');
            return;
        }

        const resumen = await fetchData(`/api/hoja_ruta/${id}/picking_list`);
        if (resumen.error) {
            mostrarNotificacion('Error al obtener datos: ' + resumen.error, 'error');
            return;
        }

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Hoja de Ruta / Reparto - HR #${id}`, 14, 20);

        doc.setFontSize(11);
        doc.text(`Fecha Generación: ${new Date().toLocaleString()}`, 14, 30);

        // Add vehicle and driver info if available
        let currentY = 40;
        if (resumen.vehiculo && resumen.vehiculo.patente) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Vehículo Asignado:', 14, 37);
            doc.setFont(undefined, 'normal');
            doc.text(`${resumen.vehiculo.patente} - ${resumen.vehiculo.modelo || 'Sin modelo'}`, 55, 37);
            currentY = 45;
        }

        if (resumen.vehiculo && resumen.vehiculo.chofer_nombre) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Chofer Asignado:', 14, currentY - 2);
            doc.setFont(undefined, 'normal');
            doc.text(`${resumen.vehiculo.chofer_nombre}`, 55, currentY - 2);
            currentY += 6;
        }

        if (resumen.vehiculo && resumen.vehiculo.vendedor_nombre) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Vendedor Asignado:', 14, currentY - 2);
            doc.setFont(undefined, 'normal');
            doc.text(`${resumen.vehiculo.vendedor_nombre}`, 55, currentY - 2);
            currentY += 6;
        }

        // SECTION 1: Total Products (for warehouse picking)
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('1. PRODUCTOS A CARGAR (Total)', 14, currentY);
        doc.setFont(undefined, 'normal');
        currentY += 5;

        const headersTotal = [["Producto", "Cant.", "✓"]];
        const dataTotal = resumen.productos.map(p => [p.producto, p.cantidad_total, ""]);

        if (dataTotal.length === 0) {
            mostrarNotificacion('No hay productos cargados en esta hoja de ruta', 'warning');
            return;
        }

        doc.autoTable({
            startY: currentY,
            head: headersTotal,
            body: dataTotal,
            theme: 'grid',
            headStyles: { fillColor: [52, 58, 64], textColor: 255 },
            styles: { fontSize: 10 },
            columnStyles: { 2: { cellWidth: 15 } }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // SECTION 2: Delivery by Client
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('2. ENTREGAS POR CLIENTE', 14, currentY);
        doc.setFont(undefined, 'normal');
        currentY += 10;

        if (resumen.clientes && resumen.clientes.length > 0) {
            resumen.clientes.forEach((cliente, idx) => {
                // Check if we need a new page
                if (currentY > 250) {
                    doc.addPage();
                    currentY = 20;
                }

                // Client header
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                const ordenText = cliente.orden !== 999 ? `Parada ${cliente.orden + 1}` : 'Sin orden';
                doc.text(`${ordenText}: ${cliente.nombre}`, 14, currentY);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(9);
                currentY += 5;
                doc.text(`Dirección: ${cliente.direccion}`, 14, currentY);
                currentY += 5;

                // Support for multiple orders (Discriminated) vs legacy consolidated
                const pedidos = cliente.pedidos || [{ id: 'S/N', productos: cliente.productos }];

                pedidos.forEach(pedido => {
                    if (pedidos.length > 1) {
                        doc.setFont(undefined, 'bold');
                        doc.text(`Pedido #${pedido.id}`, 20, currentY);
                        doc.setFont(undefined, 'normal');
                        currentY += 4;
                    }

                    const tableData = pedido.productos.map(p => [p.producto, p.cantidad, ""]);

                    doc.autoTable({
                        startY: currentY,
                        head: [["Producto", "Cant.", "✓"]],
                        body: tableData,
                        theme: 'striped',
                        headStyles: { fillColor: [40, 167, 69], textColor: 255, fontSize: 9 },
                        styles: { fontSize: 9 },
                        columnStyles: { 2: { cellWidth: 15 } },
                        margin: { left: 20 }
                    });

                    currentY = doc.lastAutoTable.finalY + 5;

                    // New page check inside loop
                    if (currentY > 260) {
                        doc.addPage();
                        currentY = 20;
                    }
                });

                currentY += 5;
            });
        } else {
            doc.text('No hay entregas programadas', 14, currentY);
        }

        doc.save(`Picking_HR_${id}.pdf`);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al generar PDF de Picking', 'error');
    }
}

// Globalizar finales
window.abrirModalLiquidacion = abrirModalLiquidacion;
window.finalizarLiquidacion = finalizarLiquidacion;
window.exportarLiquidacionPDF = exportarLiquidacionPDF;
window.exportarPickingPDF = exportarPickingPDF; // El genérico
window.exportarPickingHR_PDF = exportarPickingHR_PDF; // El de la HR específica

// ===== ASIGNACIÓN DE VEHÍCULO A HR =====

let vehiculosDisponibles = [];
let hojaRutaActualId = null;

async function abrirModalAsignarVehiculo() {
    const hrId = hojaRutaActualId || window.currentHojaRutaId; // Usar variable global si existe
    if (!hrId) {
        mostrarNotificacion('No hay una Hoja de Ruta seleccionada', 'warning');
        return;
    }

    // Cargar vehículos
    try {
        vehiculosDisponibles = await fetchData(`/api/vehiculos?negocio_id=${appState.negocioActivoId}`);
        const select = document.getElementById('select-vehiculo-asignar');
        select.innerHTML = '<option value="">-- Sin asignar --</option>';

        vehiculosDisponibles.forEach(v => {
            if (v.activo) {
                select.appendChild(new Option(
                    `${v.patente} - ${v.modelo} (${v.capacidad_kg}kg)`,
                    v.id
                ));
            }
        });

        // Evento para preview
        select.onchange = () => {
            const vehiculoId = select.value;
            const preview = document.getElementById('preview-capacidad-vehiculo');

            if (vehiculoId) {
                const v = vehiculosDisponibles.find(x => x.id == vehiculoId);
                if (v) {
                    document.getElementById('preview-vehiculo-kg').innerText = `${v.capacidad_kg || 0} Kg`;
                    document.getElementById('preview-vehiculo-m3').innerText = `${v.capacidad_volumen_m3 || 0} m³`;
                    preview.style.display = 'block';
                }
            } else {
                preview.style.display = 'none';
            }
        };

        document.getElementById('modal-asignar-vehiculo').style.display = 'flex';
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar vehículos', 'error');
    }
}

function cerrarModalAsignarVehiculo() {
    document.getElementById('modal-asignar-vehiculo').style.display = 'none';
}

async function confirmarAsignacionVehiculo() {
    const vehiculoId = document.getElementById('select-vehiculo-asignar').value;
    const hrId = hojaRutaActualId || window.currentHojaRutaId;

    if (!hrId) {
        mostrarNotificacion('No hay una Hoja de Ruta seleccionada', 'warning');
        return;
    }

    try {
        // Llamar al endpoint de asignación
        await sendData('/api/vehiculos/carga/asignar', {
            vehiculo_id: vehiculoId || null,
            hoja_ruta_ids: [hrId]
        }, 'POST');

        mostrarNotificacion('Vehículo asignado correctamente', 'success');
        cerrarModalAsignarVehiculo();

        // Recargar detalle de HR para mostrar nuevo vehículo
        if (window.verDetalleHR) {
            verDetalleHR(hrId);
        }
    } catch (error) {
        console.error(error);
        // El error ya se muestra en sendData
    }
}

// Exponer funciones globalmente
window.abrirModalAsignarVehiculo = abrirModalAsignarVehiculo;
window.cerrarModalAsignarVehiculo = cerrarModalAsignarVehiculo;
window.confirmarAsignacionVehiculo = confirmarAsignacionVehiculo;

// ===== CONTROL DE CARGA (MULTI-HR) =====

let cargaStateHR = {
    vehiculoSeleccionado: null,
    hojasRutaDisponibles: [],
    hojasRutaSeleccionadas: []
};

let vehiculosCacheHR = [];

async function inicializarControlCargaHR() {
    // Cargar vehículos
    try {
        vehiculosCacheHR = await fetchData(`/api/vehiculos?negocio_id=${appState.negocioActivoId}`);
        const select = document.getElementById('carga-vehiculo-selector');
        select.innerHTML = '<option value="">-- Selecciona un vehículo --</option>';

        vehiculosCacheHR.forEach(v => {
            if (v.activo) {
                select.appendChild(new Option(
                    `${v.patente} - ${v.modelo} (${v.capacidad_kg}kg / ${v.capacidad_volumen_m3}m³)`,
                    v.id
                ));
            }
        });

        // Evento de cambio de vehículo
        select.onchange = async () => {
            const vehiculoId = select.value;
            if (!vehiculoId) {
                document.getElementById('carga-capacidad-container').style.display = 'none';
                document.getElementById('lista-hojas-ruta-carga').innerHTML = '<p class="text-muted text-center py-4">Selecciona un vehículo para ver las rutas disponibles</p>';
                cargaStateHR.vehiculoSeleccionado = null;
                return;
            }

            cargaStateHR.vehiculoSeleccionado = vehiculosCacheHR.find(v => v.id == vehiculoId);
            document.getElementById('carga-capacidad-container').style.display = 'block';
            resetearCapacidadHR();
            await cargarHojasRutaDisponiblesHR();
        };
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar vehículos', 'error');
    }
}

async function cargarHojasRutaDisponiblesHR() {
    try {
        const hojas = await fetchData(`/api/vehiculos/carga/hojas_ruta_disponibles?negocio_id=${appState.negocioActivoId}`);
        cargaStateHR.hojasRutaDisponibles = hojas;
        renderHojasRutaCargaHR(hojas);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar hojas de ruta', 'error');
    }
}

function renderHojasRutaCargaHR(hojas) {
    const container = document.getElementById('lista-hojas-ruta-carga');

    if (hojas.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No hay Hojas de Ruta disponibles para cargar</p>';
        return;
    }

    const html = hojas.map(hr => {
        const yaAsignada = hr.vehiculo_asignado !== null && hr.vehiculo_asignado !== undefined;
        const disabledAttr = yaAsignada ? 'disabled' : '';
        const cardClass = yaAsignada ? 'card mb-2 border-success opacity-75' : 'card mb-2 hover-shadow-sm cursor-pointer';

        return `
        <div class="${cardClass}" id="card-hr-${hr.id}" onclick="event.target.type !== 'checkbox' && !${yaAsignada} && window.toggleHojaRutaHR(${hr.id}, true)">
            <div class="card-body p-3">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="hr-${hr.id}" value="${hr.id}" onchange="toggleHojaRutaHR(${hr.id})" ${disabledAttr}>
                    <label class="form-check-label w-100" for="hr-${hr.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong class="text-primary-dark">HR #${hr.id}</strong> - ${hr.vendedor_nombre}
                                ${yaAsignada ? `<span class="badge bg-success ms-2"><i class="fas fa-check"></i> Asignada a: ${hr.vehiculo_asignado}</span>` : ''}
                                <br>
                                <small class="text-muted"><i class="far fa-calendar-alt me-1"></i>${hr.fecha} | <i class="fas fa-info-circle me-1"></i>${hr.estado.toUpperCase()} | <i class="fas fa-shopping-cart me-1"></i>Pedidos: ${hr.cantidad_pedidos || 0}</small>
                            </div>
                            <div class="text-end">
                                <div><span class="badge bg-dark rounded-pill">${hr.peso_kg.toFixed(0)} Kg</span></div>
                                <div><span class="badge bg-info rounded-pill text-dark">${hr.volumen_m3.toFixed(2)} m³</span></div>
                            </div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = html;

    // Exponer función globalmente
    window.toggleHojaRutaHR = toggleHojaRutaHR;
}

function toggleHojaRutaHR(hojaRutaId, fromClick = false) {
    const checkbox = document.getElementById(`hr-${hojaRutaId}`);
    const card = document.getElementById(`card-hr-${hojaRutaId}`);

    if (fromClick) {
        checkbox.checked = !checkbox.checked;
    }

    if (checkbox.checked) {
        cargaStateHR.hojasRutaSeleccionadas.push(hojaRutaId);
        if (card) card.classList.add('table-active', 'border-primary');
    } else {
        cargaStateHR.hojasRutaSeleccionadas = cargaStateHR.hojasRutaSeleccionadas.filter(id => id !== hojaRutaId);
        if (card) card.classList.remove('table-active', 'border-primary');
    }
    actualizarCapacidadHR();
}

function actualizarCapacidadHR() {
    const vehiculo = cargaStateHR.vehiculoSeleccionado;
    if (!vehiculo) return;

    // Calcular totales de las HR seleccionadas
    let pesoTotal = 0;
    let volumenTotal = 0;
    const listaBadges = document.getElementById('lista-badges-hrs');
    const panelResumen = document.getElementById('resumen-hrs-seleccionadas');

    listaBadges.innerHTML = '';
    
    cargaStateHR.hojasRutaSeleccionadas.forEach(id => {
        const hr = cargaStateHR.hojasRutaDisponibles.find(h => h.id === id);
        if (hr) {
            pesoTotal += parseFloat(hr.peso_kg || 0);
            volumenTotal += parseFloat(hr.volumen_m3 || 0);

            // Crear badge dinámico en el panel de la izquierda
            const badge = document.createElement('span');
            badge.className = 'badge bg-primary-light text-primary border border-primary-soft shadow-sm';
            badge.style.cursor = 'default';
            badge.innerHTML = `<i class="fas fa-file-invoice me-1"></i>#${id}`;
            listaBadges.appendChild(badge);
        }
    });

    // Mostrar panel si hay algo o no
    panelResumen.style.display = (cargaStateHR.hojasRutaSeleccionadas.length > 0) ? 'block' : 'none';

    const capPeso = parseFloat(vehiculo.capacidad_kg || 0);
    const capVolumen = parseFloat(vehiculo.capacidad_volumen_m3 || 0);

    // Actualizar labels
    document.getElementById('carga-peso-label').innerText = `${pesoTotal.toFixed(0)} / ${capPeso.toFixed(0)} Kg`;
    document.getElementById('carga-volumen-label').innerText = `${volumenTotal.toFixed(2)} / ${capVolumen.toFixed(2)} m³`;

    // Actualizar barras
    const porcPeso = capPeso > 0 ? Math.min((pesoTotal / capPeso) * 100, 100) : 0;
    const porcVolumen = capVolumen > 0 ? Math.min((volumenTotal / capVolumen) * 100, 100) : 0;

    const barraPeso = document.getElementById('carga-peso-barra');
    const barraVolumen = document.getElementById('carga-volumen-barra');

    barraPeso.style.width = `${porcPeso}%`;
    barraVolumen.style.width = `${porcVolumen}%`;

    // Cambiar color según exceso
    barraPeso.className = 'progress-bar ' + (porcPeso > 100 ? 'bg-danger' : porcPeso > 80 ? 'bg-warning' : 'bg-success');
    barraVolumen.className = 'progress-bar ' + (porcVolumen > 100 ? 'bg-danger' : porcVolumen > 80 ? 'bg-warning' : 'bg-info');
}

/**
 * ✨ Baboons Premium: Modal de Stock Insuficiente
 * Crea un modal dinámico con Glassmorphism para informar al usuario sobre 
 * los productos que faltan en el depósito.
 */
function mostrarModalStockInsuficiente(detalles) {
    const existing = document.getElementById('modal-stock-error-premium');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-stock-error-premium';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        z-index: 10000; display: flex; align-items: center; justify-content: center;
        animation: baboonsFadeIn 0.3s ease-out; opacity: 1; transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        max-width: 500px; width: 90%; border-radius: 28px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        padding: 30px; position: relative; border: 1px solid rgba(255, 255, 255, 0.3);
        transform: translateY(0); animation: baboonsSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    `;

    const iconHeader = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 70px; height: 70px; background: rgba(239, 68, 68, 0.1); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                <i class="fas fa-box-open" style="font-size: 2rem; color: #dc2626;"></i>
            </div>
            <h3 style="margin: 0; font-weight: 800; color: #1f2937; letter-spacing: -0.5px;">Stock Insuficiente</h3>
            <p style="color: #6b7280; font-size: 0.95rem; margin-top: 5px;">No hay existencias suficientes en el depósito central.</p>
        </div>
    `;

    let listHtml = '<div style="background: #f9fafb; border-radius: 18px; padding: 15px; margin-bottom: 25px; max-height: 250px; overflow-y: auto; border: 1px solid #f3f4f6;">';
    detalles.forEach(d => {
        listHtml += `
            <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px; padding: 8px; border-bottom: 1px solid #f1f5f9;">
                <i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-top: 4px; font-size: 0.9rem;"></i>
                <span style="font-weight: 600; color: #374151; font-size: 0.9rem;">${d}</span>
            </div>
        `;
    });
    listHtml += '</div>';

    const footerHtml = `
        <div style="background: rgba(37, 99, 235, 0.05); border-radius: 14px; padding: 12px; margin-bottom: 25px; display: flex; gap: 10px; align-items: center;">
            <i class="fas fa-lightbulb" style="color: #2563eb;"></i>
            <span style="color: #1e40af; font-size: 0.8rem; line-height: 1.4;">
                <strong>Tip Baboons:</strong> Si necesitas cargar el camión de todas formas, un administrador puede habilitar <em>"Stock Negativo"</em> en la configuración.
            </span>
        </div>
        <button id="btn-close-stock-error" style="
            width: 100%; padding: 14px; border-radius: 14px; border: none;
            background: #1f2937; color: white; font-weight: 700; font-size: 1rem;
            cursor: pointer; transition: all 0.2s ease;
        ">
            Entendido
        </button>
    `;

    modal.innerHTML = iconHeader + listHtml + footerHtml;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (!document.getElementById('baboons-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'baboons-modal-styles';
        style.innerHTML = `
            @keyframes baboonsFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes baboonsSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            #btn-close-stock-error:hover { background: #111827 !important; transform: translateY(-2px); }
            #btn-close-stock-error:active { transform: translateY(0); }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('btn-close-stock-error').onclick = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) document.getElementById('btn-close-stock-error').click();
    };
}

function resetearCapacidadHR() {
    cargaStateHR.hojasRutaSeleccionadas = [];
    document.getElementById('carga-peso-label').innerText = '0 / 0 Kg';
    document.getElementById('carga-volumen-label').innerText = '0 / 0 m³';
    document.getElementById('carga-peso-barra').style.width = '0%';
    document.getElementById('carga-volumen-barra').style.width = '0%';
}

async function confirmarCargaVehiculoMultiple() {
    if (!cargaStateHR.vehiculoSeleccionado) {
        mostrarNotificacion('Selecciona un vehículo primero', 'warning');
        return;
    }

    if (cargaStateHR.hojasRutaSeleccionadas.length === 0) {
        mostrarNotificacion('Selecciona al menos una Hoja de Ruta', 'warning');
        return;
    }

    try {
        const response = await sendData('/api/vehiculos/carga/asignar', {
            vehiculo_id: cargaStateHR.vehiculoSeleccionado.id,
            hoja_ruta_ids: cargaStateHR.hojasRutaSeleccionadas
        }, 'POST');

        mostrarNotificacion(response.message || 'Carga asignada con éxito', 'success');

        // Resetear
        cargaStateHR.hojasRutaSeleccionadas = [];
        await cargarHojasRutaDisponiblesHR();
        resetearCapacidadHR();

    } catch (error) {
        console.error(error);
        
        if (error.status === 409 && error.data && error.data.detalles) {
            mostrarModalStockInsuficiente(error.data.detalles);
        } else {
            // El error ya se muestra en sendData/handleApiResponse (pero reforzamos con notificación directa)
            mostrarNotificacion(error.message || 'Error al confirmar la carga', 'error');
        }
    }
}

// Exponer función globalmente
window.confirmarCargaVehiculoMultiple = confirmarCargaVehiculoMultiple;
window.resetearCapacidadHR = resetearCapacidadHR;
// --- Inventario Móvil ---

async function inicializarInventarioMovil() {
    const select = document.getElementById('select-vehiculo-stock');
    if (!select) return;

    // Si ya tenemos vehículos en cache, los usamos
    if (vehiculosCache.length === 0) {
        try {
            const data = await fetchData(`/api/logistica/vehiculos?negocio_id=${appState.negocioId}`);
            vehiculosCache = data;
        } catch (e) {
            console.error("Error cargando vehículos para stock:", e);
        }
    }

    // Llenar selector
    select.innerHTML = '<option value="">-- Selecciona un Vehículo --</option>';
    vehiculosCache.forEach(v => {
        select.innerHTML += `<option value="${v.id}">${v.modelo} (${v.patente})</option>`;
    });

    // Reset UI
    document.getElementById('stock-vehiculo-vacio').style.display = 'block';
    document.getElementById('container-tabla-stock-vehiculo').style.display = 'none';
}

async function cargarStockVehiculo(vehiculoId) {
    if (!vehiculoId) {
        document.getElementById('stock-vehiculo-vacio').style.display = 'block';
        document.getElementById('container-tabla-stock-vehiculo').style.display = 'none';
        return;
    }

    try {
        const data = await fetchData(`/api/vehiculos/${vehiculoId}/stock`);
        mostrarStockVehiculo(data);
    } catch (e) {
        mostrarNotificacion("Error al cargar el stock del vehículo", "danger");
    }
}

function mostrarStockVehiculo(items) {
    const tbody = document.querySelector('#tabla-stock-vehiculo tbody');
    const container = document.getElementById('container-tabla-stock-vehiculo');
    const vacio = document.getElementById('stock-vehiculo-vacio');

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Este vehículo no tiene mercadería cargada actualmente.</td></tr>';
    } else {
        items.forEach(it => {
            const fecha = it.last_updated ? new Date(it.last_updated).toLocaleString() : '-';
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${it.producto_nombre}</td>
                    <td class="text-center">
                        <span class="badge ${it.cantidad > 0 ? 'bg-success' : 'bg-warning'} fs-6">
                            ${it.cantidad}
                        </span>
                    </td>
                    <td class="text-center text-muted small">${fecha}</td>
                </tr>
            `;
        });
    }

    vacio.style.display = 'none';
    container.style.display = 'block';
}

window.inicializarControlCargaHR = inicializarControlCargaHR;
