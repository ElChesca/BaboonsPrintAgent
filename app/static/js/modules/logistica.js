import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let vehiculosCache = [];

export async function inicializarLogistica() {
    console.log("Inicializando lógica de Logística / Flota...");
    if (!appState.negocioActivoId) {
        mostrarNotificacion('No se seleccionó un negocio', 'error');
        return;
    }

    // Bind Main Logistica Tabs (Flota / Carga)
    const mainTabs = document.querySelectorAll('#logisticaTabs .nav-link');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabEl = e.currentTarget;
            const targetId = tabEl.getAttribute('data-tab');
            if (!targetId) return;

            mainTabs.forEach(t => t.classList.remove('active'));
            tabEl.classList.add('active');

            // Ocultar contenidos de tab-content
            document.querySelectorAll('#tab-flota, #tab-carga').forEach(c => c.style.display = 'none');

            const targetElement = document.getElementById(`tab-${targetId}`);
            if (targetElement) {
                targetElement.style.display = 'block';
            }

            // Si se abrió la pestaña de carga, inicializarla
            if (targetId === 'carga') {
                inicializarControlCarga();
            }
        });
    });

    // Bind Vehicle Modal Tabs
    const tabs = document.querySelectorAll('#vehiculoTabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabEl = e.currentTarget;
            const targetId = tabEl.getAttribute('data-tab');
            if (!targetId) return;

            tabs.forEach(t => t.classList.remove('active'));
            tabEl.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const targetElement = document.getElementById(`tab-${targetId}`);
            if (targetElement) {
                targetElement.style.display = 'block';
            }
        });
    });

    // Bind Type Change
    const tipoSelect = document.getElementById('vehiculo-tipo');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', toggleEnganche);
    }

    // Bind Form Submit
    const form = document.getElementById('form-vehiculo');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await guardarVehiculo();
        };
    }

    // Expose globals
    window.abrirModalVehiculo = abrirModalVehiculo;
    window.editarVehiculo = editarVehiculo;
    window.cerrarModalVehiculo = cerrarModalVehiculo;
    window.subirDocumentoVehiculo = subirDocumentoVehiculo;
    window.borrarDocumentoVehiculo = borrarDocumentoVehiculo;
    window.confirmarCargaVehiculo = confirmarCargaVehiculo;
    // ✨ MODO REPARTIDOR GLOBALS
    window.abrirModoRepartidor = abrirModoRepartidor;
    window.abrirModalEntrega = abrirModalEntrega;
    window.cerrarModalEntrega = cerrarModalEntrega;
    window.confirmarEntregaBackend = confirmarEntregaBackend;

    await Promise.all([
        cargarVehiculos(),
        cargarChoferes(),
        cargarSemis()
    ]);
}

async function cargarVehiculos() {
    try {
        const vehiculos = await fetchData(`/api/vehiculos?negocio_id=${appState.negocioActivoId}`);
        vehiculosCache = vehiculos;
        renderVehiculos(vehiculos);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar vehículos', 'error');
    }
}

async function cargarChoferes() {
    try {
        const choferes = await fetchData(`/api/empleados?negocio_id=${appState.negocioActivoId}&rol=chofer&activo=true`);
        const select = document.getElementById('vehiculo-chofer');
        select.innerHTML = '<option value="">Sin asignar</option>';
        choferes.forEach(c => {
            select.appendChild(new Option(`${c.nombre} ${c.apellido}`, c.id));
        });
    } catch (error) {
        console.error("Error cargando choferes", error);
    }
}

async function cargarSemis() {
    // Para el select de enganche, necesitamos vehículos tipo 'semi'
    // Como vehiculosCache se carga en paralelo, tal vez sea mejor hacer fetch especifico o esperar
    // Por simplicidad, reusamos el endpoint de vehiculos si ya cargó, o fetch aparte
    // Aquí hacemos fetch aparte para asegurar
    try {
        // Asumimos que el backend de vehiculos soporta filtro por tipo, si no, filtramos en cliente
        // Por ahora filtramos en cliente usando vehiculosCache si ya está disponible, o fetch total
        // Esperamos a que cargue vehiculos (Promise.all lo maneja)
        // Pero como se ejecutan en paralelo, mejor hacer fetch independiente si es crítico
        // O simplemente re-renderizar select cuando vehiculosCache cambie.
    } catch (e) { }
}

function renderSemisOptions() {
    const select = document.getElementById('vehiculo-enganche');
    select.innerHTML = '<option value="">Ninguno</option>';
    const semis = vehiculosCache.filter(v => v.tipo_vehiculo === 'semi' && v.activo);
    semis.forEach(s => {
        select.appendChild(new Option(`${s.modelo} - ${s.patente}`, s.id));
    });
}

