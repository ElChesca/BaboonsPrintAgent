-- Tabla de Pedidos (Específica para Distribución / Preventa)
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    vendedor_id INTEGER REFERENCES usuarios(id),
    hoja_ruta_id INTEGER REFERENCES hoja_ruta(id) ON DELETE SET NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado TEXT DEFAULT 'pendiente', -- pendiente, preparado, entregado, anulado
    total NUMERIC(10, 2) DEFAULT 0,
    observaciones TEXT,
    venta_id INTEGER REFERENCES ventas(id) -- Si se convierte a venta real
);

CREATE TABLE IF NOT EXISTS pedidos_detalle (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad NUMERIC(10, 2) NOT NULL,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- Registrar el nuevo módulo
INSERT INTO modules (code, name, category) VALUES 
('pedidos', 'Pedidos / Preventa', 'Distribucion')
ON CONFLICT (code) DO NOTHING;

-- Darle permisos por defecto a las distribuidoras
INSERT INTO type_permissions (business_type, module_code) VALUES 
('distribuidora', 'pedidos')
ON CONFLICT DO NOTHING;
