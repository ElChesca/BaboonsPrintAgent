-- =============================================================================
-- MIGRACIÓN: Módulo Bancos — Cheques & Echeqs
-- Fecha: 2026-03-19
-- =============================================================================

-- ─── Tabla principal de cheques ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cheques (
    id                      SERIAL PRIMARY KEY,
    negocio_id              INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,

    -- Clasificación
    tipo                    VARCHAR(20)  NOT NULL CHECK (tipo IN ('propio', 'tercero')),
    modalidad               VARCHAR(10)  NOT NULL CHECK (modalidad IN ('fisico', 'echeq')),

    -- Datos del documento
    banco                   VARCHAR(100) NOT NULL,
    numero_cheque           VARCHAR(100) NOT NULL,
    cuit_librador           VARCHAR(20),
    nombre_librador         VARCHAR(150),
    monto                   NUMERIC(12, 2) NOT NULL,
    fecha_emision           DATE,
    fecha_vencimiento       DATE NOT NULL,

    -- Estado del ciclo de vida
    estado                  VARCHAR(30) NOT NULL DEFAULT 'en_cartera'
                            CHECK (estado IN ('en_cartera', 'depositado', 'endosado',
                                              'aplicado', 'rechazado', 'anulado')),

    -- Origen (cómo entró)
    origen                  VARCHAR(30) CHECK (origen IN ('cobro_venta', 'cobro_ctacte', 'manual', 'emision_propia')),
    venta_id                INTEGER,     -- FK suave — referencia a tabla ventas
    cliente_id              INTEGER,     -- FK suave — referencia a tabla clientes

    -- Destino (cómo salió)
    destino                 VARCHAR(30) CHECK (destino IN ('deposito', 'endoso_proveedor', 'pago_compra', NULL)),
    proveedor_id            INTEGER,     -- FK suave — referencia a tabla proveedores
    compra_id               INTEGER,     -- FK futura para tabla de compras

    -- Datos específicos de Echeq
    echeq_id                VARCHAR(100),
    echeq_cbu               VARCHAR(30),

    -- Auditoría
    usuario_registro_id     INTEGER,     -- FK suave — referencia a tabla usuarios
    fecha_registro          TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP    NOT NULL DEFAULT NOW(),
    observaciones           TEXT
);

CREATE INDEX IF NOT EXISTS idx_cheques_negocio      ON cheques(negocio_id);
CREATE INDEX IF NOT EXISTS idx_cheques_estado       ON cheques(negocio_id, estado);
CREATE INDEX IF NOT EXISTS idx_cheques_vencimiento  ON cheques(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cheques_cliente      ON cheques(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cheques_proveedor    ON cheques(proveedor_id);

-- ─── Tabla de movimientos (trazabilidad completa) ────────────────────────────
CREATE TABLE IF NOT EXISTS cheques_movimientos (
    id              SERIAL PRIMARY KEY,
    cheque_id       INTEGER NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
    negocio_id      INTEGER NOT NULL,

    tipo_movimiento VARCHAR(50) NOT NULL
                    CHECK (tipo_movimiento IN ('ingreso', 'deposito', 'endoso_salida',
                                              'rechazo', 'anulacion', 'pago_proveedor')),

    estado_anterior VARCHAR(30),
    estado_nuevo    VARCHAR(30) NOT NULL,

    -- Contraparte del movimiento
    cliente_id      INTEGER,
    proveedor_id    INTEGER,

    -- Documentación
    tiene_factura   BOOLEAN DEFAULT FALSE,
    nro_factura     VARCHAR(50),

    -- Auditoría
    usuario_id      INTEGER,
    fecha           TIMESTAMP NOT NULL DEFAULT NOW(),
    observaciones   TEXT
);

CREATE INDEX IF NOT EXISTS idx_cheq_mov_cheque      ON cheques_movimientos(cheque_id);
CREATE INDEX IF NOT EXISTS idx_cheq_mov_negocio     ON cheques_movimientos(negocio_id);

-- ─── Permisos del módulo ─────────────────────────────────────────────────────
INSERT INTO modules (code, name, category)
VALUES ('bancos', 'Bancos y Cheques', 'Retail')
ON CONFLICT (code) DO NOTHING;

INSERT INTO type_permissions (business_type, module_code)
VALUES
    ('retail', 'bancos'),
    ('distribuidora', 'bancos')
ON CONFLICT DO NOTHING;

-- ─── Comentario final ────────────────────────────────────────────────────────
-- Para aplicar en producción:
--   fly ssh console -a <app-name> -C "python apply_pg_migration.py migrations/add_modulo_bancos.sql"
-- O bien ejecutar directamente en psql.
