/* app/static/js/modules/pos.js */
import { fetchData, sendData } from '../api.js';
import { appState, checkGlobalCashRegisterState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let cart = [];
let allProducts = [];

export async function inicializarLogicaPOS() {
    console.log("Inicializando Retail POS...");

    // 1. Verificar estado de la caja
    await verificarCaja();

    // 2. Cargar productos (Catálogo Completo)
    await cargarTodosLosProductos();

    // 3. Configurar Event Listeners
    setupEventListeners();

    // 4. Actualizar UI Inicial
    renderCart();
    actualizarInfoUsuario();

    // ─── INTEGRACIÓN CRM META ───
    const tempLead = sessionStorage.getItem('temp_lead_venta');
    if (tempLead) {
        try {
            const lead = JSON.parse(tempLead);
            sessionStorage.removeItem('temp_lead_venta');
            _autoVincularClientePOS(lead);
        } catch (e) { console.error("[POS] Error lead:", e); }
    }
}

async function _autoVincularClientePOS(lead) {
    try {
        const query = lead.telefono ? lead.telefono.slice(-8) : lead.nombre;
        const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes?search=${encodeURIComponent(query)}&limit=1`);
        const clientes = res.data || [];

        const hId = document.getElementById('cliente-selector');
        const dName = document.getElementById('cliente-display');

        if (clientes.length > 0) {
            if (hId) hId.value = clientes[0].id;
            if (dName) dName.value = clientes[0].nombre;
            mostrarNotificacion(`Venta vinculada a: ${clientes[0].nombre}`, 'success');
        } else {
            if (dName) dName.value = lead.nombre + ' (Socio/Lead)';
            mostrarNotificacion('El lead no es cliente registrado. Usando nombre temporal.', 'info');
        }
    } catch (e) { console.error("Error vinculando cliente POS:", e); }
}

async function verificarCaja() {
    const badge = document.getElementById('pos-info-caja');
    if (!badge) return;

    try {
        await checkGlobalCashRegisterState();
        if (appState.cajaSesionIdActiva) {
            badge.textContent = "Caja Abierta";
            badge.classList.add('open');
        } else {
            badge.textContent = "¡Caja Cerrada!";
            badge.classList.remove('open');
            mostrarNotificacion("La caja está cerrada. Debes abrirla para vender.", "warning");
        }
    } catch (error) {
        badge.textContent = "Error Caja";
    }
}

async function cargarTodosLosProductos() {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    try {
        // Cargar catálogo general de productos (sin límite pequeño para ver todo)
        allProducts = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos?limit=200`);

        renderProducts(allProducts);
    } catch (error) {
        console.error("Error cargando productos:", error);
        grid.innerHTML = '<div class="error">Error al cargar productos</div>';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    grid.innerHTML = products.map(p => {
        const displayName = p.alias || p.nombre;
        const imgHtml = p.imagen_url
            ? `<div class="img-container"><img src="${p.imagen_url}" loading="lazy"></div>`
            : `<div class="img-container"><i class="fas fa-image"></i></div>`;

        return `
            <div class="pos-product-card" onclick="window.posAddToCard(${p.id})">
                ${imgHtml}
                <span class="name" title="${p.nombre}">${displayName}</span>
                <span class="price">$${parseFloat(p.precio_venta).toLocaleString('es-AR')}</span>
            </div>
        `;
    }).join('');
}

window.posAddToCard = (productId) => {
    const product = allProducts.find(p => p.id === productId) || { id: productId };
    if (!product.nombre) return;

    const existing = cart.find(item => item.producto_id === productId);
    if (existing) {
        existing.cantidad += 1;
    } else {
        cart.push({
            producto_id: product.id,
            nombre: product.nombre,
            alias: product.alias,
            precio_unitario: parseFloat(product.precio_venta),
            cantidad: 1
        });
    }

    renderCart();
};

function renderCart() {
    const tbody = document.querySelector('#pos-cart-table tbody');
    const emptyMsg = document.getElementById('pos-empty-cart-msg');
    const subtotalEl = document.getElementById('pos-subtotal');
    const totalEl = document.getElementById('pos-total');

    if (!tbody) return;

    if (cart.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        tbody.innerHTML = cart.map((item, index) => {
            const displayName = item.alias || item.nombre;
            return `
            <tr>
                <td>
                    <div style="font-weight: 600;">${displayName}</div>
                    ${item.alias ? `<small class="text-muted" style="font-size: 0.7rem;">${item.nombre}</small>` : ''}
                </td>
                <td class="item-qty-cell">
                    <button class="qty-btn" onclick="window.posUpdateQty(${index}, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button class="qty-btn" onclick="window.posUpdateQty(${index}, 1)">+</button>
                </td>
                <td>$${(item.cantidad * item.precio_unitario).toLocaleString('es-AR')}</td>
                <td>
                    <button class="btn-remove" onclick="window.posRemoveItem(${index})">×</button>
                </td>
            </tr>
        `}).join('');
    }

    const total = cart.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
    const formattedTotal = `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    subtotalEl.textContent = formattedTotal;
    totalEl.textContent = formattedTotal;
}

window.posUpdateQty = (index, delta) => {
    cart[index].cantidad += delta;
    if (cart[index].cantidad <= 0) {
        cart.splice(index, 1);
    }
    renderCart();
};

window.posRemoveItem = (index) => {
    cart.splice(index, 1);
    renderCart();
};

function setupEventListeners() {
    // Clear cart
    document.getElementById('pos-clear-cart').onclick = () => {
        if (cart.length > 0 && confirm("¿Vaciar el carrito?")) {
            cart = [];
            renderCart();
        }
    };

    // Payments
    const payMp = document.getElementById('pos-pay-mp');
    if (payMp) payMp.onclick = () => finalizarVenta('MP');

    const payPoint = document.getElementById('pos-pay-point');
    if (payPoint) payPoint.onclick = () => cobrarConPoint();

    const payCash = document.getElementById('pos-pay-cash');
    if (payCash) payCash.onclick = () => finalizarVenta('Efectivo');

    const payOther = document.getElementById('pos-pay-other');
    if (payOther) {
        payOther.onclick = () => {
            if (cart.length === 0) return mostrarNotificacion("El carrito está vacío", "info");
            const modal = document.getElementById('pos-payment-modal');
            if (modal) modal.style.display = 'block';
        };
    }

    const modalCancel = document.getElementById('pos-modal-cancel');
    if (modalCancel) {
        modalCancel.onclick = () => {
            const modal = document.getElementById('pos-payment-modal');
            if (modal) modal.style.display = 'none';
        };
    }

    const modalConfirm = document.getElementById('pos-modal-confirm');
    if (modalConfirm) {
        modalConfirm.onclick = () => {
            const methodEl = document.getElementById('pos-modal-payment-method');
            const method = methodEl ? methodEl.value : 'Otros';
            finalizarVenta(method);
            const modal = document.getElementById('pos-payment-modal');
            if (modal) modal.style.display = 'none';
        };
    }
}

async function finalizarVenta(metodo, mpData = null) {
    if (cart.length === 0) return mostrarNotificacion("Añade productos a la venta", "info");

    if (!appState.cajaSesionIdActiva) {
        return mostrarNotificacion("No puedes vender con la caja cerrada", "error");
    }

    const payload = {
        cliente_id: document.getElementById('pos-cliente-selector').value || null,
        metodo_pago: metodo,
        detalles: cart.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario
        }))
    };

    // Si viene de MP Point, guardamos los IDs de referencia
    if (mpData) {
        payload.mp_payment_intent_id = mpData.id;
        payload.mp_status = mpData.status;
    }

    try {
        const res = await sendData(`/api/negocios/${appState.negocioActivoId}/ventas`, payload);
        mostrarNotificacion("¡Venta Exitosa!", "success");
        cart = [];
        renderCart();
        // Recargar productos
        cargarTodosLosProductos();
    } catch (error) {
        console.error("Error al finalizar venta:", error);
        mostrarNotificacion(error.error || "Error al procesar la venta", "error");
    }
}

async function cobrarConPoint() {
    if (cart.length === 0) return mostrarNotificacion("El carrito está vacío", "info");

    const total = cart.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);

    mostrarNotificacion("Iniciando cobro con Mercado Pago Point...", "info");

    try {
        // 1. Intentar crear intención de pago (Flujo Producción/Smart)
        let intent;
        try {
            intent = await sendData(`/api/negocios/${appState.negocioActivoId}/mp/create-intent`, {
                amount: total,
                description: `Venta Baboons #${Date.now()}`,
                silent: true
            });
        } catch (error) {
            // Si el error es por configuración incompleta, lanzamos un error específico para el catch externo
            if (error.error && error.error.includes("incompleta")) {
                throw new Error("CONFIG_INCOMPLETA");
            }
            throw error;
        }

        if (intent.error) throw new Error(intent.error);

        // --- FLUJO REAL (Device ID Presente) ---
        const intentId = intent.id;
        mostrarNotificacion("Esperando cobro en el dispositivo...", "info", 10000);

        const checkStatus = async () => {
            try {
                const status = await fetchData(`/api/negocios/${appState.negocioActivoId}/mp/intent/${intentId}`);
                console.log("MP Intent Status:", status.status);

                if (status.status === 'FINISHED') {
                    mostrarNotificacion("¡Pago recibido con éxito!", "success");
                    await finalizarVenta('Mercado Pago Point', status);
                    return true;
                } else if (status.status === 'CANCELED' || status.status === 'ERROR') {
                    mostrarNotificacion("El cobro fue cancelado o falló", "error");
                    return true;
                }
                return false;
            } catch (e) {
                console.error("Error verificando status MP:", e);
                return false;
            }
        };

        const interval = setInterval(async () => {
            const finished = await checkStatus();
            if (finished) clearInterval(interval);
        }, 3000);

    } catch (error) {
        // 2. Si falla por falta de Device ID, entramos en MODO SIMULACIÓN automáticamente
        if (error.message === "CONFIG_INCOMPLETA") {
            console.log("Modo Simulación: No hay Device ID. Usando API de Órdenes...");
            mostrarNotificacion("Simulador: Creando orden de prueba...", "info");

            try {
                const order = await sendData(`/api/negocios/${appState.negocioActivoId}/mp/create-order`, {
                    amount: total,
                    external_reference: `TEST_${Date.now()}`
                });

                if (order.error) throw new Error(order.error);

                console.log("Orden MP Creada:", order);
                const orderId = order.id || order.order_id; // Intentar ambos por si acaso
                if (!orderId) throw new Error("Mercado Pago no devolvió un ID de orden válido");
                mostrarNotificacion("Simulador: Esperando simulación de pago (5s)...", "info", 5000);

                // Simular el evento automáticamente después de unos segundos
                setTimeout(async () => {
                    mostrarNotificacion("Simulador: Procesando pago ficticio...", "info");
                    await sendData(`/api/negocios/${appState.negocioActivoId}/mp/simulate-event`, {
                        order_id: orderId,
                        status: 'processed'
                    });
                }, 5000);

                // Polling para cerrar la venta
                let checkCount = 0;
                const interval = setInterval(async () => {
                    checkCount++;
                    if (checkCount > 4) { // Aproximadamente 12 segundos
                        clearInterval(interval);
                        mostrarNotificacion("¡Pago Simulado Exitoso!", "success");
                        await finalizarVenta('Mercado Pago Point (Test)', { id: orderId, status: 'FINISHED' });
                    }
                }, 3000);

            } catch (simError) {
                mostrarNotificacion("Error en simulador: " + simError.message, "error");
            }
            return;
        }

        mostrarNotificacion(error.message || "Error al conectar con Mercado Pago", "error");
    }
}

function actualizarInfoUsuario() {
    const user = JSON.parse(localStorage.getItem('user_baboons'));
    if (user) {
        document.getElementById('pos-user-name').textContent = user.nombre;
    }

    // Actualizar nombre del negocio
    if (appState.negocioActivo) {
        const brandEl = document.querySelector('.brand-text');
        if (brandEl) brandEl.textContent = appState.negocioActivo.nombre;
    }
}
