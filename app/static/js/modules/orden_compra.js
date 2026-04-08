// app/static/js/modules/orden_compra.js
import { fetchData, sendData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';

let cartItems = []; // [{ producto_id, nombre, cantidad, precio_costo, sku }]
let productosCache = [];
let proveedoresCache = [];
let comprasConfigCache = null;

export async function inicializarOC() {
    console.log("📦 [OC] Inicializando módulo...");
    
    // Listeners principales
    const modalNuevaOC = document.getElementById('modal-nueva-oc');
    if (modalNuevaOC) {
        modalNuevaOC.addEventListener('hidden.bs.modal', () => {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        });
    }

    const btnNuevaOC = document.getElementById('btn-nueva-oc');
    if (btnNuevaOC) {
        btnNuevaOC.addEventListener('click', () => {
            resetModal();
            const modal = bootstrap.Modal.getOrCreateInstance(modalNuevaOC, {
                focus: false
            });
            modal.show();
        });
    }

    // Configuración de Reporte
    const btnConfig = document.getElementById('btn-config-compras');
    if (btnConfig) {
        btnConfig.addEventListener('click', abrirModalConfig);
    }

    const btnCerrarConfig = document.getElementById('btn-cerrar-config-compras');
    const btnCancelarConfig = document.getElementById('btn-cancelar-config');
    const modalConfig = document.getElementById('modal-config-compras');
    
    [btnCerrarConfig, btnCancelarConfig].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modalConfig.style.display = 'none';
            });
        }
    });

    const formConfig = document.getElementById('form-config-compras');
    if (formConfig) {
        formConfig.addEventListener('submit', guardarConfiguracionCompras);
    }

    const btnGuardarOC = document.getElementById('btn-guardar-oc');
    if (btnGuardarOC) {
        btnGuardarOC.addEventListener('click', guardarOC);
    }

    const divAbrirBusqueda = document.getElementById('div-abrir-busqueda-producto');
    if (divAbrirBusqueda) {
        divAbrirBusqueda.addEventListener('click', abrirModalBusquedaProducto);
    }

    // Modal Events
    const btnCerrarBusqueda = document.getElementById('btn-cerrar-modal-busqueda-prod');
    if (btnCerrarBusqueda) {
        btnCerrarBusqueda.addEventListener('click', () => {
            document.getElementById('overlay-buscar-producto').style.display = 'none';
        });
    }

    const inputBusquedaModal = document.getElementById('input-busqueda-modal-prod');
    if (inputBusquedaModal) {
        let timeoutBusqueda = null;
        inputBusquedaModal.addEventListener('input', (e) => {
            clearTimeout(timeoutBusqueda);
            timeoutBusqueda = setTimeout(() => {
                filtrarProductosModal(e.target.value);
            }, 300);
        });
    }

    const formCrearExpress = document.getElementById('form-crear-producto-express');
    if (formCrearExpress) {
        formCrearExpress.addEventListener('submit', crearProductoExpress);
    }

    // Filtro de Dashboard
    const filtroProvDash = document.getElementById('filtro-proveedor-oc');
    if (filtroProvDash) {
        filtroProvDash.addEventListener('change', cargarOrdenes);
    }

    // Carga inicial de datos
    await Promise.all([
        cargarOrdenes(),
        cargarProveedores(),
        preCargarProductos(),
        cargarConfiguracionCompras()
    ]);
}

