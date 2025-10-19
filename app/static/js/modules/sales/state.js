// El estado (los datos) de la venta actual.
let stagedSaleItems = [];
let productosVentaCache = [];

/**
 * Añade un item a la venta actual. Si ya existe, incrementa la cantidad.
 * @param {object} producto - El producto a añadir.
 * @param {number} cantidad - La cantidad a añadir.
 * @returns {object} - Un objeto con { success: true } o { success: false, message: '...' }.
 */
export function addItem(producto, cantidad) {
    // La validación de stock se queda igual
    if (cantidad > producto.stock) {
        return { success: false, message: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
    }
    
    // El ID del producto ahora es 'producto.id'
    const existingItem = stagedSaleItems.find(item => item.producto_id === producto.id);
    
    if (existingItem) {
        if (existingItem.cantidad + cantidad > producto.stock) {
            return { success: false, message: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
        }
        existingItem.cantidad += cantidad;
    } else {
        stagedSaleItems.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            cantidad: cantidad,
            // ✨ Usamos el precio_venta que viene del objeto, que es el precio ya calculado ✨
            precio_unitario: parseFloat(producto.precio_venta)
        });
    }
    return { success: true };
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

