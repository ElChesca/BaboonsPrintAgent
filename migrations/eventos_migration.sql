-- migrations/eventos_migration.sql

-- Tabla de Eventos
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_evento TIMESTAMP NOT NULL,
    ubicacion TEXT,
    precio DECIMAL(10, 2) DEFAULT 0.00,
    cupo_total INTEGER DEFAULT 0,
    cupos_disponibles INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'activo', -- 'activo', 'finalizado', 'cancelado'
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

-- Tabla de Inscripciones / Tickets
CREATE TABLE IF NOT EXISTS eventos_inscripciones (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL,
    negocio_id INTEGER NOT NULL,
    nombre_cliente TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    metodo_pago TEXT, -- 'Mercado Pago', 'Transferencia'
    estado_pago TEXT DEFAULT 'pendiente', -- 'pendiente', 'confirmado', 'rechazado'
    monto_total DECIMAL(10, 2) NOT NULL,
    mp_preference_id TEXT, -- ID de Checkout Pro
    mp_payment_id TEXT,    -- ID de pago final en MP
    token_asistencia UUID DEFAULT gen_random_uuid(), -- Token para el QR
    asistio BOOLEAN DEFAULT FALSE,
    fecha_asistencia TIMESTAMP,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos (id),
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

CREATE INDEX IF NOT EXISTS idx_eventos_negocio ON eventos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_evento ON eventos_inscripciones(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_token ON eventos_inscripciones(token_asistencia);
