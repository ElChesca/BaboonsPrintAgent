/* app/static/js/modules/resto_impresoras.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let impresorasCache = [];
let destinosCache = [];

export async function inicializarRestoImpresoras() {
    console.log("🖨️ Módulo de Configuración de Impresoras Inicializado");

    const formImp = document.getElementById('form-impresora');
    if (formImp) formImp.onsubmit = guardarImpresora;

    const formDest = document.getElementById('form-destino');
    if (formDest) formDest.onsubmit = guardarDestino;

    // Sincronizar input color con texto hex
    const colorInput = document.getElementById('dest-color');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            document.getElementById('dest-color-hex').value = e.target.value.toUpperCase();
        });
    }

    // Bind windows globals (Printers)
    window.abrirNuevaImpresora = abrirNuevaImpresora;
    window.cerrarModalImpresora = cerrarModalImpresora;
    window.editarImpresora = editarImpresora;
    window.eliminarImpresora = eliminarImpresora;
    window.probarImpresora = probarImpresora;
    window.abrirGuiaImpresoras = abrirGuiaImpresoras;
    window.cerrarGuiaImpresoras = cerrarGuiaImpresoras;
    window.guardarAjustesPro = guardarAjustesPro;

    // Bind windows globals (Destinations)
    window.abrirNuevoDestino = abrirNuevoDestino;
    window.cerrarModalDestino = cerrarModalDestino;
    window.editarDestino = editarDestino;
    window.eliminarDestino = eliminarDestino;

    // Carga inicial
    await cargarDestinos(); // Cargar destinos primero para usarlos en la tabla de impresoras
    await cargarImpresoras();
    await cargarAjustesPro();
    await verificarEstadoAgente();
}

/* --- LÓGICA DE DESTINOS KDS --- */

async function cargarDestinos() {
    const idNegocio = appState.negocioActivoId;
    if (!idNegocio) return;
    try {
        destinosCache = await fetchData(`/api/negocios/${idNegocio}/destinos-kds`);
        renderizarTablaDestinos();
        actualizarSelectDestinos();
    } catch (error) {
        console.error("Error al cargar destinos:", error);
    }
}

