-- 1. Reglas de Comisión
CREATE TABLE IF NOT EXISTS comisiones_reglas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    vendedor_id INTEGER REFERENCES vendedores(id), -- Si es NULL, es la regla default del negocio
    porcentaje NUMERIC(5,2) DEFAULT 0, -- Ejemplo: 5.00 para 5%
    monto_fijo NUMERIC(10,2) DEFAULT 0, -- Por si en lugar de porcentaje se paga un fijo por pedido
    comisiona_cuenta_corriente BOOLEAN DEFAULT FALSE, -- Si ventas a crédito cuentan o no
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (negocio_id, vendedor_id) -- Solo una regla activa por vendedor o por negocio
);

-- 2. Historial de Liquidaciones
CREATE TABLE IF NOT EXISTS comisiones_liquidaciones (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
    fecha_desde DATE,
    fecha_hasta DATE,
    fecha_liquidacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto_total NUMERIC(12,2) NOT NULL,
    cantidad_operaciones INTEGER NOT NULL,
    observaciones TEXT
);

-- 3. Marcar Ventas como Liquidadas
-- Agregamos la columna para atar la venta al comprobante de liquidación
-- Nota: Usamos IF NOT EXISTS porque trabajamos con Postgres en pro y SQLite en dev.
-- Sin embargo, el IF NOT EXISTS en ALTER TABLE ADD COLUMN es propio de Postgres y SQLite lo implementa desde la v3.25.0+.
-- Asumiendo una versión de SQLite reciente se puede usar, pero lo mejor es usar try catch en python.
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS liquidacion_id INTEGER REFERENCES comisiones_liquidaciones(id);
