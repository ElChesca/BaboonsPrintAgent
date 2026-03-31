# Consistencia de Vendedor y Creación de Pedidos Integrada

Este plan corrige la discrepancia de claves foráneas entre las tablas `pedidos`, `ventas` y `vendedores`, asegurando que la automatización contable (Pedido -> Venta -> Deuda) funcione correctamente.

## Cambios Propuestos

### Componente: Base de Datos (PostgreSQL)

#### [MODIFY] `migrations/fix_pedidos_vendedor_fk.sql` [NEW]
Se creará un script para corregir la restricción de integridad en la tabla `pedidos`.
- Cambiar `vendedor_id` de `REFERENCES usuarios(id)` a `REFERENCES vendedores(id)`.
- Limpiar datos inconsistentes antes de aplicar la restricción si fuera necesario.

### Componente: Backend (Python/Flask)

#### [MODIFY] [pedidos_routes.py](file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
- **`create_pedido`**: Ajustar la lógica de asignación de `vendedor_id`. Debe usar `current_user.get('vendedor_id')` (que es el ID de la tabla `vendedores`). Si es NULL (admin/operador), se guarda NULL o se permite según la lógica de negocio.
- **`update_pedido_estado`**: Asegurar que al crear la `venta` desde un pedido "entregado", el `vendedor_id` se transfiera correctamente respetando la FK de la tabla `ventas`.

#### [MODIFY] [auth_routes.py](file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/routes/auth_routes.py)
- Verificar que el `vendedor_id` inyectado en el JWT sea siempre el ID de la tabla `vendedores`.

### Componente: Frontend (JavaScript)

#### [MODIFY] [hoja_ruta.js](file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- Validar que al abrir el modal de pedido desde la hoja de ruta, los IDs se pasen correctamente.
- Mejora estética: Mostrar el nombre del vendedor activo en el modal si corresponde.

## Plan de Verificación

### Pruebas Automatizadas
1. **Script de Verificación de Schema**: Ejecutar `check_pedidos_db.py` (actualizado) para confirmar que las FKs apuntan a `vendedores(id)`.

### Verificación Manual
1. **Flujo de Vendedor**:
   - Loguearse como vendedor (`ventas1@distri.com`).
   - Ir a "Hoja de Ruta" -> Ver Reparto.
   - Cargar un pedido rápido para un cliente.
   - Verificar en la DB que `pedidos.vendedor_id` sea el ID del vendedor y no del usuario.
   - Marcar pedido como "Entregado" y verificar que la `venta` se cree con el mismo `vendedor_id`.
2. **Flujo de Admin**:
   - Loguearse como admin.
   - Cargar un pedido desde una hoja de ruta.
   - Verificar que se asigne correctamente (o quede NULL según se decida).

> [!IMPORTANT]
> Proporcionaré las queries SQL para que el usuario las ejecute en su consola de Neon, ya que no tengo acceso directo para ejecutar DDL en producción.
