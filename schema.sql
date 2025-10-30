-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'empleado' -- Puede ser 'admin' o 'empleado'
);

-- Tabla para los diferentes negocios/tiendas
CREATE TABLE IF NOT EXISTS negocios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT
);

-- Tabla de asociación para vincular usuarios con negocios (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS usuarios_negocios (
    usuario_id INTEGER NOT NULL,
    negocio_id INTEGER NOT NULL,
    PRIMARY KEY (usuario_id, negocio_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);


-- Tabla para los productos, cada uno asociado a un negocio
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    sku TEXT,
    codigo_barras TEXT,
    stock REAL NOT NULL DEFAULT 0,
    precio_costo REAL,
    precio_venta REAL NOT NULL,
    unidad_medida TEXT DEFAULT 'unidades',
    FOREIGN KEY (negocio_id) REFERENCES negocios (id),
    UNIQUE(sku, negocio_id),
    UNIQUE(codigo_barras, negocio_id)
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