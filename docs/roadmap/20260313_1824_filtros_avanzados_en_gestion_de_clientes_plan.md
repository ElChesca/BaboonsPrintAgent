# Filtros Avanzados en Gestión de Clientes

Este plan detalla la adición de dos nuevos filtros en la pantalla de "Gestión de Clientes":
1. **Saldo Deudor**: Filtrar clientes que tengan una deuda pendiente.
2. **Top Operaciones**: Ordenar clientes por volumen de transacciones (ventas/pedidos).

## Proposed Changes

### Backend
#### [MODIFY] [ctacte_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/ctacte_routes.py)
- Modificar endpoint `registrar_cobro` para que devuelva el `nuevo_saldo` del cliente tras la operación.

### Frontend
#### [MODIFY] [cobro_ctacte.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/cobro_ctacte.js)
- Implementar función `generarReciboPDF(datos)` usando `jsPDF`.
- Implementar función `compartirWhatsApp(datos)` que genere un link `wa.me` con el detalle del pago y saldo.
- Actualizar el modal de éxito para incluir botones: "Descargar Recibo" y "Enviar por WhatsApp".
- El recibo incluirá: Fecha, Cliente, Monto Pagado, Método de Pago y Saldo Actual.

## Verification Plan
1. Verificar que el botón "Con Deuda" solo muestre clientes con saldo > 0.
2. Verificar que el botón "Más Operaciones" ordene correctamente la lista.
