-- 📅 2026-04-06 11:00: Corregir tabla de suscripciones_pagos
-- Asegurar que existan las columnas para el registro de auditoría de pagos

-- 1. Agregar columnas si no existen (Idempotente)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suscripciones_pagos' AND column_name='registrado_por') THEN
        ALTER TABLE suscripciones_pagos ADD COLUMN registrado_por TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suscripciones_pagos' AND column_name='fecha_registro') THEN
        ALTER TABLE suscripciones_pagos ADD COLUMN fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suscripciones_pagos' AND column_name='monto') THEN
        ALTER TABLE suscripciones_pagos ADD COLUMN monto NUMERIC DEFAULT 0;
    END IF;
END $$;

COMMENT ON COLUMN suscripciones_pagos.registrado_por IS 'Nombre del superadmin que registró el pago';

/* 
-- ⏪ ROLLBACK:
ALTER TABLE suscripciones_pagos DROP COLUMN IF EXISTS registrado_por;
ALTER TABLE suscripciones_pagos DROP COLUMN IF EXISTS fecha_registro;
ALTER TABLE suscripciones_pagos DROP COLUMN IF EXISTS monto;
*/
