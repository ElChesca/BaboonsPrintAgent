-- =============================================================================
-- MIGRACIÓN: Soporte para Pagos Mixtos a Proveedores
-- Crea la tabla de detalles para desglosar múltiples métodos de pago en un solo pago.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_proveedores_detalles (
    id                  SERIAL PRIMARY KEY,
    pago_proveedor_id   INTEGER NOT NULL REFERENCES pagos_proveedores(id) ON DELETE CASCADE,
    metodo_pago         VARCHAR(30) NOT NULL, -- Efectivo, Transferencia, Cheque Tercero, Cheque Propio
    monto               NUMERIC(12, 2) NOT NULL,
    
    -- Información extra según el método
    banco               VARCHAR(100),
    referencia          VARCHAR(100), -- Nro Transacción o Nro Cheque
    cheque_id           INTEGER,      -- FK a tabla cheques (si aplica)
    
    fecha_registro      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppd_pago_id ON pagos_proveedores_detalles(pago_proveedor_id);

-- Comentario: No eliminamos las columnas metodo_pago y referencia de pagos_proveedores 
-- inmediatamente para mantener compatibilidad con registros históricos, 
-- pero las nuevas registraciones usarán esta tabla de detalles.
