-- Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
);

-- Hoja de Ruta
CREATE TABLE IF NOT EXISTS hoja_ruta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    vendedor_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    estado TEXT DEFAULT 'borrador', -- borrador, activa, finalizada
    observaciones TEXT,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id),
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
);

CREATE TABLE IF NOT EXISTS hoja_ruta_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hoja_ruta_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    orden INTEGER,
    visitado BOOLEAN DEFAULT FALSE,
    observaciones TEXT,
    FOREIGN KEY (hoja_ruta_id) REFERENCES hoja_ruta(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Modules
INSERT INTO modules (code, name, category) VALUES 
('vendedores', 'Gestión Vendedores', 'Distribucion'),
('hoja_ruta', 'Hoja de Ruta', 'Distribucion'),
('mapa_clientes', 'Mapa de Clientes', 'Distribucion')
ON CONFLICT(code) DO NOTHING;

-- Permissions for Distribuidora
-- 1. Copy Retail permissions (Assuming Distribuidora is a superset or variant of Retail)
INSERT INTO type_permissions (business_type, module_code)
SELECT 'distribuidora', module_code FROM type_permissions WHERE business_type = 'retail'
ON CONFLICT DO NOTHING;

-- 2. Add specific permissions
INSERT INTO type_permissions (business_type, module_code) VALUES 
('distribuidora', 'vendedores'),
('distribuidora', 'hoja_ruta'),
('distribuidora', 'mapa_clientes')
ON CONFLICT DO NOTHING;
