-- =============================================================================
-- MIGRACIÓN: CRM Meta (WhatsApp / Instagram / Facebook)
-- Fecha: 2026-04-10
-- Módulo: crm_meta
-- Descripción: Extiende crm_leads (tabla existente con datos) con los campos
--              necesarios para el CRM Meta, y crea crm_mensajes para el historial
--              de chat. NO se crea una tabla nueva crm_contactos para preservar
--              la integridad de los datos existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOQUE 1: Extender crm_leads con columnas del CRM Meta
-- Todas las columnas usan ADD COLUMN IF NOT EXISTS para ser idempotentes.
-- -----------------------------------------------------------------------------

-- Plataforma de origen del mensaje (whatsapp | instagram | facebook)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS plataforma_origen VARCHAR(32) NOT NULL DEFAULT 'whatsapp';

-- ID interno de WhatsApp del contacto (wa_id del payload de Meta)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS wa_id VARCHAR(32);

-- ID de contacto en Instagram (si aplica)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(64);

-- ID de contacto en Facebook (si aplica)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(64);

-- Flag de activo/baja lógica (complementa fecha_baja ya existente)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Timestamp de última actualización con zona horaria
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Columna de etiqueta de progresión CRM (nuevo, calificado, cerrado, etc.)
ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS etiqueta VARCHAR(64);

-- COMENTARIOS de documentación sobre las columnas nuevas
COMMENT ON COLUMN crm_leads.plataforma_origen IS 'Canal de origen del contacto: whatsapp | instagram | facebook';
COMMENT ON COLUMN crm_leads.wa_id             IS 'ID interno de WhatsApp del contacto (wa_id del payload de Meta)';
COMMENT ON COLUMN crm_leads.instagram_id      IS 'ID de usuario en Instagram (para mensajes IG)';
COMMENT ON COLUMN crm_leads.facebook_id       IS 'ID de usuario en Facebook (para mensajes FB)';
COMMENT ON COLUMN crm_leads.activo            IS 'TRUE = contacto activo. FALSE = baja lógica (complementa fecha_baja)';
COMMENT ON COLUMN crm_leads.actualizado_en    IS 'Timestamp de última modificación (con zona horaria)';
COMMENT ON COLUMN crm_leads.etiqueta          IS 'Etiqueta de progresión CRM: nuevo | calificado | en_seguimiento | cerrado';

