// El estado (los datos) de la venta actual.
let stagedSaleItems = [];
let productosVentaCache = [];

/**
 * Añade un item a la venta actual. Si ya existe, incrementa la cantidad.
 * @param {object} producto - El producto a añadir.
 * @param {number} cantidad - La cantidad a añadir.
 * @returns {object} - Un objeto con { success: true } o { success: false, message: '...' }.
 * @param {object} precios - Un objeto { producto_id: nuevo_precio, ... }
 * 
 */
export function addItem(producto, cantidad) {
    // La validación de stock se queda igual
    if (cantidad > producto.stock) {
        return { success: false, message: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
    }
    
    // El ID del producto ahora es 'producto.id'
    const existingItem = stagedSaleItems.find(item => item.producto_id === producto.id);
    
   if (existingItem) {
        existingItem.cantidad += cantidad;
    } else {
        stagedSaleItems.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku || '-',
            cantidad: cantidad,
            precio_original: parseFloat(producto.precio_original), // Guardamos el original
            precio_unitario: parseFloat(producto.precio_final)   // Este es el precio final con descuento
        });
    }
    return { success: true };
}

export function updateItemPrices(precios) {
    stagedSaleItems.forEach(item => {
        if (precios[item.producto_id] !== undefined) {
            // El backend ahora nos envía un objeto
            item.precio_original = parseFloat(precios[item.producto_id].precio_original);
            item.precio_unitario = parseFloat(precios[item.producto_id].precio_final);
        }
    });
}
/**
 * Elimina un item de la venta por su índice en el array.
 * @param {number} index - El índice del item a eliminar.
 */
export function removeItem(index) {
    stagedSaleItems.splice(index, 1);
}

/** Limpia la venta actual. */
export function clearSale() {
    stagedSaleItems = [];
}

/** Devuelve la lista de items de la venta actual. */
export function getSaleItems() {
    return stagedSaleItems;
}

/** Calcula y devuelve el total de la venta actual. */
export function calculateTotal() {
    return stagedSaleItems.reduce((total, item) => total + (item.cantidad * item.precio_unitario), 0);
}

