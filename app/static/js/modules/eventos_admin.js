import { appState } from '../main.js';
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

let eventosCargados = [];

export async function inicializarEventos() {
    await cargarListaEventos();
}

async function cargarListaEventos() {
    const listado = document.getElementById('lista-eventos');
    if (!listado) return;

    try {
        const eventos = await fetchData(`/api/negocios/${appState.negocioActivoId}/eventos`);
        eventosCargados = eventos;

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
            const badgeEstado = ev.estado === 'activo' ? 'success' : (ev.estado === 'eliminado' ? 'danger' : 'warning');
            
            if (ev.estado === 'eliminado') return ''; // Ocultar eliminados

            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card border-left-primary shadow h-100 py-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-${badgeEstado}-soft text-${badgeEstado} border border-${badgeEstado}">${ev.estado.toUpperCase()}</span>
                            <button class="btn btn-sm btn-link text-muted" onclick='abrirModalEditarEvento(${JSON.stringify(ev).replace(/'/g, "&apos;")})'>
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                                    ${new Date(ev.fecha_evento).toLocaleDateString()} ${new Date(ev.fecha_evento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                <div class="h5 mb-1 font-weight-bold text-gray-800">${ev.titulo}</div>
                                <div class="text-muted small mb-2"><i class="fas fa-map-marker-alt me-1"></i> ${ev.ubicacion || 'Sin ubicación'}</div>
                                
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
                                    Inscriptos: <strong>${ev.cupo_total - ev.cupos_disponibles}</strong> / ${ev.cupo_total}
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between gap-2">
                            <button class="btn btn-sm btn-primary flex-grow-1" onclick="abrirModalInscriptos(${ev.id}, '${ev.titulo.replace(/'/g, "\\'")}')">
                                <i class="fas fa-users me-1"></i> Gestionar
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="copiarLinkEvento('${ev.virtual_slug}')" title="Copiar Link de Inscripción">
                                <i class="fas fa-link"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('[Eventos] Error en cargarListaEventos:', e);
        listado.innerHTML = `<div class="col-12 text-center py-5 text-danger">Error cargando eventos.</div>`;
    }
}

// --- GESTIÓN DE EVENTOS (CRUD) ---

window.abrirModalNuevoEvento = () => {
    document.getElementById('evento-modal-title').innerText = "Nuevo Evento";
    document.getElementById('form-evento').reset();
    document.getElementById('ev-id').value = "";
    document.getElementById('btn-eliminar-evento').style.display = "none";
    document.getElementById('btn-guardar-evento').innerText = "Crear Evento";
    document.getElementById('modal-evento').style.display = 'block';
};

window.abrirModalEditarEvento = (ev) => {
    document.getElementById('evento-modal-title').innerText = "Editar Evento";
    document.getElementById('ev-id').value = ev.id;
    document.getElementById('ev-titulo').value = ev.titulo;
    document.getElementById('ev-descripcion').value = ev.descripcion || '';
    // Ajustar formato fecha para input datetime-local
    if (ev.fecha_evento) {
        document.getElementById('ev-fecha').value = ev.fecha_evento.slice(0, 16);
    }
    document.getElementById('ev-precio').value = ev.precio;
    document.getElementById('ev-ubicacion').value = ev.ubicacion || '';
    document.getElementById('ev-cupo').value = ev.cupo_total;
    
    document.getElementById('btn-eliminar-evento').style.display = "block";
    document.getElementById('btn-guardar-evento').innerText = "Guardar Cambios";
    document.getElementById('modal-evento').style.display = 'block';
};

window.cerrarModalEvento = () => {
    document.getElementById('modal-evento').style.display = 'none';
};

window.guardarEvento = async () => {
    const evId = document.getElementById('ev-id').value;
    const data = {
        titulo: document.getElementById('ev-titulo').value,
        descripcion: document.getElementById('ev-descripcion').value,
        fecha_evento: document.getElementById('ev-fecha').value,
        precio: parseFloat(document.getElementById('ev-precio').value),
        ubicacion: document.getElementById('ev-ubicacion').value,
        cupo_total: parseInt(document.getElementById('ev-cupo').value)
    };

    try {
        if (evId) {
            await sendData(`/api/negocios/${appState.negocioActivoId}/eventos/${evId}`, data, 'PATCH');
            mostrarNotificacion('Evento actualizado', 'success');
        } else {
            await sendData(`/api/negocios/${appState.negocioActivoId}/eventos`, data, 'POST');
            mostrarNotificacion('Evento creado', 'success');
        }
        cerrarModalEvento();
        cargarListaEventos();
    } catch (e) {
        mostrarNotificacion('Error al guardar evento', 'error');
    }
};