-- Índices para las columnas frecuentemente filtradas
CREATE INDEX IF NOT EXISTS idx_crm_leads_plataforma  ON crm_leads (plataforma_origen);
CREATE INDEX IF NOT EXISTS idx_crm_leads_wa_id       ON crm_leads (wa_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_negocio_tel ON crm_leads (negocio_id, telefono);

-- -----------------------------------------------------------------------------
-- DEDUPLICACIÓN PREVIA AL CONSTRAINT DE UNICIDAD
-- -----------------------------------------------------------------------------
-- La columna plataforma_origen recién fue creada con DEFAULT 'whatsapp'.
-- Todos los registros existentes tienen ahora plataforma_origen = 'whatsapp'.
-- Si había teléfonos duplicados por negocio antes de esta migración,
-- el índice único fallará con SQLSTATE 23505.
--
-- Esta sentencia elimina los duplicados conservando SOLO el registro
-- con el mayor id (el más reciente) por cada grupo (negocio_id, telefono, plataforma_origen).
-- Los registros sin teléfono (NULL o vacío) se excluyen del constraint y no se tocan.
-- -----------------------------------------------------------------------------
DELETE FROM crm_leads
WHERE id NOT IN (
    SELECT MAX(id)
    FROM   crm_leads
    WHERE  NULLIF(TRIM(telefono), '') IS NOT NULL
    GROUP  BY negocio_id, telefono, plataforma_origen
)
AND NULLIF(TRIM(telefono), '') IS NOT NULL;

-- Constraint de unicidad por canal: solo aplica a registros con teléfono no nulo.
-- Se envuelve en DO $$ para ser idempotente (no falla si ya existe).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE  conname = 'crm_leads_negocio_tel_plataforma_uq'
    ) THEN
        ALTER TABLE crm_leads
            ADD CONSTRAINT crm_leads_negocio_tel_plataforma_uq
            UNIQUE (negocio_id, telefono, plataforma_origen);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 2: Tabla meta_configuraciones (credenciales por negocio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_configuraciones (
    id                SERIAL PRIMARY KEY,
    negocio_id        INTEGER NOT NULL,
    phone_number_id   VARCHAR(64) NOT NULL,
    access_token      TEXT NOT NULL,
    verify_token      VARCHAR(255) NOT NULL,
    waba_id           VARCHAR(64),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT meta_config_negocio_uq UNIQUE (negocio_id)
);

COMMENT ON TABLE  meta_configuraciones                 IS 'Credenciales de la API de Meta Business (WhatsApp/IG/FB) por negocio';
COMMENT ON COLUMN meta_configuraciones.negocio_id      IS 'FK al negocio dueño de estas credenciales';
COMMENT ON COLUMN meta_configuraciones.phone_number_id IS 'Phone Number ID de Meta (identifica al remitente del Webhook)';
COMMENT ON COLUMN meta_configuraciones.access_token    IS 'Access Token permanente de Meta Business API';
COMMENT ON COLUMN meta_configuraciones.verify_token    IS 'Token de verificación del Webhook (debe coincidir con el panel Meta)';
COMMENT ON COLUMN meta_configuraciones.waba_id         IS 'WhatsApp Business Account ID (opcional)';

CREATE INDEX IF NOT EXISTS idx_meta_config_phone   ON meta_configuraciones (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_meta_config_negocio ON meta_configuraciones (negocio_id);

-- -----------------------------------------------------------------------------
-- BLOQUE 3: Tabla crm_mensajes (historial de chat — FK a crm_leads)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_mensajes (
    id           SERIAL PRIMARY KEY,
    lead_id      INTEGER NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    mensaje      TEXT NOT NULL,
    tipo_emisor  VARCHAR(16) NOT NULL DEFAULT 'cliente',
    media_url    TEXT,
    media_tipo   VARCHAR(32),
    meta_msg_id  VARCHAR(128),
    leido        BOOLEAN NOT NULL DEFAULT FALSE,
    fecha        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crm_mensajes_tipo_emisor_chk CHECK (tipo_emisor IN ('cliente', 'agente', 'bot'))
);

COMMENT ON TABLE  crm_mensajes             IS 'Historial de mensajes del chat CRM Meta. Cada fila es un mensaje de la conversación.';
COMMENT ON COLUMN crm_mensajes.lead_id     IS 'FK al lead/contacto en crm_leads';
COMMENT ON COLUMN crm_mensajes.mensaje     IS 'Cuerpo del mensaje. Usar NULLIF(TRIM(mensaje), "") al insertar.';
COMMENT ON COLUMN crm_mensajes.tipo_emisor IS 'Origen: cliente (entrante) | agente (respuesta ERP) | bot (automatizado)';
COMMENT ON COLUMN crm_mensajes.meta_msg_id IS 'ID único del mensaje en Meta (para evitar duplicados por reintento)';
COMMENT ON COLUMN crm_mensajes.leido       IS 'TRUE si el operador ya visualizó este mensaje';

CREATE INDEX IF NOT EXISTS idx_crm_mensajes_lead   ON crm_mensajes (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensajes_fecha  ON crm_mensajes (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_crm_mensajes_leido  ON crm_mensajes (leido) WHERE leido = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_mensajes_meta_id ON crm_mensajes (meta_msg_id) WHERE meta_msg_id IS NOT NULL;


-- =============================================================================
-- ROLLBACK
-- Ejecutar SOLO si se necesita revertir esta migración completa.
-- ATENCIÓN: El DROP de columnas en crm_leads es destructivo para los datos
--           nuevos cargados por el módulo CRM Meta. Ejecutar con precaución.
-- =============================================================================
-- -- Bloque 3: eliminar crm_mensajes
-- DROP INDEX IF EXISTS idx_crm_mensajes_meta_id;
-- DROP INDEX IF EXISTS idx_crm_mensajes_leido;
-- DROP INDEX IF EXISTS idx_crm_mensajes_fecha;
-- DROP INDEX IF EXISTS idx_crm_mensajes_lead;
-- DROP TABLE IF EXISTS crm_mensajes;
--
-- -- Bloque 2: eliminar meta_configuraciones
-- DROP INDEX IF EXISTS idx_meta_config_negocio;
-- DROP INDEX IF EXISTS idx_meta_config_phone;
-- DROP TABLE IF EXISTS meta_configuraciones;
--
-- -- Bloque 1: revertir columnas en crm_leads
-- ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_negocio_tel_plataforma_uq;
-- DROP INDEX IF EXISTS idx_crm_leads_negocio_tel;
-- DROP INDEX IF EXISTS idx_crm_leads_wa_id;
-- DROP INDEX IF EXISTS idx_crm_leads_plataforma;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS etiqueta;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS actualizado_en;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS activo;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS facebook_id;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS instagram_id;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS wa_id;
-- ALTER TABLE crm_leads DROP COLUMN IF EXISTS plataforma_origen;
