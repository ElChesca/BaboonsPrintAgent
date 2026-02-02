import { fetchData } from '../api.js';
import { appState } from '../main.js'; 
// 👇 1. IMPORTAR TU MÓDULO DE NOTIFICACIONES EXISTENTE
import { mostrarNotificacion } from './notifications.js';

let clienteActivo = null;
let html5QrCode = null;
let cargandoPuntos = false;
let chartBalanceInstance = null;
let chartTopInstance = null;

// =========================================================
// 🚀 INICIALIZACIÓN
// =========================================================
export function inicializarLogicaGestionClub() {
    const negocioId = appState.negocioActivoId;
    
    // Validación con notificación linda
    if (!negocioId) {
        mostrarNotificacion("Selecciona un negocio primero", "warning");
        return;
    }

    // Cargas iniciales
    cargarConfiguracion(negocioId);
    cargarPremios(negocioId);
    cargarNiveles(); 
    actualizarHistorialActivo();
    cargarDashboard();
    cargarEncuestas();

    // Listener para formulario de Premios
    const formPremio = document.getElementById('form-premio');
    if (formPremio) {
        const newFormP = formPremio.cloneNode(true);
        formPremio.parentNode.replaceChild(newFormP, formPremio);
        newFormP.addEventListener('submit', (e) => guardarPremio(e, negocioId));
    }
}

// =========================================================
// 🔍 CLIENTES Y CARGA (Aquí estaba el problema visual)
// =========================================================
window.buscarClientePuntos = async () => {
    const dni = document.getElementById('filtro-dni-cliente').value;
    
    if(!dni) {
        mostrarNotificacion("Por favor, ingrese un DNI", "warning");
        return;
    }

    const token = localStorage.getItem('jwt_token');
    const negocioId = appState.negocioActivoId;

    try {
        const res = await fetch(`/api/club/admin/cliente/${dni}?negocio_id=${negocioId}`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 👇 MANEJO CORRECTO DEL 404
        if(!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Cliente no encontrado");
        }

        const data = await res.json();
        clienteActivo = data; 
        
        // Renderizar Panel
        document.getElementById('info-cliente-panel').classList.remove('d-none');
        document.getElementById('nombre-cliente-display').innerText = `${data.nombre}`;
        document.getElementById('puntos-cliente-display').innerText = data.puntos_acumulados || 0;
        
        // Renderizar Nivel (Badge)
        const badgeContainer = document.getElementById('nivel-cliente-badge');
        if(badgeContainer) {
            const nivel = data.nivel || { nombre: 'Miembro', color: '#6c757d', icono: 'fa-user' };
            badgeContainer.innerHTML = `
                <span class="badge rounded-pill px-3 py-2 shadow-sm" 
                      style="background-color: ${nivel.color}; font-size: 0.9rem;">
                    <i class="fas ${nivel.icono} me-1"></i> ${nivel.nombre}
                </span>
            `;
        }
        // ... después de renderizar el badge del nivel ...
        const panelInfo = document.getElementById('info-cliente-panel');
        const canjesPendientes = data.canjes_pendientes || [];

        if (canjesPendientes.length > 0) {
            // Insertamos un aviso dinámico en el panel del cliente
            const avisoCanje = document.createElement('div');
            avisoCanje.className = "alert alert-warning mt-3 border-0 shadow-sm animate__animated animate__pulse animate__infinite";
            avisoCanje.innerHTML = `
                <h6 class="fw-bold mb-1"><i class="fas fa-gift me-2"></i>¡Canje Pendiente!</h6>
                <p class="small mb-2">El cliente solicitó: <b>${canjesPendientes[0].premio_nombre}</b></p>
                <button class="btn btn-dark btn-sm w-100 rounded-pill" onclick="entregarPremio(${canjesPendientes[0].id})">
                    CONFIRMAR ENTREGA
                </button>
            `;
            panelInfo.appendChild(avisoCanje);
        }

        // Mostrar botón X
        const btnLimpiar = document.getElementById('btn-limpiar-filtro');
        if(btnLimpiar) btnLimpiar.style.display = 'block';
        
        actualizarBotonesSegunPuntos();
        
        // 👇 NOTIFICACIÓN VERDE DE ÉXITO
        mostrarNotificacion(`Cliente encontrado: ${data.nombre}`, "success");

    } catch (e) {
        // 👇 NOTIFICACIÓN ROJA DE ERROR (ESTÉTICA)
        mostrarNotificacion(e.message, "error");
        limpiarCliente();
    }
};

window.limpiarCliente = () => {
    clienteActivo = null;
    document.getElementById('filtro-dni-cliente').value = '';
    
    const btnLimpiar = document.getElementById('btn-limpiar-filtro');
    if(btnLimpiar) btnLimpiar.style.display = 'none';
    
    document.getElementById('info-cliente-panel').classList.add('d-none');
    
    document.querySelectorAll('.btn-canjear').forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = '🎁 Canjear';
        btn.classList.replace('btn-secondary', 'btn-success');
    });
};

