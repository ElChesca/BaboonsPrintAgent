# Sistema de Tickets de Soporte Interno

Módulo nuevo e independiente (`/tickets`) para gestión de tickets de soporte interno entre el equipo del sistema. Incluye prioridades, SLA, alertas por email, vista Kanban + tabla, y asignación de responsables. Se integra al sistema de módulos existente (admin_apps) para ser configurable por negocio y tipo de app.

> [!IMPORTANT]
> El sistema ya está en producción. Todos los cambios son **aditivos** (nuevas tablas, nuevo blueprint, nuevas rutas). No se modifica lógica existente, solo se registra el nuevo blueprint y se agrega el switch-case en `main.js`. **Riesgo de rotura: MUY BAJO.**

---

## Scripts SQL para NEON (el usuario los ejecuta manualmente)

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
    fecha_limite TIMESTAMPTZ,      -- SLA deadline calculado al crear
    fecha_resolucion TIMESTAMPTZ,  -- Cuando se cierra/resuelve
    sla_vencido BOOLEAN DEFAULT FALSE
);

-- 2. Comentarios / actividad del ticket
CREATE TABLE IF NOT EXISTS ticket_comentarios (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    comentario TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'comentario'  -- 'comentario' o 'cambio_estado'
        CHECK (tipo IN ('comentario', 'cambio_estado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Configuración de alertas (emails destinatarios) por negocio
CREATE TABLE IF NOT EXISTS ticket_alertas_config (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE(negocio_id, email)
);

-- 4. Insertar email por defecto
INSERT INTO ticket_alertas_config (negocio_id, email)
SELECT id, 'elchesca@gmail.com' FROM negocios
ON CONFLICT (negocio_id, email) DO NOTHING;

-- 5. Registrar el módulo en el catálogo (para admin_apps)
INSERT INTO modules (code, name, category)
VALUES ('tickets', 'Tickets de Soporte', 'Gestión')
ON CONFLICT (code) DO NOTHING;

-- 6. Agregar a todos los tipos de negocio
INSERT INTO type_permissions (business_type, module_code) VALUES
    ('retail',        'tickets'),
    ('consorcio',     'tickets'),
    ('distribuidora', 'tickets'),
    ('rentals',       'tickets')
ON CONFLICT DO NOTHING;
```

---

## Proposed Changes

### Base de datos

Los scripts SQL anteriores son todo lo que se necesita. Tablas 100% nuevas, sin tocar las existentes.

---

### Backend — Nuevo Blueprint

#### [NEW] [tickets_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/tickets_routes.py)

Blueprint `tickets` con los siguientes endpoints (todos bajo `/api`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/negocios/<id>/tickets` | Listar tickets (filtros: estado, prioridad, asignado) |
| POST   | `/negocios/<id>/tickets` | Crear ticket (calcula fecha_limite según prioridad) |
| PUT    | `/tickets/<id>` | Actualizar ticket (estado, asignado, horas, etc.) |
| DELETE | `/tickets/<id>` | Eliminar ticket (solo admin) |
| GET    | `/tickets/<id>/comentarios` | Listar comentarios del ticket |
| POST   | `/tickets/<id>/comentarios` | Agregar comentario; al cambiar estado, registra en log |
| GET    | `/negocios/<id>/tickets/alertas-config` | Ver emails configurados |
| POST   | `/negocios/<id>/tickets/alertas-config` | Agregar/quitar email |
| GET    | `/negocios/<id>/tickets/stats` | Estadísticas rápidas (KPIs) |

**Lógica SLA por prioridad:**
- `urgente` → 4 horas
- `alta` → 24 horas
- `media` → 72 horas
- `baja` → sin límite

**Envío de emails:**
- Al crear un ticket → notifica a todos los emails configurados
- Cuando SLA vence → el scheduler lo marca como `sla_vencido = TRUE` y envía alerta (usa `flask_mail` ya configurado)

---

#### [MODIFY] [__init__.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/__init__.py)

Agregar import y registro del blueprint `tickets_routes`:

```diff
+    from .routes import tickets_routes
     ...
     blueprints = [
         ...
+        (tickets_routes.bp, '/api'),
     ]
```

También agregar el job de APScheduler para chequeo de SLA cada 30 minutos:

```diff
+    scheduler.add_job(
+        func=_job_chequeo_sla,
+        trigger='interval', minutes=30,
+        id='tickets_sla_check',
+        replace_existing=True,
+    )
```

---

#### [MODIFY] [admin_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/admin_routes.py)

Agregar `'tickets'` a las listas `default_distri`, `default_retail`, y crear equivalentes para `consorcio` y `rentals` si aún no existen, para que el auto-seed las incluya.

---

### Frontend

#### [NEW] [tickets.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/tickets.html)

Vista principal con:
- **Header:** título + botón "Nuevo Ticket" + filtros (estado, prioridad, asignado, búsqueda)
- **Switcher:** Vista Tabla / Vista Kanban
- **Vista Tabla:** tabla con columnas: ID, Prioridad (badge de color), Título, Categoría, Asignado, Creado, Fecha Límite (🔴 si vencido), Estado, Acciones
- **Vista Kanban:** columnas Abierto / En Progreso / Pendiente / Resuelto
- **Modal Ticket:** formulario (título, descripción, categoría, prioridad, asignado, horas estimadas, fecha límite manual) + panel de comentarios/actividad
- **Modal Config Alertas:** lista de emails + campo para agregar/quitar

#### [NEW] [tickets.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/tickets.js)

Módulo JS con la función principal `inicializarTickets()` exportada. Maneja:
- Carga y renderizado de tickets (tabla + kanban)
- CRUD de tickets via `fetchData`/`sendData`
- Modal de detalle + comentarios
- Filtros en tiempo real
- Badges de prioridad con colores `urgente=rojo, alta=naranja, media=azul, baja=gris`
- SLA countdown / badge "VENCIDO"
- Modal de configuración de alertas de email

#### [NEW] [tickets.css](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/css/tickets.css)

Estilos para:
- Badges de prioridad (urgente/alta/media/baja)
- Kanban board (columnas, cards)
- Indicador SLA vencido (borde rojo pulsante)
- Formulario modal dos columnas

---

#### [MODIFY] [main.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/main.js)

Agregar case `'tickets'` en el switch de `inicializarModulo()`:

```diff
+    case 'tickets':
+        const { inicializarTickets } = await import(`./modules/tickets.js${v}`);
+        inicializarTickets();
+        break;
```

---

## Verification Plan

### Automatizada (no hay tests existentes en el proyecto)

No se encontraron tests automatizados en el directorio `/tests`. Se realizará **verificación manual** bajo las siguientes condiciones:

### Manual — Paso a Paso

> Ejecutar en la instancia de desarrollo (`multinegociobaboons-dev`), o localmente.

1. **Ejecutar los scripts SQL** en NEON y verificar que las tablas `tickets`, `ticket_comentarios`, `ticket_alertas_config` fueron creadas.
2. **Iniciar el servidor** (`flask run` o `python run.py`) — verificar que no hay error de import al registrar el blueprint.
3. **Abrir la app** → Login → navegar a `#tickets` → debe cargar `tickets.html` sin error 404.
4. **Crear un ticket** con prioridad `urgente` → verificar que `fecha_limite` se setea en ~4hs desde ahora.
5. **Cambiar el estado** del ticket a "En Progreso" → verificar que aparece un comentario de actividad registrando el cambio.
6. **Agregar un comentario** → verificar que aparece en el historial del ticket.
7. **Eliminar el ticket** (solo admin) → verificar que desaparece de la lista.
8. **Admin Apps** → abrir `#admin_apps` → verificar que "Tickets de Soporte" aparece como módulo configurable para todos los tipos de negocio.
9. **Email de alerta** → crear un ticket y verificar que llega correo a `elchesca@gmail.com`.
10. **SLA vencido** → crear ticket urgente con fecha pasada manualmente en DB → verificar que aparece badge "VENCIDO" en rojo.
