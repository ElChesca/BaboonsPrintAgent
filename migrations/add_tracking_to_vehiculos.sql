-- Migración: Agregar tracking de GPS a Vehículos
ALTER TABLE vehiculos 
ADD COLUMN IF NOT EXISTS latitud REAL,
ADD COLUMN IF NOT EXISTS longitud REAL,
ADD COLUMN IF NOT EXISTS ultima_actualizacion TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN vehiculos.latitud IS 'Última latitud GPS reportada por el chofer';
COMMENT ON COLUMN vehiculos.longitud IS 'Última longitud GPS reportada por el chofer';
COMMENT ON COLUMN vehiculos.ultima_actualizacion IS 'Fecha y hora del último reporte de ubicación';
