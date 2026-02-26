-- Add Empleados module
INSERT INTO modules (code, name, category)
VALUES ('empleados', 'Gestión Empleados', 'Administración')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions for Distributors (and Retail if needed)
-- Assuming 'distribuidora' needs access to employees (drivers, sellers)
INSERT INTO type_permissions (business_type, module_code)
VALUES 
    ('distribuidora', 'empleados'),
    ('retail', 'empleados') -- Assuming retail also has employees
ON CONFLICT (business_type, module_code) DO NOTHING;

-- Ensure Logistica permissions (just in case)
INSERT INTO type_permissions (business_type, module_code)
VALUES 
    ('distribuidora', 'logistica')
ON CONFLICT (business_type, module_code) DO NOTHING;
