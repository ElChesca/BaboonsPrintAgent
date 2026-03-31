import { fetchData, sendData } from '../api.js';

// Variables de estado a nivel de módulo para evitar pérdida de referencia en reinicializaciones SPA
let clienteSeleccionado = null;
let metodoPagoActual = 'Efectivo';

export async function inicializarCobroCtaCte() {
    console.log("Inicializando módulo de Cobranza Cta Cte...");

    // Resetear estado al inicializar la vista
    clienteSeleccionado = null;
    metodoPagoActual = 'Efectivo';

    const negocioId = typeof appState !== 'undefined' ? appState.negocioActivoId : (getNegocioIdFromUrl() || 1);

    // Elementos UI
    const inputBuscar = document.getElementById('buscar-cliente');
    const listadoResultados = document.getElementById('resultados-busqueda');
    const infoCliente = document.getElementById('cliente-seleccionado-info');
    const msgSinCliente = document.getElementById('msg-sin-cliente');
    const panelCobro = document.getElementById('panel-cobro');
    const panelInstrucciones = document.getElementById('panel-instrucciones');

    if (!inputBuscar) return; // Salir si los elementos no están en el DOM

    const infoNombre = document.getElementById('info-cliente-nombre');
    const infoDireccion = document.getElementById('info-cliente-direccion');
    const infoDeuda = document.getElementById('info-cliente-deuda');

    const montoInput = document.getElementById('monto-cobro');
    const btnCobroTotal = document.getElementById('btn-cobro-total');
    const btnRegistrar = document.getElementById('btn-registrar-cobro');
    const observacionesInput = document.getElementById('observaciones');

    const metodosCards = document.querySelectorAll('.pago-metodo-card');
    const camposMixtos = document.getElementById('campos-mixtos');
    const inputsMixtos = document.querySelectorAll('.input-mixto');
    const sumaMixtaEl = document.getElementById('suma-mixta');

    // --- Búsqueda de Clientes ---
    inputBuscar.addEventListener('input', debounce(async function (e) {
        const query = e.target.value.trim();
        if (query.length < 2) {
            listadoResultados.classList.add('d-none');
            return;
        }

        try {
            const clientes = await fetchData(`/api/negocios/${negocioId}/ctacte/clientes`);
            const filtrados = clientes.filter(c =>
                c.nombre.toLowerCase().includes(query.toLowerCase()) ||
                (c.direccion && c.direccion.toLowerCase().includes(query.toLowerCase()))
            );

            renderResultados(filtrados);
        } catch (error) {
            console.error('Error buscando clientes:', error);
        }
    }, 300));

    function renderResultados(clientes) {
        listadoResultados.innerHTML = '';
        if (clientes.length === 0) {
            listadoResultados.innerHTML = '<div class="list-group-item text-muted">No se encontraron clientes con deuda</div>';
        } else {
            clientes.forEach(c => {
                const item = document.createElement('a');
                item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                item.innerHTML = `
                    <div>
                        <div class="fw-bold">${c.nombre}</div>
                        <div class="small text-muted">${c.direccion || 'Sin dirección'}</div>
                    </div>
                    <span class="badge bg-danger rounded-pill">$${c.saldo.toLocaleString()}</span>
                `;
                item.onclick = () => seleccionarCliente(c);
                listadoResultados.appendChild(item);
            });
        }
        listadoResultados.classList.remove('d-none');
    }

    function seleccionarCliente(cliente) {
        console.log("Cliente seleccionado:", cliente);
        clienteSeleccionado = cliente;
        inputBuscar.value = '';
        listadoResultados.classList.add('d-none');

        infoNombre.innerText = cliente.nombre;
        infoDireccion.innerText = cliente.direccion || 'Sin dirección';
        infoDeuda.innerText = `$${cliente.saldo.toLocaleString()}`;

        infoCliente.classList.remove('d-none');
        msgSinCliente.classList.add('d-none');
        panelCobro.classList.remove('d-none');
        panelInstrucciones.classList.add('d-none');

        montoInput.value = '';
        montoInput.focus();
    }

    const btnLimpiar = document.getElementById('btn-limpiar-cliente');
    if (btnLimpiar) {
        btnLimpiar.onclick = () => {
            clienteSeleccionado = null;
            infoCliente.classList.add('d-none');
            msgSinCliente.classList.remove('d-none');
            panelCobro.classList.add('d-none');
            panelInstrucciones.classList.remove('d-none');
        };
    }

    if (btnCobroTotal) {
        btnCobroTotal.onclick = () => {
            if (clienteSeleccionado) {
                montoInput.value = clienteSeleccionado.saldo;
                montoInput.dispatchEvent(new Event('input'));
            }
        };
    }

    // --- Lógica de Pago ---
    metodosCards.forEach(card => {
        card.onclick = () => {
            metodosCards.forEach(c => {
                c.classList.remove('active');
                c.querySelector('.check-icon').classList.add('d-none');
            });
            card.classList.add('active');
            card.querySelector('.check-icon').classList.remove('d-none');

            metodoPagoActual = card.dataset.metodo;

            if (metodoPagoActual === 'Mixto') {
                camposMixtos.classList.remove('d-none');
                autoCompletarMixto();
            } else {
                camposMixtos.classList.add('d-none');
            }
        };
    });

    if (montoInput) {
        montoInput.addEventListener('input', () => {
            if (metodoPagoActual === 'Mixto') {
                autoCompletarMixto();
            }
        });
    }

    function autoCompletarMixto() {
        const total = parseFloat(montoInput.value) || 0;
        inputsMixtos.forEach(input => input.value = '');
        if (inputsMixtos.length > 0) inputsMixtos[0].value = total;
        actualizarSumaMixta();
    }

    inputsMixtos.forEach(input => {
        input.addEventListener('input', actualizarSumaMixta);
    });

    function actualizarSumaMixta() {
        let suma = 0;
        inputsMixtos.forEach(input => {
            suma += parseFloat(input.value) || 0;
        });
        if (sumaMixtaEl) {
            sumaMixtaEl.innerText = `$${suma.toLocaleString()}`;
            const totalReq = parseFloat(montoInput.value) || 0;
            if (Math.abs(suma - totalReq) > 0.01) {
                sumaMixtaEl.className = 'small fw-bold text-danger';
            } else {
                sumaMixtaEl.className = 'small fw-bold text-success';
            }
        }
    }

    // --- Registro ---
    if (btnRegistrar) {
        btnRegistrar.onclick = async () => {
            console.log("Click en Registrar. Cliente actual:", clienteSeleccionado);
            if (!clienteSeleccionado) {
                Swal.fire('Error', 'Debe seleccionar un cliente', 'warning');
                return;
            }

            const monto = parseFloat(montoInput.value);
            if (isNaN(monto) || monto <= 0) {
                Swal.fire('Error', 'Ingrese un monto válido', 'warning');
                return;
            }

            if (monto > clienteSeleccionado.saldo + 0.01) {
                const confirm = await Swal.fire({
                    title: '¿Confirmar cobro mayor?',
                    text: `El monto ($${monto}) es mayor a la deuda ($${clienteSeleccionado.saldo}). ¿Desea continuar?`,
                    icon: 'question',
                    showCancelButton: true
                });
                if (!confirm.isConfirmed) return;
            }

            let payload = {
                cliente_id: clienteSeleccionado.id,
                monto_total: monto,
                metodo_pago: metodoPagoActual,
                observaciones: observacionesInput.value,
                montos_mixtos: {}
            };

            if (metodoPagoActual === 'Mixto') {
                let suma = 0;
                inputsMixtos.forEach(input => {
                    const val = parseFloat(input.value) || 0;
                    if (val > 0) {
                        payload.montos_mixtos[input.dataset.metodo] = val;
                        suma += val;
                    }
                });

                if (Math.abs(suma - monto) > 0.01) {
                    Swal.fire('Error', 'La suma de los métodos mixtos no coincide con el monto total', 'error');
                    return;
                }
            }

            btnRegistrar.disabled = true;
            btnRegistrar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';

            try {
                console.log("Enviando cobro al servidor...", payload);
                const res = await sendData(`/api/negocios/${negocioId}/ctacte/cobro`, payload);
                console.log("Respuesta del servidor:", res);

                if (res.error) throw new Error(res.error);

                const datosRecibo = {
                    cliente: clienteSeleccionado.nombre,
                    monto: monto,
                    metodo: metodoPagoActual,
                    saldo_anterior: clienteSeleccionado.saldo,
                    nuevo_saldo: res.nuevo_saldo ?? 0,
                    fecha: new Date().toLocaleString('es-AR'),
                    observaciones: observacionesInput.value
                };

                // ✨ Nueva UI de Éxito usando SweetAlert2 (más robusto en SPA)
                Swal.fire({
                    title: '¡Cobro Registrado!',
                    html: `
                        <div class="py-3">
                            <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                            <h2 class="fw-bold mb-2">$${monto.toLocaleString('es-AR')}</h2>
                            <p class="text-muted">El pago se ha procesado con éxito.</p>
                            
                            <div class="mt-4 p-3 bg-light rounded-3">
                                <p class="small text-muted mb-3 fw-bold">COMPROBANTE</p>
                                <div class="d-grid gap-2">
                                    <button id="swal-btn-pdf" class="btn btn-outline-primary py-2">
                                        <i class="fas fa-file-pdf me-2"></i>Descargar Recibo PDF
                                    </button>
                                    <button id="swal-btn-wa" class="btn btn-outline-success py-2">
                                        <i class="fab fa-whatsapp me-2"></i>Enviar por WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    `,
                    showConfirmButton: true,
                    confirmButtonText: 'Finalizar y Limpiar',
                    allowOutsideClick: false,
                    didOpen: () => {
                        const btnPdf = document.getElementById('swal-btn-pdf');
                        const btnWa = document.getElementById('swal-btn-wa');
                        if (btnPdf) btnPdf.onclick = () => generarReciboPDF(datosRecibo);
                        if (btnWa) btnWa.onclick = () => compartirWhatsApp(datosRecibo);
                    }
                }).then(() => {
                    // En lugar de reload completo, podemos simplemente resetear la vista si es un SPA
                    // Pero reload es más seguro para asegurar limpieza de estado.
                    location.reload();
                });

            } catch (error) {
                console.error('Error al registrar cobro:', error);
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Error', error.message || 'Error al procesar el pago', 'error');
                } else {
                    alert('Error: ' + (error.message || 'Error al procesar el pago'));
                }
            } finally {
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Cobro';
                console.log("Proceso de registro finalizado.");
            }
        };
    }

    function generarReciboPDF(datos) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            unit: 'mm',
            format: [80, 150] // Formato ticket (80mm ancho)
        });

        // Diseño del Recibo (Simplificado y Elegante)
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("RECIBO DE PAGO", 40, 15, { align: 'center' });

        doc.setDrawColor(200, 200, 200);
        doc.line(5, 20, 75, 20);

        doc.setFontSize(10);
        doc.text(`Fecha: ${datos.fecha}`, 5, 28);
        doc.text(`Cliente: ${datos.cliente}`, 5, 34);

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`MONTO: $${datos.monto.toLocaleString('es-AR')}`, 5, 45);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Método: ${datos.metodo}`, 5, 52);

        if (datos.observaciones) {
            doc.text(`Obs: ${datos.observaciones}`, 5, 58, { maxWidth: 70 });
        }

        doc.line(5, 75, 75, 75);

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`SALDO ACTUAL: $${datos.nuevo_saldo.toLocaleString('es-AR')}`, 5, 85);

        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.text("¡Muchas gracias por su pago!", 40, 100, { align: 'center' });

        doc.save(`Recibo_${datos.cliente.replace(/\s/g, '_')}.pdf`);
    }

    function compartirWhatsApp(datos) {
        const mensaje =
            `*COMPROBANTE DE PAGO*\n\n` +
            `Hola *${datos.cliente}*,\n` +
            `Hemos registrado tu pago de *$${datos.monto.toLocaleString('es-AR')}*.\n\n` +
            `*Detalles:*\n` +
            `📅 Fecha: ${datos.fecha}\n` +
            `💳 Método: ${datos.metodo}\n` +
            `📉 *Saldo Actual: $${datos.nuevo_saldo.toLocaleString('es-AR')}*\n\n` +
            `¡Muchas gracias!`;

        const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }

    // Helper: Debounce para búsqueda
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Helper: Obtener Negocio ID de la URL
    function getNegocioIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }
}
