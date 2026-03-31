-- 2026_03_31_0900_add_numero_to_presupuestos.sql
-- ✨ Ref. Solicitud Usuario: Numeración Secuencial por Negocio

DO $$ 
BEGIN 
    -- 1. Añadir la columna numero si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'presupuestos' 
                   AND column_name = 'numero') THEN
        ALTER TABLE presupuestos ADD COLUMN numero INTEGER;

        -- 2. Poblar retroactivamente la secuencia por negocio
        WITH Secuenciador AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY id) as nro
            FROM presupuestos
        )
        UPDATE presupuestos p
        SET numero = s.nro
        FROM Secuenciador s
        WHERE p.id = s.id;

        -- 3. Asegurar que no sea nulo en el futuro (opcional, pero buena práctica)
        -- ALTER TABLE presupuestos ALTER COLUMN numero SET NOT NULL;
    END IF;
END $$;