async function cargarOrdenes() {
    try {
        const filtroProv = document.getElementById('filtro-proveedor-oc');
        const proveedorId = filtroProv ? filtroProv.value : '';
        
        let url = `/api/negocios/${appState.negocioActivoId}/compras/ordenes`;
        if (proveedorId) {
            url += `?proveedor_id=${proveedorId}`;
        }

        const ordenes = await fetchData(url);
        const tbody = document.getElementById('lista-oc-body');
        const emptyState = document.getElementById('oc-empty-state');
        
        if (!tbody) return;
        tbody.innerHTML = '';

        if (ordenes.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }
        emptyState.classList.add('d-none');

        ordenes.forEach(oc => {
            const fechaFmt = new Date(oc.fecha).toLocaleDateString('es-AR');
            const totalFmt = oc.total_estimado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
            
            const tr = document.createElement('tr');
            tr.className = 'animate__animated animate__fadeIn';
            tr.innerHTML = `
                <td class="ps-4 fw-bold text-slate-700">${oc.numero_oc}</td>
                <td>${fechaFmt}</td>
                <td>${oc.proveedor_nombre}</td>
                <td><small class="text-muted">${oc.usuario_nombre}</small></td>
                <td class="text-end fw-bold text-slate-800">${totalFmt}</td>
                <td class="text-center">
                    <span class="status-badge status-${oc.estado}">${oc.estado}</span>
                </td>
                <td class="pe-4 text-center">
                    <div class="btn-group shadow-sm" style="border-radius: 8px; overflow: hidden;">
                        <button class="btn btn-white btn-sm px-3 border" onclick="window.descargarPDFOC(${oc.id}, '${oc.numero_oc}', '${oc.proveedor_nombre}')" title="Ver PDF">
                            <i class="fas fa-file-pdf text-danger"></i>
                        </button>
                        ${oc.estado === 'abierta' ? `
                        <button class="btn btn-white btn-sm px-3 border border-start-0" onclick="cancelarOC(${oc.id})" title="Cancelar">
                            <i class="fas fa-times text-muted"></i>
                        </button>
                        ` : ''}
                        ${oc.estado === 'completada' ? `
                        <button class="btn btn-white btn-sm px-3 border border-start-0" onclick="verDetalleIngreso(${oc.id})" title="Ver Ingreso Vinculado">
                            <i class="fas fa-link text-primary"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-white btn-sm px-3 border border-start-0" onclick="eliminarOC(${oc.id}, '${oc.numero_oc}')" title="Eliminar definitivamente">
                            <i class="fas fa-trash text-danger"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error cargando OCs:", error);
    }
}

// ... existing code ...

async function eliminarOC(id, numero) {
    if (!confirm(`¿Estás seguro que deseas ELIMINAR la ${numero}?`)) return;
    if (!confirm(`¡ÚLTIMO AVISO! Se borrará definitivamente.\nEsta acción solo es posible si NO tiene ingresos de mercadería relacionados.\n¿Confirmar eliminación definitiva?`)) return;

    try {
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/orden/${id}`, {
            method: 'DELETE'
        });
        mostrarNotificacion(res.message || 'Orden eliminada', 'success');
        cargarOrdenes();
    } catch (error) {
        mostrarNotificacion(error.error || error.message || 'Error al eliminar', 'error');
    }
}

async function cargarProveedores() {
    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedoresCache = proveedores;
        const select = document.getElementById('select-proveedor');
        const selectFiltro = document.getElementById('filtro-proveedor-oc');
        
        if (select) {
            select.innerHTML = '<option value="">Seleccione un proveedor...</option>';
            proveedores.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nombre;
                select.appendChild(opt);
            });
        }

        if (selectFiltro) {
            // Guardar valor actual por si se está recargando
            const currentVal = selectFiltro.value;
            selectFiltro.innerHTML = '<option value="">-- Todos los proveedores --</option>';
            proveedores.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nombre;
                selectFiltro.appendChild(opt);
            });
            selectFiltro.value = currentVal || "";
        }
    } catch (error) {
        console.error("Error proveedores:", error);
    }
}

async function preCargarProductos() {
    try {
        productosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos?simple=true`);
    } catch (error) {
        console.error("Error productos:", error);
    }
}

async function abrirModalBusquedaProducto() {
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
    }
}

