// app/static/js/modules/ingresos.js
import { fetchData, sendData } from '../api.js'; // Asegúrate que sendData esté exportado y funcione
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { BaboonAIScanner } from './ia_scanner.js';

let stagedIncomeItems = []; 
let productosCache = [];
let selectedOCId = null; // Para vincular con OC al registrar

// Helper para formatear moneda
const formatCurrency = (value) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return '$ 0,00'; 
    }
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

// Helper para calcular neto de un item
function calcularNetoItem(cantidad, costoBruto, dto1, dto2) {
    const qty = parseFloat(cantidad) || 0;
    const bruto = parseFloat(costoBruto) || 0;
    const d1 = parseFloat(dto1) || 0;
    const d2 = parseFloat(dto2) || 0;
    
    // Aplicar descuentos en cascada
    let neto = bruto * (1 - (d1 / 100));
    neto = neto * (1 - (d2 / 100));
    
    return neto * qty;
}

async function poblarSelectores() {
    try {
        const [proveedores, productos] = await Promise.all([
            fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`),
            fetchData(`/api/negocios/${appState.negocioActivoId}/productos?simple=true`) // Pedir versión simple si la API lo soporta
        ]);
        
        productosCache = productos;
        const selProv = document.getElementById('ingreso-proveedor-selector');
        
        if (!selProv) {
             console.error("Selector de proveedor no encontrado.");
             return;
        }

        selProv.innerHTML = '<option value="">Seleccione un proveedor...</option>';
        proveedores.forEach(p => selProv.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
        
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar proveedores o productos.', 'error');
        console.error("Error poblando selectores:", error);
    }
}

function renderStagedIncomeItems() {
    const tbody = document.querySelector('#staged-items-ingreso tbody');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    if (stagedIncomeItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">Añada productos para comenzar.</td></tr>';
        actualizarTotalesGlobales();
        return;
    }

    stagedIncomeItems.forEach((item, index) => {
        const neto = calcularNetoItem(item.cantidad, item.precio_costo, item.descuento_1, item.descuento_2);
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input check-recibido" data-index="${index}" ${item.recibido ? 'checked' : ''}>
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="fw-bold">${item.nombre}</div>
                    ${item.no_vinculado ? 
                        '<span class="badge rounded-pill bg-info-subtle text-info border border-info-subtle" style="font-size: 0.65rem;">NUEVO</span>' : 
                        '<span class="text-success" title="Producto vinculado"><i class="fas fa-check-circle"></i></span>'
                    }
                </div>
                <div class="text-muted small">IVA: ${item.iva_porcentaje}%</div>
            </td>
            <td class="text-end">
                <input type="number" class="form-control form-control-sm edit-cantidad text-end" data-index="${index}" value="${item.cantidad}" style="width: 80px; display: inline-block;">
            </td>
            <td class="text-end">
                <input type="number" class="form-control form-control-sm edit-costo text-end" data-index="${index}" value="${item.precio_costo || ''}" style="width: 100px; display: inline-block;">
            </td>
            <td class="text-center small">
                <div class="d-flex gap-1 justify-content-center">
                    <input type="number" class="form-control form-control-sm edit-dto1" data-index="${index}" value="${item.descuento_1}" style="width: 50px;" title="Dto 1">
                    <input type="number" class="form-control form-control-sm edit-dto2" data-index="${index}" value="${item.descuento_2}" style="width: 50px;" title="Dto 2">
                </div>
            </td>
            <td class="text-end small opacity-75">
                ${item.iva_porcentaje}%
            </td>
            <td class="text-end fw-bold">
                ${formatCurrency(neto)}
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-link text-danger p-0 btn-quitar" data-index="${index}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    actualizarTotalesGlobales();
}

function actualizarTotalesGlobales() {
    let netoGravado = 0;
    let totalsByIVA = { "27": 0, "21": 0, "10.5": 0, "2.5": 0 };
    let descuentosTotales = 0;

    const facturaTipo = document.getElementById('ingreso-factura-tipo')?.value || '01';

    stagedIncomeItems.forEach(item => {
        if (!item.recibido) return;
        
        // Si es bonificado, no suma al neto gravado
        if (item.bonificado) return;

        const subtotalBruto = (item.precio_costo || 0) * item.cantidad;
        const netoItem = calcularNetoItem(item.cantidad, item.precio_costo, item.descuento_1, item.descuento_2);
        
        netoGravado += netoItem;
        descuentosTotales += (subtotalBruto - netoItem);
        
        // Calcular IVA proporcional
        const ivaP = parseFloat(item.iva_porcentaje) || 0;
        const ivaMonto = netoItem * (ivaP / 100);
        
        // No sumar IVA si el comprobante es 99
        if (facturaTipo !== '99') {
            const key = ivaP.toString();
            if (totalsByIVA.hasOwnProperty(key)) {
                totalsByIVA[key] += ivaMonto;
            }
        }
    });

    // Actualizar UI
    document.getElementById('total-neto-gravado').innerText = formatCurrency(netoGravado);
    document.getElementById('total-descuentos').innerText = formatCurrency(descuentosTotales);
    
    // Auto-completar campos de IVA si no tienen el foco
    const ivaFields = {
        "27": document.getElementById('tax-iva-27'),
        "21": document.getElementById('tax-iva-21'),
        "10.5": document.getElementById('tax-iva-105'),
        "2.5": document.getElementById('tax-iva-25')
    };

    for (const [rate, input] of Object.entries(ivaFields)) {
        if (input && !input.matches(':focus')) {
            // Si el tipo es 99, forzar 0
            input.value = (facturaTipo === '99') ? "0" : totalsByIVA[rate].toFixed(2);
        }
    }

    recalcularTotalFactura();
}

function recalcularTotalFactura() {
    const netoText = document.getElementById('total-neto-gravado').innerText;
    const neto = parseFloat(netoText.replace(/[^0-9,-]+/g,"").replace(",", ".")) || 0;
    
    const iva27 = parseFloat(document.getElementById('tax-iva-27')?.value) || 0;
    const iva21 = parseFloat(document.getElementById('tax-iva-21')?.value) || 0;
    const iva105 = parseFloat(document.getElementById('tax-iva-105')?.value) || 0;
    const iva25 = parseFloat(document.getElementById('tax-iva-25')?.value) || 0;
    
    const iibb = parseFloat(document.getElementById('tax-iibb')?.value) || 0;
    const piva = parseFloat(document.getElementById('tax-percep-iva')?.value) || 0;
    const exento = parseFloat(document.getElementById('tax-exento')?.value) || 0;
    const noGravado = parseFloat(document.getElementById('tax-no-gravado')?.value) || 0;

    const total = neto + iva27 + iva21 + iva105 + iva25 + iibb + piva + exento + noGravado;
    
    const display = document.getElementById('total-comprobante-display');
    if (display) display.innerText = formatCurrency(total);
}

// --- Función para mostrar las alertas de precios ---
function mostrarAlertasDePrecios(alertas) {
     const alertasContainer = document.getElementById('alertas-precios-container');
     const listaAlertas = document.getElementById('lista-alertas-precios');

     if (!alertasContainer || !listaAlertas || !alertas || alertas.length === 0) {
         // Si no hay contenedor o no hay alertas, nos aseguramos que esté oculto
         if(alertasContainer) alertasContainer.classList.add('hidden');
         return; 
     }

     listaAlertas.innerHTML = ''; // Limpiamos alertas previas
     alertas.forEach(alerta => {
         const variacionClass = alerta.variacion > 0 ? 'text-danger' : 'text-success'; // Rojo si sube, verde si baja (o usa tus propias clases)
         const icono = alerta.variacion > 0 ? '🔺' : '🔻';
         listaAlertas.innerHTML += `
            <li>
                <strong>${alerta.producto}:</strong> Costo ${icono} ${Math.abs(alerta.variacion)}% 
                (Antes: ${formatCurrency(alerta.anterior)}, Ahora: ${formatCurrency(alerta.nuevo)})
            </li>
         `;
     });
     alertasContainer.classList.remove('hidden'); // Mostramos el contenedor
}


export function inicializarLogicaIngresos() {
    stagedIncomeItems = []; // Resetear al inicializar
    const formAddItem = document.getElementById('form-add-item-ingreso');
    const formFinalize = document.getElementById('form-finalize-ingreso');
    const tablaItemsBody = document.querySelector('#staged-items-ingreso tbody'); // Mover selector aquí

    if (!formAddItem || !formFinalize || !tablaItemsBody) {
        console.error("Faltan elementos HTML esenciales para el módulo de Ingresos.");
        return; // Salir si falta algo
    }

    poblarSelectores();
    renderStagedIncomeItems(); // Render inicial

    // Listener para añadir ítem
    formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const productoId = document.getElementById('ingreso-producto-id-hidden').value;
        const cantidadInput = document.getElementById('ingreso-item-cantidad');
        const costoInput = document.getElementById('ingreso-item-costo');
        const dto1Input = document.getElementById('ingreso-item-dto1');
        const dto2Input = document.getElementById('ingreso-item-dto2');
        const ivaInput = document.getElementById('ingreso-item-iva');
        const bonificadoCheck = document.getElementById('ingreso-item-bonificado');
        
        const cantidad = parseFloat(cantidadInput.value);
        const precio_costo = parseFloat(costoInput.value) || 0;
        const dto1 = parseFloat(dto1Input.value) || 0;
        const dto2 = parseFloat(dto2Input.value) || 0;
        const ivaP = parseFloat(ivaInput.value) || 0;
        const isBonificado = bonificadoCheck && bonificadoCheck.checked;

        if (!productoId || !cantidad || cantidad <= 0) {
            return mostrarNotificacion('Seleccione un producto y cantidad válida.', 'warning');
        }
        
        const productoSel = productosCache.find(p => p.id == productoId);
        if (!productoSel) return;

        stagedIncomeItems.push({
            producto_id: productoId,
            nombre: productoSel.nombre,
            cantidad: cantidad,
            precio_costo: precio_costo,
            descuento_1: dto1,
            descuento_2: dto2,
            iva_porcentaje: isBonificado ? 0 : ivaP,
            bonificado: isBonificado,
            recibido: true
        });
        
        renderStagedIncomeItems();
        formAddItem.reset();
        limpiarSeleccionProducto();
    });

    // --- LÓGICA MODAL BÚSQUEDA PRODUCTO ---
    const btnAbrirBusqueda = document.getElementById('btn-abrir-busqueda-producto');
    const displayProducto = document.getElementById('ingreso-producto-nombre-display');
    const overlayBusqueda = document.getElementById('overlay-buscar-producto');
    const btnCerrarBusqueda = document.getElementById('btn-cerrar-modal-busqueda-prod');
    const inputBusquedaModal = document.getElementById('input-busqueda-modal-prod');
    const formCrearExpress = document.getElementById('form-crear-producto-express');

    const abrirBusqueda = async () => {
        const overlay = document.getElementById('overlay-buscar-producto');
        const input = document.getElementById('input-busqueda-modal-prod');
        if (overlay) {
            overlay.style.display = 'flex';
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
            // Poblar categorías si están vacías
            const selCat = document.getElementById('exp-prod-categoria');
            if (selCat && selCat.options.length <= 1) {
                try {
                    const categorias = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias`);
                    if (categorias) {
                        selCat.innerHTML = '<option value="">Seleccione...</option>';
                        categorias.forEach(c => selCat.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
                    }
                } catch (e) { console.error("Error cargando categorías", e); }
            }
        } else {
            console.error("No se encontró el overlay del modal.");
        }
    };
    window.abrirModalBusquedaProducto = abrirBusqueda;

    const inputGroupProducto = document.querySelector('.product-input-premium-wrapper');

    if (btnAbrirBusqueda) btnAbrirBusqueda.addEventListener('click', abrirBusqueda);
    if (displayProducto) {
        displayProducto.addEventListener('mousedown', (e) => {
            e.preventDefault();
            abrirBusqueda();
        });
        displayProducto.addEventListener('keydown', (e) => {
            // Si el usuario empieza a escribir, abrir modal y pasarle el foco
            if (e.key.length === 1 || e.key === 'Backspace') {
                abrirBusqueda();
            }
        });
        displayProducto.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val) {
                const modalInput = document.getElementById('input-busqueda-modal-prod');
                if (modalInput) {
                    modalInput.value = val;
                    // Disparar evento input en el modal para que busque
                    modalInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                e.target.value = ''; // Limpiar el del fondo
            }
        });
    }
    if (inputGroupProducto) {
        inputGroupProducto.addEventListener('click', abrirBusqueda);
    }
    
    if (btnCerrarBusqueda) {
        btnCerrarBusqueda.addEventListener('click', () => {
            overlayBusqueda.style.display = 'none';
        });
    }

    if (inputBusquedaModal) {
        inputBusquedaModal.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const wrapper = document.getElementById('wrapper-resultados-prod');
            
            if (!term) {
                wrapper.innerHTML = '<div class="text-center py-5 text-muted"><p>Escriba para buscar...</p></div>';
                return;
            }

            let matches = productosCache.filter(p => 
                p.nombre.toLowerCase().includes(term) || 
                (p.sku && p.sku.toLowerCase().includes(term)) ||
                (p.id.toString().includes(term))
            ).slice(0, 15);

            const renderMatches = (items) => {
                if (items.length === 0) {
                    wrapper.innerHTML = '<div class="text-center py-5 text-muted"><p>No se encontraron productos.</p></div>';
                    return;
                }
                wrapper.innerHTML = items.map(p => `
                    <div class="product-result-item p-3 border-bottom d-flex justify-content-between align-items-center" 
                         style="cursor:pointer;" data-id="${p.id}">
                        <div>
                            <div class="fw-bold text-dark">${p.nombre}</div>
                            <div class="text-muted small">ID: ${p.id} ${p.sku ? '| SKU: '+p.sku : ''}</div>
                        </div>
                        <div class="text-end">
                            <div class="badge bg-primary-subtle text-primary">$ ${p.precio_venta || 0}</div>
                        </div>
                    </div>
                `).join('');

                wrapper.querySelectorAll('.product-result-item').forEach(item => {
                    item.onclick = () => {
                        const pid = item.dataset.id;
                        const p = productosCache.find(x => x.id == pid) || items.find(x => x.id == pid);
                        seleccionarProducto(p);
                    };
                });
            };

            if (matches.length === 0 && term.length > 2) {
                // Fallback a API si no hay en cache y el término es largo
                fetchData(`/api/negocios/${appState.negocioActivoId}/productos/buscar?q=${term}`)
                    .then(res => renderMatches(res || []))
                    .catch(e => console.error("Error buscando:", e));
            } else {
                renderMatches(matches);
            }
        });
    }

    function seleccionarProducto(p) {
        document.getElementById('ingreso-producto-nombre-display').value = p.nombre;
        document.getElementById('ingreso-producto-id-hidden').value = p.id;
        document.getElementById('ingreso-item-costo').value = p.precio_costo || "";
        document.getElementById('overlay-buscar-producto').style.display = 'none';
        document.getElementById('ingreso-item-cantidad').focus();
    }

    function limpiarSeleccionProducto() {
        document.getElementById('ingreso-producto-nombre-display').value = '';
        document.getElementById('ingreso-producto-id-hidden').value = '';
    }

    // --- CREACIÓN EXPRESS ---
    if (formCrearExpress) {
        formCrearExpress.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('msg-creacion-prod');
            const btn = formCrearExpress.querySelector('button[type="submit"]');
            
            const payload = {
                nombre: document.getElementById('exp-prod-nombre').value,
                categoria_id: document.getElementById('exp-prod-categoria').value,
                unidad_medida: document.getElementById('exp-prod-unidad').value,
                precio_venta: parseFloat(document.getElementById('exp-prod-precio-v').value),
                sku: document.getElementById('exp-prod-sku').value || null,
                precio_costo: 0, // Se definirá en la carga del ingreso
                stock: 0
            };

            try {
                btn.disabled = true;
                msg.classList.remove('hidden');
                const nuevoP = await sendData(`/api/negocios/${appState.negocioActivoId}/productos`, payload);
                
                // Actualizar cache local
                productosCache.push(nuevoP);
                seleccionarProducto(nuevoP);
                formCrearExpress.reset();
                mostrarNotificacion('Producto creado y seleccionado.', 'success');
            } catch (err) {
                mostrarNotificacion('Error al crear producto: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                msg.classList.add('hidden');
            }
        });
    }

    // Listeners para recalcular totales al editar tasas globales
    document.querySelectorAll('.tax-input-compact').forEach(input => {
        input.addEventListener('input', recalcularTotalFactura);
    });

    // Cambiar tipo de factura resetea impuestos si es 99
    const selectTipoFactura = document.getElementById('ingreso-factura-tipo');
    if (selectTipoFactura) {
        selectTipoFactura.addEventListener('change', () => {
            actualizarTotalesGlobales();
        });
    }

    // El botón Confirmar Carga (nuevo ID en HTML premium)
    const btnConfirmar = document.getElementById('btn-registrar-ingreso-final');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', () => formFinalize.requestSubmit());
    }

    // Listener para finalizar ingreso
    formFinalize.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (stagedIncomeItems.length === 0) {
            return mostrarNotificacion('Añada al menos un producto al ingreso.', 'warning');
        }
        
        const proveedorId = document.getElementById('ingreso-proveedor-selector').value;
        const facturaTipo = document.getElementById('ingreso-factura-tipo').value;
        const fechaEmision = document.getElementById('ingreso-fecha-emision').value;
        const puntoVenta = document.getElementById('ingreso-punto-venta').value;
        const facturaNumero = document.getElementById('ingreso-factura-numero').value;
        const referencia = document.getElementById('ingreso-referencia').value;
        const cae = document.getElementById('ingreso-cae').value;
        const caeVenc = document.getElementById('ingreso-cae-vencimiento').value;

        // Impuestos
        const iva27 = parseFloat(document.getElementById('tax-iva-27')?.value) || 0;
        const iva21 = parseFloat(document.getElementById('tax-iva-21')?.value) || 0;
        const iva105 = parseFloat(document.getElementById('tax-iva-105')?.value) || 0;
        const iva25 = parseFloat(document.getElementById('tax-iva-25')?.value) || 0;
        const iibb = parseFloat(document.getElementById('tax-iibb')?.value) || 0;
        const piva = parseFloat(document.getElementById('tax-percep-iva')?.value) || 0;
        const exento = parseFloat(document.getElementById('tax-exento')?.value) || 0;
        const noGravado = parseFloat(document.getElementById('tax-no-gravado')?.value) || 0;
        const neto = parseFloat(document.getElementById('total-neto-gravado').innerText.replace(/[^0-9,-]+/g,"").replace(",", ".")) || 0;

        const totalComprobante = neto + iva27 + iva21 + iva105 + iva25 + iibb + piva + exento + noGravado;

        if (!proveedorId || !facturaTipo || !facturaNumero || !fechaEmision || !puntoVenta) {
             return mostrarNotificacion('Complete los datos obligatorios del comprobante.', 'warning');
        }

        const finalItems = stagedIncomeItems.filter(i => i.recibido);

        const payload = {
            proveedor_id: proveedorId,
            referencia: referencia || null,
            factura_tipo: facturaTipo,
            punto_venta: puntoVenta,
            factura_numero: facturaNumero,
            fecha_emision: fechaEmision,
            cae: cae || null,
            cae_vencimiento: caeVenc || null,
            iva_27: iva27,
            iva_21: iva21,
            iva_105: iva105,
            iva_25: iva25,
            iva_percepcion: piva,
            iibb_percepcion: iibb,
            neto_gravado: neto,
            exento: exento,
            no_gravado: noGravado,
            total_factura: totalComprobante,
            orden_compra_id: selectedOCId,
            detalles: finalItems.map(item => ({ 
                 producto_id: item.producto_id,
                 nombre: item.nombre, // Enviamos el nombre por si el ID es nulo
                 cantidad: item.cantidad,
                 precio_costo: item.precio_costo,
                 descuento_1: item.descuento_1,
                 descuento_2: item.descuento_2,
                 iva_porcentaje: item.iva_porcentaje
            }))
        };
        
        // Deshabilitar botón para evitar doble envío
        const submitButton = document.getElementById('btn-registrar-ingreso-final');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Registrando...';
        }

        try {
            const response = await sendData(`/api/negocios/${appState.negocioActivoId}/ingresos`, payload); 
            
            mostrarNotificacion(response.message || 'Ingreso registrado con éxito.', 'success');
            
            if (response.alertas_precios && response.alertas_precios.length > 0) {
                 mostrarAlertasDePrecios(response.alertas_precios);
            } else {
                 const alertasContainer = document.getElementById('alertas-precios-container');
                 if(alertasContainer) alertasContainer.classList.add('hidden');
            }

            limpiarFormularioIngreso();
            poblarSelectores(); 
            
        } catch (error) {
            mostrarNotificacion(error.message || 'Ocurrió un error al registrar el ingreso.', 'error');
            console.error("Error al finalizar ingreso:", error);
        } finally {
             // Volver a habilitar el botón
             const submitButton = document.getElementById('btn-registrar-ingreso-final');
             if (submitButton) {
                 submitButton.disabled = false;
                 submitButton.innerHTML = '<i class="fas fa-save me-2"></i>GUARDAR INGRESO';
             }
        }
    });

    // --- BOTÓN IA SCANNER (BABOON AI) ---
    const btnIAScanner = document.getElementById('btn-ia-scanner');
    if (btnIAScanner) {
        btnIAScanner.addEventListener('click', () => {
            BaboonAIScanner.openModal({
                endpoint: '/api/ia/scan-factura',
                loadingText: 'Escaneando con Document AI...',
                extraData: { negocio_id: appState.negocioActivoId },
                onComplete: (response) => {
                    // El backend devuelve { success, data }
                    poblarConResultadosIA(response.data || response);
                }
            });
        });
    }

    async function poblarConResultadosIA(data) {
        if (!data) return;

        console.log("📥 [IA] Poblando con:", data);

        // 1. Datos del Comprobante
        const tipoSelect = document.getElementById('ingreso-factura-tipo');
        if (tipoSelect) {
            const rawTipo = data.tipo_comprobante || '';
            const mapTipos = { 'A': '01', 'B': '06', 'C': '11', 'REMITO': '99', 'RECIBO': '99', 'FACTURA': '01' };
            const val = mapTipos[rawTipo.toUpperCase()];
            if (val) tipoSelect.value = val;
        }

        const fecha = data.fecha_emision || data.fecha;
        if (fecha) document.getElementById('ingreso-fecha-emision').value = fecha;
        
        const pv = data.punto_venta;
        const num = data.numero_comprobante || data.nro_comprobante;

        if (pv) document.getElementById('ingreso-punto-venta').value = pv.padStart(4, '0');
        
        if (num) {
            if (typeof num === 'string' && num.includes('-')) {
                const parts = num.split('-');
                document.getElementById('ingreso-punto-venta').value = parts[0].padStart(4, '0');
                document.getElementById('ingreso-factura-numero').value = parts[1].padStart(8, '0');
            } else {
                document.getElementById('ingreso-factura-numero').value = String(num).padStart(8, '0');
            }
        }

        // Match Proveedor (por CUIT si tenemos la info o por nombre)
        if (data.cuit_emisor || data.proveedor) {
            const selProv = document.getElementById('ingreso-proveedor-selector');
            if (selProv) {
                // Buscamos en el select. Por ahora por nombre si no tenemos el CUIT mapeado
                const term = (data.proveedor || '').toLowerCase();
                for (let opt of selProv.options) {
                    if (opt.text.toLowerCase().includes(term) && term.length > 3) {
                        selProv.value = opt.value;
                        break;
                    }
                }
            }
        }

        // 2. Impuestos
        if (data.iva_27 !== undefined) document.getElementById('tax-iva-27').value = data.iva_27 || 0;
        if (data.iva_21 !== undefined) document.getElementById('tax-iva-21').value = data.iva_21 || 0;
        if (data.iva_105 !== undefined) document.getElementById('tax-iva-105').value = data.iva_105 || 0;
        if (data.iva_25 !== undefined) document.getElementById('tax-iva-25').value = data.iva_25 || 0;
        if (data.iibb_percepcion !== undefined) document.getElementById('tax-iibb').value = data.iibb_percepcion || 0;
        if (data.iva_percepcion !== undefined) document.getElementById('tax-percep-iva').value = data.iva_percepcion || 0;
        
        // Si hay monto total pero no items, lo informamos (Document AI extrae cabecera)
        if (data.monto_total && (!data.items || data.items.length === 0)) {
            console.log("💰 [IA] Monto total detectado:", data.monto_total);
            // Podríamos ponerlo en algún lado para referencia
        }

        // 3. Ítems
        if (data.items && data.items.length > 0) {
            data.items.forEach(it => {
                const aiName = (it.producto || "").toLowerCase().trim();
                const match = productosCache.find(p => {
                    const dbName = p.nombre.toLowerCase().trim();
                    return dbName.includes(aiName) || aiName.includes(dbName);
                });
                
                stagedIncomeItems.push({
                    producto_id: match ? match.id : null,
                    nombre: match ? match.nombre : (it.producto || "Sin nombre"),
                    cantidad: it.cantidad || 1,
                    precio_costo: it.precio_unitario || 0,
                    descuento_1: 0,
                    descuento_2: 0,
                    iva_porcentaje: it.bonificado ? 0 : (it.iva_p || 21),
                    recibido: true,
                    bonificado: it.bonificado || false,
                    ia_detected: true,
                    no_vinculado: !match
                });
            });
            renderStagedIncomeItems();
        }

        actualizarTotalesGlobales();
        mostrarNotificacion('Datos cargados desde el escaneo IA.', 'success');
    }

    // --- EVENTOS DE LA TABLA (Delegación) ---
    tablaItemsBody.addEventListener('change', (e) => {
        const index = e.target.dataset.index;
        if (typeof index === 'undefined') return;
        
        const item = stagedIncomeItems[index];
        if (e.target.classList.contains('check-recibido')) {
            item.recibido = e.target.checked;
        } else if (e.target.classList.contains('edit-cantidad')) {
            item.cantidad = parseFloat(e.target.value) || 0;
        } else if (e.target.classList.contains('edit-costo')) {
            item.precio_costo = parseFloat(e.target.value) || 0;
        } else if (e.target.classList.contains('edit-dto1')) {
            item.descuento_1 = parseFloat(e.target.value) || 0;
        } else if (e.target.classList.contains('edit-dto2')) {
            item.descuento_2 = parseFloat(e.target.value) || 0;
        }
        renderStagedIncomeItems(); 
    });

    tablaItemsBody.addEventListener('click', (e) => {
        const target = e.target.closest('.btn-quitar');
        if (target) {
            const index = target.dataset.index;
            if (typeof index !== 'undefined') {
                stagedIncomeItems.splice(index, 1);
                renderStagedIncomeItems();
            }
        }
    });

    // Listener para abrir modal de importar OC
    const btnImportarOC = document.getElementById('btn-importar-oc');
    if (btnImportarOC) {
        btnImportarOC.addEventListener('click', async () => {
            await cargarOCPendientes();
            const modal = new bootstrap.Modal(document.getElementById('modal-importar-oc'));
            modal.show();
        });
    }

    // --- BOTÓN VER HISTORIAL (Acceso Rápido) ---
    const btnVerHistorial = document.getElementById('btn-ver-historial-ingresos');
    if (btnVerHistorial) {
        btnVerHistorial.addEventListener('click', () => {
             if (window.loadContent) window.loadContent(null, 'historial_ingresos');
        });
    }

    // --- BOTÓN CANCELAR ---
    const btnCancelar = document.getElementById('btn-cancelar-ingreso');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            if (stagedIncomeItems.length > 0 || selectedOCId) {
                if (confirm('¿Está seguro de cancelar la carga actual? Se perderán todos los datos ingresados.')) {
                    limpiarFormularioIngreso();
                    mostrarNotificacion('Carga cancelada.', 'info');
                }
            } else {
                limpiarFormularioIngreso();
            }
        });
    }

