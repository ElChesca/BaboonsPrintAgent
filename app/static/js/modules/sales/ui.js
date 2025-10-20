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

        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${item.nombre}</td>
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

    resultados.forEach(producto => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'search-item';
        
        // Usamos el precio_venta que ya viene calculado
        itemDiv.innerHTML = `
            <span>${producto.nombre}</span> 
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

export function actualizarTotalFinal() {
    const subtotal = state.calculateTotal();
    const descuento = parseFloat(document.getElementById('descuento-extra').value) || 0;
    const envio = parseFloat(document.getElementById('gastos-envio').value) || 0;
    
    const totalFinal = subtotal - descuento + envio;
    
    const totalEl = document.getElementById('venta-total');
    if (totalEl) {
        totalEl.textContent = formatCurrency(totalFinal);
    }
}