window.eliminarEvento = async () => {
    const evId = document.getElementById('ev-id').value;
    if (!evId) return;

    const confirm = await Swal.fire({
        title: '¿Estás seguro?',
        text: "El evento ya no será visible para inscripciones.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            await sendData(`/api/negocios/${appState.negocioActivoId}/eventos/${evId}`, {}, 'DELETE');
            mostrarNotificacion('Evento eliminado', 'success');
            cerrarModalEvento();
            cargarListaEventos();
        } catch (e) {
            mostrarNotificacion('Error al eliminar', 'error');
        }
    }
};

// --- GESTIÓN DE INSCRIPTOS ---

window.abrirModalInscriptos = async (eventoId, titulo) => {
    document.getElementById('inscriptos-modal-title').innerText = `Gestión: ${titulo}`;
    document.getElementById('tabla-inscriptos-body').innerHTML = '<tr><td colspan="6" class="text-center">Cargando inscriptos...</td></tr>';
    document.getElementById('modal-inscriptos').style.display = 'block';

    try {
        const inscriptos = await fetchData(`/api/eventos/${eventoId}/inscriptos`);
        document.getElementById('inscriptos-count').innerText = `${inscriptos.length} personas inscriptas`;
        
        // Manejo del botón de exportación
        const btnExport = document.getElementById('btn-exportar-csv');
        if (btnExport) {
            btnExport.onclick = () => {
                const token = localStorage.getItem('jwt_token');
                window.open(`/api/eventos/${eventoId}/exportar?token=${token}`, '_blank');
            };
        }

        const body = document.getElementById('tabla-inscriptos-body');
        if (inscriptos.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aún no hay inscripciones para este evento.</td></tr>';
            return;
        }

        body.innerHTML = inscriptos.map(ins => {
            const badgePago = ins.estado_pago === 'confirmado' ? 'bg-success' : 'bg-warning';
            const badgeIngreso = ins.asistio ? 'bg-info' : 'bg-secondary';
            
            return `
            <tr>
                <td>
                    <div class="fw-bold">${ins.nombre_cliente}</div>
                    <div class="text-muted small">${ins.email}</div>
                </td>
                <td>${ins.telefono || '-'}</td>
                <td><span class="badge ${badgePago}">${ins.estado_pago.toUpperCase()}</span></td>
                <td>$${ins.monto_total.toFixed(2)}</td>
                <td>
                    <span class="badge ${badgeIngreso}">
                        ${ins.asistio ? '<i class="fas fa-check me-1"></i> INGRESÓ' : 'NO INGRESÓ'}
                    </span>
                    ${ins.fecha_asistencia ? `<div class="text-muted" style="font-size:0.7rem">${new Date(ins.fecha_asistencia).toLocaleTimeString()}</div>` : ''}
                </td>
                <td class="text-end">
                    <div class="btn-group">
                        ${ins.estado_pago !== 'confirmado' ? 
                            `<button class="btn btn-sm btn-outline-success" onclick="actualizarInscripcion(${ins.id}, {estado_pago: 'confirmado'}, ${eventoId}, '${titulo}')" title="Confirmar Pago">
                                <i class="fas fa-dollar-sign"></i>
                            </button>` : ''
                        }
                        ${!ins.asistio ? 
                            `<button class="btn btn-sm btn-outline-info" onclick="actualizarInscripcion(${ins.id}, {asistio: true}, ${eventoId}, '${titulo}')" title="Registrar Ingreso Manual">
                                <i class="fas fa-user-check"></i>
                            </button>` : ''
                        }
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        mostrarNotificacion('Error cargando inscriptos', 'error');
    }
};

window.cerrarModalInscriptos = () => {
    document.getElementById('modal-inscriptos').style.display = 'none';
};

window.actualizarInscripcion = async (insId, data, evId, titulo) => {
    try {
        await sendData(`/api/eventos/inscripciones/${insId}`, data, 'PATCH');
        mostrarNotificacion('Registro actualizado', 'success');
        // Recargar la lista de inscriptos sin cerrar el modal
        abrirModalInscriptos(evId, titulo);
        // También recargar la lista de eventos para ver si bajó el cupo (opcional)
        cargarListaEventos();
    } catch (e) {
        mostrarNotificacion('Error al actualizar registro', 'error');
    }
};

window.copiarLinkEvento = (identifier) => {
    const url = `${window.location.origin}/landing/${identifier}`;
    navigator.clipboard.writeText(url).then(() => {
        mostrarNotificacion('Link de inscripción copiado (Slug Seguro)', 'info');
    });
};

window.copiarLinkPortero = () => {
    const url = window.location.origin + '/static/Eventos/operador.html';
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            mostrarNotificacion('Link del Portero copiado al portapapeles', 'success');
        }).catch(err => {
            // Fallback manual
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            mostrarNotificacion('Link del Portero copiado', 'success');
        });
    } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        mostrarNotificacion('Link del Portero copiado', 'success');
    }
};
