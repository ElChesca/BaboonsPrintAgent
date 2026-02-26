-- Migración: Crear tabla de permisos por negocio y rol
CREATE TABLE IF NOT EXISTS negocio_rol_permisos (
    negocio_id INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (negocio_id, role, module_code),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    FOREIGN KEY (module_code) REFERENCES modules(code) ON DELETE CASCADE
);

-- Index para búsquedas rápidas por negocio y rol
CREATE INDEX IF NOT EXISTS idx_negocio_rol_permisos ON negocio_rol_permisos(negocio_id, role);
