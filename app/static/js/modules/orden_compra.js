// app/static/js/modules/orden_compra.js
import { fetchData, sendData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getAuthHeaders } from './auth.js';

let cartItems = []; // [{ producto_id, nombre, cantidad, precio_costo, sku }]
let productosCache = [];
let proveedoresCache = [];

export async function inicializarOC() {
    console.log("📦 [OC] Inicializando módulo...");
    
    // Listeners principales
    const btnNuevaOC = document.getElementById('btn-nueva-oc');
    if (btnNuevaOC) {
        btnNuevaOC.addEventListener('click', () => {
            resetModal();
            const modal = new bootstrap.Modal(document.getElementById('modal-nueva-oc'));
            modal.show();
        });
    }

    const btnGuardarOC = document.getElementById('btn-guardar-oc');
    if (btnGuardarOC) {
        btnGuardarOC.addEventListener('click', guardarOC);
    }

    const inputBuscarProd = document.getElementById('buscar-producto');
    if (inputBuscarProd) {
        inputBuscarProd.addEventListener('input', (e) => buscarProductos(e.target.value));
    }

    // Carga inicial de datos
    await Promise.all([
        cargarOrdenes(),
        cargarProveedores(),
        preCargarProductos()
    ]);
}

async function cargarOrdenes() {
    try {
        const ordenes = await fetchData(`/api/negocios/${appState.negocioActivoId}/compras/ordenes`);
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
                        <button class="btn btn-white btn-sm px-3 border" onclick="window.open('/api/negocios/${appState.negocioActivoId}/compras/orden/${oc.id}/pdf', '_blank')" title="Ver PDF">
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
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error cargando OCs:", error);
    }
}

async function cargarProveedores() {
    try {
        const proveedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/proveedores`);
        proveedoresCache = proveedores;
        const select = document.getElementById('select-proveedor');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccione un proveedor...</option>';
        proveedores.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });
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

function buscarProductos(term) {
    const resultsDiv = document.getElementById('resultados-productos');
    if (!term || term.length < 2) {
        resultsDiv.classList.add('d-none');
        return;
    }

    const filtered = productosCache.filter(p => 
        p.nombre.toLowerCase().includes(term.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(term.toLowerCase()))
    ).slice(0, 10);

    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="list-group-item small text-muted">No se encontraron productos</div>';
    } else {
        resultsDiv.innerHTML = filtered.map(p => `
            <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
               onclick="event.preventDefault(); window.agregarAlCart(${p.id})">
                <div>
                    <div class="fw-bold">${p.nombre}</div>
                    <small class="text-muted">SKU: ${p.sku || '-'}</small>
                </div>
                <div class="text-primary fw-600">$ ${p.precio_costo || 0}</div>
            </a>
        `).join('');
    }
    resultsDiv.classList.remove('d-none');
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
        document.getElementById('resultados-productos').classList.add('d-none');
        document.getElementById('buscar-producto').value = '';
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
                // Obtener nombre del proveedor para el nombre del archivo
                const provSelect = document.getElementById('select-proveedor');
                const provNombre = provSelect.options[provSelect.selectedIndex].text;
                descargarPDFOC(res.id, res.numero_oc, provNombre);
            }
            bootstrap.Modal.getInstance(document.getElementById('modal-nueva-oc')).hide();
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
async function descargarPDFOC(id, numero, proveedor) {
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/compras/orden/${id}/pdf`;
        const authHeaders = getAuthHeaders();
        
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) throw new Error('Error al generar el PDF de la Orden');
        
        const blob = await res.blob();
        const objUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        
        // Limpiamos el nombre del proveedor para el archivo
        const safeProv = proveedor.replace(/[^a-z0-9]/gi, '_');
        a.download = `${numero}_${safeProv}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objUrl);
        
        mostrarNotificacion(`Descargando ${numero}...`, 'info');
    } catch (e) {
        console.error("❌ [OC] Error descarga PDF:", e);
        mostrarNotificacion('Error al descargar el PDF', 'error');
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
