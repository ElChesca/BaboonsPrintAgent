import * as state from './state.js';
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
}