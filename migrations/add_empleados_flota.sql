-- Migración: Gestión de Empleados y Flota Avanzada

-- 1. Tabla de Empleados
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE,
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(100),
    fecha_ingreso DATE,
    estado_civil VARCHAR(50),
    hijos INTEGER DEFAULT 0,
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_telefono VARCHAR(50),
    rol VARCHAR(50) NOT NULL, -- 'chofer', 'vendedor', 'administrativo', 'deposito', 'otro'
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Documentación (Polimórfica para Empleados y Vehículos)
CREATE TABLE IF NOT EXISTS documentacion (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL, -- 'empleado', 'vehiculo'
    entity_id INTEGER NOT NULL,
    tipo_documento VARCHAR(100) NOT NULL, -- 'licencia_conducir', 'seguro', 'vtv', 'libreta_sanitaria', etc.
    fecha_vencimiento DATE,
    estado VARCHAR(20) DEFAULT 'vigente', -- 'vigente', 'por_vencer', 'vencido'
    archivo_path TEXT,
    observaciones TEXT,
    fecha_carga TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index para búsquedas rápidas de documentación
CREATE INDEX IF NOT EXISTS idx_documentacion_entity ON documentacion(entity_type, entity_id);

-- 3. Actualización de Tabla Vehículos
ALTER TABLE vehiculos 
ADD COLUMN IF NOT EXISTS tipo_vehiculo VARCHAR(50) DEFAULT 'utilitario', -- 'utilitario', 'chasis', 'chasis_acoplado', 'tractor', 'semi'
ADD COLUMN IF NOT EXISTS propiedad VARCHAR(20) DEFAULT 'propio', -- 'propio', 'terceros'
ADD COLUMN IF NOT EXISTS capacidad_pallets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS enganche_id INTEGER REFERENCES vehiculos(id), -- Para vincular un Semi a un Tractor por defecto
ADD COLUMN IF NOT EXISTS chofer_default_id INTEGER REFERENCES empleados(id);

-- 4. Actualización de Tabla Vendedores (Vínculo con Empleados)
ALTER TABLE vendedores
ADD COLUMN IF NOT EXISTS empleado_id INTEGER REFERENCES empleados(id);

-- 5. Actualización de Productos (para cálculo de Pallets)
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS unidades_por_pallet INTEGER DEFAULT 0; -- Cantidad de bultos/unidades que entran en un pallet

-- Comentarios
COMMENT ON COLUMN vehiculos.enganche_id IS 'ID del acoplado/semi asociado por defecto a este tractor';
COMMENT ON COLUMN vehiculos.chofer_default_id IS 'Chofer asignado habitualmente al vehículo';
COMMENT ON COLUMN productos.unidades_por_pallet IS 'Referencia para calcular ocupación de pallets en hoja de ruta';
