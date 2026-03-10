import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

export async function inicializarEventos() {
    await cargarListaEventos();
}

async function cargarListaEventos() {
    const listado = document.getElementById('lista-eventos');
    if (!listado) return;

    try {
        console.log(`[Eventos] Cargando lista para negocio: ${appState.negocioActivoId}`);
        const eventos = await fetchData(`/api/negocios/${appState.negocioActivoId}/eventos`);
        console.log(`[Eventos] ${eventos.length} eventos recibidos.`);

        if (eventos.length === 0) {
            listado.innerHTML = `
                <div class="col-12 text-center py-5">
                    <p class="text-muted">No has creado eventos todavía.</p>
                </div>
            `;
            return;
        }

        listado.innerHTML = eventos.map(ev => {
            const porcentaje = Math.round(((ev.cupo_total - ev.cupos_disponibles) / ev.cupo_total) * 100);
            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card border-left-primary shadow h-100 py-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                                    ${new Date(ev.fecha_evento).toLocaleDateString()}
                                </div>
                                <div class="h5 mb-1 font-weight-bold text-gray-800">${ev.titulo}</div>
                                <div class="text-muted small mb-2">${ev.ubicacion || 'Sin ubicación'}</div>
                                
                                <div class="row no-gutters align-items-center">
                                    <div class="col-auto">
                                        <div class="h6 mb-0 mr-3 font-weight-bold text-gray-800">${porcentaje}%</div>
                                    </div>
                                    <div class="col">
                                        <div class="progress progress-sm mr-2">
                                            <div class="progress-bar bg-primary" role="progressbar" style="width: ${porcentaje}%"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-2 small text-muted">
                                    Vendidos: ${ev.cupo_total - ev.cupos_disponibles} / ${ev.cupo_total}
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-sm btn-outline-info" onclick="copiarLinkEvento(${ev.id})">
                                <i class="fas fa-link"></i> Landing
                            </button>
                            <button class="btn btn-sm btn-outline-primary" onclick="window.location.href='/static/Eventos/operador.html'">
                                <i class="fas fa-qrcode"></i> Operador
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('[Eventos] Error en cargarListaEventos:', e);
        listado.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="text-danger">Hubo un error al cargar los eventos. Por favor, reintente.</p>
                <button class="btn btn-sm btn-outline-primary" onclick="window.location.reload()">Recargar</button>
            </div>
        `;
        mostrarNotificacion('Error cargando eventos', 'error');
    }
}

window.abrirModalNuevoEvento = () => {
    document.getElementById('modal-evento').style.display = 'block';
};

window.cerrarModalEvento = () => {
    document.getElementById('modal-evento').style.display = 'none';
};

window.guardarEvento = async () => {
    const data = {
        titulo: document.getElementById('ev-titulo').value,
        descripcion: document.getElementById('ev-descripcion').value,
        fecha_evento: document.getElementById('ev-fecha').value,
        precio: document.getElementById('ev-precio').value,
        ubicacion: document.getElementById('ev-ubicacion').value,
        cupo_total: document.getElementById('ev-cupo').value
    };

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/eventos`, data, 'POST');
        mostrarNotificacion('Evento creado con éxito!', 'success');
        cerrarModalEvento();
        cargarListaEventos();
    } catch (e) {
        mostrarNotificacion('Error al crear evento', 'error');
    }
};

window.copiarLinkEvento = (id) => {
    const url = `${window.location.origin}/static/Eventos/landing.html?id=${id}`;
    navigator.clipboard.writeText(url).then(() => {
        mostrarNotificacion('Link copiado al portapapeles', 'info');
    });
};
