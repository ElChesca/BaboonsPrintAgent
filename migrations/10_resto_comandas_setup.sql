-- Migración: Tabla de Comandas para Restó (Separado de Pedidos Distribución)

-- 1. Tabla Principal de Comandas
CREATE TABLE IF NOT EXISTS comandas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    mesa_id INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    mozo_id INTEGER NOT NULL REFERENCES vendedores(id),
    num_comensales INTEGER DEFAULT 1,
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'abierta', -- abierta, cerrada, anulada
    total DECIMAL(12, 2) DEFAULT 0.00,
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    venta_id INTEGER -- Referencia opcional a la venta final en el ERP
);

-- 2. Detalle de Comandas
CREATE TABLE IF NOT EXISTS comandas_detalle (
    id SERIAL PRIMARY KEY,
    comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    cantidad DECIMAL(10, 2) NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(12, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, cocinando, listo, entregado
    notas TEXT,
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Actualizar la tabla mesas para referenciar la comanda_id en lugar de pedido_id
-- Primero borramos la columna si existía de pruebas previas o simplemente la ignoramos.
-- Para limpieza, nos aseguramos que mesa tenga una columna comanda_id.
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS comanda_id INTEGER REFERENCES comandas(id) ON DELETE SET NULL;
