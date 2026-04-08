-- migration: c:\Users\usuario\Documents\MultinegocioBaboons\migrations\20260407_add_compras_config.sql
-- creation: 2026-04-07
-- description: Adds compras_configuracion table

CREATE TABLE IF NOT EXISTS compras_configuracion (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id) ON DELETE CASCADE,
    razon_social TEXT,
    cuit TEXT,
    condicion_iva TEXT,
    domicilio TEXT,
    telefono TEXT,
    email TEXT,
    horarios_entrega TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE compras_configuracion IS 'Almacena datos fiscales y operativos exclusivos para el módulo de compras.';
