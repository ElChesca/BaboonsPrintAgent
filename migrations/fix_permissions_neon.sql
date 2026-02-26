-- Script de Reparación de Permisos para Neon DB
-- Ejecutar este script en la consola SQL de Neon

-- 1. Asegurar que los módulos existan
INSERT INTO modules (code, name, category) VALUES 
('rentals_dashboard', 'Dashboard Alquileres', 'Rental'),
('rentals_units', 'Unidades Alquiler', 'Rental'),
('rentals_contracts', 'Contratos Alquiler', 'Rental')
ON CONFLICT(code) DO NOTHING;

-- 2. Insertar permisos para 'rentals' (plural)
INSERT INTO type_permissions (business_type, module_code)
SELECT 'rentals', code FROM modules WHERE category = 'Rental'
ON CONFLICT DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
SELECT 'rentals', code FROM modules WHERE category = 'Comun'
ON CONFLICT DO NOTHING;

-- 3. Insertar permisos para 'rental' (singular) - POR SI ACASO
-- Esto cubrirá el caso donde el negocio esté registrado como 'rental' en la tabla negocios
INSERT INTO type_permissions (business_type, module_code)
SELECT 'rental', code FROM modules WHERE category = 'Rental'
ON CONFLICT DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
SELECT 'rental', code FROM modules WHERE category = 'Comun'
ON CONFLICT DO NOTHING;

-- 4. Verificar configuración actual (Opcional, para debug visual)
SELECT * FROM type_permissions WHERE business_type LIKE 'rental%';
