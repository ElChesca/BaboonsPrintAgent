-- Tabla para almacenar el catálogo de módulos (apps) disponibles en el sistema
CREATE TABLE IF NOT EXISTS modules (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) -- Retail, Consorcio, Rental, Comun, etc.
);

-- Tabla para almacenar qué módulos están habilitados para cada tipo de negocio
CREATE TABLE IF NOT EXISTS type_permissions (
    business_type VARCHAR(50) NOT NULL, -- retail, consorcio, rentals
    module_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (business_type, module_code),
    FOREIGN KEY (module_code) REFERENCES modules(code)
);

-- Insertar Módulos Base (Extraídos de main.js)
-- RETAIL
INSERT INTO modules (code, name, category) VALUES 
('home_retail', 'Inicio Retail', 'Retail'),
('ventas', 'Punto de Venta', 'Retail'),
('historial_ventas', 'Historial Ventas', 'Retail'),
('historial_presupuestos', 'Historial Presupuestos', 'Retail'),
('reportes', 'Reportes Generales', 'Retail'),
('reporte_caja', 'Reporte Caja', 'Retail'),
('reporte_ganancias', 'Reporte Ganancias', 'Retail'),
('historial_inventario', 'Historial Inventario', 'Retail'),
('inventario', 'Inventario', 'Retail'),
('clientes', 'Clientes', 'Retail'),
('dashboard', 'Dashboard', 'Retail'),
('caja', 'Caja', 'Retail'),
('factura', 'Facturación', 'Retail'),
('verificador', 'Verificador Precios', 'Retail'),
('historial_ingresos', 'Historial Ingresos', 'Retail'),
('ingresos', 'Ingresos Varios', 'Retail'),
('historial_ajustes', 'Historial Ajustes', 'Retail'),
('ajuste_caja', 'Ajuste Caja', 'Retail'),
('presupuestos', 'Presupuestos', 'Retail'),
('inventario_movil', 'Inventario Móvil', 'Retail'),
('proveedores', 'Proveedores', 'Retail'),
('payments', 'Pagos Proveedores', 'Retail'),
('historial_pagos_proveedores', 'Historial Pagos Prov.', 'Retail'),
('listas_precios', 'Listas de Precios', 'Retail'),
('precios_especificos', 'Precios Específicos', 'Retail'),
('gastos', 'Gastos', 'Retail'),
('gastos_categorias', 'Categorías Gastos', 'Retail'),
('categorias', 'Categorías Productos', 'Retail'),
('unidades_medida', 'Unidades Medida', 'Retail'),
('club_puntos', 'Club de Puntos', 'Retail'),
('club_gestion', 'Gestión Club', 'Retail'),
('club_admin', 'Admin Club', 'Retail'),
('crm_social', 'CRM Social', 'Retail')
ON CONFLICT(code) DO NOTHING;

-- CONSORCIO
INSERT INTO modules (code, name, category) VALUES 
('home_consorcio', 'Inicio Consorcio', 'Consorcio'),
('reclamos', 'Reclamos', 'Consorcio'),
('expensas', 'Expensas', 'Consorcio'),
('unidades', 'Unidades Funcionales', 'Consorcio'),
('noticias', 'Noticias', 'Consorcio')
ON CONFLICT(code) DO NOTHING;

-- RENTALS
INSERT INTO modules (code, name, category) VALUES 
('rentals_dashboard', 'Dashboard Alquileres', 'Rental'),
('rentals_units', 'Unidades Alquiler', 'Rental'),
('rentals_contracts', 'Contratos Alquiler', 'Rental')
ON CONFLICT(code) DO NOTHING;

-- COMUN (Configuración)
INSERT INTO modules (code, name, category) VALUES 
('configuracion', 'Configuración', 'Comun'),
('usuarios', 'Gestión Usuarios', 'Comun'),
('negocios', 'Gestión Negocios', 'Comun')
ON CONFLICT(code) DO NOTHING;


-- Insertar Permisos Iniciales (Mapeo 1:1 con APP_RUTAS actual)
-- RETAIL
INSERT INTO type_permissions (business_type, module_code)
SELECT 'retail', code FROM modules WHERE category = 'Retail'
ON CONFLICT DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
SELECT 'retail', code FROM modules WHERE category = 'Comun'
ON CONFLICT DO NOTHING;

-- CONSORCIO
INSERT INTO type_permissions (business_type, module_code)
SELECT 'consorcio', code FROM modules WHERE category = 'Consorcio'
ON CONFLICT DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
SELECT 'consorcio', code FROM modules WHERE category = 'Comun'
ON CONFLICT DO NOTHING;

-- RENTALS
INSERT INTO type_permissions (business_type, module_code)
SELECT 'rentals', code FROM modules WHERE category = 'Rental'
ON CONFLICT DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
SELECT 'rentals', code FROM modules WHERE category = 'Comun'
ON CONFLICT DO NOTHING;
