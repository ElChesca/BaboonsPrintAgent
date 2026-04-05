-- Migración: Módulo de Orden de Compra (OC)
-- Objetivo: Permitir la creación de pedidos a proveedores y su posterior vinculación con ingresos.

-- 1. Tabla Maestra de Órdenes de Compra
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    numero_oc VARCHAR(50), -- Ej: OC-0001
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'abierta', -- abierta, recibida, cancelada
    total_estimado DECIMAL(12,2) DEFAULT 0,
    observaciones TEXT,
    CONSTRAINT unique_oc_por_negocio UNIQUE(negocio_id, numero_oc)
);

-- 2. Detalle de la Orden de Compra
CREATE TABLE IF NOT EXISTS ordenes_compra_detalle (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad DECIMAL(12,2) NOT NULL,
    precio_costo_actual DECIMAL(12,2) DEFAULT 0, -- Precio al momento de la orden
    subtotal DECIMAL(12,2) DEFAULT 0
);

-- 3. Vincular Ingreso con OC (Para trazabilidad)
ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS orden_compra_id INTEGER REFERENCES ordenes_compra(id);

-- 4. Registrar Módulo
INSERT INTO modules (code, name, category) VALUES 
('ordenes_compra', 'Órdenes de Compra', 'Compras')
ON CONFLICT(code) DO NOTHING;

-- 5. Asignar Permisos a los tipos de negocio
INSERT INTO type_permissions (business_type, module_code)
SELECT DISTINCT business_type, 'ordenes_compra'
FROM type_permissions
WHERE business_type IN ('retail', 'distribuidora', 'resto')
ON CONFLICT DO NOTHING;
