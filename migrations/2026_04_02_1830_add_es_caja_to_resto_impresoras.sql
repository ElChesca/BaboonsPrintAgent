-- UP: Agregar columna es_caja a resto_impresoras
-- Esta columna identifica cuál impresora se usa para tickets de cuenta/caja.

ALTER TABLE resto_impresoras ADD COLUMN IF NOT EXISTS es_caja BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN resto_impresoras.es_caja IS 'Indica si la impresora se utiliza para emitir pre-cuentas o tickets de caja.';

-- DOWN: Reversión (Rollback)
-- ALTER TABLE resto_impresoras DROP COLUMN IF EXISTS es_caja;
