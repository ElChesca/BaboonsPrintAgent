import * as state from './state.js';
import { mostrarNotificacion } from '../notifications.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

/** Dibuja la tabla de items de la venta. */
export function renderSaleItemsTable(items, total) {
    const tbody = document.querySelector('#staged-items-venta tbody');
    const totalEl = document.getElementById('venta-total');
    if (!tbody || !totalEl) return;

    tbody.innerHTML = '';
    items.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio_unitario;
        // Calculamos el descuento total para esta línea de producto
        const descuentoTotalItem = (item.precio_original - item.precio_unitario) * item.cantidad;

        // Usamos el alias si existe, si no, el nombre
        const nombreDisplay = item.alias || item.nombre;

        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${nombreDisplay} <small style="color: grey; display: block;">SKU: ${item.sku}</small></td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio_unitario)}</td>
                <td>${descuentoTotalItem > 0 ? formatCurrency(descuentoTotalItem) : '-'}</td>
                <td>${formatCurrency(subtotal)}</td>
                <td><button type="button" class="btn-quitar">Quitar</button></td>
            </tr>
        `;
    });
    //totalEl.textContent = formatCurrency(total);
    actualizarTotalFinal();
}

/** Dibuja la grilla de acceso rápido (ELIMINADO) */
// renderPosGrid eliminado por solicitud de refactorización.

/** Dibuja los resultados de la búsqueda. */
export function renderSearchResults(resultados, callback) {
    const searchResultsEl = document.getElementById('search-results-venta');
    searchResultsEl.innerHTML = '';

    resultados.forEach(producto => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'search-item';

        // Mostramos el alias si existe, si no, el nombre
        const nombreDisplay = producto.alias || producto.nombre;
        itemDiv.innerHTML = `
            <span>${nombreDisplay}</span>
            <span class="stock">Stock: ${producto.stock} | ${formatCurrency(producto.precio_venta)}</span>
        `;

        itemDiv.addEventListener('click', () => {
            callback(producto); // Pasamos el objeto completo
            searchResultsEl.innerHTML = '';
            searchResultsEl.style.display = 'none';
        });
        searchResultsEl.appendChild(itemDiv);
    });

    // Simplemente mostramos u ocultamos el contenedor
    searchResultsEl.style.display = resultados.length > 0 ? 'block' : 'none';
}

/** Dibuja los resultados de búsqueda de clientes en el modal. */
export function renderClientSearchResults(clientes, onSelect) {
    const resultsContainer = document.getElementById('resultados-busqueda-clientes');
    if (!resultsContainer) return;

    if (clientes.length === 0) {
        resultsContainer.innerHTML = '<div class="search-placeholder">No se encontraron clientes.</div>';
        return;
    }

    resultsContainer.innerHTML = clientes.map(c => `
        <div class="result-item-cliente" data-id="${c.id}">
            <span class="name">${c.nombre}</span>
            <span class="sub">${c.dni ? 'DNI: ' + c.dni : 'Sin DNI'} | ${c.direccion || 'Sin dirección'}</span>
        </div>
    `).join('');

    // Listener para selección técnica (delegación)
    resultsContainer.querySelectorAll('.result-item-cliente').forEach(div => {
        div.onclick = () => {
            const id = div.dataset.id;
            const cliente = clientes.find(item => item.id == id);
            onSelect(cliente);
        };
    });
}

/** Actualiza el display de vuelto. */
export function updateVueltoDisplay(pagaCon, total) {
    const vueltoMontoEl = document.getElementById('vuelto-monto');
    if (!vueltoMontoEl) return;

    if (total === 0) {
        vueltoMontoEl.textContent = formatCurrency(0);
        vueltoMontoEl.style.color = '#333';
        return;
    }
    const vuelto = pagaCon - total;
    if (pagaCon === 0) {
        vueltoMontoEl.textContent = formatCurrency(0);
        vueltoMontoEl.style.color = '#333';
    } else if (vuelto >= 0) {
        vueltoMontoEl.textContent = formatCurrency(vuelto);
        vueltoMontoEl.style.color = '#28a745';
    } else {
        vueltoMontoEl.textContent = `Faltan ${formatCurrency(Math.abs(vuelto))}`;
        vueltoMontoEl.style.color = '#dc3545';
    }
}

/** Limpia los formularios y resetea la UI a su estado inicial. */
export function resetSaleUI() {
    document.getElementById('form-add-item-venta').reset();
    document.getElementById('form-finalize-venta').reset();
    document.getElementById('paga-con-input').value = '';
    document.getElementById('bonificacion-global').value = '';
    document.getElementById('descuento-extra').value = '';
    document.getElementById('gastos-envio').value = '';
    document.getElementById('venta-item-cantidad').value = '1';
    document.querySelector('#metodo-pago-selector').dispatchEvent(new Event('change'));
}

/** Habilita o deshabilita los botones de finalizar venta. */
export function toggleFinalizeButtons(isProcessing) {
    const btnFinalizar = document.getElementById('btn-finalize-sale');
    const btnImprimir = document.getElementById('btn-finalize-and-print');

    btnFinalizar.disabled = isProcessing;
    btnImprimir.disabled = isProcessing;
    btnFinalizar.textContent = isProcessing ? 'Procesando...' : 'Cobrar';
    btnImprimir.textContent = isProcessing ? 'Procesando...' : 'Cobrar e Imprimir';
}

export function actualizarTotalFinal() {
    const subtotalItems = state.calculateTotal();

    // NUEVO RECUADRO: Total SKUs, Unidades, Subtotal
    const items = state.getSaleItems();
    const cantidadSkus = items.length;
    const cantidadUnidades = items.reduce((sum, item) => sum + parseFloat(item.cantidad || 0), 0);

    const skusEl = document.getElementById('resumen-skus');
    const unidadesEl = document.getElementById('resumen-unidades');
    const subtotalEl = document.getElementById('resumen-subtotal-lineas');

    if (skusEl) skusEl.textContent = cantidadSkus;
    if (unidadesEl) unidadesEl.textContent = cantidadUnidades;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotalItems);

    // Obtener valores de los nuevos inputs
    const bonificacionPorcentaje = parseFloat(document.getElementById('bonificacion-global').value) || 0;
    const descuentoFijo = parseFloat(document.getElementById('descuento-extra').value) || 0;
    const envio = parseFloat(document.getElementById('gastos-envio').value) || 0;

    // Aplicar lógica: (Subtotal Items * (1 - %Bonif)) - $Desc + $Envio
    const subtotalConBonif = subtotalItems * (1 - (bonificacionPorcentaje / 100));
    const totalFinal = subtotalConBonif - descuentoFijo + envio;

    const totalEl = document.getElementById('venta-total');
    if (totalEl) {
        totalEl.textContent = formatCurrency(totalFinal);
    }

    // Si estamos en modo mixto, actualizar restante
    actualizarRestanteMixto(totalFinal);
}

/** Configura los listeners para el pago mixto */
export function setupMixPayments() {
    const selector = document.getElementById('metodo-pago-selector');
    const panelMixto = document.getElementById('panel-pago-mixto');
    const calculoVuelto = document.getElementById('calculo-vuelto-container');
    const inputsMixtos = document.querySelectorAll('.mixto-input');

    if (selector) {
        selector.addEventListener('change', (e) => {
            const clienteSelector = document.getElementById('cliente-selector');
            const clienteId = clienteSelector ? clienteSelector.value : null;

            if (e.target.value === 'Cuenta Corriente' && !clienteId) {
                e.target.value = 'Efectivo'; // Fallback immediately
                mostrarNotificacion('Debe seleccionar un cliente para usar Cuenta Corriente.', 'warning');
                return;
            }

            if (e.target.value === 'Mixto') {
                if (panelMixto) panelMixto.style.display = 'flex';
                if (calculoVuelto) calculoVuelto.style.display = 'none';
                actualizarTotalFinal(); // Para recalcular el restante
            } else if (e.target.value === 'Efectivo') {
                if (panelMixto) panelMixto.style.display = 'none';
                if (calculoVuelto) calculoVuelto.style.display = 'block';
            } else {
                if (panelMixto) panelMixto.style.display = 'none';
                if (calculoVuelto) calculoVuelto.style.display = 'none';
            }
        });
    }

    // Actualizar restante al tippear
    inputsMixtos.forEach(input => {
        input.addEventListener('input', () => {
            actualizarTotalFinal();
        });
    });
}

function actualizarRestanteMixto(totalFinal) {
    const selector = document.getElementById('metodo-pago-selector');
    if (selector && selector.value !== 'Mixto') return;

    const efectivo = parseFloat(document.getElementById('mixto-efectivo').value) || 0;
    const mp = parseFloat(document.getElementById('mixto-mp').value) || 0;

    const sumaFija = efectivo + mp;
    const restante = totalFinal - sumaFija;

    const restanteEl = document.getElementById('mixto-restante');
    if (restanteEl) {
        restanteEl.textContent = formatCurrency(Math.abs(restante));

        // Colores según estado del pago
        restanteEl.className = '';
        if (restante > 0) {
            restanteEl.classList.add('falta');
            restanteEl.previousElementSibling.textContent = 'A Cta Cte:';
        } else if (restante < 0) {
            restanteEl.classList.add('sobra');
            restanteEl.previousElementSibling.textContent = 'Sobran (Vuelto):';
        } else {
            restanteEl.classList.add('ok');
            restanteEl.previousElementSibling.textContent = 'A Cta Cte:';
        }
    }
}