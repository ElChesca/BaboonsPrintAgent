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
    if (cantidad > producto.stock) {
        return { success: false, message: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
    }
    
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

/** Guarda la lista de todos los productos en una caché local. */
export function setProductosCache(productos) {
    productosVentaCache = productos;
}

/** Busca productos en la caché por nombre. */
export function findProductoInCache(query) {
    if (query.length < 2) return [];
    return productosVentaCache.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()));
}