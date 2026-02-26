-- Migración: Gestión de Logística de Camiones

-- 1. Crear tabla de Vehículos
CREATE TABLE IF NOT EXISTS vehiculos (
    id SERIAL PRIMARY KEY,
    patente VARCHAR(20) UNIQUE NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    capacidad_kg DECIMAL(10, 2) DEFAULT 0.0,
    capacidad_volumen_m3 DECIMAL(10, 2) DEFAULT 0.0,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agregar metadata de carga a Productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(10, 3) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS volumen_m3 DECIMAL(10, 6) DEFAULT 0.0;

-- 3. Vincular Hoja de Ruta con un Vehículo
ALTER TABLE hoja_ruta 
ADD COLUMN IF NOT EXISTS vehiculo_id INTEGER REFERENCES vehiculos(id);

-- 4. Comentarios para documentación
COMMENT ON COLUMN productos.peso_kg IS 'Peso unitario del producto en kilogramos';
COMMENT ON COLUMN productos.volumen_m3 IS 'Volumen unitario del producto en metros cúbicos';
