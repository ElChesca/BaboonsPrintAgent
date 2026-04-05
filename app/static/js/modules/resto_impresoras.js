/* app/static/js/modules/resto_impresoras.js */
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

let impresorasCache = [];

export async function inicializarRestoImpresoras() {
    console.log("🖨️ Módulo de Configuración de Impresoras Inicializado");

    const form = document.getElementById('form-impresora');
    if (form) {
        form.onsubmit = guardarImpresora;
    }

    // Bind windows globals
    window.abrirNuevaImpresora = abrirNuevaImpresora;
    window.cerrarModalImpresora = cerrarModalImpresora;
    window.editarImpresora = editarImpresora;
    window.eliminarImpresora = eliminarImpresora;
    window.probarImpresora = probarImpresora;
    window.abrirGuiaImpresoras = abrirGuiaImpresoras;
    window.cerrarGuiaImpresoras = cerrarGuiaImpresoras;
    window.guardarAjustesPro = guardarAjustesPro;

    await cargarImpresoras();
    await cargarAjustesPro();
    await verificarEstadoAgente();
}

async function cargarImpresoras() {
    const idNegocio = appState.negocioActivoId;
    if (!idNegocio) return;

    try {
        impresorasCache = await fetchData(`/api/negocios/${idNegocio}/impresoras`);
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion("Error al cargar impresoras", "error");
        console.error(error);
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
        const tr = document.createElement('tr');
        tr.className = 'animate__animated animate__fadeIn';
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-800 text-dark">${imp.nombre}</div>
                <small class="text-muted">ID: ${imp.id}</small>
            </td>
            <td class="fw-700 text-primary">${imp.ip}</td>
            <td>
                <span class="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-700">
                    <i class="fas fa-terminal me-2"></i>${imp.estacion.toUpperCase()}
                </span>
            </td>
            <td class="text-center">
                ${imp.es_caja ? '<i class="fas fa-check-circle text-success fs-5"></i>' : '<i class="far fa-circle text-muted fs-5"></i>'}
            </td>
            <td class="text-end pe-4">
                <div class="btn-group gap-2">
                    <button class="btn btn-sm btn-outline-warning rounded-3" onclick="window.probarImpresora(${imp.id})" title="Probar Impresión">
                        <i class="fas fa-bolt"></i> PRUEBA
                    </button>
                    <button class="btn btn-sm btn-light border rounded-3" onclick="window.editarImpresora(${imp.id})" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger rounded-3" onclick="window.eliminarImpresora(${imp.id})" title="Eliminar">
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
        document.getElementById('modal-impresora-titulo').innerText = 'Registrar Impresora';
        document.getElementById('form-impresora').reset();
        document.getElementById('imp-id').value = '';
        document.getElementById('imp-es-caja').checked = false;
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
    document.getElementById('imp-estacion').value = imp.estacion;
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
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e74c3c'
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
function getAgentUrl() {
    const hubIp = document.getElementById('p-print-hub-ip')?.value || '';
    if (hubIp && hubIp.trim() !== '') {
        return `http://${hubIp.trim()}:5001`;
    }
    return 'http://localhost:5001';
}

async function verificarEstadoAgente() {
    const dot = document.getElementById('agent-status-dot');
    const text = document.getElementById('agent-status-text');
    if (!dot || !text) return;

    try {
        const idNegocio = appState.negocioActivoId;
        const res = await fetchData(`/api/negocios/${idNegocio}/agente/status`, { silent: true });
        
        if (res && res.status === 'online') {
            dot.style.background = '#00b894'; // Verde esmeralda
            text.textContent = 'Agente Online (Nube)';
            text.style.color = '#2d3436';
        } else {
            // Fallback: intentar ver si hay un agente local corriendo para compatibilidad
            const localRes = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(1000) }).catch(() => null);
            if (localRes && localRes.ok) {
                dot.style.background = '#0984e3'; // Azul (Local)
                text.textContent = 'Agente Online (Local)';
            } else {
                dot.style.background = '#e74c3c'; // Rojo coral
                text.textContent = 'Agente Offline';
                text.style.color = '#636e72';
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
            { cantidad: 1, nombre: "CERVEZA DE PRUEBA", notas: "Esquema Oficial v1" },
            { cantidad: 2, nombre: "EMPANADA TECNICA", notas: "Datos Reales" }
        ]
    };

    try {
        const idNegocio = appState.negocioActivoId;
        // ENVIAR A LA COLA CLOUD EN LUGAR DE LOCALHOST
        await sendData(`/api/negocios/${idNegocio}/impresion-cola/test`, { 
            payload: payload 
        });
        
        mostrarNotificacion("¡Comanda de prueba enviada a la Nube con éxito!", "success");
    } catch (e) {
        console.error("Error al enviar prueba a la nube:", e);
        mostrarNotificacion("No se pudo enviar la prueba a la nube. Verifique su conexión.", "error");
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
        
        // Mapear los valores a los inputs del modal
        if (configs.resto_print_fallback !== undefined) {
            document.getElementById('p-fallback').checked = configs.resto_print_fallback === 'true' || configs.resto_print_fallback === true;
        }
        if (configs.resto_print_legend !== undefined) {
            document.getElementById('p-legend').value = configs.resto_print_legend;
        }
        if (configs.resto_print_sz_mesa !== undefined) {
            document.getElementById('p-sz-mesa').value = configs.resto_print_sz_mesa;
        }
        if (configs.resto_print_sz_mozo !== undefined) {
            document.getElementById('p-sz-mozo').value = configs.resto_print_sz_mozo;
        }
        if (configs.resto_print_sz_items !== undefined) {
            document.getElementById('p-sz-items').value = configs.resto_print_sz_items;
        }
        if (configs.resto_print_bill_title !== undefined) {
            document.getElementById('p-bill-title').value = configs.resto_print_bill_title;
        }
        if (configs.resto_print_hub_ip !== undefined) {
            document.getElementById('p-print-hub-ip').value = configs.resto_print_hub_ip;
        }
    } catch (e) {
        console.warn("⚠️ No se pudieron cargar los ajustes PRO de impresión:", e);
    }
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
        mostrarNotificacion("✅ Ajustes de impresión guardados", "success");
        await cargarAjustesPro(); // Refrescar
    } catch (e) {
        mostrarNotificacion("❌ Error al guardar ajustes", "error");
    }
}
