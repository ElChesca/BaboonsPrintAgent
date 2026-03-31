# Limpieza y Reset de Base de Datos (Produccion)
## RESET: Borrón y Cuenta Nueva (Limpieza de Datos)

Para evitar arrastrar inconsistencias (como IDs de vendedores inválidos), realizaremos una limpieza total de las tablas de Pedidos y Hojas de Ruta, y luego aplicaremos el fix definitivo.

### [Data] SQL Reset
Se ejecutarán los siguientes comandos en la base de datos de producción:
```sql
TRUNCATE pedidos_detalle, pedidos, hoja_ruta_items, hoja_ruta CASCADE;
```

### [Backend] app/routes/pedidos_routes.py

1.  **`create_pedido`**: Modificar para que guarde `current_user.get('vendedor_id')` en lugar de `current_user['id']`. Si el usuario no es "vendedor" (es admin), se guardará el ID de usuario como respaldo o NULL.
2.  **`get_pedidos`**: Cambiar el `JOIN` para que use la tabla `vendedores` para mostrar el nombre del vendedor real.
3.  **`update_pedido_estado`**: Asegurar que al crear la `venta`, el `vendedor_id` se pase correctamente desde el pedido.

## Verification Plan

### Manual Verification
1.  **Verificar Tablas Vacías**: Entrar a la app y confirmar que no hay pedidos ni hojas de ruta.
2.  **Prueba de Flujo Completo**:
    - Crear una Hoja de Ruta.
    - Cargar un Pedido desde la Hoja de Ruta.
    - Entregar el Pedido.
    - Verificar que la Venta se cree sin errores de Foreign Key.
