# Bonificaciones y Cobro Manual en Seller App

Este plan describe los cambios necesarios para que el vendedor pueda aplicar bonificaciones (descuentos o unidades sin cargo) al momento de cobrar un pedido, y pueda hacerlo incluso si el pedido está en estado "Pendiente", siempre que la ruta esté Activa.

## 1. Flexibilización del Cobro (Control Manual)
- El vendedor podrá iniciar el proceso de cobro (entrega) tanto para pedidos en `pendiente` como en `en_camino`, siempre que la hoja de ruta esté en estado **ACTIVA**.
- **Backend**: Se permitirá la transición a `entregado` desde el estado `pendiente`.

## 2. Bonificaciones por Ítem en el Cobro
Para cada producto en el modal de entrega, se agregará un campo para definir unidades bonificadas (sin cargo).
- **Frontend**: El modal de entrega incluirá un input de "Bonif." por producto.
- **Lógica**: `Subtotal Item = (Cantidad Entregada - Bonificación) * Precio Unitario`.
- **Backend**: Se actualizará `entregar_pedido` para aceptar y registrar bonificaciones ajustadas desde el frontend.

## 3. Unificación de Lógica de Descuentos
Se eliminará la redundancia en `recalcularTotalEntrega` y se asegurará que el descuento porcentual general se aplique sobre el subtotal resultante de los ítems ya bonificados.

## Cambios Propuestos

### Backend (Python/Flask)

#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
- `entregar_pedido`: 
    - Permitir estado `pendiente` como origen.
    - Soporta la recepción de bonificaciones por ítem en el cuerpo de la petición.

### Frontend (JavaScript)

#### [MODIFY] [seller.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/seller.js)
- `renderClients`: Cambiar lógica para que pedidos `pendiente` en rutas `activa` muestren el botón **"COBRAR"**.
- `abrirModalEntregaSeller`: Generar UI con input de bonificación por producto.
- `recalcularTotalEntrega`: Unificar y corregir cálculo de subtotal con bonificaciones + descuento general.
- `confirmarEntregaBackend`: Enviar datos estructurados de cantidades y bonificaciones.

## Plan de Verificación
1. **Cobro de Pedido Pendiente**: Verificar que se pueda cobrar el pedido de FEDE en la Ruta #5.
2. **Aplicación de Bonificación**: Entregar 10 unidades de un producto con 1 bonificada. El total debe reflejar el cobro de solo 9 unidades.
3. **Cálculo de Descuento**: Aplicar un 10% adicional y verificar que se calcule correctamente sobre el subtotal bonificado.
