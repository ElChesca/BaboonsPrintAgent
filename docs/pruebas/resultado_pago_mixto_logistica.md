# Walkthrough: Soporte de Pago Mixto en Logística

Se ha implementado el soporte completo para el pago "Mixto / Parcial" en el Modo Repartidor del módulo de Logística. Esta mejora permite a los repartidores (o administrativos) registrar entregas donde el cliente paga una parte en efectivo o transferencia, y el saldo restante se acredita automáticamente a su Cuenta Corriente.

## Cambios Realizados

### Frontend (Logística)

#### [logistica.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/logistica.js)
- **Interactividad del Modal**: Se agregaron listeners al modal "Confirmar Entrega" para que, al seleccionar "Mixto / Parcial", se despliegue el panel de montos.
- **Cálculo de Diferencia**: Se implementó la lógica que calcula en tiempo real cuánto dinero falta para cubrir el total del pedido, asignándolo automáticamente al campo de Cuenta Corriente.
- **Procesamiento de Pago**: Se actualizó la función de confirmación para que envíe el desglose detallado (`monto_efectivo`, `monto_mp`, `monto_cta_cte`) al endpoint de entrega.

## Verificación Manual Recomendada

Para asegurar que todo funcione correctamente, siga estos pasos:

1. Ingrese al módulo de **Hoja de Ruta**.
2. Abra una Hoja de Ruta activa y entre al **Modo Repartidor**.
3. Seleccione un pedido con estado "Pendiente" y haga clic en **ENTREGAR**.
4. Elija **Mixto / Parcial** como medio de pago.
5. Ingrese un monto en **Efectivo** (por ejemplo, la mitad del total).
6. Verifique que el campo **"A Cta Cte"** muestre automáticamente el saldo restante.
7. Haga clic en **FINALIZAR ENTREGA**.
8. Verifique en el **Historial de Ventas** o en la **Cuenta Corriente del Cliente** que los montos se hayan imputado correctamente.

> [!NOTE]
> Siguiendo su solicitud, el sistema permite cualquier combinación de montos. Si la suma de Efectivo y MP es inferior al total, el sistema simplemente enviará la diferencia a Cuenta Corriente sin bloquear la operación.
