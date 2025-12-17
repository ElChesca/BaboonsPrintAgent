import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js'; 

let clienteActivo = null;
let html5QrCode = null;
let cargandoPuntos = false;

// =========================================================
// 🚀 INICIALIZACIÓN
// =========================================================
export function inicializarLogicaGestionClub() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) {
        mostrarNotificacion("Selecciona un negocio primero", "warning");
        return;
    }

    // Cargas iniciales
    cargarConfiguracion(negocioId);
    cargarPremios(negocioId);
    cargarNiveles(); // <--- Faltaba cargar la grilla de niveles
    actualizarHistorialActivo();

    // Listener para formulario de Premios
    const formPremio = document.getElementById('form-premio');
    if (formPremio) {
        const newFormP = formPremio.cloneNode(true);
        formPremio.parentNode.replaceChild(newFormP, formPremio);
        newFormP.addEventListener('submit', (e) => guardarPremio(e, negocioId));
    }
}

// =========================================================
// 📷 ESCÁNER QR (ADMIN) - FIX ID "reader-admin"
// =========================================================
window.abrirEscanerQR = () => {
    const modal = document.getElementById('modalEscanerQR');
    modal.style.display = 'block'; // Manual Open

    setTimeout(() => {
        // CORRECCIÓN: Usamos 'reader-admin' para no chocar con la Terminal
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader-admin");
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.error("Error cámara:", err);
            mostrarNotificacion("No se pudo iniciar la cámara.", "error");
            window.cerrarEscanerQR();
        });
    }, 300);
};

window.cerrarEscanerQR = () => {
    document.getElementById('modalEscanerQR').style.display = 'none';
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(err => console.warn("Cámara ya detenida", err));
    }
};

function onScanSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(200);
    window.cerrarEscanerQR();
    document.getElementById('filtro-dni-cliente').value = decodedText;
    buscarClientePuntos();
    mostrarNotificacion("¡Cliente detectado!", "success");
}

function onScanFailure(error) { /* Silencio */ }

