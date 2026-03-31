-- Migración Fase 2: Pedidos por Mesa y Comandas
-- 1. Modificar tabla pedidos para asociar a mesas
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mesa_id INTEGER REFERENCES mesas(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS num_comensales INTEGER DEFAULT 1;

-- 2. Modificar tabla pedidos_detalle para asociar a items de carta y manejar estados de preparación
ALTER TABLE pedidos_detalle ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menu_items(id);
ALTER TABLE pedidos_detalle ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente'; -- pendiente, en_preparacion, listo, entregado

-- 3. Asegurar que los productos puedan ser nulos en pedidos_detalle si es un item de carta que no está en inventario
ALTER TABLE pedidos_detalle ALTER COLUMN producto_id DROP NOT NULL;

-- 4. Notificaciones para mozos (Opcional por ahora, pero útil para Fase 3)
CREATE TABLE IF NOT EXISTS resto_notificaciones (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    detalle_id INTEGER REFERENCES pedidos_detalle(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
