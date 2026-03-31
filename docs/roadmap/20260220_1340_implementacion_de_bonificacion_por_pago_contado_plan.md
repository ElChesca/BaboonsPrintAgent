# Implementación de Bonificación por Pago Contado

Añadir la capacidad de aplicar un descuento (ej. 10%) al momento de registrar el cobro en efectivo desde la App del Vendedor, reflejando este descuento en el total de la venta y en el remito/recibo.

## Proposed Changes

### [Component Name] Backend (Pedidos Routes)

#### [MODIFY] [pedidos_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
- Modificar el endpoint `entregar_pedido` para recibir un campo opcional `descuento_porcentaje` o `descuento_valor`.
- Validar que el descuento no exceda el 100% del total.
- Al crear el registro en la tabla `ventas`, restar el descuento del `total`.
- Almacenar el descuento aplicado en una nueva columna de la tabla `ventas` (si no existe, se usará el campo `observaciones` o se propondrá una migración).

### [Component Name] Frontend (Seller App)

#### [MODIFY] [seller.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/seller.html)
- Añadir un campo de entrada numérico en el `modal-confirmar-entrega` para ingresar el porcentaje de descuento.
- Mostrar el "Nuevo Total" calculado en tiempo real cuando se ingresa un descuento.
- Solo mostrar/habilitar el campo si el método de pago seleccionado es "Efectivo".

#### [MODIFY] [seller.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/seller.js)
- Actualizar `abrirModalEntregaSeller` para resetear el campo de descuento.
- Añadir lógica para recalcular el total visual al cambiar el descuento.
- Actualizar `confirmarEntregaBackend` para enviar el valor del descuento al servidor.

### [Component Name] Remito / Recibo

#### [MODIFY] [pedidos.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pedidos.js)
- Actualizar la lógica de generación de PDF para mostrar una línea de "Descuento por Pago Contado" si la venta asociada tiene un descuento.
- [NEW] Implementar `imprimirReciboPDF(ventaId)` para generar un comprobante simplificado de pago.

### [Component Name] WhatsApp Integration

#### [NEW] [whatsapp.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/whatsapp.js)
- Crear un módulo de utilidades para generar enlaces `wa.me` con mensajes predefinidos.
- Función `enviarReciboWhatsApp(cliente, total, articulos)`: Genera mensaje con resumen de cobro.
- Función `notificarPedidoPreparado(cliente, pedidoId)`: Genera mensaje avisando que el pedido está listo para entrega/retiro.

#### [MODIFY] [pedidos.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pedidos.js)
- Al cambiar el estado de un pedido a "Preparado", mostrar un botón o link para que el administrador pueda enviar el aviso por WhatsApp.

#### [MODIFY] [seller.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/seller.js)
- Después de una entrega exitosa, mostrar un botón "Enviar Recibo (WA)" que abra el enlace de WhatsApp.

## Verification Plan

### Automated Tests
- No hay tests automatizados específicos en este proyecto, se usará verificación manual.

### Manual Verification
1. Abrir la App Vendedor.
2. Registrar un cobro en efectivo con 10% de descuento.
3. Presionar el nuevo botón "Enviar Recibo" y verificar que redirija a WhatsApp con el mensaje correcto.
4. En el panel de administración, cambiar un pedido a "Preparado" y enviar la notificación de WhatsApp.
5. Verificar que el Remito PDF muestre el descuento aplicado.
