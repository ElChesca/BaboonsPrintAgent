-- 2026_03_31_0830_add_descuento_fijo_to_presupuestos.sql
-- ✨ Ref. Solicitud Usuario: Descuentos en Pesos y Porcentaje

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'presupuestos' 
                   AND column_name = 'descuento_fijo') THEN
        ALTER TABLE presupuestos ADD COLUMN descuento_fijo DECIMAL(15,2) DEFAULT 0;
    END IF;
END $$;
