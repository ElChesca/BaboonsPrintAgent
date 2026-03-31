# Manual de Administrador: Módulo de Comisiones de Vendedores

**Sistema:** Multinegocio Baboons — Distribuidora FS  
**Rol requerido:** Administrador  
**Acceso:** Inicio → Administración y Reglas → Liquidación Comisiones

---

## ¿Para qué sirve este módulo?

El módulo de Comisiones permite calcular, previsualizar y asentar el pago de comisiones a cada vendedor según las ventas que generó en un período determinado. Cada liquidación queda registrada con comprobante propio, y las ventas involucradas quedan "marcadas" para no volver a comisionarse.

---

## Pestaña 1: Reglas de Comisión

Antes de liquidar, el sistema necesita saber **cuánto le corresponde a cada vendedor**. Esto se configura aquí.

### Regla Global (aplica a todos los vendedores por defecto)

| Campo | Descripción |
|---|---|
| **Porcentaje** | % sobre el total de la venta. Ej: `5` = 5% |
| **Monto Fijo** | Monto fijo por venta (alternativa al porcentaje) |
| **Incluir Cuenta Corriente** | Si está activado, las ventas a crédito también generan comisión |

> [!TIP]
> Solo completá uno de los dos campos (Porcentaje **o** Monto Fijo). Si completás ambos, el sistema usa el porcentaje.

### Excepciones por Vendedor

Para vendedores con condiciones especiales (ej. comisión diferente por antigüedad o meta lograda):

1. Hacé clic en **"+ Nueva Excepción"**
2. Seleccioná el vendedor
3. Definí su porcentaje o monto fijo particular
4. Guardá

Las excepciones tienen prioridad sobre la regla global para ese vendedor.

---

## Pestaña 2: Liquidar

Este es el flujo principal. Se realiza típicamente al cierre de mes o quincena.

### Paso 1 — Selección

- **Vendedor**: Elegí al vendedor a liquidar
- **Fecha Desde / Hasta**: El período a considerar (ej. 01/03/2025 al 31/03/2025)

### Paso 2 — Calcular

Presioná **"Calcular"**. El sistema:
- Busca todas las ventas del vendedor en el período
- Excluye ventas ya liquidadas anteriormente
- Excluye ventas a Cuenta Corriente si la regla no las contempla
- Muestra el detalle de cada venta y la comisión calculada

### Paso 3 — Revisar y Confirmar

Revisá el resumen:
- **Operaciones**: Cantidad de ventas incluidas
- **Regla aplicada**: Global o Específica
- **Total a pagar**: Monto final de la comisión

Agregá una **Observación** si querés (ej. "Cierre Marzo 2025 - Premio productividad incluido") y presioná **"Confirmar Liquidación"**.

> [!IMPORTANT]
> Una vez confirmada, las ventas quedan **bloqueadas**: no aparecerán en futuras liquidaciones. Esta acción no tiene deshacer desde la UI.

---

## Pestaña 3: Historial

Listado de todas las liquidaciones realizadas, con:

- Número de comprobante (`#ID`)
- Fecha y hora del cierre
- Vendedor
- Período liquidado
- Cantidad de operaciones
- Observaciones
- Monto total pagado

Útil para auditar pagos pasados o justificar discrepancias con un vendedor.

---

## Preguntas Frecuentes

**¿Qué pasa si una venta fue anulada?**  
Las ventas con estado `Anulado` son excluidas automáticamente del cálculo.

**¿Puedo liquidar el mismo período dos veces?**  
No. Las ventas ya liquidadas no aparecen en futuras previsiones.

**¿Qué pasa si no tengo reglas configuradas?**  
El sistema te avisará con un error al intentar calcular. Primero configurá las reglas en la pestaña correspondiente.

**¿La comisión se paga automáticamente?**  
No. El sistema registra el comprobante de lo que *corresponde pagar*, pero el pago real (transferencia, efectivo, etc.) lo gestionás vos por fuera del sistema.