function limpiarFormularioIngreso() {
    stagedIncomeItems = [];
    selectedOCId = null;
    renderStagedIncomeItems();
    if (formFinalize) formFinalize.reset();
    if (formAddItem) formAddItem.reset();
    
    const alertasContainer = document.getElementById('alertas-precios-container');
    if (alertasContainer) alertasContainer.classList.add('hidden');

    const submitButton = document.getElementById('btn-registrar-ingreso-final');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save me-2"></i>GUARDAR INGRESO';
    }

    // 🧹 Limpieza de backdrops para evitar congelamiento
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}
}

async function cargarOCPendientes() {
    try {
        const ordenes = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/ordenes?estado=abierta`);
        const tbody = document.getElementById('lista-importar-oc-body');
        
        if (!tbody) return;
        tbody.innerHTML = '';

        if (ordenes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay órdenes abiertas.</td></tr>';
            return;
        }

        ordenes.forEach(oc => {
            const fechaFmt = new Date(oc.fecha).toLocaleDateString('es-AR');
            const totalFmt = oc.total_estimado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fw-bold">${oc.numero_oc}</td>
                <td>${fechaFmt}</td>
                <td>${oc.proveedor_nombre}</td>
                <td>${totalFmt}</td>
                <td class="text-center">
                    <button class="btn btn-primary btn-sm" onclick="importarOC(${oc.id})">
                        Importar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error cargando OCs:", error);
    }
}

window.importarOC = async (id) => {
    selectedOCId = id; // IMPORTANTE: Guardamos el ID de la OC vinculada
    try {
        const oc = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/orden/${id}`);
        
        if (!oc) throw new Error("No se pudo obtener el detalle de la orden.");

        // Limpiar items actuales (opcional)
        if (stagedIncomeItems.length > 0) {
            const confirm = await Swal.fire({
                title: '¿Combinar ítems?',
                text: 'Ya tienes productos en la lista. ¿Deseas agregar los de la OC o reemplazar la lista actual?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Combinar',
                cancelButtonText: 'Reemplazar',
                reverseButtons: true
            });
            if (!confirm.isConfirmed) stagedIncomeItems = [];
        } else {
            stagedIncomeItems = [];
        }

        // Setear proveedor
        const selProv = document.getElementById('ingreso-proveedor-selector');
        if (selProv) selProv.value = oc.proveedor_id;

        // Setear referencia con el nro de OC / Referencia
        const refInput = document.getElementById('ingreso-referencia');
        if (refInput) refInput.value = oc.referencia || '';

        // Añadir items
        oc.detalles.forEach(d => {
            // Evitar duplicados si combinamos
            const existing = stagedIncomeItems.find(i => i.producto_id == d.producto_id);
            if (existing) {
                existing.cantidad += d.cantidad;
                existing.precio_costo = d.precio_costo;
            } else {
                stagedIncomeItems.push({
                    producto_id: d.producto_id,
                    nombre: d.producto_nombre,
                    cantidad: d.cantidad,
                    precio_costo: d.precio_costo,
                    precio_oc: d.precio_costo, // Referencia de la OC
                    descuento_1: 0,
                    descuento_2: 0,
                    iva_porcentaje: 21.0,
                    recibido: true
                });
            }
        });

        renderStagedIncomeItems();
        
        // Cerrar modal
        const modalEl = document.getElementById('modal-importar-oc');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
        
        mostrarNotificacion(`Datos de la OC importados con éxito.`, 'success');

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};
