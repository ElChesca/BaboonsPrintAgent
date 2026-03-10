-- ======================================================
-- MIGRACIÓN: Tabla notas_credito para anulaciones de ventas directas
-- Ejecutar una sola vez en la base de datos de producción
-- ======================================================

CREATE TABLE IF NOT EXISTS notas_credito (
    id          SERIAL PRIMARY KEY,
    venta_id    INTEGER NOT NULL REFERENCES ventas(id),
    negocio_id  INTEGER NOT NULL,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo      TEXT,
    total       NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notas_credito_negocio ON notas_credito(negocio_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_venta   ON notas_credito(venta_id);

-- Verificar que la columna 'estado' existe en ventas (debería ya existir)
-- Si no existe, ejecutar:
-- ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'Pendiente';

-- Verificar que la tabla clientes_cuenta_corriente tiene columna venta_id
-- Si no existe, ejecutar:
-- ALTER TABLE clientes_cuenta_corriente ADD COLUMN IF NOT EXISTS venta_id INTEGER;
