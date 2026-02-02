-- Tabla para las unidades (contenedores/oficinas)
CREATE TABLE IF NOT EXISTS alquiler_unidades (
    id INTEGER PRIMARY KEY,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL, -- Ej: "Oficina 20ft #001"
    descripcion TEXT,
    tipo TEXT, -- 'Oficina', 'Depósito', 'Vivienda', etc.
    estado TEXT DEFAULT 'disponible', -- disponible, alquilado, mantenimiento
    costo_adquisicion REAL,
    precio_base_alquiler REAL, -- Precio sugerido
    ubicacion_actual TEXT,
    fecha_adquisicion DATE,
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

-- Tabla para los contratos de alquiler
CREATE TABLE IF NOT EXISTS alquiler_contratos (
    id INTEGER PRIMARY KEY,
    negocio_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    unidad_id INTEGER NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_mensual REAL NOT NULL,
    dia_vencimiento_pago INTEGER DEFAULT 1, -- Día del mes que vence el pago
    archivo_contrato TEXT, -- Ruta al PDF/Imagen
    estado TEXT DEFAULT 'activo', -- activo, finalizado, cancelado
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Nuevos campos V2
    latitud REAL,
    longitud REAL,
    costo_traslado REAL DEFAULT 0,
    traslado_a_cargo TEXT DEFAULT 'cliente', -- 'cliente', 'empresa', 'bonificado'
    FOREIGN KEY (negocio_id) REFERENCES negocios (id),
    FOREIGN KEY (cliente_id) REFERENCES clientes (id),
    FOREIGN KEY (unidad_id) REFERENCES alquiler_unidades (id)
);

-- Tabla para el seguimiento de pagos/cuotas
CREATE TABLE IF NOT EXISTS alquiler_pagos (
    id INTEGER PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    periodo TEXT NOT NULL, -- Ej: "2023-10" para el pago de Octubre
    monto_esperado REAL NOT NULL,
    monto_pagado REAL DEFAULT 0,
    fecha_pago DATE,
    estado TEXT DEFAULT 'pendiente', -- pendiente, parcial, pagado
    metodo_pago TEXT,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES alquiler_contratos (id)
);

-- Tabla para fotos de estado (V2)
CREATE TABLE IF NOT EXISTS alquiler_fotos_estado (
    id INTEGER PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    etapa TEXT NOT NULL, -- 'entrega', 'devolucion'
    archivo TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES alquiler_contratos (id)
);

CREATE INDEX IF NOT EXISTS idx_alquiler_unidades_negocio ON alquiler_unidades(negocio_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_contratos_cliente ON alquiler_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_pagos_contrato ON alquiler_pagos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_fotos_contrato ON alquiler_fotos_estado(contrato_id);
