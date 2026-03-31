# 🛡️ Reglas de Negocio - Módulo Distribuidora (Hoja de Ruta & Pedidos)

Este documento contiene las reglas críticas que constituyen el **CORAZÓN** de la lógica de distribución. Estas reglas **NO DEBEN SER MODIFICADAS** sin una revisión exhaustiva del impacto sistémico, incluso si se solicitan cambios menores en la UI o pequeñas funcionalidades.

Cualquier Agente de IA (o desarrollador) debe leer y respetar estas directrices antes de tocar `distribucion_routes.py`, `hoja_ruta.js` o `pedidos.js`.

---

## 📌 1. Integridad de la Hoja de Ruta (HR)

### 1.1 Estados de la HR
- **Borrador**: Solo preparación.
- **Activa/En Camino**: La mercadería ha salido del depósito y está bajo responsabilidad del chofer/vehículo.
- **Finalizada**: Los pedidos han sido entregados o rebotados. Solo en este estado (o tras liquidación) se permite el retorno de stock.

### 1.2 Prohibición de Modificación de Precios Históricos
> [!IMPORTANT]
> **REGLA DE ORO**: Los precios de los pedidos se fijan al momento de su creación.
> - **NUNCA** recalcular el total de un pedido existente consultando la tabla de `productos`.
> - Si el precio del producto cambia en el catálogo, los pedidos antiguos **DEBEN** mantener su `precio_unitario` original.
> - Romper esta regla altera la cuenta corriente del cliente y la liquidación histórica.

---

## 📦 2. Gestión de Stock e Inventario Móvil

### 2.1 Carga de Vehículos
- Al asignar mercadería a una HR, el stock se mueve de `deposito` a `vehiculos_stock`.
- Si un vehículo tiene varias HRs asignadas (ej. Mañana y Tarde), el stock en el camión es **ACUMULATIVO**.

### 2.2 Retorno de Stock ("Descarga de Camión")
> [!CAUTION]
> **PROTECCIÓN DE STOCK**: No descargar el camión si tiene otras rutas pendientes.
> - Al finalizar una HR, el sistema **SOLO** debe devolver al depósito la mercadería que no fue entregada de **ESA** Hoja de Ruta.
> - Si el vehículo tiene otra HR en estado `Activa` o `Pendiente`, el stock restante que pertenece a esas otras rutas **DEBE PERMANECER** en el vehículo (`vehiculos_stock`).

---

## 💰 3. Liquidación y Cobranzas (Los 3 Pilares)

La liquidación es el proceso de rendición de cuentas del chofer. Se basa en tres pilares inamovibles:

- **PILAR 1: Rendición de Caja (Fisico vs Sistema)**: Lo que el chofer cobró en efectivo debe coincidir con los registros de `ventas` vinculados a la HR.
- **PILAR 2: Rendición de Mercadería**: Todo lo que salió en el camión debe estar: a) Entregado (Vendido), b) Rebotado (Vuelve al stock), o c) En el camión (si hay otra HR).
- **PILAR 3: Conciliación de Cta Cte**: Las ventas a crédito deben impactar correctamente el saldo del cliente.

### 3.1 Vínculo de Ventas a HR
- Todas las ventas (Efectivo, Mercado Pago, Cta Cte, Mixto) **DEBEN** estar vinculadas a `hoja_ruta_id` en la tabla `ventas`.
- **Pagos Mixtos**: Los registros de cobranza secundarios de un pedido (ej. la parte en MP de un pago Efectivo+MP) **DEBEN** mantener el `hoja_ruta_id` para no ser omitidos en el resumen de liquidación.

### 3.2 Transparencia Financiera (Desglose de Cobros)
> [!NOTE]
> **REGLA DE RENDICIÓN**: El sistema **NUNCA** debe mostrar el "Total Vendido" como sinónimo de "Efectivo a Rendir".
> - Los reportes (PDF y Modal) **DEBEN** desglosar los montos por método de pago (`resumen_cobros`).
> - La cifra final de rendición para el chofer **DEBE** ser únicamente el monto total en **Efectivo** registrado en el sistema.

---

## 📄 4. Documentación de Entrega (Picking & Remitos)

- **Discriminación por Pedido**: Cuando un cliente tiene múltiples pedidos en una misma HR, el sistema **DEBE** separarlos visualmente en el picking list y remitos. No consolidar productos de distintos pedidos en una sola tabla de entrega para facilitar la auditoría física.

---

## 🤖 Directriz para Asistentes IA
Antes de realizar cualquier cambio en la lógica de `distribucion_routes.py`, verifica:
1. ¿Este cambio altera el precio de un pedido ya creado? (Ver Regla 1.2)
2. ¿Este cambio vacía el stock de un vehículo ignorando otras rutas? (Ver Regla 2.2)
3. ¿Este cambio rompe la trazabilidad de `hoja_ruta_id` en `ventas`? (Ver Regla 3.1)
4. ¿Este cambio oculta el desglose de cobros (`resumen_cobros`) o mezcla Mercado Pago con Efectivo? (Ver Regla 3.2)

**Si la respuesta es SÍ a cualquiera de estas, RECHAZA la modificación e informa al usuario.**
