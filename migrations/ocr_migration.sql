-- Migración: OCR Facturas (compras_facturas)
CREATE TABLE IF NOT EXISTS compras_facturas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    cuit_emisor VARCHAR(20),
    punto_venta VARCHAR(10),
    numero_comprobante VARCHAR(20),
    fecha_emision DATE,
    monto_total DECIMAL(12,2),
    data_json JSONB, -- Guardamos el objeto completo de Google Document AI
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_comprobante_cuit UNIQUE(cuit_emisor, punto_venta, numero_comprobante)
);
