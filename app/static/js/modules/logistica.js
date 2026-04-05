import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let vehiculosCache = [];

export async function inicializarLogistica() {
    console.log("🚛 [Logística] Inicializando módulo...");
    if (!appState.negocioActivoId) {
        mostrarNotificacion('No se seleccionó un negocio', 'error');
        return;
    }

    // --- 1. Inicializar Tabs del Modal de Vehículo ---
    const vehicleTabs = document.querySelectorAll('#vehiculoTabs .nav-link');
    vehicleTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabEl = e.currentTarget;
            const targetId = tabEl.getAttribute('data-tab');
            if (!targetId) return;

            vehicleTabs.forEach(t => t.classList.remove('active'));
            tabEl.classList.add('active');

            document.querySelectorAll('#form-vehiculo .tab-content').forEach(c => c.style.display = 'none');
            const targetElement = document.getElementById(`tab-${targetId}`);
            if (targetElement) targetElement.style.display = 'block';
        });
    });

    // --- 2. Listeners de Formularios ---
    const formVehiculo = document.getElementById('form-vehiculo');
    if (formVehiculo) {
        formVehiculo.onsubmit = async (e) => {
            e.preventDefault();
            await guardarVehiculo();
        };
    }

    const formMotivo = document.getElementById('form-motivo-rebote');
    if (formMotivo) {
        formMotivo.onsubmit = async (e) => {
            e.preventDefault();
            await guardarMotivo();
        };
    }

    // --- 3. Registrar Globales para HTML ---
    window.abrirModalVehiculo = abrirModalVehiculo;
    window.editarVehiculo = editarVehiculo;
    window.cerrarModalVehiculo = cerrarModalVehiculo;
    window.subirDocumentoVehiculo = subirDocumentoVehiculo;

    window.cambiarVistaLogistica = cambiarVistaLogistica;
    window.cargarMotivosLogistica = cargarMotivosLogistica;
    window.abrirModalMotivo = abrirModalMotivo;
    window.cerrarModalMotivo = cerrarModalMotivo;
    window.abrirModoRepartidor = abrirModoRepartidor;
    window.cerrarModoRepartidor = cerrarModoRepartidor;
    window.abrirModalEntrega = abrirModalEntrega;
    window.cerrarModalEntrega = cerrarModalEntrega;
    window.guardarEntregaChofer = guardarEntregaChofer;
    window.editarMotivo = editarMotivo;
    window.toggleEstadoMotivo = toggleEstadoMotivo;
    window.eliminarMotivo = eliminarMotivo;
    window.confirmarEntregaBackend = confirmarEntregaBackend;

    // --- 4. Cargar Datos Iniciales ---
    try {
        await Promise.all([
            cargarVehiculos(),
            cargarChoferes(),
            cargarMotivosLogistica()
        ]);
    } catch (error) {
        // 3. Improving error reporting in the catch block
        console.error("Error crítico en inicialización de logística:", error);
        mostrarNotificacion('Error al cargar datos de logística', 'error');
    }
}

async function cargarVehiculos() {
    try {
        const vehiculos = await fetchData(`/api/vehiculos?negocio_id=${appState.negocioActivoId}`);
        vehiculosCache = vehiculos;
        renderVehiculos(vehiculos);
    } catch (error) { 
        console.error("Error cargando vehículos:", error); 
    }
}

async function cargarChoferes() {
    try {
        const choferes = await fetchData(`/api/empleados?negocio_id=${appState.negocioActivoId}&rol=chofer&activo=true`);
        const select = document.getElementById('vehiculo-chofer');
        if (select) {
            select.innerHTML = '<option value="">Sin asignar</option>';
            choferes.forEach(c => {
                const opt = new Option(`${c.nombre} ${c.apellido}`, c.id);
                select.appendChild(opt);
            });
        }
    } catch (e) { 
        console.error("Error cargando choferes:", e);
    }
}