function filtrarProductosModal(term) {
    const termLower = (term || '').toLowerCase().trim();
    const wrapper = document.getElementById('wrapper-resultados-prod');
    if (!wrapper) return;
    
    if (!termLower || termLower.length < 2) {
        wrapper.innerHTML = '<div class="text-center py-5 text-muted"><p>Escriba al menos 2 caracteres para buscar...</p></div>';
        return;
    }

    if (!Array.isArray(productosCache)) {
        wrapper.innerHTML = '<div class="text-center py-5 text-muted"><p>Cargando catálogo...</p></div>';
        return;
    }

    try {
        const matches = productosCache.filter(p => {
            if (!p) return false;
            const nombre = (p.nombre || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            const id = String(p.id || '');
            return nombre.includes(termLower) || sku.includes(termLower) || id.includes(termLower);
        }).slice(0, 20);

        if (matches.length === 0) {
            wrapper.innerHTML = '<div class="text-center py-5 text-muted"><p>No se encontraron productos que coincidan.</p></div>';
            return;
        }

        wrapper.innerHTML = matches.map(p => `
            <div class="product-result-item p-3 border-bottom d-flex justify-content-between align-items-center" 
                 style="cursor:pointer;" onclick="window.seleccionarProductoExpress(${p.id})">
                <div class="me-3 overflow-hidden">
                    <div class="fw-bold text-dark text-truncate" title="${p.nombre || ''}">${p.nombre || 'Sin nombre'}</div>
                    <div class="text-muted micro-label">ID: ${p.id} ${p.sku ? '| SKU: '+p.sku : ''}</div>
                </div>
                <div class="text-end flex-shrink-0">
                    <div class="badge bg-primary-subtle text-primary">$ ${p.precio_costo || 0}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error filtrando productos:", err);
        wrapper.innerHTML = '<div class="text-center py-5 text-danger"><p>Error al filtrar productos.</p></div>';
    }
}

// Expongo para el onclick dinámico
window.seleccionarProductoExpress = (id) => {
    const p = productosCache.find(x => String(x.id) === String(id));
    if (p) {
        seleccionarProducto(p);
    }
};

function seleccionarProducto(p) {
    if (!p) return;
    window.agregarAlCart(p.id);
    const overlay = document.getElementById('overlay-buscar-producto');
    if (overlay) overlay.style.display = 'none';
    const input = document.getElementById('input-busqueda-modal-prod');
    if (input) input.value = '';
}

async function crearProductoExpress(e) {
    e.preventDefault();
    const msg = document.getElementById('msg-creacion-prod');
    const btn = e.target.querySelector('button[type="submit"]');
    
    const payload = {
        nombre: document.getElementById('exp-prod-nombre').value,
        categoria_id: document.getElementById('exp-prod-categoria').value,
        unidad_medida: document.getElementById('exp-prod-unidad').value,
        precio_venta: parseFloat(document.getElementById('exp-prod-precio-v').value),
        sku: document.getElementById('exp-prod-sku').value || null,
        precio_costo: 0,
        stock: 0
    };

    try {
        btn.disabled = true;
        msg.classList.remove('d-none');
        const nuevoP = await sendData(`/api/negocios/${appState.negocioActivoId}/productos`, payload);
        
        productosCache.push(nuevoP);
        seleccionarProducto(nuevoP);
        e.target.reset();
        mostrarNotificacion('Producto creado y ya agregado al pedido.', 'success');
    } catch (err) {
        mostrarNotificacion('Error al crear producto: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        msg.classList.add('d-none');
    }
}

    // Expongo a window para el onclick dinámico
    window.agregarAlCart = (id) => {
        console.log("🛒 [OC] Agregando ID:", id);
        const p = productosCache.find(x => String(x.id) === String(id));
        
        if (!p) {
            console.error("❌ [OC] Producto no encontrado en cache:", id);
            return;
        }

        const exist = cartItems.find(x => String(x.producto_id) === String(id));
        if (exist) {
            exist.cantidad += 1;
        } else {
            cartItems.push({
                producto_id: p.id,
                nombre: p.nombre,
                sku: p.sku,
                cantidad: 1,
                precio_costo: p.precio_costo || 0
            });
        }

        console.log("✅ [OC] Cart actualizado, items:", cartItems.length);
        renderCart();
    };

    function renderCart() {
        const container = document.getElementById('cart-items');
        const msg = document.getElementById('cart-empty-msg');
        const totalSpan = document.getElementById('cart-total');

        if (!container) return;

        if (cartItems.length === 0) {
            if (msg) msg.classList.remove('d-none');
            container.innerHTML = '';
            totalSpan.textContent = '$ 0,00';
            return;
        }

        if (msg) msg.classList.add('d-none');
        let total = 0;
        
        container.innerHTML = cartItems.map((item, idx) => {
            const subtotal = item.cantidad * item.precio_costo;
            total += subtotal;
            return `
                <tr class="animate__animated animate__fadeIn">
                    <td>
                        <div class="fw-600 text-slate-800 small">${item.nombre}</div>
                        <div class="text-muted" style="font-size: 10px;">SKU: ${item.sku || 'N/A'}</div>
                    </td>
                    <td class="text-center">
                        <input type="number" class="form-control form-control-sm text-center mx-auto" 
                               style="width: 60px; border-radius: 8px; border: 1px solid #e2e8f0;" 
                               value="${item.cantidad}" onchange="window.updateCant(${idx}, this.value)">
                    </td>
                    <td class="text-center">
                        <div class="d-flex align-items-center justify-content-center bg-light px-2 py-1" style="border-radius: 8px;">
                            <span class="text-muted small me-1">$</span>
                            <input type="number" class="form-control form-control-sm border-0 bg-transparent text-center p-0" 
                                   style="width: 80px; font-weight: 500;"
                                   value="${item.precio_costo}" onchange="window.updatePrice(${idx}, this.value)">
                        </div>
                    </td>
                    <td class="text-end fw-bold text-slate-700 small">
                        $ ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-link text-danger btn-sm p-0" onclick="window.removeId(${idx})" title="Eliminar">
                            <i class="fas fa-trash-alt" style="font-size: 13px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        totalSpan.textContent = total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    }

window.updateCant = (idx, val) => {
    cartItems[idx].cantidad = parseFloat(val) || 0;
    renderCart();
};

window.updatePrice = (idx, val) => {
    cartItems[idx].precio_costo = parseFloat(val) || 0;
    renderCart();
};

window.removeId = (idx) => {
    cartItems.splice(idx, 1);
    renderCart();
};

async function guardarOC() {
    const provId = document.getElementById('select-provider') ? document.getElementById('select-provider').value : document.getElementById('select-proveedor').value;
    const obs = document.getElementById('oc-observaciones').value;

    if (!provId) return mostrarNotificacion('Seleccione un proveedor', 'warning');
    if (cartItems.length === 0) return mostrarNotificacion('La orden está vacía', 'warning');

    const btn = document.getElementById('btn-guardar-oc');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generando...';

    const payload = {
        proveedor_id: provId,
        observaciones: obs,
        detalles: cartItems
    };

    try {
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/compras/orden`, payload);
        
        Swal.fire({
            title: '¡Orden Generada!',
            text: `Se ha creado la ${res.numero_oc} correctamente.`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-file-pdf me-2"></i>Ver PDF',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                const provSelect = document.getElementById('select-proveedor');
                const provNombre = provSelect ? provSelect.options[provSelect.selectedIndex].text : 'prov';
                descargarPDFOC(res.id, res.numero_oc, provNombre);
            }
            const modalEl = document.getElementById('modal-nueva-oc');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.hide();
            
            // Forzar limpieza de backdrop
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, 300);

            cargarOrdenes();
        });

    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'GENERAR ORDEN';
    }
}

function resetModal() {
    cartItems = [];
    document.getElementById('select-proveedor').value = '';
    document.getElementById('oc-observaciones').value = '';
    renderCart();
}

window.cancelarOC = async (id) => {
    const confirm = await Swal.fire({
        title: '¿Cancelar Orden?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No',
        confirmButtonColor: '#e11d48'
    });

    if (confirm.isConfirmed) {
        try {
            await sendData(`/api/negocios/${appState.negocioActivoId}/compras/orden/${id}/cancelar`, {}, 'PUT');
            mostrarNotificacion('Orden cancelada correctamente', 'success');
            cargarOrdenes();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }
}
window.descargarPDFOC = async function(id, numero, proveedor) {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            mostrarNotificacion('Librería PDF no cargada', 'error');
            return;
        }

        mostrarNotificacion('Preparando PDF...', 'info');
        
        // Obtenemos los datos completos del servidor
        const oc = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/orden/${id}`);
        const negocio = (appState.negociosCache || []).find(n => n.id == appState.negocioActivoId) || { nombre: 'Mi Negocio', direccion: '' };

        const doc = new jsPDF();
        
        // --- DATOS EMISOR (Priorizar Config Compras) ---
        const emisor = {
            nombre: (comprasConfigCache && comprasConfigCache.razon_social) || negocio.nombre,
            cuit: (comprasConfigCache && comprasConfigCache.cuit) || negocio.cuit,
            direccion: (comprasConfigCache && comprasConfigCache.domicilio) || negocio.direccion,
            email: (comprasConfigCache && comprasConfigCache.email) || negocio.email,
            telefono: (comprasConfigCache && comprasConfigCache.telefono) || '',
            iva: (comprasConfigCache && comprasConfigCache.condicion_iva) || (negocio.posicion_iva || ''),
            horarios: (comprasConfigCache && comprasConfigCache.horarios_entrega) || ''
        };

        // --- CABECERA ---
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); 
        doc.text(emisor.nombre, 105, 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        const headerInfo = [
            emisor.direccion,
            emisor.cuit ? `CUIT: ${emisor.cuit}` : '',
            emisor.iva ? `IVA: ${emisor.iva}` : ''
        ].filter(Boolean).join(' | ');
        doc.text(headerInfo, 105, 26, { align: 'center' });

        const subHeaderInfo = [
            emisor.email ? `Email: ${emisor.email}` : '',
            emisor.telefono ? `Tel: ${emisor.telefono}` : ''
        ].filter(Boolean).join(' | ');
        if (subHeaderInfo) doc.text(subHeaderInfo, 105, 31, { align: 'center' });

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 34, 196, 34);

        // --- INFO DE LA ORDEN ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text("ORDEN DE COMPRA", 14, 46);
        
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`#${oc.numero_oc || id}`, 196, 46, { align: 'right' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fechaStr = oc.fecha ? new Date(oc.fecha).toLocaleDateString() : 'N/A';
        doc.text(`Fecha de Emisión: ${fechaStr}`, 14, 53);
        const estadoLabel = oc.estado ? oc.estado.toUpperCase() : 'ABIERTA';
        doc.text(`Estado: ${estadoLabel}`, 196, 53, { align: 'right' });

        // --- CUADRO PROVEEDOR ---
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 62, 182, 30, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 62, 182, 30, 'D');

        doc.setFont("helvetica", "bold");
        doc.text("PROVEEDOR:", 20, 71);
        doc.setFont("helvetica", "normal");
        doc.text(String(oc.proveedor_nombre || 'N/A'), 60, 71);

        doc.setFont("helvetica", "bold");
        doc.text("CUIT:", 20, 79);
        doc.setFont("helvetica", "normal");
        doc.text(String(oc.proveedor_cuit || 'N/A'), 60, 79);

        doc.setFont("helvetica", "bold");
        doc.text("CONTACTO:", 20, 87);
        doc.setFont("helvetica", "normal");
        doc.text(String(oc.proveedor_email || 'N/A'), 60, 87);

        // --- TABLA DE ITEMS ---
        const rows = (oc.detalles || []).map(d => [
            d.producto_nombre,
            d.sku || '-',
            parseFloat(d.cantidad).toFixed(2),
            `$ ${parseFloat(d.precio_costo_actual || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
            `$ ${parseFloat(d.subtotal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
        ]);

        doc.autoTable({
            startY: 100,
            head: [['Producto', 'SKU', 'Cant.', 'Costo U.', 'Subtotal']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });

        // --- TOTAL & FOOTER ---
        let finalY = doc.lastAutoTable.finalY + 12;
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("TOTAL ESTIMADO:", 130, finalY);
        doc.text(`$ ${parseFloat(oc.total_estimado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 196, finalY, { align: 'right' });

        if (emisor.horarios) {
            finalY += 10;
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("HORARIOS DE ENTREGA:", 14, finalY);
            doc.setFont("helvetica", "normal");
            doc.text(emisor.horarios, 14, finalY + 5);
        }

        // --- OBSERVACIONES ---
        if (oc.observaciones) {
            finalY += 15;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Observaciones:", 14, finalY);
            doc.setFont("helvetica", "normal");
            const splitObs = doc.splitTextToSize(oc.observaciones, 180);
            doc.text(splitObs, 14, finalY + 6);
        }

        // --- PIE DE PÁGINA ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(`Multinegocio - Compras | Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }

        const safeProv = (oc.proveedor_nombre || 'prov').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`OC_${numero || id}_${safeProv}.pdf`);
        mostrarNotificacion('PDF generado correctamente.', 'success');

    } catch (e) {
        console.error("❌ [OC] Error descarga PDF:", e);
        mostrarNotificacion('Error al generar el archivo PDF: ' + e.message, 'error');
    }
}

window.verDetalleIngreso = async (id) => {
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/compras/orden/${id}`;
        const oc = await fetchData(url);
        
        if (oc.ingreso_vinculado) {
            const i = oc.ingreso_vinculado;
            const fechaFmt = new Date(i.fecha).toLocaleString('es-AR');
            const factura = `${i.factura_tipo} ${i.factura_prefijo}-${i.factura_numero}`;
            
            Swal.fire({
                title: 'Trazabilidad de Orden',
                html: `
                    <div class="text-start">
                        <p>Esta orden fue procesada en el siguiente ingreso:</p>
                        <hr>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Comprobante:</span>
                            <span class="fw-bold">${factura}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Fecha de Ingreso:</span>
                            <span>${fechaFmt}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">ID Sistema:</span>
                            <code>#${i.id}</code>
                        </div>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#4f46e5'
            });
        } else {
            mostrarNotificacion('No se encontró información del ingreso vinculado.', 'warning');
        }
    } catch (e) {
        console.error("Error al ver trazabilidad:", e);
    }
};

