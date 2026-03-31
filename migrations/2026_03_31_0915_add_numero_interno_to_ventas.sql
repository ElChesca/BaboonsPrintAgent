-- 2026_03_31_0915_add_numero_interno_to_ventas.sql
-- ✨ Ref. Solicitud Usuario: Numeración Secuencial por Negocio para Ventas

DO $$ 
BEGIN 
    -- 1. Añadir la columna numero_interno si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' 
                   AND column_name = 'numero_interno') THEN
        ALTER TABLE ventas ADD COLUMN numero_interno INTEGER;

        -- 2. Poblar retroactivamente la secuencia por negocio
        WITH Secuenciador AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY id) as nro
            FROM ventas
        )
        UPDATE ventas v
        SET numero_interno = s.nro
        FROM Secuenciador s
        WHERE v.id = s.id;

    END IF;
END $$;
