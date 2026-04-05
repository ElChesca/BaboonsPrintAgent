-- migrations/20240401_add_reserva_token.sql
-- IDEMPOTENTE: Añade token para el portal de reservas público.

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS reserva_token VARCHAR(100);

-- Crear índice único si no existe para asegurar que los tokens no se repitan
CREATE UNIQUE INDEX IF NOT EXISTS idx_negocios_reserva_token ON negocios(reserva_token);

COMMENT ON COLUMN negocios.reserva_token IS 'Token de acceso público para el portal de reservas del negocio.';

-- Nota: La población de datos para negocios existentes se manejará vía Python 
-- para asegurar compatibilidad entre SQLite y Postgres sin usar funciones de hash específicas.

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_negocios_reserva_token;
-- ALTER TABLE negocios DROP COLUMN IF EXISTS reserva_token;