function renderVehiculos(vehiculos) {
    const tbody = document.getElementById('lista-vehiculos');
    tbody.innerHTML = '';

    // Actualizar también selects dependientes
    renderSemisOptions();

    if (vehiculos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">No hay vehículos registrados</td></tr>';
        return;
    }

    vehiculos.forEach(v => {
        const tr = document.createElement('tr');

        let icon = 'fa-truck';
        if (v.tipo_vehiculo === 'utilitario') icon = 'fa-shuttle-van';
        if (v.tipo_vehiculo === 'semi') icon = 'fa-trailer';

        tr.innerHTML = `
            <td class="ps-4">
                <i class="fas ${icon} text-muted me-2"></i>
                ${(v.tipo_vehiculo || 'Otro').toUpperCase()}
            </td>
            <td class="fw-bold">
                ${v.patente} <br>
                <small class="fw-normal text-muted">${v.modelo}</small>
            </td>
            <td>
                <span class="badge ${v.propiedad === 'propio' ? 'bg-info' : 'bg-warning text-dark'}">
                    ${(v.propiedad || 'propio').toUpperCase()}
                </span>
            </td>
            <td class="text-center">
                <div>${v.capacidad_kg || 0} Kg</div>
                <small class="text-muted">${v.capacidad_pallets || 0} Pallets</small>
            </td>
            <td class="text-center">
                <span class="badge ${v.activo ? 'bg-success' : 'bg-secondary'}">
                    ${v.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary" onclick="editarVehiculo(${v.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleEnganche() {
    const tipo = document.getElementById('vehiculo-tipo').value;
    const container = document.getElementById('container-enganche');
    if (tipo === 'tractor') {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        document.getElementById('vehiculo-enganche').value = "";
    }
}

function abrirModalVehiculo() {
    document.getElementById('modal-vehiculo-titulo').innerText = 'Nuevo Vehículo';
    document.getElementById('form-vehiculo').reset();
    document.getElementById('vehiculo-id').value = '';
    document.getElementById('vehiculo-activo').checked = true;

    // Reset tabs
    document.querySelector('[data-tab="datos-tecnicos"]').click();

    // Hide docs
    document.getElementById('vehiculo-doc-upload').style.display = 'none';
    document.getElementById('lista-docs-vehiculo').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Guardar primero</td></tr>';

    toggleEnganche();
    document.getElementById('modal-vehiculo').style.display = 'flex';
}

async function editarVehiculo(id) {
    const v = vehiculosCache.find(x => x.id === id);
    if (!v) return;

    document.getElementById('modal-vehiculo-titulo').innerText = 'Editar Vehículo';
    document.getElementById('vehiculo-id').value = v.id;
    document.getElementById('vehiculo-patente').value = v.patente;
    document.getElementById('vehiculo-modelo').value = v.modelo;
    document.getElementById('vehiculo-kg').value = v.capacidad_kg;
    document.getElementById('vehiculo-m3').value = v.capacidad_volumen_m3;
    document.getElementById('vehiculo-pallets').value = v.capacidad_pallets || 0;
    document.getElementById('vehiculo-tipo').value = v.tipo_vehiculo || 'utilitario';
    document.getElementById('vehiculo-propiedad').value = v.propiedad || 'propio';
    document.getElementById('vehiculo-chofer').value = v.chofer_default_id || "";
    document.getElementById('vehiculo-enganche').value = v.enganche_id || "";
    document.getElementById('vehiculo-activo').checked = v.activo;

    toggleEnganche();

    // Show docs
    document.getElementById('vehiculo-doc-upload').style.display = 'block';
    await cargarDocumentacionVehiculo(id);

    document.getElementById('modal-vehiculo').style.display = 'flex';
}

async function guardarVehiculo() {
    const id = document.getElementById('vehiculo-id').value;
    const data = {
        negocio_id: appState.negocioActivoId,
        patente: document.getElementById('vehiculo-patente').value,
        modelo: document.getElementById('vehiculo-modelo').value,
        tipo_vehiculo: document.getElementById('vehiculo-tipo').value,
        propiedad: document.getElementById('vehiculo-propiedad').value,
        capacidad_kg: document.getElementById('vehiculo-kg').value,
        capacidad_volumen_m3: document.getElementById('vehiculo-m3').value,
        capacidad_pallets: document.getElementById('vehiculo-pallets').value,
        chofer_default_id: document.getElementById('vehiculo-chofer').value || null,
        enganche_id: document.getElementById('vehiculo-enganche').value || null,
        activo: document.getElementById('vehiculo-activo').checked
    };

    if (!data.patente || !data.modelo) {
        mostrarNotificacion('Completa los campos obligatorios', 'warning');
        return;
    }

    try {
        if (id) {
            await sendData(`/api/vehiculos/${id}`, data, 'PUT');
            mostrarNotificacion('Vehículo actualizado', 'success');
        } else {
            await sendData('/api/vehiculos', data, 'POST');
            mostrarNotificacion('Vehículo creado', 'success');
        }
        cerrarModalVehiculo();
        cargarVehiculos();
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al guardar vehículo', 'error');
    }
}

function cerrarModalVehiculo() {
    document.getElementById('modal-vehiculo').style.display = 'none';
}

// --- Docs Vehiculos ---

async function cargarDocumentacionVehiculo(vehiculoId) {
    const tbody = document.getElementById('lista-docs-vehiculo');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const docs = await fetchData(`/api/vehiculos/${vehiculoId}/documentacion`);
        tbody.innerHTML = '';

        if (!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay documentos cargados</td></tr>';
            return;
        }

        docs.forEach(doc => {
            const tr = document.createElement('tr');
            let estadoBadge = '<span class="badge bg-success">Vigente</span>';
            if (doc.fecha_vencimiento) {
                const now = new Date();
                const vto = new Date(doc.fecha_vencimiento);
                const diffDays = Math.ceil((vto - now) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) estadoBadge = '<span class="badge bg-danger">Vencido</span>';
                else if (diffDays < 30) estadoBadge = '<span class="badge bg-warning text-dark">Por Vencer</span>';
            }

            tr.innerHTML = `
                <td>
                    <strong>${doc.tipo_documento.replace('_', ' ').toUpperCase()}</strong><br>
                    <small class="text-muted">${doc.observaciones || ''}</small>
                </td>
                <td>${doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString() : '-'}</td>
                <td>${estadoBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarDocumentoVehiculo(${doc.id})"><i class="fas fa-trash"></i></button>
                    ${doc.archivo_path ? '<a href="#" class="btn btn-sm btn-outline-info"><i class="fas fa-eye"></i></a>' : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error docs vehiculo:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error cargando documentos</td></tr>';
    }
}

async function subirDocumentoVehiculo() {
    const id = document.getElementById('vehiculo-id').value;
    if (!id) return;

    const data = {
        tipo_documento: document.getElementById('doc-tipo').value,
        fecha_vencimiento: document.getElementById('doc-vencimiento').value,
        observaciones: document.getElementById('doc-obs').value
    };

    if (document.getElementById('doc-vencimiento').value === '') {
        alert("Por favor ingrese la fecha de vencimiento");
        return;
    }

    try {
        await sendData(`/api/vehiculos/${id}/documentacion`, data, 'POST');
        mostrarNotificacion("Documento guardado", "success");
        cargarDocumentacionVehiculo(id);
    } catch (error) {
        mostrarNotificacion("Error subiendo documento", "error");
    }
}

function borrarDocumentoVehiculo(id) {
    if (!confirm("¿Eliminar documento?")) return;
    alert("Función borrar pendiente de backend");
}

// ===== CONTROL DE CARGA =====

let cargaState = {
    vehiculoSeleccionado: null,
    hojasRutaDisponibles: [],
    hojasRutaSeleccionadas: []
};

async function inicializarControlCarga() {
    // Cargar vehículos en el selector
    const select = document.getElementById('carga-vehiculo-selector');
    select.innerHTML = '<option value="">-- Selecciona un vehículo --</option>';

    vehiculosCache.forEach(v => {
        if (v.activo) {
            select.appendChild(new Option(`${v.patente} - ${v.modelo} (${v.capacidad_kg}kg)`, v.id));
        }
    });

    // Evento de cambio de vehículo
    select.onchange = async () => {
        const vehiculoId = select.value;
        if (!vehiculoId) {
            document.getElementById('carga-capacidad-container').style.display = 'none';
            document.getElementById('lista-hojas-ruta-carga').innerHTML = '<p class="text-muted text-center py-4">Selecciona un vehículo para ver las rutas disponibles</p>';
            cargaState.vehiculoSeleccionado = null;
            return;
        }

        cargaState.vehiculoSeleccionado = vehiculosCache.find(v => v.id == vehiculoId);
        document.getElementById('carga-capacidad-container').style.display = 'block';
        resetearCapacidad();
        await cargarHojasRutaDisponibles();
    };
}

async function cargarHojasRutaDisponibles() {
    try {
        const hojas = await fetchData(`/api/vehiculos/carga/hojas_ruta_disponibles?negocio_id=${appState.negocioActivoId}`);
        cargaState.hojasRutaDisponibles = hojas;
        renderHojasRutaCarga(hojas);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al cargar hojas de ruta', 'error');
    }
}

function renderHojasRutaCarga(hojas) {
    const container = document.getElementById('lista-hojas-ruta-carga');

    if (hojas.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No hay Hojas de Ruta disponibles para cargar</p>';
        return;
    }

    const html = hojas.map(hr => `
        <div class="card mb-2">
            <div class="card-body p-3">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="hr-${hr.id}" value="${hr.id}" onchange="toggleHojaRuta(${hr.id})">
                    <label class="form-check-label w-100" for="hr-${hr.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>HR #${hr.id}</strong> - ${hr.vendedor_nombre}
                                <br>
                                <small class="text-muted">Fecha: ${hr.fecha} | Pedidos: ${hr.cantidad_pedidos || 0}</small>
                            </div>
                            <div class="text-end">
                                <div><span class="badge bg-secondary">${hr.peso_kg.toFixed(0)} Kg</span></div>
                                <div><span class="badge bg-info">${hr.volumen_m3.toFixed(2)} m³</span></div>
                            </div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;

    // Exponer función globalmente
    window.toggleHojaRuta = toggleHojaRuta;
}

function toggleHojaRuta(hojaRutaId) {
    const checkbox = document.getElementById(`hr-${hojaRutaId}`);
    if (checkbox.checked) {
        cargaState.hojasRutaSeleccionadas.push(hojaRutaId);
    } else {
        cargaState.hojasRutaSeleccionadas = cargaState.hojasRutaSeleccionadas.filter(id => id !== hojaRutaId);
    }
    actualizarCapacidad();
}

function actualizarCapacidad() {
    const vehiculo = cargaState.vehiculoSeleccionado;
    if (!vehiculo) return;

    // Calcular totales de las HR seleccionadas
    let pesoTotal = 0;
    let volumenTotal = 0;

    cargaState.hojasRutaSeleccionadas.forEach(id => {
        const hr = cargaState.hojasRutaDisponibles.find(h => h.id === id);
        if (hr) {
            pesoTotal += parseFloat(hr.peso_kg || 0);
            volumenTotal += parseFloat(hr.volumen_m3 || 0);
        }
    });

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

function resetearCapacidad() {
    cargaState.hojasRutaSeleccionadas = [];
    document.getElementById('carga-peso-label').innerText = '0 / 0 Kg';
    document.getElementById('carga-volumen-label').innerText = '0 / 0 m³';
    document.getElementById('carga-peso-barra').style.width = '0%';
    document.getElementById('carga-volumen-barra').style.width = '0%';
}

async function confirmarCargaVehiculo() {
    if (!cargaState.vehiculoSeleccionado) {
        mostrarNotificacion('Selecciona un vehículo primero', 'warning');
        return;
    }

    if (cargaState.hojasRutaSeleccionadas.length === 0) {
        mostrarNotificacion('Selecciona al menos una Hoja de Ruta', 'warning');
        return;
    }

    try {
        const response = await sendData('/api/vehiculos/carga/asignar', {
            vehiculo_id: cargaState.vehiculoSeleccionado.id,
            hoja_ruta_ids: cargaState.hojasRutaSeleccionadas
        }, 'POST');

        mostrarNotificacion(response.message || 'Carga asignada con éxito', 'success');

        // Resetear
        cargaState.hojasRutaSeleccionadas = [];
        await cargarHojasRutaDisponibles();
        resetearCapacidad();

    } catch (error) {
        // El error ya se muestra en sendData/handleApiResponse
    }
}

// ===== MODO REPARTIDOR (Lógica de Logística) =====

// Variables de estado para el modal de entrega del chofer (bajada)
let currentEntregaItems = [];
let motivosReboteCache = null;

async function cargarMotivosRebote(negocioId) {
    if (motivosReboteCache) return;
    try {
        motivosReboteCache = await fetchData(`/api/negocios/${negocioId}/motivos_rebote`);
    } catch (e) {
        console.error("Error cargando motivos de rebote:", e);
        motivosReboteCache = [];
    }
}

window.marcarVisitaChofer = async function (hrId, itemId, estado, btn) {
    if (!confirm(estado ? "¿Confirmar que se bajó la mercadería en esta parada?" : "¿Deshacer la bajada de mercadería?")) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;

    try {
        await sendData(`/api/hoja_ruta/${hrId}/item/${itemId}`, { visitado: estado, observaciones: '' }, 'PUT');
        // Recargar Modo Repartidor
        abrirModoRepartidor(hrId);
    } catch (e) {
        alert("Error al actualizar estado: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.abrirModalEntregaChofer = async function (hrId, itemId, pedido) {
    await cargarMotivosRebote(appState.negocioActivoId);

    // Asegurarnos que el modal de chofer existe en el DOM de logistica.html
    // Si no existe, usamos el de cobro estándar pero con flag de 'solo_bajada'
    // REVISIÓN: Logistica suele usar el modal de confirmación de entrega estándar.
    // Sin embargo, el "Modo Repartidor" en Logística está diseñado para ser usado por Administrativos.

    document.getElementById('entrega-pedido-id').value = pedido.id || pedido.pedido_id;
    // El modal de 'confirmar-entrega' en logistica no tiene todos los campos del modal de chofer.
    // Vamos a usar el modal de 'entrega' estándar pero adaptado si es necesario.

    // Si el usuario quiere el flujo de chofer (con rebotes), necesitamos ese modal.
    // Pero logistica.html no parece tener 'chofer-modal-entrega'.
    // Por simplicidad para el administrativo, si hace clic en "Confirmar Bajada",
    // podemos simplemente llamar a marcarVisitaChofer si no hay ajustes,
    // o abrir el modal de entrega estándar.

    // El plan decía: Implementar abrirModalEntregaChofer.
    // Copiaremos la lógica simplificada o aseguramos que el modal exista.

    // Si no hay modal de chofer, abrimos el de entrega normal pero marcando que es solo bajada.
    // Pero el modal de entrega normal pide pago.

    // Vamos a implementar una versión funcional de abrirModalEntregaChofer que use el modal de chofer
    // asumiendo que el usuario quiere esa funcionalidad (que permite rebotes).

    const modalChofer = document.getElementById('chofer-modal-entrega');
    if (!modalChofer) {
        // Si no existe el modal específico de chofer en logistica.html, usamos marcarVisitaChofer directo
        // o notificamos que debe usar el flujo de cobro.
        console.warn("Modal de chofer no encontrado en Logística. Realizando visita simple.");
        return window.marcarVisitaChofer(hrId, itemId, true, document.activeElement);
    }

    document.getElementById('entrega-pedido-id').value = pedido.id;
    document.getElementById('entrega-hr-id').value = hrId;
    document.getElementById('entrega-item-id').value = itemId;
    document.getElementById('entrega-cliente-nombre').innerText = `Bajada: ${pedido.cliente_nombre || 'Cliente'}`;

    const montoTotalEl = document.getElementById('entrega-monto-total-chofer') || document.getElementById('entrega-monto-total');
    montoTotalEl.innerText = `$${pedido.total.toLocaleString()}`;

    const itemsContainer = document.getElementById('entrega-items-container');
    if (itemsContainer) {
        itemsContainer.innerHTML = '';
        currentEntregaItems = (pedido.productos || []).map(p => ({
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
                        <div class="fw-bold small text-truncate">${item.nombre}</div>
                        <div class="text-muted" style="font-size:0.7rem;">Orig: ${item.cantidad_original} | $${item.precio_unitario}</div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-danger py-0" onclick="updateQtyEntrega(${index}, -1)">-</button>
                        <span class="fw-bold">${item.cantidad_actual}</span>
                        <button class="btn btn-sm btn-outline-success py-0" onclick="updateQtyEntrega(${index}, 1)" ${item.cantidad_actual >= item.cantidad_original ? 'disabled' : ''}>+</button>
                    </div>
                </div>
            `;
            itemsContainer.appendChild(div);
        });
    }

    modalChofer.style.display = 'flex';
};

window.updateQtyEntrega = function (index, delta) {
    const item = currentEntregaItems[index];
    const nuevaCant = item.cantidad_actual + delta;
    if (nuevaCant >= 0 && nuevaCant <= item.cantidad_original) {
        item.cantidad_actual = nuevaCant;
        // Refrescar lista e importe si los elementos existen
        const itemsContainer = document.getElementById('entrega-items-container');
        if (itemsContainer) {
            // Re-renderizar o simplemente actualizar el span (más eficiente)
            const spans = itemsContainer.querySelectorAll('.fw-bold');
            // Nota: El primero es el nombre, el segundo es la cantidad. 
            // Buscamos el span de cantidad específico por el contexto del click.
            // Para ser robustos, mejor re-renderizar o usar IDs.
            abrirModalEntregaChofer(
                document.getElementById('entrega-hr-id').value,
                document.getElementById('entrega-item-id').value,
                { id: document.getElementById('entrega-pedido-id').value, total: 0, productos: currentEntregaItems, cliente_nombre: '' }
            );
        }
    }
};

window.cerrarModalEntregaChofer = function () {
    const m = document.getElementById('chofer-modal-entrega');
    if (m) m.style.display = 'none';
};

window.confirmarEntregaChoferBackend = async function () {
    const pedidoId = document.getElementById('entrega-pedido-id').value;
    const hrId = document.getElementById('entrega-hr-id').value;

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
            text: 'Se ha registrado la bajada de mercadería.',
            timer: 2000,
            showConfirmButton: false
        });

        window.cerrarModalEntregaChofer();
        // Refrescar vista de modo repartidor en Logística
        abrirModoRepartidor(hrId);

    } catch (e) {
        console.error(e);
        Swal.fire('Error', e.message || 'No se pudo confirmar la entrega', 'error');
    }
};

