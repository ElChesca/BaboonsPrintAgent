import { fetchData, sendData } from '../api.js';

// Variables de estado persistentes en el módulo
let clienteSeleccionado = null;
let metodoPagoActual = 'Efectivo';

/**
 * Inicialización principal del módulo de Cuenta Corriente
 */
export async function inicializarCobroCtaCte() {
    console.log("🚀 [CtaCte] Inicializando lógica Premium...");

    const appStateRef = (typeof window.appState !== 'undefined') ? window.appState : null;
    const getActualNegocioId = () => appStateRef?.negocioActivoId || getNegocioIdFromUrl() || 1;

    // --- Elementos de la UI ---
    const UI = {
        inputBuscar: document.getElementById('buscar-cliente'),
        listadoResultados: document.getElementById('resultados-busqueda'),
        infoCliente: document.getElementById('cliente-seleccionado-info'),
        msgSinCliente: document.getElementById('msg-sin-cliente'),
        panelCobro: document.getElementById('panel-cobro'),
        panelInstrucciones: document.getElementById('panel-instrucciones'),
        
        infoNombre: document.getElementById('info-cliente-nombre'),
        infoDireccion: document.getElementById('info-cliente-direccion'),
        infoDeuda: document.getElementById('info-cliente-deuda'),
        
        montoInput: document.getElementById('monto-cobro'),
        btnCobroTotal: document.getElementById('btn-cobro-total'),
        btnRegistrar: document.getElementById('btn-registrar-cobro'),
        observaciones: document.getElementById('observaciones'),
        
        metodosCards: document.querySelectorAll('.pago-metodo-card'),
        camposMixtos: document.getElementById('campos-mixtos'),
        inputsMixtos: document.querySelectorAll('.input-mixto'),
        sumaMixtaEl: document.getElementById('suma-mixta')
    };

    if (!UI.inputBuscar) {
        console.warn("⚠️ [CtaCte] No se encontró el input de búsqueda. ¿DOM listo?");
        return;
    }

    // --- Lógica de Búsqueda de Clientes ---
    UI.inputBuscar.addEventListener('input', debounce(async function (e) {
        const query = e.target.value.trim();
        if (query.length < 2) {
            UI.listadoResultados.classList.add('d-none');
            return;
        }

        try {
            const actualId = getActualNegocioId();
            console.log(`🔍 [CtaCte] Buscando clientes para negocio ${actualId}...`);
            const clientes = await fetchData(`/api/negocios/${actualId}/ctacte/clientes`);
            
            const filtrados = (clientes || []).filter(c =>
                c.nombre.toLowerCase().includes(query.toLowerCase()) ||
                (c.direccion && c.direccion.toLowerCase().includes(query.toLowerCase()))
            );

            renderResultados(filtrados);
        } catch (error) {
            console.error('❌ [CtaCte] Error buscando clientes:', error);
            // Si el error es 404, informar al usuario que no hay clientes con saldo o la ruta falló
            if (error.message.includes('404')) {
                UI.listadoResultados.innerHTML = '<div class="list-group-item text-danger small">No se encontró el endpoint de búsqueda. Contacte soporte.</div>';
                UI.listadoResultados.classList.remove('d-none');
            }
        }
    }, 400));

    function renderResultados(clientes) {
        UI.listadoResultados.innerHTML = '';
        if (clientes.length === 0) {
            UI.listadoResultados.innerHTML = '<div class="list-group-item text-muted p-3">No hay clientes con deuda que coincidan</div>';
        } else {
            clientes.forEach(c => {
                const item = document.createElement('a');
                item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border-0 border-bottom';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div>
                        <div class="fw-bold text-slate-700">${c.nombre}</div>
                        <div class="small text-muted"><i class="fas fa-map-marker-alt me-1"></i>${c.direccion || 'Sin dirección'}</div>
                    </div>
                    <span class="badge rounded-pill bg-danger-light text-danger fw-bold">$${parseFloat(c.saldo).toLocaleString('es-AR')}</span>
                `;
                item.onclick = () => seleccionarCliente(c);
                UI.listadoResultados.appendChild(item);
            });
        }
        UI.listadoResultados.classList.remove('d-none');
    }

    function seleccionarCliente(cliente) {
        console.log("👤 [CtaCte] Seleccionando:", cliente);
        clienteSeleccionado = cliente;
        UI.inputBuscar.value = '';
        UI.listadoResultados.classList.add('d-none');

        if (UI.infoNombre) UI.infoNombre.innerText = cliente.nombre;
        if (UI.infoDireccion) UI.infoDireccion.innerText = cliente.direccion || 'Sin dirección registrada';
        if (UI.infoDeuda) UI.infoDeuda.innerText = `$${parseFloat(cliente.saldo).toLocaleString('es-AR')}`;

        UI.infoCliente.classList.remove('d-none');
        UI.msgSinCliente.classList.add('d-none');
        UI.panelCobro.classList.remove('d-none');
        UI.panelInstrucciones.classList.add('d-none');

        if (UI.montoInput) {
            UI.montoInput.value = '';
            UI.montoInput.focus();
        }
    }

    const btnLib = document.getElementById('btn-limpiar-cliente');
    if (btnLib) {
        btnLib.onclick = () => {
            clienteSeleccionado = null;
            UI.infoCliente.classList.add('d-none');
            UI.msgSinCliente.classList.remove('d-none');
            UI.panelCobro.classList.add('d-none');
            UI.panelInstrucciones.classList.remove('d-none');
        };
    }

    if (UI.btnCobroTotal) {
        UI.btnCobroTotal.onclick = () => {
            if (clienteSeleccionado) {
                UI.montoInput.value = parseFloat(clienteSeleccionado.saldo).toFixed(2);
                UI.montoInput.dispatchEvent(new Event('input'));
            }
        };
    }

    // --- Lógica de Métodos de Pago ---
    UI.metodosCards.forEach(card => {
        card.addEventListener('click', () => {
            UI.metodosCards.forEach(c => {
                c.classList.remove('active');
                c.querySelector('.check-icon')?.classList.add('d-none');
            });
            card.classList.add('active');
            card.querySelector('.check-icon')?.classList.remove('d-none');

            metodoPagoActual = card.dataset.metodo;

            if (metodoPagoActual === 'Mixto') {
                UI.camposMixtos.classList.remove('d-none');
                autoCompletarMixto();
            } else {
                UI.camposMixtos.classList.add('d-none');
            }
        });
    });

    if (UI.montoInput) {
        UI.montoInput.addEventListener('input', () => {
            if (metodoPagoActual === 'Mixto') autoCompletarMixto();
        });
    }

    function autoCompletarMixto() {
        const total = parseFloat(UI.montoInput.value) || 0;
        UI.inputsMixtos.forEach(input => input.value = '');
        if (UI.inputsMixtos.length > 0) UI.inputsMixtos[0].value = total.toFixed(2);
        actualizarSumaMixta();
    }

    UI.inputsMixtos.forEach(input => {
        input.addEventListener('input', actualizarSumaMixta);
    });

    function actualizarSumaMixta() {
        let suma = 0;
        UI.inputsMixtos.forEach(input => {
            suma += parseFloat(input.value) || 0;
        });
        if (UI.sumaMixtaEl) {
            UI.sumaMixtaEl.innerText = `$${suma.toLocaleString('es-AR')}`;
            const totalReq = parseFloat(UI.montoInput.value) || 0;
            UI.sumaMixtaEl.className = (Math.abs(suma - totalReq) > 0.1) ? 'h6 mb-0 fw-bold text-danger' : 'h6 mb-0 fw-bold text-success';
        }
    }

    // --- Registro Final ---
    if (UI.btnRegistrar) {
        UI.btnRegistrar.onclick = async () => {
            if (!clienteSeleccionado) {
                Swal.fire({ icon: 'warning', title: 'Atención', text: 'Seleccione un cliente primero' });
                return;
            }

            const monto = parseFloat(UI.montoInput.value);
            if (!monto || monto <= 0) {
                Swal.fire({ icon: 'warning', title: 'Atención', text: 'Ingrese un monto válido' });
                return;
            }

            let payload = {
                cliente_id: clienteSeleccionado.id,
                monto_total: monto,
                metodo_pago: metodoPagoActual,
                observaciones: UI.observaciones.value,
                montos_mixtos: {}
            };

            if (metodoPagoActual === 'Mixto') {
                let sumaMixta = 0;
                UI.inputsMixtos.forEach(input => {
                    const val = parseFloat(input.value) || 0;
                    if (val > 0) {
                        payload.montos_mixtos[input.dataset.metodo] = val;
                        sumaMixta += val;
                    }
                });
                if (Math.abs(sumaMixta - monto) > 0.1) {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'La suma del desglose no coincide con el total' });
                    return;
                }
            }

            UI.btnRegistrar.disabled = true;
            UI.btnRegistrar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Registrando...';

            try {
                const actualId = getActualNegocioId();
                const res = await sendData(`/api/negocios/${actualId}/ctacte/cobro`, payload, 'POST');
                
                if (res.error) throw new Error(res.error);

                await Swal.fire({
                    icon: 'success',
                    title: '¡Cobro Exitoso!',
                    text: `Se registraron $${monto.toLocaleString('es-AR')} a la cuenta de ${clienteSeleccionado.nombre}`,
                    confirmButtonText: 'Genial',
                    background: '#ffffff',
                    borderRadius: '20px'
                });

                location.reload(); // Recargar para limpiar todo

            } catch (error) {
                console.error("❌ Error registrando cobro:", error);
                Swal.fire({ icon: 'error', title: 'Error de Servidor', text: error.message });
            } finally {
                UI.btnRegistrar.disabled = false;
                UI.btnRegistrar.innerHTML = '<i class="fas fa-check-circle me-2"></i>REGISTRAR COBRO';
            }
        };
    }
}

// Helpers
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function getNegocioIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('negocio_id');
}
