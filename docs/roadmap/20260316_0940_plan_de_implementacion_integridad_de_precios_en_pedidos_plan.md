# Plan de Implementación - Integridad de Precios en Pedidos

Garantizar que los pedidos mantengan el precio del producto al momento de su creación, evitando que cambios posteriores en el catálogo de productos afecten a órdenes ya emitidas o en reparto.

## Diagnóstico y Causa Raíz

Se detectó que el módulo de **Distribución**, específicamente al confirmar una entrega o visualizar el detalle para el chofer, consulta la tabla `productos` para obtener el `precio_venta` actual, en lugar de utilizar el campo `precio_unitario` que ya se guarda en la tabla `pedidos_detalle`.

> [!IMPORTANT]
> El sistema ya persiste el precio correcto en `pedidos_detalle` al crear el pedido. La falla reside exclusivamente en las consultas posteriores que "filtran" o "recalculan" subtotales usando el precio vigente del catálogo.

## Cambios Propuestos

### Backend

#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)

1. **Endpoint `entregar_pedido` (`/pedidos/<int:pedido_id>/entregar`)**:
   - Modificar la consulta de detalles del pedido (alrededor de la línea 1081) para eliminar el join innecesario con `productos.precio_venta` o, al menos, asegurar que se priorice `pd.precio_unitario`.
   - Reemplazar el uso de `item['precio']` (que viene de `pr.precio_venta`) por `item['precio_unitario']` (que viene de `pd.precio_unitario`) en todos los cálculos de subtotales y totales.
   - Asegurar que la inserción en `ventas_detalle` utilice el precio histórico.

2. **Endpoint `get_hoja_ruta_chofer` (`/chofer/hoja_ruta/<int:id>`)**:
   - Actualizar la consulta (alrededor de la línea 1583) para que devuelva `pd.precio_unitario` en lugar de `pr.precio_venta`. Esto evitará discrepancias visuales para el repartidor.

---

### Verificación Plan

#### Pruebas Automatizadas (Simuladas)
- Crear un pedido con un producto a $100.
- Cambiar el precio del producto en el inventario a $150.
- Ejecutar la entrega del pedido mediante el endpoint de distribución.
- Verificar que el total de la venta generada siga siendo basado en $100.

#### Verificación Manual
1. **Paso 1**: Crear un pedido para un cliente. Tomar nota del total.
2. **Paso 2**: Ir a Inventario y subir el precio de uno de los productos incluidos en ese pedido.
3. **Paso 3**: Ir a Hojas de Ruta -> Modo Repartidor.
4. **Paso 4**: Verificar que el precio mostrado al confirmar la entrega coincida con el original.
5. **Paso 5**: Confirmar entrega y verificar que en Cuenta Corriente o Ventas el monto sea el original.