export async function abrirModoRepartidor(hrId) {
    document.getElementById('modal-modo-repartidor').style.display = 'block';

    // 1. Mostrar loading
    const container = document.getElementById('repartidor-lista-paradas');
    container.innerHTML = '<div class="text-center py-5 text-secondary"><i class="fas fa-circle-notch fa-spin fa-3x mb-3"></i><br>Cargando información del recorrido...</div>';

    try {
        // 2. Fetch Data (Reusamos endpoints existentes)
        const detalle = await fetchData(`/api/hoja_ruta/${hrId}`);
        const pedidos = await fetchData(`/api/negocios/${appState.negocioActivoId}/pedidos?hoja_ruta_id=${hrId}`);
        // Combinamos info: Items de HR (orden, dirección) + Pedidos (monto, estado)

        document.getElementById('repartidor-titulo-ruta').innerText = `HR #${detalle.id} - ${detalle.fecha}`;

        renderRepartidorMode(detalle, pedidos);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar ruta: ${e.message}</div>`;
    }
}

function renderRepartidorMode(detalle, pedidos) {
    const container = document.getElementById('repartidor-lista-paradas');
    container.innerHTML = '';

    // Mapa de cliente -> Pedido
    const pedidosMap = {};
    const pedidosArr = Array.isArray(pedidos.pedidos) ? pedidos.pedidos : (Array.isArray(pedidos) ? pedidos : []);
    pedidosArr.forEach(p => {
        pedidosMap[p.cliente_id] = p;
    });

    const items = detalle.items || [];
    const totalItems = items.length;
    let itemsVisitados = 0;

    items.forEach(item => {
        const pedido = pedidosMap[item.cliente_id];
        const tienePedido = !!pedido;
        const esEntregado = pedido && pedido.estado === 'entregado';
        const esCobrado = pedido && pedido.venta_id !== null && pedido.venta_id !== undefined;
        // Solo consideramos visitado para el estilo si ya se entregó el pedido 
        // o si no tiene pedido y fue marcado como visitada la parada.
        const seVeVisitado = esCobrado || (item.visitado && !tienePedido);
        const esVisitadoContador = item.visitado || esCobrado;

        if (esVisitadoContador) itemsVisitados++;

        // Card HTML
        const div = document.createElement('div');
        div.className = `card-parada ${seVeVisitado ? 'visitado' : ''}`;

        let accionBtn = '';
        if (esCobrado) {
            accionBtn = `<div class="text-success fw-bold"><i class="fas fa-check-double me-1"></i>ENTREGADO Y COBRADO</div>`;
        } else if (esEntregado) {
            // Ya fue entregado (por el chofer) pero falta el cobro
            accionBtn = `
                <button class="btn btn-warning text-dark w-100 shadow-sm fw-bold" onclick='window.abrirModalEntrega(${JSON.stringify(pedido).replace(/'/g, "&#39;")}, true)'>
                    <i class="fas fa-hand-holding-usd me-2"></i>💰 REGISTRAR COBRO ($${pedido.total})
                </button>
            `;
        } else if (tienePedido) {
            const isVisitado = item.visitado || esEntregado || esCobrado;
            const hrId = detalle.id;

            // DETERMINAR QUÉ BOTÓN MOSTRAR
            let btnAccion = '';

            if (esCobrado) {
                btnAccion = `<div class="text-success fw-bold"><i class="fas fa-check-double me-1"></i>ENTREGADO Y COBRADO</div>`;
            } else if (esEntregado || item.visitado) {
                // Ya bajó la mercadería, falta el cobro
                btnAccion = `
                    <button class="btn btn-warning text-dark w-100 shadow-sm fw-bold mb-2" onclick='window.abrirModalEntrega(${JSON.stringify(pedido).replace(/'/g, "&#39;")}, true)'>
                        <i class="fas fa-hand-holding-usd me-2"></i>💰 REGISTRAR COBRO ($${pedido.total})
                    </button>
                    ${pedido.venta_id ? '' : `
                    <button class="btn btn-link text-danger w-100 btn-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, false, this)">
                        <i class="fas fa-undo"></i> Deshacer bajada/visita
                    </button>`}
                `;
            } else {
                // Pendiente de bajada
                btnAccion = `
                    <button class="btn btn-primary w-100 fw-bold btn-lg shadow-sm" onclick='abrirModalEntregaChofer(${hrId || item.hoja_ruta_id || 0}, ${item.hoja_ruta_item_id}, ${JSON.stringify(pedido).replace(/'/g, "&apos;")})'>
                        <i class="fas fa-hand-holding-usd me-1"></i> Confirmar Bajada
                    </button>
                    <button class="btn btn-link text-muted w-100 mt-2 btn-sm" onclick="marcarVisitaChofer(${item.hoja_ruta_id || hrId}, ${item.hoja_ruta_item_id}, true, this)">
                         Solo marcar visita (sin bajar mercadería)
                    </button>
                `;
            }
            accionBtn = btnAccion;
        } else {
            accionBtn = `<div class="text-muted"><small>Solo Visita / Sin Pedido</small></div>`;
        }

        div.innerHTML = `
            <div class="card-parada-header bg-white">
                <div class="d-flex align-items-center">
                    <span class="badge bg-dark rounded-circle me-2" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center;">${item.orden + 1}</span>
                    <h6 class="mb-0 fw-bold text-truncate" style="max-width: 200px;">${item.cliente_nombre} ${pedido ? `<span class="badge bg-light text-primary border ms-1">#${pedido.id}</span>` : ''}</h6>
                </div>
                ${hasCoords(item) ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${item.latitud},${item.longitud}" target="_blank" class="btn btn-sm btn-outline-primary rounded-circle"><i class="fas fa-location-arrow"></i></a>` : ''}
            </div>
            <div class="card-parada-body">
                <p class="mb-3 text-muted small"><i class="fas fa-map-marker-alt me-1 text-danger"></i> ${item.cliente_direccion || 'Sin dirección registrada'}</p>
                ${accionBtn}
            </div>
        `;
        container.appendChild(div);
    });

    // ✨ AUTO-SCROLL: Ir a la primera parada no visitada
    setTimeout(() => {
        const primeraParada = container.querySelector(".card-parada:not(.visitado)");
        if (primeraParada) {
            primeraParada.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, 300);

    // Actualizar Barra Progreso
    const percentage =
        totalItems > 0 ? Math.round((itemsVisitados / totalItems) * 100) : 0;
    document.getElementById("repartidor-progress-bar").style.width =
        `${percentage}%`;
    document.getElementById("repartidor-progress-badge").innerText =
        `${percentage}%`;
}

function hasCoords(item) {
    return item.latitud && item.longitud;
}

export async function abrirModalEntrega(pedido, isCobroSolamente = false) {
    document.getElementById("entrega-pedido-id").value = pedido.id;
    document.getElementById("entrega-pedido-id").dataset.soloCobro = isCobroSolamente ? "true" : "false";

    document.getElementById("entrega-pedido-id-header").innerText = `(Pedido #${pedido.id})`;

    const montoTotal = parseFloat(pedido.total);
    document.getElementById("entrega-monto-total").innerText =
        `$${montoTotal.toLocaleString()}`;

    // Resetear panel mixto
    document.getElementById("pago-efectivo").checked = true;
    document.getElementById("panel-pago-mixto").style.display = "none";
    document.getElementById("monto-efectivo-mixto").value = "";
    document.getElementById("monto-mp-mixto").value = "";
    document.getElementById("mixto-saldo-ctacte").innerText = `$${montoTotal.toLocaleString()}`;

    const recalcularSaldoCtaCte = () => {
        const ef = parseFloat(document.getElementById("monto-efectivo-mixto").value || 0);
        const mp = parseFloat(document.getElementById("monto-mp-mixto").value || 0);
        const saldo = Math.max(0, montoTotal - (ef + mp));
        document.getElementById("mixto-saldo-ctacte").innerText = `$${saldo.toLocaleString()}`;
    };

    // Bind eventos radio
    const radios = document.querySelectorAll('input[name="metodoPago"]');
    radios.forEach((r) => {
        r.onchange = () => {
            const panelMixto = document.getElementById("panel-pago-mixto");
            if (r.value === "Mixto") {
                panelMixto.style.display = "block";
                document.getElementById("monto-efectivo-mixto").value = 0;
                document.getElementById("monto-mp-mixto").value = 0;
                recalcularSaldoCtaCte();
            } else {
                panelMixto.style.display = "none";
            }
        };
    });

    // Calculo automático de saldo Cta Cte en mixto
    document.getElementById("monto-efectivo-mixto").oninput = recalcularSaldoCtaCte;
    document.getElementById("monto-mp-mixto").oninput = recalcularSaldoCtaCte;

    // Resumen dinámico con detalles reales
    const resumenDiv = document.getElementById("entrega-resumen-items");
    resumenDiv.innerHTML = '<div class="text-center py-2"><i class="fas fa-spinner fa-spin"></i> Cargando detalles del pedido...</div>';

    document.getElementById("modal-confirmar-entrega").style.display = "block";

    try {
        const detalleCompleto = await fetchData(`/api/pedidos/${pedido.id}`);

        let htmlStr = '<h6 class="border-bottom pb-1 text-dark mb-2" style="font-size:0.9rem;">Pedido Original</h6><ul class="list-unstyled mb-2" style="font-size: 0.85rem;">';
        if (detalleCompleto.detalles && detalleCompleto.detalles.length > 0) {
            detalleCompleto.detalles.forEach(d => {
                const rebote = detalleCompleto.rebotes ? detalleCompleto.rebotes.find(r => r.producto_id === d.producto_id) : null;
                const cantOriginal = parseFloat(d.cantidad) + (rebote ? parseFloat(rebote.cantidad) : 0);
                htmlStr += `<li><i class="fas fa-box text-secondary me-1"></i> <b>${cantOriginal}</b>x ${d.producto_nombre} <span class="text-muted">($${parseFloat(d.subtotal).toLocaleString()} cobrables)</span></li>`;
            });
        } else {
            htmlStr += '<li class="text-muted fst-italic">Sin ítems en el pedido</li>';
        }
        htmlStr += '</ul>';

        if (detalleCompleto.rebotes && detalleCompleto.rebotes.length > 0) {
            htmlStr += '<h6 class="border-bottom pb-1 text-danger mb-2 mt-3" style="font-size:0.9rem;"><i class="fas fa-exclamation-triangle"></i> Rechazos / Devoluciones</h6><ul class="list-unstyled mb-0 text-danger" style="font-size: 0.85rem;">';
            detalleCompleto.rebotes.forEach(r => {
                htmlStr += `<li>- <b>${r.cantidad}</b>x ${r.producto_nombre} <small class="text-muted d-block ms-3">💬 ${r.motivo || 'Sin motivo'}</small></li>`;
            });
            htmlStr += '</ul>';
        }

        resumenDiv.innerHTML = htmlStr;
    } catch (e) {
        console.error("Error cargando detalles del pedido", e);
        resumenDiv.innerHTML = '<div class="text-danger small"><i class="fas fa-exclamation-circle"></i> No se pudo cargar el detalle completo del pedido. Por favor, revise la factura.</div>';
    }
}

export function cerrarModalEntrega() {
    document.getElementById('modal-confirmar-entrega').style.display = 'none';
}

export async function confirmarEntregaBackend() {
    const pedidoId = document.getElementById("entrega-pedido-id").value;
    const isCobroSolamente = document.getElementById("entrega-pedido-id").dataset.soloCobro === "true";
    const metodoPago = document.querySelector(
        'input[name="metodoPago"]:checked',
    ).value;

    // Validar
    if (!pedidoId) return;

    const payload = {
        metodo_pago: metodoPago,
    };

    if (isCobroSolamente) {
        payload.solo_cobro = true;
    }

    if (metodoPago === "Mixto") {
        payload.monto_efectivo =
            parseFloat(document.getElementById("monto-efectivo-mixto").value) || 0;
        payload.monto_mp =
            parseFloat(document.getElementById("monto-mp-mixto").value) || 0;

        if (payload.monto_efectivo + payload.monto_mp <= 0) {
            mostrarNotificacion("Debe ingresar los montos para el pago mixto", "error");
            return;
        }
    }

    try {
        const btn = document.querySelector("#modal-confirmar-entrega .btn-success");
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        const response = await sendData(
            `/api/pedidos/${pedidoId}/entregar`,
            payload,
            "POST",
        );

        mostrarNotificacion(response.message, "success");

        // Mostrar notificaciones de stock si las hay
        if (response.notificaciones && response.notificaciones.length > 0) {
            response.notificaciones.forEach(n => mostrarNotificacion(n, 'warning'));
        }

        cerrarModalEntrega();

        // Recargar Modo Repartidor
        // Del texto del header: "HR #123 - ..."
        const headerText = document.getElementById('repartidor-titulo-ruta').innerText;
        const hrIdMatch = headerText.match(/HR #(\d+)/);
        if (hrIdMatch) {
            window.abrirModoRepartidor(hrIdMatch[1]);
        }

    } catch (error) {
        console.error(error);
        mostrarNotificacion(error.message || 'Error al procesar entrega', 'error');
    } finally {
        const btn = document.querySelector('#modal-confirmar-entrega .btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'CONFIRMAR ENTREGA'; // Reset textual
        }
    }
}
