# 📘 Walkthrough: Refinamiento de Pedidos y Ventas

Hemos mejorado la trazabilidad entre tus pedidos y el historial de ventas, facilitando la corrección de errores.

## 1. Identificación en el Historial de Ventas
Ahora, en el **Histórico de Ventas**, verás una nueva columna: **"Pedido / HR"**.
- Si una venta proviene de un pedido repartido, verás el **#ID del pedido** y el **#ID de la Hoja de Ruta**.
- Si es una venta directa por mostrador, se indicará como **(Directa)**.
- Esto te permite saber exactamente qué entrega originó cada cobro.

![Sales History](/absolute/path/to/screenshot_history.png)
> *Ejemplo visual de la nueva columna en el historial.*

## 2. Flujo de Corrección y Anulación
Ahora tienes dos formas de manejar errores en el cobro:

### A. Corregir el Método de Pago (Recomendado)
Si el repartidor se equivocó de método (ej: puso Efectivo en lugar de Cta Cte), usa el botón **"Corregir Pago"** en la pantalla de **Gestión de Pedidos**.
- Es instantáneo.
- No afecta el stock.
- Corrige la caja y la cuenta corriente automáticamente.

### B. Anular Venta por NC (Liberación de Pedido)
Si necesitas anular la venta completamente (vía Nota de Crédito):
1. Ve al **Historial de Ventas** y pulsa **🚫 Anular**.
2. **Lo nuevo:** El sistema ahora detecta si la venta tenía un pedido asociado.
3. El pedido se **"libera"** automáticamente: vuelve a estado **"En Camino"** y se borra el cobro anterior.
4. Así, el administrativo puede volver a cobrar el pedido correctamente sin tener que recrearlo.

## 3. Verificación Realizada
- [x] **Backend**: La ruta `/api/ventas/<id>/anular` ahora limpia el `venta_id` y resetea el `estado` en la tabla `pedidos`.
- [x] **Frontend**: La tabla de ventas ahora solicita y muestra `pedido_id` y `hoja_ruta_id`.
- [x] **UX**: Se ajustaron los anchos de columna para mantener la legibilidad.

---
*Nota: Las ventas directas (sin pedido) se siguen anulando de la forma tradicional devolviendo el stock al depósito central.*
