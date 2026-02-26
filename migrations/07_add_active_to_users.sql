-- Migración: Añadir columna 'activo' a la tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Asegurar que todos los usuarios actuales estén activos
UPDATE usuarios SET activo = TRUE WHERE activo IS NULL;