async function cargarConfiguracionCompras() {
    try {
        comprasConfigCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/config`);
        console.log("⚙️ [OC] Configuración de compras cargada:", comprasConfigCache);
    } catch (e) {
        console.error("Error al cargar config de compras:", e);
    }
}

function abrirModalConfig() {
    if (comprasConfigCache) {
        document.getElementById('cfg-razon-social').value = comprasConfigCache.razon_social || '';
        document.getElementById('cfg-cuit').value = comprasConfigCache.cuit || '';
        document.getElementById('cfg-iva').value = comprasConfigCache.condicion_iva || 'Responsable Inscripto';
        document.getElementById('cfg-domicilio').value = comprasConfigCache.domicilio || '';
        document.getElementById('cfg-telefono').value = comprasConfigCache.telefono || '';
        document.getElementById('cfg-email').value = comprasConfigCache.email || '';
        document.getElementById('cfg-horarios').value = comprasConfigCache.horarios_entrega || '';
    }
    document.getElementById('modal-config-compras').style.display = 'flex';
}

async function guardarConfiguracionCompras(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalHtml = btn.innerHTML;
    
    const payload = {
        razon_social: document.getElementById('cfg-razon-social').value,
        cuit: document.getElementById('cfg-cuit').value,
        condicion_iva: document.getElementById('cfg-iva').value,
        domicilio: document.getElementById('cfg-domicilio').value,
        telefono: document.getElementById('cfg-telefono').value,
        email: document.getElementById('cfg-email').value,
        horarios_entrega: document.getElementById('cfg-horarios').value
    };

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';
        
        await sendData(`/api/negocios/${appState.negocioActivoId}/compras/config`, payload);
        
        // Actualizar cache local
        comprasConfigCache = { ...payload };
        
        document.getElementById('modal-config-compras').style.display = 'none';
        Swal.fire('¡Éxito!', 'Configuración guardada correctamente.', 'success');
        
    } catch (err) {
        mostrarNotificacion('Error al guardar configuración: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}