window.confirmarCargaPuntos = async () => {
    if (cargandoPuntos) return;
    
    const dni = document.getElementById('filtro-dni-cliente').value.trim();
    const puntos = document.getElementById('puntos-manual').value.trim();
    const motivo = document.getElementById('motivo-manual').value.trim() || 'Carga en caja';

    if (!dni) return mostrarNotificacion("Busque un cliente primero", "warning");
    if (!puntos || parseInt(puntos) <= 0) return mostrarNotificacion("Monto inválido", "warning");

    // Usamos confirm nativo para acciones críticas (o podés hacer un modal lindo después)
    if (!confirm(`¿Cargar ${puntos} puntos a ${dni}?`)) return;

    try {
        cargandoPuntos = true;
        const res = await fetchData('/api/club/admin/cargar-puntos', {
            method: 'POST',
            body: JSON.stringify({
                negocio_id: appState.negocioActivoId,
                cliente_identificador: clienteActivo ? (clienteActivo.token_qr || dni) : dni,
                cantidad: puntos,
                motivo: motivo
            })
        });

        // 👇 ÉXITO
        mostrarNotificacion(res.mensaje, "success");
        
        document.getElementById('puntos-manual').value = '';
        buscarClientePuntos(); 
        actualizarHistorialActivo();

    } catch (error) {
        mostrarNotificacion(error.message, "error");
    } finally {
        cargandoPuntos = false;
    }
};

