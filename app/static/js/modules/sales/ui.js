const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

/** Dibuja la tabla de items de la venta. */
export function renderSaleItemsTable(items, total) {
    const tbody = document.querySelector('#staged-items-venta tbody');
    const totalEl = document.getElementById('venta-total');
    if (!tbody || !totalEl) return;

    tbody.innerHTML = '';
    items.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio_unitario;
        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio_unitario)}</td>
                <td>${formatCurrency(subtotal)}</td>
                <td><button type="button" class="btn-quitar">Quitar</button></td>
            </tr>
        `;
    });
    totalEl.textContent = formatCurrency(total);
}

/** Dibuja la grilla de acceso rápido (POS). */
export function renderPosGrid(productos, callback) {
    const gridContainer = document.getElementById('pos-grid-container');
    if (!gridContainer) return;
    
    gridContainer.innerHTML = '';
    productos.forEach(prod => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'pos-item';
        itemDiv.dataset.productId = prod.id; // Guardamos el ID para el callback
        itemDiv.innerHTML = `
            <span class="pos-item-name">${prod.nombre}</span>
            <span class="pos-item-price">${formatCurrency(prod.precio_venta)}</span>
        `;
        itemDiv.addEventListener('click', () => callback(prod.id));
        gridContainer.appendChild(itemDiv);
    });
}

/** Dibuja los resultados de la búsqueda. */
export function renderSearchResults(resultados, callback) {
    const searchResultsEl = document.getElementById('search-results-venta');
    searchResultsEl.innerHTML = '';
    resultados.forEach(p => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'search-item';
        itemDiv.innerHTML = `<span>${p.nombre}</span> <span class="stock">Stock: ${p.stock} | Precio: ${formatCurrency(p.precio_venta)}</span>`;
        itemDiv.addEventListener('click', () => {
            callback(p.nombre);
            searchResultsEl.innerHTML = '';
            searchResultsEl.style.display = 'none';
        });
        searchResultsEl.appendChild(itemDiv);
    });
    searchResultsEl.style.display = resultados.length > 0 ? 'block' : 'none';
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