# Walkthrough: Anulación de Venta Directa y Corrección de Entregas

Este documento resume los cambios realizados para implementar la Cancelación de Ventas Directas, mostrar las notas de crédito e ingresos en la Caja en tiempo real, e **implementar un Panel de Corrección de Medios de Pago** para las entregas de logística.

## Cambios Realizados

- **Panel de Corrección de Pagos (Ticket #6)**:
  - **Backend**: Se creó el endpoint `POST /api/pedidos/<id>/corregir_pago` en `distribucion_routes.py`.
  - **Lógica Financiera**: La corrección de un pago de Cuenta Corriente a Efectivo (o viceversa) ahora revierte automáticamente la deuda en la tabla `clientes_cuenta_corriente` y actualiza la tabla de `ventas`. El recálculo de la "Caja Abierta" se ajusta automáticamente, evitando ingresos duplicados.
  - **Validaciones de Seguridad**: Se requiere obligatoriamente una **Caja Abierta** para alterar pagos que involucren Efectivo, Mercado Pago, etc. (Excepto para mover a/desde Cuenta Corriente pura sin afectar caja). Además, se requiere un **Motivo de Corrección**.
  - **Frontend UI**: Se agregó el botón con un ícono amarillo en las vistas de "Gestión de Pedidos" (tanto en el listado general como en el detalle del pedido) exclusivamente para pedidos en estado `Entregado` que posean un comprobante de venta. El modal incluye ahora un campo `textarea` obligatorio.
  - **Frontend Javascript**: Se conectó la llamada AJAX para enviar el cambio de pago en vivo junto al motivo, sin recargar la pantalla completa. Solo se recarga la tabla de pedidos, brindando una experiencia rápida.
  - **Auditoría**: El motivo introducido por el administrador queda registrado automáticamente en las `observaciones` del pedido para mantener el historial.

## Verificación Manual Requerida

### Visualización y Uso del Corrector de Pagos

1. Ve desde el menú a la pantalla de **Logística > Gestión de Pedidos**.
2. Identifica un pedido que se encuentre **Entregado** y tenga la marca "Pagado - Si". 
3. *Observa la columna de Caja/Método de Pago* (Ej. Dirá **Efectivo**).
4. A la derecha, hace click en el botón amarillo con el ícono de la tarjeta/billete.
5. Se abrirá el modal *Corregir Método de Pago* (El cual ahora respeta el estilo visual del sistema `baboons-modal`).
6. Clickea el selector y cambialo a **Cuenta Corriente**. Apreta "Guardar Cambio".
7. Revisa que el sistema actualice silenciosamente el método y la tabla se redibuje con el nuevo estado.
8. (Opcional) Dirígete al **Estado de Cuenta** de ese cliente y verifica que ahora sí aparezca la deuda generada por ese pedido, lo cual corrige exactamente el reclamo del Ticket #6.

---

> [!TIP]
> **Recordatorio para Cajeros**: Si se cambia un pago de *Cuenta Corriente* a *Efectivo*, el monto de efectivo esperado en el "Arqueo de Caja" **aumentará automáticamente**, ya que el sistema recuenta el total vivo de las ventas del día registradas como Efectivo.
