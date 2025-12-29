CREATE TABLE IF NOT EXISTS crm_leads (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    estado TEXT DEFAULT 'nuevo',
    origen TEXT DEFAULT 'manual',
    notas TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios (id)
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_negocio ON crm_leads(negocio_id);