// --- CANJE DE PREMIO ---
window.entregarPremio = async (canjeId) => {
    if (!confirm("¿Confirmas la entrega física del premio?")) return;

    try {
        const token = localStorage.getItem('jwt_token');
        const res = await fetch(`/api/club/admin/confirmar-entrega`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ canje_id: canjeId })
        });

        const result = await res.json();
        
        if (res.ok) {
            // 1. Intentamos mostrar el cartel lindo si Swal existe
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: '¡Entrega Exitosa!',
                    html: `Premio: <b>${result.premio}</b><br>Comprobante: <span class="fs-2 text-primary"><b>${result.comprobante}</b></span>`,
                    icon: 'success',
                    confirmButtonColor: '#ff7a21'
                });
            } else {
                alert(`¡Entrega Exitosa! Comprobante: ${result.comprobante}`);
            }

            // 2. 🔥 LA CLAVE: Limpiamos y buscamos de nuevo al cliente
            // Esto hará que el aviso amarillo de canje desaparezca porque el estado ya no es 'pendiente'
            await buscarClientePuntos(); 
            cargarDashboard();
            
        } else {
            // Si el canje ya se hizo, igual refrescamos para limpiar el panel "fantasma"
            if (res.status === 404) {
                mostrarNotificacion("Este canje ya fue procesado anteriormente.", "info");
                buscarClientePuntos();
            } else {
                throw new Error(result.error);
            }
        }
    } catch (e) {
        mostrarNotificacion(e.message, "error");
    }
};
// =========================================================
// 🏆 NIVELES
// =========================================================
window.cargarNiveles = async () => {
    const tbody = document.getElementById('tabla-niveles-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const res = await fetchData(`/api/club/admin/niveles?negocio_id=${appState.negocioActivoId}`);
        tbody.innerHTML = '';
        
        if(res.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin niveles configurados</td></tr>';
            return;
        }

        res.forEach(n => {
            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold" style="color: ${n.color}">${n.nombre}</td>
                    <td>${n.puntos_minimos} pts</td>
                    <td><i class="fa ${n.icono} fa-lg" style="color: ${n.color}"></i></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarNivel(${n.id})"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch(e) { console.error(e); }
};

window.abrirModalNivel = () => {
    const modal = document.getElementById('modalNivel');
    document.getElementById('form-nivel').reset();
    document.getElementById('nivel-id').value = '';
    modal.style.display = 'flex'; 
};

window.cerrarModalNivel = () => {
    document.getElementById('modalNivel').style.display = 'none';
};

window.guardarNivel = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const txt = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

    const payload = {
        id: document.getElementById('nivel-id').value || null,
        negocio_id: appState.negocioActivoId,
        nombre: document.getElementById('nivel-nombre').value,
        puntos_minimos: document.getElementById('nivel-puntos').value,
        color: document.getElementById('nivel-color').value,
        icono: document.getElementById('nivel-icono').value
    };

    try {
        await fetchData('/api/club/admin/niveles', { method: 'POST', body: JSON.stringify(payload) });
        mostrarNotificacion('Nivel guardado correctamente', 'success');
        window.cerrarModalNivel();
        cargarNiveles();
    } catch(err) { 
        mostrarNotificacion(err.message, 'error'); 
    } finally {
        btn.innerText = txt;
        btn.disabled = false;
    }
};

window.eliminarNivel = async (id) => {
    if(!confirm('¿Estás seguro de borrar este nivel?')) return;
    
    try {
        await fetchData(`/api/club/admin/niveles?id=${id}`, { method: 'DELETE' });
        mostrarNotificacion('Nivel eliminado', 'success');
        cargarNiveles();
    } catch(e) { 
        mostrarNotificacion("Error: " + e.message, "error"); 
    }
};

// =========================================================
// 🎁 PREMIOS
// =========================================================
async function guardarPremio(e, negocioId) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-premio');
    const txtOriginal = btn.innerText;
    
    if (!document.getElementById('form-premio').checkValidity()) {
        document.getElementById('form-premio').reportValidity();
        return;
    }

    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('negocio_id', negocioId);
        formData.append('nombre', document.getElementById('premio-nombre').value);
        formData.append('costo_puntos', document.getElementById('premio-costo').value);
        formData.append('stock', document.getElementById('premio-stock').value);
        formData.append('descripcion', document.getElementById('premio-descripcion').value);        
        formData.append('tipo_premio', document.getElementById('premio-tipo').value); 
        
        const esFuego = document.getElementById('nuevo-premio-fuego').checked ? 1 : 0;
        formData.append('es_fuego', esFuego);

        const id = document.getElementById('premio-id-hidden').value;
        if(id) formData.append('id', id);

        const fileInput = document.getElementById('premio-img-file');
        if (fileInput.files.length > 0) {
            formData.append('imagen', fileInput.files[0]);
        }

        const token = localStorage.getItem('jwt_token');
        const res = await fetch('/api/club/admin/premios', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const text = await res.text();
        let result;
        try { result = JSON.parse(text); } catch (err) { throw new Error("Error del servidor"); }

        if (!res.ok) throw new Error(result.error || "Error al guardar");
        
        mostrarNotificacion(id ? "Premio actualizado" : "Premio creado", "success");
        window.cerrarModalManual();
        cargarPremios(negocioId);

    } catch(err) { 
        console.error(err);
        mostrarNotificacion(err.message, "error"); 
    } finally { 
        btn.innerText = txtOriginal;
        btn.disabled = false; 
    }
}

async function cargarPremios(negocioId) {
    const cont = document.getElementById('premios-grilla');
    const vacio = document.getElementById('sin-premios-msg');
    if (!cont) return; 
    
    cont.innerHTML = '<div class="text-center w-100 py-4"><div class="spinner-border text-primary"></div></div>'; 
    try {
        const premios = await fetchData(`/api/club/admin/premios?negocio_id=${negocioId}`);
        cont.innerHTML = '';
        if (premios.length === 0) {
            if(vacio) vacio.classList.remove('d-none');
        } else {
            if(vacio) vacio.classList.add('d-none');
            renderizarPremios(premios, cont);
        }
    } catch(e) { 
        console.error(e);
        mostrarNotificacion("Error cargando premios", "error");
    }
}

function renderizarPremios(premios, contenedor) {
    premios.forEach(p => {
        let imgUrl = p.imagen_url;
        if (!imgUrl || imgUrl === 'null') imgUrl = 'https://placehold.co/400x300?text=Sin+Imagen';
        else if (!imgUrl.startsWith('http')) imgUrl = `/static/img/premios/${imgUrl}`;

        contenedor.innerHTML += `
            <div class="col">
                <div class="card card-premio h-100">
                    <div class="img-premio-container">
                        <img src="${imgUrl}" alt="${p.nombre}" onerror="this.onerror=null; this.src='https://placehold.co/400x300?text=Error';"> 
                    </div>
                    <div class="card-premio-body">
                        <div class="mb-3">
                            <h5 class="fw-bold mb-1 text-truncate">${p.nombre}</h5>
                            <span class="badge bg-primary bg-opacity-10 text-primary">💎 ${p.costo_puntos}</span>
                            <small class="text-muted ms-2">Stock: ${p.stock}</small>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-success btn-sm w-100 btn-canjear" onclick="iniciarCanje(${p.id}, '${p.nombre}', ${p.costo_puntos})">🎁 Canjear</button>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-secondary flex-grow-1" onclick="editarPremio(${p.id})">Editar</button>
                                <button class="btn btn-sm btn-outline-danger flex-grow-1" onclick="eliminarPremio(${p.id})"><i class="fa fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    actualizarBotonesSegunPuntos();
}

window.abrirModalPremio = () => {
    document.getElementById('form-premio').reset();
    document.getElementById('premio-id-hidden').value = ''; 
    document.getElementById('modalPremioLabel').innerText = "Nuevo Premio";
    document.getElementById('btn-submit-premio').innerText = "Crear Premio";
    
    // Mostrar visualmente
    const modal = document.getElementById('modalPremio');
    modal.classList.add('show'); 
    modal.style.display = 'block';
};

window.editarPremio = async (id) => {
    try {
        const premios = await fetchData(`/api/club/admin/premios?negocio_id=${appState.negocioActivoId}`);
        const p = premios.find(x => x.id == id);
        
        if(p) {
            document.getElementById('premio-id-hidden').value = p.id;
            document.getElementById('premio-nombre').value = p.nombre;
            document.getElementById('premio-costo').value = p.costo_puntos;
            document.getElementById('premio-stock').value = p.stock;
            document.getElementById('premio-descripcion').value = p.descripcion || '';
            document.getElementById('premio-img-file').value = ''; 
            document.getElementById('premio-tipo').value = p.tipo_premio || 'producto'; 
            document.getElementById('nuevo-premio-fuego').checked = (p.es_fuego === 1 || p.es_fuego === true);
            
            document.getElementById('modalPremioLabel').innerText = "Editar Premio";
            document.getElementById('btn-submit-premio').innerText = "Guardar Cambios";
            

            const modal = document.getElementById('modalPremio');
            modal.classList.add('show'); 
            modal.style.display = 'block';
        }
    } catch(e) { 
        mostrarNotificacion("Error cargando premio", "error");
    }
};

window.cerrarModalManual = () => {
    const modal = document.getElementById('modalPremio');
    if(modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
};

window.eliminarPremio = async (id) => {
    if(!confirm("¿Estás seguro de que quieres borrar este premio permanentemente?")) return;

    try {
        await fetchData(`/api/club/admin/premios?id=${id}`, { method: 'DELETE' });
        mostrarNotificacion("Premio eliminado", "success");
        cargarPremios(appState.negocioActivoId);
    } catch(e) { 
        mostrarNotificacion(e.message, "error"); 
    }
};

// =========================================================
// 📷 ESCÁNER QR (ADMIN)
// =========================================================
window.abrirEscanerQR = () => {
    const modal = document.getElementById('modalEscanerQR');
    modal.style.display = 'block'; 

    setTimeout(() => {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader-admin");
        }
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            mostrarNotificacion("No se pudo iniciar la cámara", "error");
            window.cerrarEscanerQR();
        });
    }, 300);
};

window.cerrarEscanerQR = () => {
    document.getElementById('modalEscanerQR').style.display = 'none';
    if (html5QrCode) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => {});
    }
};

function onScanSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(200);
    window.cerrarEscanerQR();
    document.getElementById('filtro-dni-cliente').value = decodedText;
    buscarClientePuntos();
}

function onScanFailure(error) { /* Silencio */ }

// =========================================================
// 📜 HISTORIAL & DASHBOARD
// =========================================================
async function cargarDashboard() {
    // ... (Tu lógica de gráficos se mantiene IGUAL, solo quité los logs molestos) ...
    const ctxBalance = document.getElementById('chartBalance');
    const ctxTop = document.getElementById('chartTop');
    if (!ctxBalance || !ctxTop) return;
    if (typeof Chart === 'undefined') return;

    try {
        const url = `/api/club/admin/stats?negocio_id=${appState.negocioActivoId}`;
        const data = await fetchData(url);
        
        const otorgados = parseInt(data.balance.otorgados) || 0;
        const canjeados = parseInt(data.balance.canjeados) || 0;

        if (chartBalanceInstance) chartBalanceInstance.destroy();
        chartBalanceInstance = new Chart(ctxBalance, {
            type: 'doughnut',
            data: {
                labels: ['Puntos Entregados', 'Puntos Canjeados'],
                datasets: [{
                    data: [otorgados, canjeados],
                    backgroundColor: ['#ffc107', '#198754'],
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

        const labels = (data.top_premios && data.top_premios.labels) ? data.top_premios.labels : [];
        const valores = (data.top_premios && data.top_premios.data) ? data.top_premios.data : [];

        if (chartTopInstance) chartTopInstance.destroy();
        chartTopInstance = new Chart(ctxTop, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Canjes',
                    data: valores,
                    backgroundColor: '#0d6efd',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });

    } catch (error) { console.error("Error Dashboard:", error); }
}

window.actualizarHistorialActivo = () => {

    if (document.getElementById('tab-cargas').classList.contains('active')) cargarHistorialCargas();
    else if (document.getElementById('tab-canjes').classList.contains('active')) cargarHistorialCanjes();
    else cargarHistorialRespuestas();
};

window.cargarHistorialCanjes = async () => {
    const tbody = document.getElementById('tabla-historial-body');
    if(!tbody) return;
    const desde = document.getElementById('historial-desde').value;
    const hasta = document.getElementById('historial-hasta').value;
    
    let url = `/api/club/admin/historial?negocio_id=${appState.negocioActivoId}`;
    if(desde) url += `&desde=${desde}`;
    if(hasta) url += `&hasta=${hasta}`;

    try {
        const datos = await fetchData(url);
        tbody.innerHTML = '';
        if (datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin movimientos</td></tr>';
            return;
        }
        datos.forEach(d => {
            tbody.innerHTML += `
                <tr>
                    <td class="ps-4">${d.fecha}</td>
                    <td class="fw-bold">${d.cliente}</td>
                    <td>🎁 ${d.premio}</td>
                    <td class="small text-muted">${d.operador}</td>
                    <td class="text-center fw-bold text-danger pe-4">-${d.puntos}</td>
                </tr>`;
        });
    } catch(e) { console.error(e); }
};

window.cargarHistorialCargas = async () => {
    const tbody = document.getElementById('tabla-cargas-body');
    if(!tbody) return;
    try {
        const datos = await fetchData(`/api/club/admin/historial-cargas?negocio_id=${appState.negocioActivoId}`);
        tbody.innerHTML = '';
        if (datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin movimientos</td></tr>';
            return;
        }
        datos.forEach(d => {
            const op = d.nombre_operador || 'Sistema';
            tbody.innerHTML += `
                <tr>
                    <td class="ps-4">${d.fecha_fmt}</td>
                    <td class="fw-bold">${d.cliente_nombre}</td>
                    <td>${d.motivo}</td>
                    <td class="small text-muted">${op}</td>
                    <td class="text-center fw-bold text-success pe-4">+${d.monto}</td>
                </tr>`;
        });
    } catch(e) { console.error(e); }
};

// Utils & Canje
window.iniciarCanje = (pid, nombre, costo) => {
    document.getElementById('canje-premio-id').value = pid;
    document.getElementById('canje-nombre-premio').innerText = nombre;
    document.getElementById('canje-costo-premio').innerText = costo;
    const inputDni = document.getElementById('canje-dni-cliente');
    document.getElementById('canje-error-msg').classList.add('hidden');
    if (clienteActivo) inputDni.value = clienteActivo.dni;
    else inputDni.value = '';
    
    document.getElementById('modalCanje').style.display = 'flex';
};

window.cerrarModalCanje = () => {
    document.getElementById('modalCanje').style.display = 'none';
};

window.procesarCanje = async () => {
    const dni = document.getElementById('canje-dni-cliente').value.trim();
    const pid = document.getElementById('canje-premio-id').value;
    if(!dni) return mostrarNotificacion("Falta DNI", "warning");

    try {
        const res = await fetchData('/api/club/admin/canjear', {
            method: 'POST',
            body: JSON.stringify({
                negocio_id: appState.negocioActivoId,
                premio_id: pid,
                cliente_dni: dni
            })
        });
        mostrarNotificacion(res.message, "success");
        window.cerrarModalCanje();
        cargarPremios(appState.negocioActivoId);
    } catch(e) {
        mostrarNotificacion(e.message, "error");
    }
};

function actualizarBotonesSegunPuntos() {
    if (!clienteActivo) return;
    const puntos = clienteActivo.puntos_acumulados || 0;
    document.querySelectorAll('.card-premio').forEach(card => {
        const costo = parseInt(card.querySelector('.badge').innerText.replace(/\D/g, ''));
        const btn = card.querySelector('.btn-canjear');
        if (!btn) return;
        if (costo > puntos) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-lock"></i> Insuficiente';
        } else {
            btn.disabled = false;
            btn.innerHTML = '🎁 Canjear';
        }
    });
}

// Cierre global de modales
window.addEventListener('click', (event) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    });
});

async function cargarConfiguracion(nid) { /* Placeholder */ }
window.toggleEdicionReglas = () => { /* Placeholder */ };

// --- GESTIÓN DE ENCUESTAS ---

window.cargarEncuestas = async () => {
    const tbody = document.getElementById('tabla-encuestas-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        // Asumiendo que crearás este endpoint en el back
        const res = await fetchData(`/api/club/admin/encuestas?negocio_id=${appState.negocioActivoId}`);
        tbody.innerHTML = '';
        
        if(res.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay encuestas creadas</td></tr>';
            return;
        }

        res.forEach(e => {
            tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-dark">${e.titulo}</td>
                <td><span class="badge bg-success bg-opacity-10 text-success">💎 ${e.puntos_premio}</span></td>
                <td><span class="badge ${e.activo ? 'bg-info' : 'bg-secondary'}">${e.activo ? 'Activa' : 'Pausada'}</span></td>
                
                <!-- Columna del ojo centrada -->
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-primary p-0" onclick="verPreguntas(${e.id}, '${e.titulo}')" title="Ver Preguntas">
                        <i class="fa fa-eye fa-lg"></i>
                    </button>
                </td>                
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarEncuesta(${e.id})">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
    } catch(err) { 
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar</td></tr>';
    }
};

window.abrirModalEncuesta = () => {
    const modal = document.getElementById('modalEncuesta');
    document.getElementById('form-encuesta').reset();
    document.getElementById('encuesta-id').value = '';
    modal.style.display = 'flex';
};

window.cerrarModalEncuesta = () => {
    document.getElementById('modalEncuesta').style.display = 'none';
};

window.guardarEncuesta = async (event) => {
    event.preventDefault();
    const preguntas = Array.from(document.querySelectorAll('.pregunta-input'))
                           .map(i => i.value)
                           .filter(v => v.trim() !== "");

    const payload = {
        negocio_id: appState.negocioActivoId,
        titulo: document.getElementById('encuesta-titulo').value,
        puntos: document.getElementById('encuesta-puntos').value,
        fecha_expiracion: document.getElementById('encuesta-expiracion').value || null,
        preguntas: preguntas // <--- Enviamos la lista
    };

    try {
        await fetchData('/api/club/admin/encuestas', { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });
        mostrarNotificacion('Encuesta publicada con éxito', 'success');
        cerrarModalEncuesta();
        cargarEncuestas();
    } catch(err) {
        mostrarNotificacion(err.message, 'error');
    }
};

window.eliminarEncuesta = async (id) => {
    if(!confirm('¿Eliminar esta encuesta? Se perderán las estadísticas asociadas.')) return;
    try {
        await fetchData(`/api/club/admin/encuestas?id=${id}`, { method: 'DELETE' });
        mostrarNotificacion('Encuesta eliminada', 'success');
        cargarEncuestas();
    } catch(err) {
        mostrarNotificacion(err.message, 'error');
    }
};

window.cargarHistorialRespuestas = async () => {
    const tbody = document.getElementById('tabla-respuestas-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const datos = await fetchData(`/api/club/admin/respuestas-encuestas?negocio_id=${appState.negocioActivoId}`);
        tbody.innerHTML = '';
        if (datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin respuestas aún</td></tr>';
            return;
        }

        datos.forEach(d => {
            // Generar estrellitas según el rating
            let estrellas = '';
            for(let i=1; i<=5; i++) {
                estrellas += `<i class="fa fa-star ${i <= d.rating ? 'text-warning' : 'text-light'}"></i>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 small">${d.fecha_fmt}</td>
                    <td class="fw-bold">${d.encuesta_titulo}</td>
                    <td>${d.cliente_nombre} <br><small class="text-muted">DNI: ${d.cliente_dni}</small></td>
                    <td class="text-center pe-4">${estrellas}</td>
                </tr>`;
        });
    } catch(e) { console.error(e); }
};

window.agregarInputPregunta = () => {
    const cont = document.getElementById('contenedor-preguntas-dinamicas');
    const cantidad = cont.querySelectorAll('input').length;
    if (cantidad < 5) {
        const input = document.createElement('input');
        input.className = 'form-control form-control-sm mb-2 pregunta-input';
        input.placeholder = `Pregunta ${cantidad + 1}`;
        cont.appendChild(input);
    }
};

window.verPreguntas = async (id, titulo) => {
    const modal = document.getElementById('modalVerPreguntas');
    const lista = document.getElementById('lista-preguntas-encuesta');
    document.getElementById('titulo-encuesta-preguntas').innerText = titulo;
    
    lista.innerHTML = '<li class="list-group-item text-center">Cargando preguntas...</li>';
    modal.style.display = 'flex';

    try {
        const res = await fetchData(`/api/club/admin/encuesta/${id}/preguntas`);
        lista.innerHTML = '';
        
        if (res.length === 0) {
            lista.innerHTML = '<li class="list-group-item text-muted">Esta encuesta no tiene preguntas cargadas.</li>';
        } else {
            res.forEach((p, index) => {
                lista.innerHTML += `
                    <li class="list-group-item d-flex gap-3 align-items-start border-0 border-bottom">
                        <span class="badge bg-secondary rounded-pill">${index + 1}</span>
                        <span class="text-dark">${p.texto_pregunta}</span>
                    </li>`;
            });
        }
    } catch (err) {
        lista.innerHTML = `<li class="list-group-item text-danger">Error: ${err.message}</li>`;
    }
};

window.cerrarModalVerPreguntas = () => {
    document.getElementById('modalVerPreguntas').style.display = 'none';
};

