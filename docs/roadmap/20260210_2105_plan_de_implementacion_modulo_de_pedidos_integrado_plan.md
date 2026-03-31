# Plan de Implementación: Módulo de Pedidos Integrado

## Objetivo
Implementar un módulo de Pedidos dedicado para que los vendedores puedan cargar ventas/pedidos directamente desde la Hoja de Ruta, manteniendo un flujo de estados (Pendiente, Preparado, Entregado).

## Cambios Propuestos

### Base de Datos (PostgreSQL)

#### [NEW] [pedidos_migration.sql](file:///c:/Users/usuario/Documents/MultinegocioBaboons/migrations/pedidos_migration.sql)
- Crear tabla `pedidos`: `id`, `negocio_id`, `cliente_id`, `vendedor_id`, `hoja_ruta_id`, `fecha`, `estado`, `total`, `observaciones`.
- Crear tabla `pedidos_detalle`: `id`, `pedido_id`, `producto_id`, `cantidad`, `precio_unitario`, `subtotal`.

### Backend (Python/Flask)

#### [NEW] [pedidos_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
- `POST /api/negocios/<id>/pedidos`: Crear pedido vinculado a una HR.
- `GET /api/negocios/<id>/pedidos`: Listar pedidos con filtros.
- `GET /api/pedidos/<id>`: Detalle del pedido.
- `PUT /api/pedidos/<int:id>/estado`: Cambiar estado del pedido.

### Frontend (JS/HTML)

#### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- Añadir botón "🛒 Pedido" en cada fila de clientes del detalle de la HR.
- Implementar `abrirModalPedido(clienteId, hrId)`: Un modal simplificado de búsqueda de productos y carga de cantidades.
- Integrar la visualización: Si el cliente tiene pedido en esa ruta, mostrar un ícono visual diferente.

## Verificación
1. Entrar a una Hoja de Ruta Activa.
2. Hacer clic en el carrito 🛒 de un cliente.
3. Cargar 2 o 3 productos y guardar.
4. Verificar que el Pedido se haya creado correctamente en la DB vinculado a esa HR.
5. Ver el listado de pedidos realizados.
