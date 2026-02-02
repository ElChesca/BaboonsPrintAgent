-- Tabla para los diferentes negocios/tiendas
CREATE TABLE IF NOT EXISTS negocios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT
);

-- Tabla para los productos, cada uno asociado a un negocio
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    codigo_barras TEXT UNIQUE,
    stock REAL NOT NULL DEFAULT 0,
    precio_costo REAL,
    precio_venta REAL NOT NULL,
    unidad_medida TEXT DEFAULT 'unidades',
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

-- Tabla para las cabeceras de las ventas
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    total REAL NOT NULL,
    cliente TEXT,
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

-- Tabla para los detalles (líneas) de cada venta
CREATE TABLE IF NOT EXISTS ventas_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    precio_unitario_venta REAL NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas (id),
    FOREIGN KEY (producto_id) REFERENCES productos (id)
);
-- CRM & Social Module Tables

CREATE TABLE IF NOT EXISTS crm_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    estado TEXT DEFAULT 'nuevo', -- nuevo, contactado, interesado, cliente, perdido
    origen TEXT DEFAULT 'manual', -- manual, web, instagram, facebook
    notas TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_negocio ON crm_leads(negocio_id);
