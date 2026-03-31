// static/js/modules/admin_negocios.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';

let todosLosNegocios = [];
let inicializado = false;

export async function inicializarAdminNegocios() {
    if (inicializado) return;
    inicializado = true;
    
    console.log("🚀 Inicializando Panel Corporativo...");
    await cargarResumenNegocios();
}

async function cargarResumenNegocios() {
    const grid = document.getElementById('negocios-grid');
    if (!grid) return;

    try {
        grid.innerHTML = `
            <div class="col text-center py-5 w-100">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2" style="color: #888;">Sincronizando filiales...</p>
            </div>
        `;

        const negocios = await fetchData('/api/admin/negocios/summary');
        todosLosNegocios = negocios;
        
        document.getElementById('total-negocios-count').textContent = negocios.length;
        renderizarGrid(negocios);

    } catch (error) {
        console.error("Error al cargar resumen:", error);
        mostrarNotificacion('Error al sincronizar filiales.', 'error');
        grid.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

function renderizarGrid(lista) {
    const grid = document.getElementById('negocios-grid');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">No se encontraron negocios con esos criterios.</div>';
        return;
    }

    grid.innerHTML = lista.map(n => `
        <div class="col">
            <div class="card-negocio fade-in">
                <div class="card-negocio-header">
                    <div class="negocio-logo-container" style="${n.logo_url ? `background-image: url('${n.logo_url}')` : ''}">
                        ${!n.logo_url ? n.nombre.charAt(0).toUpperCase() : ''}
                    </div>
                    <div class="d-flex flex-column align-items-end">
                        <div class="d-flex align-items-center mb-2">
                            <div class="status-dot ${n.acceso_bloqueado ? 'inactive' : 'active'}"></div>
                            <span class="small fw-bold" style="color: ${n.acceso_bloqueado ? '#ff6b6b' : '#51cf66'}">
                                ${n.acceso_bloqueado ? 'BLOQUEADO' : 'ACTIVO'}
                            </span>
                        </div>
                        <span class="negocio-type-badge">${n.tipo_app || 'Retail'}</span>
                    </div>
                </div>
                
                <div class="negocio-info">
                    <h3 class="negocio-nombre">${n.nombre}</h3>
                    <div class="mp-status-pill ${n.mp_configured ? 'connected' : 'disconnected'}">
                        <i class="fas ${n.mp_configured ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2"></i>
                        MP: ${n.mp_configured ? 'Configurado' : 'Pendiente'}
                    </div>
                </div>

                <div class="card-negocio-footer">
                    <button class="btn btn-action-glass primary flex-grow-1" onclick="window.abrirConfigTecnica(${n.id}, '${n.nombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-cog"></i> Configurar
                    </button>
                    <button class="btn btn-action-glass" onclick="window.verDashboardNegocio(${n.id})">
                        <i class="fas fa-chart-line"></i> Reportes
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Globales para el HTML
window.filtrarNegociosAdmin = () => {
    const query = document.getElementById('search-negocios').value.toLowerCase();
    const filtered = todosLosNegocios.filter(n => 
        n.nombre.toLowerCase().includes(query) || 
        (n.tipo_app && n.tipo_app.toLowerCase().includes(query))
    );
    renderizarGrid(filtered);
};

window.abrirConfigTecnica = async (id, nombre) => {
    document.getElementById('modal-negocio-nombre').textContent = nombre;
    document.getElementById('config-negocio-id').value = id;
    
    // Limpiar campos antes de cargar
    document.getElementById('mp-access-token').value = "";
    document.getElementById('mp-device-id').value = "";
    
    try {
        showGlobalLoader();
        const configs = await fetchData(`/api/negocios/${id}/configuraciones`);
        hideGlobalLoader();
        
        if (configs.mp_access_token) document.getElementById('mp-access-token').value = configs.mp_access_token;
        if (configs.mp_device_id) document.getElementById('mp-device-id').value = configs.mp_device_id;
        
        const modal = new bootstrap.Modal(document.getElementById('modalConfigTecnica'));
        modal.show();
    } catch (error) {
        hideGlobalLoader();
        mostrarNotificacion('No se pudo cargar la configuración técnica.', 'error');
    }
};

window.testMPConnectionAdmin = async () => {
    const id = document.getElementById('config-negocio-id').value;
    const token = document.getElementById('mp-access-token').value.trim();
    const btn = document.getElementById('btn-test-mp');
    
    if (!token) {
        Swal.fire('Atención', 'Primero pegue su Access Token para probar la conexión.', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Verificando...';
        
        // Enviamos el token actual en un header para que el backend pruebe ESE token, no el guardado
        const res = await fetchData(`/api/admin/negocios/${id}/mp-test`, {
            headers: { 'X-MP-Token': token }
        });
        
        if (res.success) {
            Swal.fire({
                title: '✅ Conexión Exitosa',
                html: `<b>Usuario MP:</b> ${res.nickname || 'N/A'}<br><b>ID Cliente:</b> ${res.user_id || 'N/A'}`,
                icon: 'success',
                background: '#1a1a1a',
                color: '#fff',
                confirmButtonColor: '#0d6efd'
            });
        } else {
            Swal.fire({
                title: '❌ Error de Validación',
                text: res.error || 'El token no es válido o ha expirado.',
                icon: 'error',
                background: '#1a1a1a',
                color: '#fff'
            });
        }
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-vial me-2"></i> Probar Conexión';
    }
};

window.toggleMPTokenVisibility = () => {
    const input = document.getElementById('mp-access-token');
    const icon = document.getElementById('toggle-token-icon');
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};
 
window.buscarDispositivosMPAdmin = async () => {
    const negocioId = document.getElementById('config-negocio-id').value;
    const token = document.getElementById('mp-access-token').value.trim();
    const btn = document.getElementById('btn-search-mp-admin');
    
    if (!token) {
        Swal.fire('Atención', 'Primero pegue su Access Token para buscar los dispositivos vinculados.', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Pasamos el token manual en un header para que el backend lo use temporalmente
        const res = await fetchData(`/api/negocios/${negocioId}/mp/devices`, {
            headers: { 'X-MP-Token': token }
        });

        if (res.error) {
            throw new Error(res.error);
        }

        const devices = res.devices || [];
        if (devices.length === 0) {
            Swal.fire('Sin Resultados', 'No hay terminales Point vinculados a este token de Mercado Pago.', 'info');
            return;
        }

        const options = {};
        devices.forEach(d => {
            const label = d.id.includes('__') ? d.id.replace('__', ' (S/N: ') + ')' : d.id;
            options[d.id] = `${label} - ${d.operating_mode || 'Point'}`;
        });

        const { value: selectedId } = await Swal.fire({
            title: '📜 Dispositivos Encontrados',
            input: 'select',
            inputOptions: options,
            inputPlaceholder: 'Seleccione su Point...',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#0d6efd',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'rounded-4 border-secondary'
            }
        });

        if (selectedId) {
            document.getElementById('mp-device-id').value = selectedId;
            mostrarNotificacion('Terminal vinculada localmente. Pulse Guardar para confirmar.', 'info');
        }

    } catch (error) {
        console.error("Error buscando dispositivos:", error);
        Swal.fire('Error', `No se pudo buscar: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search"></i>';
    }
};

// Guardar Configuración
const formMP = document.getElementById('form-config-mp');
if (formMP) {
    formMP.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('config-negocio-id').value;
        const token = document.getElementById('mp-access-token').value.trim();
        const deviceId = document.getElementById('mp-device-id').value.trim();
        
        const payload = {
            'mp_access_token': token,
            'mp_device_id': deviceId
        };
 
        try {
            showGlobalLoader("Guardando y Sincronizando...");
            
            // 1. Guardar configuraciones en la BD
            const saveRes = await sendData(`/api/negocios/${id}/configuraciones`, payload);
            
            if (saveRes.error) throw new Error(saveRes.error);

            // 2. Vincular automáticamente con Mercado Pago (Modo PDV)
            // Esto es crucial para que el Point Smart esté "despierto"
            const syncRes = await sendData(`/api/negocios/${id}/mp/setup-terminal`, { 
                device_id: deviceId, 
                mode: 'PDV' 
            });

            hideGlobalLoader();

            if (syncRes.error) {
                console.warn("Error de sincronización:", syncRes.error);
                await Swal.fire({
                    title: 'Configuración Guardada',
                    text: 'Los datos se guardaron, pero hubo un problema al sincronizar el POS: ' + syncRes.error,
                    icon: 'warning',
                    confirmButtonText: 'Entendido',
                    background: '#1a1a1a',
                    color: '#fff'
                });
            } else {
                await Swal.fire({
                    title: '¡Sincronización Exitosa!',
                    text: 'Configuración guardada y Point configurado en Modo PDV. ¡Ya puedes realizar cobros!',
                    icon: 'success',
                    confirmButtonText: 'Perfecto',
                    background: '#1a1a1a',
                    color: '#fff'
                });
            }
            
            // Cerramos el modal usando el ID correcto del HTML
            const modalEl = document.getElementById('modalConfigTecnica');
            if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
            
            // Actualizamos el grid para ver el badge "CONECTADO"
            if (typeof cargarResumenNegocios === 'function') cargarResumenNegocios();

        } catch (error) {
            hideGlobalLoader();
            console.error("Error guardando:", error);
            Swal.fire('Error', `Fallo al guardar: ${error.message}`, 'error');
        }
    };
}

window.verDashboardNegocio = (id) => {
    // Aquí podrías redirigir a una vista de reportes filtrada por este negocio
    mostrarNotificacion(`Cargando métricas del negocio ID: ${id}...`, 'info');
    // Implementación futura: window.location.hash = `#dashboard?negocio_id=${id}`;
};