function renderVehiculos(vehiculos) {
    const tbody = document.getElementById('lista-vehiculos');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (vehiculos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay vehículos registrados</td></tr>';
        return;
    }

    vehiculos.forEach(v => {
        const tr = document.createElement('tr');
        const badgePropiedad = v.propiedad === 'propio' ? 
            '<span class="badge bg-success-soft text-success">Propio</span>' : 
            '<span class="badge bg-info-soft text-info">Terceros</span>';
        
        const badgeEstado = v.activo ? 
            '<span class="badge bg-success">Activo</span>' : 
            '<span class="badge bg-danger">Inactivo</span>';

        // Determinar icono por tipo
        let icon = 'fas fa-truck';
        if (v.tipo_vehiculo === 'utilitario') icon = 'fas fa-shuttle-van';
        if (v.tipo_vehiculo === 'tractor') icon = 'fas fa-truck-pickup';

        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="rounded-circle bg-light p-2 me-3">
                        <i class="${icon} text-primary"></i>
                    </div>
                    <span class="text-capitalize small fw-bold">${v.tipo_vehiculo.replace('_', ' ')}</span>
                </div>
            </td>
            <td>
                <div class="fw-bold text-dark">${v.patente}</div>
                <div class="small text-muted">${v.modelo}</div>
            </td>
            <td>${badgePropiedad}</td>
            <td class="text-center">
                <div class="small"><b>${v.capacidad_kg || 0}</b> kg</div>
                <div class="small text-muted">${v.capacidad_volumen_m3 || 0} m³</div>
            </td>
            <td class="text-center">${badgeEstado}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-light border shadow-sm" onclick="editarVehiculo(${v.id})">
                    <i class="fas fa-edit text-primary"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalVehiculo() {
    document.getElementById('form-vehiculo').reset();
    document.getElementById('vehiculo-id').value = '';
    document.getElementById('modal-vehiculo-titulo').innerText = 'Nuevo Vehículo';
    
    // Reset tabs
    document.querySelector('#vehiculoTabs .nav-link[data-tab="datos-tecnicos"]').click();
    
    const m = document.getElementById('modal-vehiculo');
    if (m) m.style.display = 'flex';
}

function cerrarModalVehiculo() {
    const m = document.getElementById('modal-vehiculo');
    if (m) m.style.display = 'none';
}

function editarVehiculo(id) {
    const v = vehiculosCache.find(v => v.id === id);
    if (!v) return;

    abrirModalVehiculo();
    document.getElementById('modal-vehiculo-titulo').innerText = 'Editar Vehículo';
    
    document.getElementById('vehiculo-id').value = v.id;
    document.getElementById('vehiculo-patente').value = v.patente;
    document.getElementById('vehiculo-modelo').value = v.modelo;
    document.getElementById('vehiculo-tipo').value = v.tipo_vehiculo || 'utilitario';
    document.getElementById('vehiculo-propiedad').value = v.propiedad || 'propio';
    document.getElementById('vehiculo-kg').value = v.capacidad_kg || 0;
    document.getElementById('vehiculo-m3').value = v.capacidad_volumen_m3 || 0;
    document.getElementById('vehiculo-pallets').value = v.capacidad_pallets || 0;
    document.getElementById('vehiculo-chofer').value = v.chofer_default_id || '';
    document.getElementById('vehiculo-activo').checked = !!v.activo;

    // Cargar documentos si es edición
    cargarDocumentosVehiculo(v.id);
}

async function guardarVehiculo() {
    const id = document.getElementById('vehiculo-id').value;
    const data = {
        patente: document.getElementById('vehiculo-patente').value,
        modelo: document.getElementById('vehiculo-modelo').value,
        tipo_vehiculo: document.getElementById('vehiculo-tipo').value,
        propiedad: document.getElementById('vehiculo-propiedad').value,
        capacidad_kg: parseFloat(document.getElementById('vehiculo-kg').value || 0),
        capacidad_volumen_m3: parseFloat(document.getElementById('vehiculo-m3').value || 0),
        capacidad_pallets: parseInt(document.getElementById('vehiculo-pallets').value || 0),
        chofer_default_id: document.getElementById('vehiculo-chofer').value || null,
        activo: document.getElementById('vehiculo-activo').checked,
        negocio_id: appState.negocioActivoId
    };

    try {
        let res;
        if (id) {
            res = await sendData(`/api/vehiculos/${id}`, data, 'PUT');
        } else {
            res = await sendData('/api/vehiculos', data, 'POST');
        }
        
        mostrarNotificacion(res.mensaje || 'Operación exitosa', 'success');
        cerrarModalVehiculo();
        cargarVehiculos(); // Recargar lista
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- Documentación ---

async function cargarDocumentosVehiculo(vehiculoId) {
    const tbody = document.getElementById('lista-docs-vehiculo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const docs = await fetchData(`/api/vehiculos/${vehiculoId}/documentacion`);
        tbody.innerHTML = '';
        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay documentos cargados</td></tr>';
            return;
        }

        docs.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.tipo_documento.replace('_', ' ').toUpperCase()}</td>
                <td>${d.fecha_vencimiento}</td>
                <td><span class="badge bg-light text-dark border">Cargado</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarDocumento(${d.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error cargando docs</td></tr>';
    }
}

async function subirDocumentoVehiculo() {
    const vehiculoId = document.getElementById('vehiculo-id').value;
    if (!vehiculoId) {
        mostrarNotificacion('Primero guarda el vehículo', 'warning');
        return;
    }

    const data = {
        tipo_documento: document.getElementById('doc-tipo').value,
        fecha_vencimiento: document.getElementById('doc-vencimiento').value,
        observaciones: document.getElementById('doc-obs').value
    };

    if (!data.fecha_vencimiento) {
        mostrarNotificacion('Indica la fecha de vencimiento', 'warning');
        return;
    }

    try {
        await sendData(`/api/vehiculos/${vehiculoId}/documentacion`, data, 'POST');
        mostrarNotificacion('Documento registrado', 'success');
        cargarDocumentosVehiculo(vehiculoId);
        // Limpiar campos
        document.getElementById('doc-vencimiento').value = '';
        document.getElementById('doc-obs').value = '';
    } catch (e) {
        mostrarNotificacion(e.message, 'error');
    }
}

// --- ✨ MODO REPARTIDOR & ENTREGA (PREMIUM) ---

export function cerrarModoRepartidor() {
    const modal = document.getElementById('modal-modo-repartidor');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
    }
}

export async function abrirModoRepartidor(hrId) {
    console.log("🚛 [ModoRepartidor] Abriendo para HR:", hrId);
    let modal = document.getElementById('modal-modo-repartidor');
    if (!modal) return;
    
    if (modal.parentElement !== document.body) document.body.appendChild(modal);

    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '9999', 'important');

    const title = document.getElementById('repartidor-titulo-ruta');
    if (title) {
        title.innerText = `Cargando Hoja de Ruta #${hrId}...`;
        title.dataset.hrId = hrId;
    }

    const container = document.getElementById('repartidor-lista-paradas');
    if (container) container.innerHTML = '<div class="text-center py-5 text-muted col-12"><i class="fas fa-circle-notch fa-spin fa-3x mb-3 text-primary"></i><br>Cargando ruta...</div>';

    try {
        if (!appState.negocioActivoId) {
            throw new Error("No hay un negocio activo seleccionado.");
        }

        const [detalle, pedidos] = await Promise.all([
            fetchData(`/api/hoja_ruta/${hrId}`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/pedidos?hoja_ruta_id=${hrId}`)
        ]);

        if (title) title.innerText = `HR #${detalle.id} - ${detalle.fecha}`;

        const pArr = Array.isArray(pedidos) ? pedidos : (pedidos.pedidos || []);
        // Copy to consume without affecting original
        const availablePedidos = [...pArr];

        container.innerHTML = '';
        container.className = 'row g-3 p-3'; // Desktop grid
        let visitadosCount = 0;
        const items = detalle.items || [];
        const totalItems = items.length;

        items.forEach((it, idx) => {
            // Find ALL orders for this stop
            const stopOrders = [];
            
            // 1. By explicit ID match
            if (it.id_pedido) {
                const pIdx = availablePedidos.findIndex(ped => ped.id == it.id_pedido);
                if (pIdx !== -1) stopOrders.push(availablePedidos.splice(pIdx, 1)[0]);
            }
            
            // 2. By client match (find all remaining for this client)
            let pIdx;
            while ((pIdx = availablePedidos.findIndex(ped => ped.cliente_id == it.cliente_id)) !== -1) {
                stopOrders.push(availablePedidos.splice(pIdx, 1)[0]);
            }

            const div = document.createElement('div');
            div.className = 'col-12 col-lg-6'; 
            
            const hasOrders = stopOrders.length > 0;
            const totalMonto = stopOrders.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
            const idsStr = stopOrders.map(p => `#${p.id}`).join(', ');
            
            // Check if ALL orders in this stop are delivered
            const allEntregados = hasOrders && stopOrders.every(p => p.estado === 'entregado');
            const allPagados = hasOrders && stopOrders.every(p => p.pagado);
            const isVisitado = it.visitado || allEntregados;
            
            if (isVisitado) visitadosCount++;

            let statusHtml = '';
            let actionBtn = '';
            const totalStr = hasOrders ? `$${totalMonto.toLocaleString('es-AR')}` : '';

            if (!hasOrders) {
                statusHtml = '<span class="badge-soft bg-secondary-soft">SIN PEDIDO</span>';
            } else if (allEntregados && allPagados) {
                statusHtml = '<span class="badge-soft bg-success-soft"><i class="fas fa-check-circle me-1"></i>ENTREGADO/PAGADO</span>';
                actionBtn = `<button class="btn btn-outline-secondary btn-lg rounded-pill w-100 mt-3" onclick="window.abrirModalEntregaMulti(${JSON.stringify(stopOrders).replace(/"/g, '&quot;')}, true)"><i class="fas fa-eye me-1"></i>Ver Detalles</button>`;
            } else if (allEntregados) {
                statusHtml = '<span class="badge-soft bg-warning-soft"><i class="fas fa-hand-holding-usd me-1"></i>POR COBRAR</span>';
                actionBtn = `<button class="btn btn-warning btn-lg w-100 fw-bold rounded-pill mt-3 shadow-sm" onclick="window.abrirModalEntregaMulti(${JSON.stringify(stopOrders).replace(/"/g, '&quot;')}, true)"><i class="fas fa-hand-holding-usd me-1"></i>COBRAR ${totalStr}</button>`;
            } else {
                statusHtml = '<span class="badge-soft bg-primary-soft"><i class="fas fa-shipping-fast me-1"></i>EN CAMINO</span>';
                actionBtn = `<button class="btn btn-primary btn-lg w-100 fw-bold rounded-pill mt-3 shadow-sm" onclick="window.abrirModalEntregaMulti(${JSON.stringify(stopOrders).replace(/"/g, '&quot;')}, false)"><i class="fas fa-shipping-fast me-1"></i>ENTREGAR TODO</button>`;
            }

            const mapsUrl = it.cliente_direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.cliente_direccion)}` : '#';

            div.innerHTML = `
                <div class="card-parada p-3 position-relative ${isVisitado ? 'visitado' : ''}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center gap-3">
                            <div class="parada-number">${idx + 1}</div>
                            <div>
                                <h6 class="mb-1 fw-bold text-dark text-truncate" style="max-width: 220px;">
                                    ${it.cliente_nombre} <span class="badge bg-light text-dark border ms-1" style="font-size: 0.7em;">${idsStr}</span>
                                </h6>
                                <div class="d-flex align-items-center gap-1">
                                    <a href="${mapsUrl}" target="_blank" class="small text-primary text-decoration-none">
                                        <i class="fas fa-map-marker-alt me-1"></i>${it.cliente_direccion || 'Sin dirección'}
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-primary h6 mb-1">${totalStr}</div>
                            ${statusHtml}
                        </div>
                    </div>
                    ${actionBtn}
                </div>
            `;
            container.appendChild(div);
        });

        const progressPct = items.length > 0 ? Math.round((visitadosCount / items.length) * 100) : 0;
        const fill = document.getElementById('repartidor-progress-fill');
        const text = document.getElementById('repartidor-progress-text');
        if (fill) fill.style.width = `${progressPct}%`;
        if (text) text.innerText = `${progressPct}%`;

    } catch (e) {
        console.error(e);
        const container = document.getElementById('repartidor-lista-paradas');
        if (container) container.innerHTML = `<div class="alert alert-danger mx-3 mt-3">Error: ${e.message}</div>`;
    }
}

export async function abrirModalEntregaMulti(pedidos, isCobroSolamente = false) {
    if (!pedidos || pedidos.length === 0) return;
    const modal = document.getElementById("modal-confirmar-entrega");
    if (!modal) return;
    if (modal.parentElement !== document.body) document.body.appendChild(modal);

    const totalSuma = pedidos.reduce((acc, p) => acc + parseFloat(p.total || 0), 0);
    const idsStr = pedidos.map(p => p.id).join(',');

    const pidEl = document.getElementById("entrega-pedido-id");
    if (pidEl) {
        pidEl.value = idsStr;
        pidEl.dataset.soloCobro = isCobroSolamente ? "true" : "false";
        pidEl.dataset.total = totalSuma;
    }

    const hId = document.getElementById("entrega-pedido-id-header");
    if (hId) hId.innerText = `(${pedidos.length} Pedido${pedidos.length > 1 ? 's' : ''}: #${idsStr})`;

    const totalEl = document.getElementById("entrega-monto-total");
    if (totalEl) totalEl.innerText = `$${totalSuma.toLocaleString('es-AR')}`;

    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '10000', 'important');

    // Reset panel mixto y campos
    const panelMixto = document.getElementById("panel-pago-mixto");
    if (panelMixto) panelMixto.style.display = "none";
    
    const radioEfectivo = document.getElementById("pago-efectivo");
    if (radioEfectivo) radioEfectivo.checked = true;

    const efInp = document.getElementById("monto-efectivo-mixto");
    const mpInp = document.getElementById("monto-mp-mixto");
    if (efInp) efInp.value = "";
    if (mpInp) mpInp.value = "";
    
    const saldoCtacte = document.getElementById("mixto-saldo-ctacte");
    if (saldoCtacte) saldoCtacte.innerText = "$0";

    // Setup Mix Listeners (once)
    if (!window._mixListenersSet) {
        document.querySelectorAll('input[name="metodoPago"]').forEach(r => {
            r.addEventListener('change', (e) => {
                const pMixto = document.getElementById("panel-pago-mixto");
                if (pMixto) pMixto.style.display = (e.target.value === 'Mixto') ? 'block' : 'none';
            });
        });
        const updateMixto = () => {
            const tot = parseFloat(document.getElementById("entrega-pedido-id").dataset.total || 0);
            const efValue = parseFloat(document.getElementById("monto-efectivo-mixto").value || 0);
            const mpValue = parseFloat(document.getElementById("monto-mp-mixto").value || 0);
            const sld = Math.max(0, tot - efValue - mpValue);
            const sldCtacte = document.getElementById("mixto-saldo-ctacte");
            if (sldCtacte) sldCtacte.innerText = `$${sld.toLocaleString('es-AR')}`;
        };
        if (efInp) efInp.addEventListener('input', updateMixto);
        if (mpInp) mpInp.addEventListener('input', updateMixto);
        window._mixListenersSet = true;
    }

    // Load consolidate summary
    const resDiv = document.getElementById("entrega-resumen-items");
    if (resDiv) {
        resDiv.innerHTML = '<div class="text-center py-2"><i class="fas fa-spinner fa-spin"></i> Cargando resumen...</div>';
        try {
            let htmlDetalle = '<ul class="list-unstyled mb-0 small">';
            for(const p of pedidos) {
                const d = await fetchData(`/api/pedidos/${p.id}`);
                (d.detalles || []).forEach(it => {
                    htmlDetalle += `<li><span class="text-muted">#${p.id}</span> <b>${it.cantidad}</b>x ${it.producto_nombre}</li>`;
                });
            }
            htmlDetalle += '</ul>';
            resDiv.innerHTML = htmlDetalle;
        } catch (e) { 
            resDiv.innerHTML = '<div class="text-danger small">Error al cargar detalles.</div>';
        }
    }
}

export async function abrirModalEntrega(pedido, isCobroSolamente = false) {
    return abrirModalEntregaMulti([pedido], isCobroSolamente);
}

export function cerrarModalEntrega() {
    const modal = document.getElementById('modal-confirmar-entrega');
    if (modal) modal.style.setProperty('display', 'none', 'important');
}

export async function confirmarEntregaBackend() {
    const idsRaw = document.getElementById("entrega-pedido-id").value;
    const isCobro = document.getElementById("entrega-pedido-id").dataset.soloCobro === "true";
    const ids = (idsRaw || "").split(',').filter(x => x);

    if (ids.length === 0) return;

    const radio = document.querySelector('input[name="metodoPago"]:checked');
    if (!radio) {
        mostrarNotificacion("Seleccione un método de pago", "warning");
        return;
    }
    
    // Si es mixto, dividimos el pago proporcionalmente (simplificación técnica)
    const basePayload = { metodo_pago: radio.value };
    if (radio.value === 'Mixto') {
        const efTotal = parseFloat(document.getElementById("monto-efectivo-mixto").value || 0);
        const mpTotal = parseFloat(document.getElementById("monto-mp-mixto").value || 0);
        basePayload.monto_efectivo = efTotal / ids.length;
        basePayload.monto_mp = mpTotal / ids.length;
    }
    if (isCobro) basePayload.solo_cobro = true;

    try {
        for (const pid of ids) {
            await sendData(`/api/pedidos/${pid}/entregar`, basePayload, "POST");
        }

        mostrarNotificacion(`✅ ${ids.length} pedido(s) procesado(s)`, "success");
        cerrarModalEntrega();
        
        const title = document.getElementById('repartidor-titulo-ruta');
        if (title) {
            const hrId = title.dataset.hrId || (title.innerText.match(/#(\d+)/) || [])[1];
            if (hrId) abrirModoRepartidor(hrId);
        }
    } catch (e) {
        mostrarNotificacion("Error en proceso: " + e.message, 'error');
    }
}
window.abrirModalEntregaMulti = abrirModalEntregaMulti;
// =================================================================
// GESTIÓN DE MOTIVOS DE REBOTE (ABM)
// =================================================================

function cambiarVistaLogistica(vista) {
    const btnV = document.getElementById('btn-nuevo-vehiculo');
    const btnM = document.getElementById('btn-nuevo-motivos');
    
    if (vista === 'vehiculos') {
        btnV.style.display = 'block';
        btnM.style.display = 'none';
        cargarVehiculos();
    } else {
        btnV.style.display = 'none';
        btnM.style.display = 'block';
        cargarMotivosLogistica();
    }
}

async function cargarMotivosLogistica() {
    const tbody = document.getElementById('lista-motivos-rebote');
    if (!tbody) return;
    
    try {
        const motivos = await fetchData(`/api/negocios/${appState.negocioActivoId}/motivos_rebote`);
        renderMotivosLogistica(motivos);
    } catch (e) {
        console.error("Error cargando motivos:", e);
    }
}

function renderMotivosLogistica(motivos) {
    const tbody = document.getElementById('lista-motivos-rebote');
    tbody.innerHTML = '';
    
    if (motivos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No hay motivos configurados</td></tr>';
        return;
    }
    
    motivos.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold">${m.descripcion}</div>
                <small class="text-muted">ID: #${m.id}</small>
            </td>
            <td class="text-center">
                <span class="badge ${m.activo ? 'bg-success' : 'bg-secondary'} rounded-pill">
                    ${m.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-end pe-4">
                <div class="btn-group shadow-sm">
                    <button class="btn btn-sm btn-light" onclick="editarMotivo(${m.id}, '${m.descripcion}', ${m.activo})">
                        <i class="fas fa-edit text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-light" onclick="toggleEstadoMotivo(${m.id}, ${m.activo})">
                        <i class="fas ${m.activo ? 'fa-ban text-danger' : 'fa-check text-success'}"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalMotivo() {
    document.getElementById('modal-motivo-titulo').innerText = 'Nuevo Motivo de Rebote';
    document.getElementById('form-motivo-rebote').reset();
    document.getElementById('motivo-id').value = '';
    document.getElementById('motivo-activo').checked = true;
    
    // Sincronizar etiqueta de estado premium
    const lbl = document.getElementById('motivo-status-label');
    if (lbl) {
        lbl.innerText = 'ACTIVO';
        lbl.className = 'status-badge-text status-badge-active';
    }
    
    document.getElementById('modal-motivo-rebote').style.display = 'flex';
}

function editarMotivo(id, descripcion, activo) {
    document.getElementById('modal-motivo-titulo').innerText = 'Editar Motivo de Rebote';
    document.getElementById('motivo-id').value = id;
    document.getElementById('motivo-descripcion').value = descripcion;
    document.getElementById('motivo-activo').checked = activo;
    
    // Sincronizar etiqueta de estado premium
    const lbl = document.getElementById('motivo-status-label');
    if (lbl) {
        lbl.innerText = activo ? 'ACTIVO' : 'INACTIVO';
        lbl.className = activo ? 'status-badge-text status-badge-active' : 'status-badge-text status-badge-inactive';
    }

    document.getElementById('modal-motivo-rebote').style.display = 'flex';
}

function cerrarModalMotivo() {
    document.getElementById('modal-motivo-rebote').style.display = 'none';
}

async function guardarMotivo() {
    const id = document.getElementById('motivo-id').value;
    const payload = {
        descripcion: document.getElementById('motivo-descripcion').value,
        activo: document.getElementById('motivo-activo').checked,
        negocio_id: appState.negocioActivoId
    };
    
    try {
        let result;
        if (id) {
            result = await sendData(`/api/motivos_rebote/${id}`, payload, 'PUT');
        } else {
            result = await sendData('/api/motivos_rebote', payload, 'POST');
        }
        
        mostrarNotificacion(result.message || 'Motivo guardado con éxito');
        cerrarModalMotivo();
        cargarMotivosLogistica();
    } catch (e) {
        mostrarNotificacion('Error al guardar el motivo: ' + e.message, 'error');
    }
}

async function toggleEstadoMotivo(id, estadoActual) {
    try {
        await sendData(`/api/motivos_rebote/${id}`, { activo: !estadoActual }, 'PUT');
        mostrarNotificacion('Estado actualizado');
        cargarMotivosLogistica();
    } catch (e) {
        mostrarNotificacion('Error al actualizar estado: ' + e.message, 'error');
    }
}

async function eliminarMotivo(id) {
    if (!confirm('¿Está seguro de eliminar este motivo?')) return;
    try {
        await fetchData(`/api/motivos_rebote/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Motivo eliminado');
        cargarMotivosLogistica();
    } catch (e) {
        mostrarNotificacion('Error al eliminar', 'error');
    }
}

// --- ✨ REGISTRO GLOBAL DE FUNCIONES ---
window.abrirModalVehiculo = abrirModalVehiculo;
window.cerrarModalVehiculo = cerrarModalVehiculo;
window.abrirModoRepartidor = abrirModoRepartidor;
window.cerrarModoRepartidor = cerrarModoRepartidor;
window.abrirModalEntrega = abrirModalEntrega;
window.cerrarModalEntrega = cerrarModalEntrega;
window.confirmarEntregaBackend = confirmarEntregaBackend;
window.cambiarVistaLogistica = cambiarVistaLogistica;
window.abrirModalMotivo = abrirModalMotivo;
window.cerrarModalMotivo = cerrarModalMotivo;
window.editarMotivo = editarMotivo;
window.eliminarMotivo = eliminarMotivo;
window.toggleEstadoMotivo = toggleEstadoMotivo;
window.guardarMotivo = guardarMotivo;
