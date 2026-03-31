# Plan de Implementación: Modelo de Negocio Restó

Este plan detalla los pasos para implementar el tipo de negocio "Restó" (Restaurantes) en el ecosistema MultinegocioBaboons.

## Cambios Propuestos

### Base de Datos
Se requiere la creación de tablas específicas para gastronomía y la extensión de las tablas de pedidos existentes.

#### [NUEVO] `/migrations/20260325_create_mesas.sql`
Script para crear la tabla de mesas y añadir columnas a pedidos.

```sql
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL,
    numero INTEGER NOT NULL,
    nombre TEXT,
    capacidad INTEGER,
    estado TEXT DEFAULT 'libre', -- libre, ocupada, reservada
    zona TEXT DEFAULT 'Salon'
);

ALTER TABLE pedidos ADD COLUMN mesa_id INTEGER;
ALTER TABLE pedidos ADD COLUMN mozo_id INTEGER;
ALTER TABLE pedidos ADD COLUMN num_comensales INTEGER;
ALTER TABLE pedidos_detalle ADD COLUMN estado TEXT DEFAULT 'pendiente';
```

### Backend (Flask)
Registro de nuevas rutas para gestión de salón y cocina.

#### [NUEVO] `app/routes/resto_routes.py`
Endpoints para:
- Listar/Crear mesas por negocio.
- Abrir pedidos en mesas.
- Gestionar cola de cocina.

#### [MODIFICAR] `app/__init__.py` y `app/routes/admin_routes.py`
- Registro del blueprint `resto`.
- Configuración de permisos por defecto para el tipo de negocio `resto`.

### Frontend (PWA)
Nuevas interfaces estéticas con Glassmorphism.

#### [NUEVOS]
- `app/static/home_resto.html`: Dashboard principal.
- `app/static/resto_mozo.html`: Mapa de mesas interactivo.
- `app/static/resto_cocina.html`: Tablero de preparación de cocina.

## Plan de Verificación

### Verificación Manual
1. **Configuración**: Crear un negocio tipo "Restó" en el panel administrativo.
2. **Flujo de Mozo**: Abrir una mesa, cargar productos y enviar a cocina.
3. **Flujo de Cocina**: Recibir el ticket, marcar como "En Preparación" y luego "Listo".
4. **Cierre**: En el panel de Mozo, verificar estado "Listo" y proceder al cobro.
