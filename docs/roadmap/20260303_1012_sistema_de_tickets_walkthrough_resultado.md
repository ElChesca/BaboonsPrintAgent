# Sistema de Tickets — Walkthrough

## ✅ Archivos creados/modificados

| Archivo | Acción |
|---------|--------|
| [tickets_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/tickets_routes.py) | **NUEVO** — 9 endpoints, SLA, emails |
| [__init__.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/__init__.py) | Modificado — blueprint + job SLA cada 30 min |
| [admin_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/admin_routes.py) | Modificado — `tickets` en listas auto-seed |
| [tickets.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/tickets.html) | **NUEVO** — Vista tabla + Kanban + modales |
| [tickets.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/tickets.js) | **NUEVO** — Módulo JS completo |
| [tickets.css](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/css/tickets.css) | **NUEVO** — Estilos Kanban, badges prioridad/estado |
| [main.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/main.js) | Modificado — `case 'tickets'` en el switch |

---

## 🗄️ Scripts SQL para NEON

> Ejecutar **en este orden** en la consola SQL de Neon.

```sql
-- 1. Tabla principal de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(50) DEFAULT 'General',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media'
        CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    estado VARCHAR(30) NOT NULL DEFAULT 'abierto'
        CHECK (estado IN ('abierto', 'en_progreso', 'pendiente', 'resuelto', 'cerrado')),
    usuario_creador_id INTEGER NOT NULL REFERENCES usuarios(id),
    usuario_asignado_id INTEGER REFERENCES usuarios(id),
    horas_estimadas NUMERIC(6,2),
    horas_reales NUMERIC(6,2),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_limite TIMESTAMPTZ,
    fecha_resolucion TIMESTAMPTZ,
    sla_vencido BOOLEAN DEFAULT FALSE
);

-- 2. Comentarios y actividad
CREATE TABLE IF NOT EXISTS ticket_comentarios (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    comentario TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'comentario'
        CHECK (tipo IN ('comentario', 'cambio_estado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Configuración de emails por negocio
CREATE TABLE IF NOT EXISTS ticket_alertas_config (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE(negocio_id, email)
);

-- 4. Email por defecto para todos los negocios
INSERT INTO ticket_alertas_config (negocio_id, email)
SELECT id, 'elchesca@gmail.com' FROM negocios
ON CONFLICT (negocio_id, email) DO NOTHING;

-- 5. Registrar módulo en catálogo
INSERT INTO modules (code, name, category)
VALUES ('tickets', 'Tickets de Soporte', 'Gestión')
ON CONFLICT (code) DO NOTHING;

-- 6. Habilitar para todos los tipos de negocio
INSERT INTO type_permissions (business_type, module_code) VALUES
    ('retail',        'tickets'),
    ('consorcio',     'tickets'),
    ('distribuidora', 'tickets'),
    ('rentals',       'tickets')
ON CONFLICT DO NOTHING;
```

---

## 🔍 Verificación manual

1. **Ejecutar scripts SQL** en Neon → verificar que se crearon las 3 tablas
2. **Reiniciar el servidor** → no debe haber errores de import
3. **Navegar a `#tickets`** → carga la vista con KPIs, tabla y Kanban
4. **Crear ticket urgente** → `fecha_limite` se setea ~4hs automáticamente
5. **Cambiar estado** → aparece log de actividad "Estado cambiado a..."
6. **Agregar comentario** → aparece en el feed de actividad
7. **Eliminar ticket** (admin) → desaparece de la lista
8. **Admin Apps** → "Tickets de Soporte" aparece como módulo configurable
9. **Email** → al crear un ticket, llega correo a `elchesca@gmail.com`

---

## ⚙️ SLA por prioridad

| Prioridad | Tiempo límite |
|-----------|--------------|
| 🔴 Urgente | 4 horas |
| 🟠 Alta | 24 horas |
| 🔵 Media | 72 horas |
| ⚪ Baja | Sin límite |

El scheduler de APScheduler chequea cada **30 minutos** si algún ticket superó su `fecha_limite`. Si detecta uno nuevo vencido: lo marca como `sla_vencido = TRUE`, registra un log en la actividad, y envía email de alerta.
