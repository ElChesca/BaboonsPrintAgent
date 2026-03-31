-- Migración: Setup Completo para Módulo Restó (Carta, Staff y Permisos)

-- 1. Categorías del Menú (Entradas, Pastas, Minutas, Bebidas, etc.)
CREATE TABLE IF NOT EXISTS menu_categorias (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

-- 2. Items de la Carta (Los platos/bebidas reales)
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES menu_categorias(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    imagen_url TEXT,
    disponible BOOLEAN DEFAULT TRUE,
    stock_control BOOLEAN DEFAULT FALSE, -- Si descuenta stock de la tabla de productos general
    producto_id INTEGER NULL REFERENCES productos(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Especialización de Staff Gastronómico
-- Añadimos la columna a la tabla empleados y vendedores para compatibilidad con módulos existentes.
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS especialidad_resto VARCHAR(50);
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS especialidad_resto VARCHAR(50);
-- Valores previstos: 'mozo', 'cocinero', 'bachero', 'adicionista', 'barman'

-- 4. Registro de Nuevos Módulos
INSERT INTO modules (code, name, category) VALUES 
('resto_menu', 'Gestión de Carta', 'Resto'),
('resto_mozo', 'Mozo / Salón', 'Resto'),
('resto_cocina', 'Cocina / Comandas', 'Resto')
ON CONFLICT(code) DO NOTHING;

-- 5. Mapeo de Permisos para Negocios de tipo 'resto'
INSERT INTO type_permissions (business_type, module_code) VALUES 
('resto', 'home_resto'),
('resto', 'mesas'),
('resto', 'resto_menu'),
('resto', 'resto_mozo'),
('resto', 'resto_cocina'),
('resto', 'mozos'),
('resto', 'caja'),
('resto', 'configuracion'),
('resto', 'usuarios')
ON CONFLICT DO NOTHING;
