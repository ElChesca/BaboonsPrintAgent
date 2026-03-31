-- Migración: Añadir columna 'activo' a la tabla clientes para baja lógica
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Asegurar que todos los clientes actuales queden activos
UPDATE clientes SET activo = TRUE WHERE activo IS NULL;