function renderizarTablaDestinos() {
    const body = document.getElementById('destinos-kds-body');
    const noDestinos = document.getElementById('no-destinos');
    if (!body) return;
    body.innerHTML = '';

    if (destinosCache.length === 0) {
        if (noDestinos) noDestinos.style.display = 'block';
        return;
    }
    if (noDestinos) noDestinos.style.display = 'none';

    destinosCache.forEach(dest => {
        const tr = document.createElement('tr');
        tr.className = 'animate__animated animate__fadeIn';
        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="rounded-circle me-3" style="width: 12px; height: 12px; background: ${dest.color_ui}"></div>
                    <div class="fw-800 text-dark">${dest.nombre}</div>
                </div>
            </td>
            <td><code>${dest.color_ui}</code></td>
            <td class="text-end pe-4">
                <div class="btn-group gap-2">
                    <button class="btn btn-sm btn-light border rounded-3" onclick="window.editarDestino(${dest.id})">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger rounded-3" onclick="window.eliminarDestino(${dest.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

function actualizarSelectDestinos() {
    const select = document.getElementById('imp-destino-id');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    destinosCache.forEach(dest => {
        const opt = document.createElement('option');
        opt.value = dest.id;
        opt.textContent = dest.nombre;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

function abrirNuevoDestino() {
    const modal = document.getElementById('modal-destino');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-destino-titulo').innerText = 'Crear Destino KDS';
        document.getElementById('form-destino').reset();
        document.getElementById('dest-id').value = '';
        document.getElementById('dest-color-hex').value = '#3498DB';
    }
}

function cerrarModalDestino() {
    const modal = document.getElementById('modal-destino');
    if (modal) modal.style.display = 'none';
}

function editarDestino(id) {
    const dest = destinosCache.find(d => d.id == id);
    if (!dest) return;
    abrirNuevoDestino();
    document.getElementById('modal-destino-titulo').innerText = 'Editar Destino';
    document.getElementById('dest-id').value = dest.id;
    document.getElementById('dest-nombre').value = dest.nombre;
    document.getElementById('dest-color').value = dest.color_ui;
    document.getElementById('dest-color-hex').value = dest.color_ui;
}

async function guardarDestino(e) {
    e.preventDefault();
    const id = document.getElementById('dest-id').value;
    const idNegocio = appState.negocioActivoId;
    const data = {
        nombre: document.getElementById('dest-nombre').value,
        color_ui: document.getElementById('dest-color').value
    };
    const url = id ? `/api/destinos-kds/${id}` : `/api/negocios/${idNegocio}/destinos-kds`;
    const method = id ? 'PUT' : 'POST';

    try {
        await sendData(url, data, method);
        mostrarNotificacion("Destino guardado correctamente", "success");
        cerrarModalDestino();
        await cargarDestinos();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function eliminarDestino(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Destino?',
        text: 'Se desvincularán las impresoras y categorías asociadas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar'
    });
    if (result.isConfirmed) {
        try {
            await sendData(`/api/destinos-kds/${id}`, {}, 'DELETE');
            mostrarNotificacion("Destino eliminado", "success");
            await cargarDestinos();
            await cargarImpresoras(); // Refrescar impresoras por si perdieron el vínculo
        } catch (error) {
            mostrarNotificacion(error.message, "error");
        }
    }
}

/* --- LÓGICA DE IMPRESORAS --- */

async function cargarImpresoras() {
    const idNegocio = appState.negocioActivoId;
    if (!idNegocio) return;
    try {
        impresorasCache = await fetchData(`/api/negocios/${idNegocio}/impresoras`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion("Error al cargar impresoras", "error");
    }
}

function renderizarTabla() {
    const body = document.getElementById('impresoras-body');
    const noImpresoras = document.getElementById('no-impresoras');
    if (!body) return;
    body.innerHTML = '';

    if (impresorasCache.length === 0) {
        if (noImpresoras) noImpresoras.style.display = 'block';
        return;
    }
    if (noImpresoras) noImpresoras.style.display = 'none';

    impresorasCache.forEach(imp => {
        const destino = destinosCache.find(d => d.id == imp.destino_id);
        const labelDestino = destino ? destino.nombre : (imp.estacion || 'SIN DESTINO');
        const colorDestino = destino ? destino.color_ui : '#95a5a6';

        const tr = document.createElement('tr');
        tr.className = 'animate__animated animate__fadeIn';
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-800 text-dark">${imp.nombre}</div>
                <small class="text-muted">ID: ${imp.id}</small>
            </td>
            <td class="fw-700 text-primary">${imp.ip}</td>
            <td>
                <span class="badge px-3 py-2 rounded-pill fw-700" style="background: ${colorDestino}20; color: ${colorDestino}">
                    <i class="fas fa-terminal me-2"></i>${labelDestino.toUpperCase()}
                </span>
            </td>
            <td class="text-center">
                ${imp.es_caja ? '<i class="fas fa-check-circle text-success fs-5"></i>' : '<i class="far fa-circle text-muted fs-5"></i>'}
            </td>
            <td class="text-end pe-4">
                <div class="btn-group gap-2">
                    <button class="btn btn-sm btn-outline-warning rounded-3" onclick="window.probarImpresora(${imp.id})">
                        <i class="fas fa-bolt"></i> PRUEBA
                    </button>
                    <button class="btn btn-sm btn-light border rounded-3" onclick="window.editarImpresora(${imp.id})">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger rounded-3" onclick="window.eliminarImpresora(${imp.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

function abrirNuevaImpresora() {
    const modal = document.getElementById('modal-impresora');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-impresora-titulo').innerText = 'Configurar Impresora';
        document.getElementById('form-impresora').reset();
        document.getElementById('imp-id').value = '';
        document.getElementById('imp-es-caja').checked = false;
        actualizarSelectDestinos();
    }
}

function cerrarModalImpresora() {
    const modal = document.getElementById('modal-impresora');
    if (modal) modal.style.display = 'none';
}

function editarImpresora(id) {
    const imp = impresorasCache.find(i => i.id == id);
    if (!imp) return;
    abrirNuevaImpresora();
    document.getElementById('modal-impresora-titulo').innerText = 'Editar Impresora';
    document.getElementById('imp-id').value = imp.id;
    document.getElementById('imp-nombre').value = imp.nombre;
    document.getElementById('imp-ip').value = imp.ip;
    document.getElementById('imp-estacion').value = imp.estacion || '';
    document.getElementById('imp-destino-id').value = imp.destino_id || '';
    document.getElementById('imp-es-caja').checked = !!imp.es_caja;
}

async function guardarImpresora(e) {
    e.preventDefault();
    const id = document.getElementById('imp-id').value;
    const idNegocio = appState.negocioActivoId;
    const data = {
        nombre: document.getElementById('imp-nombre').value,
        ip: document.getElementById('imp-ip').value,
        estacion: document.getElementById('imp-estacion').value,
        destino_id: document.getElementById('imp-destino-id').value || null,
        es_caja: document.getElementById('imp-es-caja').checked
    };
    const url = id ? `/api/impresoras/${id}` : `/api/negocios/${idNegocio}/impresoras`;
    const approach = id ? 'PUT' : 'POST';
    try {
        await sendData(url, data, approach);
        mostrarNotificacion(id ? "Impresora actualizada" : "Impresora registrada", "success");
        cerrarModalImpresora();
        await cargarImpresoras();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function eliminarImpresora(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Impresora?',
        text: 'Se perderá el ruteo configurado para esta estación.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonColor: '#e74c3c'
    });
    if (result.isConfirmed) {
        try {
            await sendData(`/api/impresoras/${id}`, {}, 'DELETE');
            mostrarNotificacion("Impresora eliminada", "success");
            await cargarImpresoras();
        } catch (error) {
            mostrarNotificacion(error.message, "error");
        }
    }
}

/* --- UTILIDADES Y AGENTE --- */

async function verificarEstadoAgente() {
    const dot = document.getElementById('agent-status-dot');
    const text = document.getElementById('agent-status-text');
    if (!dot || !text) return;
    try {
        const idNegocio = appState.negocioActivoId;
        const res = await fetchData(`/api/negocios/${idNegocio}/agente/status`, { silent: true });
        if (res && res.status === 'online') {
            dot.style.background = '#00b894';
            text.textContent = 'Agente Online (Nube)';
        } else {
            const localRes = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(1000) }).catch(() => null);
            if (localRes && localRes.ok) {
                dot.style.background = '#0984e3';
                text.textContent = 'Agente Online (Local)';
            } else {
                dot.style.background = '#e74c3c';
                text.textContent = 'Agente Offline';
            }
        }
    } catch (e) {
        dot.style.background = '#e74c3c';
        text.textContent = 'Error Status';
    }
}

async function probarImpresora(id) {
    const imp = impresorasCache.find(i => i.id == id);
    if (!imp) return;
    const payload = {
        printer_name: imp.nombre,
        ip_destino: imp.ip,
        id_orden: "TEST-" + Math.floor(Math.random() * 1000),
        mesa: "TEST-GUI",
        mozo: "AGENTE CLOUD",
        negocio_nombre: "Baboons Test",
        items: [
            { cantidad: 1, nombre: "CERVEZA DE PRUEBA", notas: "Esquema Oficial v2" },
            { cantidad: 2, nombre: "EMPANADA TECNICA", notas: "Datos Reales" }
        ]
    };
    try {
        const idNegocio = appState.negocioActivoId;
        await sendData(`/api/negocios/${idNegocio}/impresion-cola/test`, { payload: payload });
        mostrarNotificacion("¡Comanda de prueba enviada con éxito!", "success");
    } catch (e) {
        mostrarNotificacion("No se pudo enviar la prueba.", "error");
    }
}

function abrirGuiaImpresoras() {
    const modal = document.getElementById('modal-guia-impresoras');
    if (modal) modal.style.display = 'flex';
}

function cerrarGuiaImpresoras() {
    const modal = document.getElementById('modal-guia-impresoras');
    if (modal) modal.style.display = 'none';
}

async function cargarAjustesPro() {
    const idNegocio = appState.negocioActivoId;
    try {
        const configs = await fetchData(`/api/negocios/${idNegocio}/configuraciones`, { silent: true });
        if (configs.resto_print_fallback !== undefined) {
            document.getElementById('p-fallback').checked = configs.resto_print_fallback === 'true' || configs.resto_print_fallback === true;
        }
        if (configs.resto_print_legend !== undefined) document.getElementById('p-legend').value = configs.resto_print_legend;
        if (configs.resto_print_sz_mesa !== undefined) document.getElementById('p-sz-mesa').value = configs.resto_print_sz_mesa;
        if (configs.resto_print_sz_mozo !== undefined) document.getElementById('p-sz-mozo').value = configs.resto_print_sz_mozo;
        if (configs.resto_print_sz_items !== undefined) document.getElementById('p-sz-items').value = configs.resto_print_sz_items;
        if (configs.resto_print_bill_title !== undefined) document.getElementById('p-bill-title').value = configs.resto_print_bill_title;
        if (configs.resto_print_hub_ip !== undefined) document.getElementById('p-print-hub-ip').value = configs.resto_print_hub_ip;
    } catch (e) { console.warn("Ajustes PRO omitidos"); }
}

async function guardarAjustesPro() {
    const idNegocio = appState.negocioActivoId;
    const payload = {
        resto_print_fallback: document.getElementById('p-fallback').checked,
        resto_print_legend: document.getElementById('p-legend').value,
        resto_print_sz_mesa: document.getElementById('p-sz-mesa').value,
        resto_print_sz_mozo: document.getElementById('p-sz-mozo').value,
        resto_print_sz_items: document.getElementById('p-sz-items').value,
        resto_print_bill_title: document.getElementById('p-bill-title').value,
        resto_print_hub_ip: document.getElementById('p-print-hub-ip').value
    };
    try {
        await sendData(`/api/negocios/${idNegocio}/configuraciones`, payload, 'POST');
        mostrarNotificacion("✅ Ajustes guardados", "success");
    } catch (e) { mostrarNotificacion("❌ Error al guardar", "error"); }
}