// =========================================================
// 🔍 CLIENTES Y CARGA
// =========================================================
window.buscarClientePuntos = async () => {
    const dni = document.getElementById('filtro-dni-cliente').value;
    if(!dni) return mostrarNotificacion("Ingrese un DNI", "warning");

    const token = localStorage.getItem('jwt_token');
    const negocioId = appState.negocioActivoId;

    try {
        const res = await fetch(`/api/club/admin/cliente/${dni}?negocio_id=${negocioId}`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if(!res.ok) throw new Error("Cliente no encontrado");
        const data = await res.json();
        
        clienteActivo = data; 
        
        document.getElementById('info-cliente-panel').classList.remove('d-none');
        document.getElementById('nombre-cliente-display').innerText = `${data.nombre}`;
        document.getElementById('puntos-cliente-display').innerText = data.puntos_acumulados || 0;
        
        // Mostrar botón X
        const btnLimpiar = document.getElementById('btn-limpiar-filtro');
        if(btnLimpiar) btnLimpiar.style.display = 'block';
        
        actualizarBotonesSegunPuntos();
        mostrarNotificacion(`Cliente: ${data.nombre}`, "success");

    } catch (e) {
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

// =========================================================
// 🏆 NIVELES (LÓGICA MANUAL - NO BOOTSTRAP JS)
// =========================================================
window.cargarNiveles = async () => {
    const tbody = document.getElementById('tabla-niveles-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const res = await fetchData(`/api/club/admin/niveles?negocio_id=${appState.negocioActivoId}`);
        tbody.innerHTML = '';
        
        if(res.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin niveles</td></tr>';
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
    modal.style.display = 'flex'; // Manual Open
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
        mostrarNotificacion('Nivel guardado', 'success');
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
    // Usamos confirm nativo (si quieres modal bonito, avísame, pero este es rápido)
    if(!confirm('¿Estás seguro de borrar este nivel?')) return;
    
    try {
        await fetchData(`/api/club/admin/niveles?id=${id}`, { method: 'DELETE' });
        
        // ¡ESTO FALTABA! 👇
        mostrarNotificacion('Nivel eliminado con éxito', 'success');
        
        cargarNiveles();
    } catch(e) { 
        mostrarNotificacion("No se pudo eliminar: " + e.message, "error"); 
    }
};

// =========================================================
// 🎁 PREMIOS (LÓGICA MANUAL)
// =========================================================


/* window.cerrarModalManual = () => {
    const modal = document.getElementById('modalPremio');
    if(modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}; */

// --- GUARDAR PREMIO (Versión Manual / A prueba de balas) ---
async function guardarPremio(e, negocioId) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-premio');
    const txtOriginal = btn.innerText;
    
    // Validar HTML5 básico (required, min, etc)
    if (!document.getElementById('form-premio').checkValidity()) {
        document.getElementById('form-premio').reportValidity();
        return;
    }

    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        // 1. Construimos el FormData MANUALMENTE (Como lo tenías vos antes)
        const formData = new FormData();
        formData.append('negocio_id', negocioId);
        
        // IDs explícitos (No dependemos del atributo 'name')
        formData.append('nombre', document.getElementById('premio-nombre').value);
        formData.append('costo_puntos', document.getElementById('premio-costo').value);
        formData.append('stock', document.getElementById('premio-stock').value);
        formData.append('descripcion', document.getElementById('premio-descripcion').value);

        // ID del premio (Solo si es edición)
        const id = document.getElementById('premio-id-hidden').value;
        if(id) formData.append('id', id);

        // Archivo (Solo si seleccionó algo)
        const fileInput = document.getElementById('premio-img-file');
        if (fileInput.files.length > 0) {
            formData.append('imagen', fileInput.files[0]);
        }

        // 2. Fetch directo (Sin fetchData para evitar headers JSON automáticos)
        const token = localStorage.getItem('jwt_token');
        const res = await fetch('/api/club/admin/premios', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }, // NO Content-Type (FormData lo pone solo)
            body: formData
        });
        
        // 3. Manejo de error del servidor (HTML vs JSON)
        const text = await res.text();
        let result;
        try {
            result = JSON.parse(text); // Intentamos leer JSON
        } catch (err) {
            throw new Error(`Error del Servidor (500): Posiblemente falta una columna en la BD o dato inválido.`);
        }

        if (!res.ok) throw new Error(result.error || "Error al guardar");
        
        // 4. Éxito
        mostrarNotificacion(id ? "Premio actualizado correctamente" : "Premio creado correctamente", "success");
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
        cont.innerHTML = '<div class="alert alert-danger">Error premios</div>';
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
                                <button class="btn btn-sm btn-outline-danger flex-grow-1" onclick="confirmarEliminarPremio(${p.id})"><i class="fa fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    actualizarBotonesSegunPuntos();
}

/* window.editarPremio = async (id) => {
    try {
        const premios = await fetchData(`/api/club/admin/premios?negocio_id=${appState.negocioActivoId}`);
        const p = premios.find(x => x.id == id);
        if(p) {
            document.getElementById('premio-id-hidden').value = p.id;
            document.getElementById('premio-nombre').value = p.nombre;
            document.getElementById('premio-costo').value = p.costo_puntos;
            document.getElementById('premio-stock').value = p.stock;
            document.getElementById('premio-descripcion').value = p.descripcion || '';
            document.getElementById('modalPremioLabel').innerText = "Editar Premio";
            window.abrirModalPremio();
        }
    } catch(e) { console.error(e); }
};

 */

// --- GESTIÓN DE PREMIOS (CORREGIDO) ---

// 1. Función interna solo para mostrar el modal (sin borrar nada)
function mostrarModalPremioVisualmente() {
    const modal = document.getElementById('modalPremio');
    modal.classList.add('show'); 
    modal.style.display = 'block';
}

// 2. Función para BOTÓN "NUEVO PREMIO" (Borra y abre)
window.abrirModalPremio = () => {
    document.getElementById('form-premio').reset();
    document.getElementById('premio-id-hidden').value = ''; 
    document.getElementById('modalPremioLabel').innerText = "Nuevo Premio";
    document.getElementById('btn-submit-premio').innerText = "Crear Premio";
    
    mostrarModalPremioVisualmente(); // Solo abre
};

// 3. Función para BOTÓN "EDITAR" (Carga datos y abre)
window.editarPremio = async (id) => {
    try {
        // Buscamos el premio en la API (o en memoria si prefieres, pero esto asegura datos frescos)
        const premios = await fetchData(`/api/club/admin/premios?negocio_id=${appState.negocioActivoId}`);
        const p = premios.find(x => x.id == id);
        
        if(p) {
            // Llenamos campos
            document.getElementById('premio-id-hidden').value = p.id;
            document.getElementById('premio-nombre').value = p.nombre;
            document.getElementById('premio-costo').value = p.costo_puntos;
            document.getElementById('premio-stock').value = p.stock;
            document.getElementById('premio-descripcion').value = p.descripcion || '';
            
            // Limpiamos el input de archivo (no se puede setear valor a file input por seguridad)
            document.getElementById('premio-img-file').value = ''; 
            
            // Cambiamos textos
            document.getElementById('modalPremioLabel').innerText = "Editar Premio";
            document.getElementById('btn-submit-premio').innerText = "Guardar Cambios";

            // ABRIMOS SIN RESETEAR
            mostrarModalPremioVisualmente();
        }
    } catch(e) { 
        console.error(e);
        mostrarNotificacion("Error al cargar datos del premio", "error");
    }
};

// 4. Cerrar
window.cerrarModalManual = () => {
    const modal = document.getElementById('modalPremio');
    if(modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
};

window.eliminarPremio = async (id) => {
    // 1. Confirmación
    if(!confirm("¿Estás seguro de que quieres borrar este premio permanentemente?")) return;

    try {
        // 2. Llamada a la API
        await fetchData(`/api/club/admin/premios?id=${id}`, { method: 'DELETE' });
        
        // 3. Notificación y recarga
        mostrarNotificacion("Premio eliminado correctamente", "success");
        cargarPremios(appState.negocioActivoId);

    } catch(e) { 
        console.error(e);
        mostrarNotificacion("Error al borrar el premio", "error"); 
    }
};



// =========================================================
// 📜 HISTORIAL
// =========================================================
window.actualizarHistorialActivo = () => {
    const tabCargas = document.getElementById('tab-cargas');
    if (tabCargas && tabCargas.classList.contains('active')) cargarHistorialCargas();
    else cargarHistorialCanjes();
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
    
    // Manual Open
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

// Cierre global de modales al hacer clic afuera
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