# 🚛 GUÍA CRÍTICA: LÓGICA DE DISTRIBUCIÓN Y LOGÍSTICA (MODO REPARTIDOR)

Este documento es la **ÚNICA fuente de verdad** para la lógica de entrega y cobro en el flujo de la Distribuidora. Cualquier modificación en `distribucion_routes.py` o `logistica.js` DEBE respetar estas definiciones.

## ⚠️ REGLAS DE ORO (PROHIBIDO MODIFICAR SIN ESQUEMA SQL)
1.  **NO adivinar columnas**: La base de datos no es estándar en todas las tablas. Consultar siempre el esquema real antes de proponer un INSERT/UPDATE.
2.  **Estado de Pago**: Un pedido se considera "PAGADO" si y solo si su columna `venta_id` NO es NULL. La columna `pagado` (booleana) NO existe físicamente en la tabla `pedidos`.
3.  **Vínculo Pedido-Venta**: El vínculo es **unidireccional**. `pedidos` tiene `venta_id`, pero `ventas` NO tiene `pedido_id`.
4.  **Caja (Sesiones)**: Las ventas se vinculan a la caja mediante `caja_sesion_id` (NO `caja_id`). No existe la tabla `caja_movimientos` para ventas; el saldo se calcula sumando las ventas de la sesión.

---

## 📊 ESQUEMA DE BASE DE DATOS REAL (CONFIRMADO)

### Tabla: `pedidos`
*   `id`: integer (PK)
*   `hoja_ruta_id`: integer (link a la ruta activa/finalizada)
*   `estado`: text ('pendiente', 'preparado', 'en_camino', 'entregado', 'anulado')
*   `venta_id`: integer (Link a la venta generada al cobrar. **FUENTE DE VERDAD PARA EL PAGO**)
*   `total`: numeric

### Tabla: `ventas`
*   `id`: integer (PK)
*   `negocio_id`: integer
*   `cliente_id`: integer
*   `caja_sesion_id`: integer (Link a la sesión de caja abierta en `caja_sesiones`)
*   `total`: real (Cuidado: Tipo `real`, no `numeric` en esta tabla)
*   `metodo_pago`: text ('Efectivo', 'Mercado Pago', 'Cuenta Corriente', 'Mixto')
*   `fecha`: timestamp (CURRENT_TIMESTAMP)

### Tabla: `clientes_cuenta_corriente`
*   `cliente_id`: integer
*   `debe`: real (Monto de la deuda)
*   `haber`: real (Monto del pago)
*   `venta_id`: integer (Link a la venta que originó la deuda)
*   `concepto`: text

---

## 🔄 FLUJO CRÍTICO DE ENTREGA (Backend: `entregar_pedido`)

Al confirmar la bajada/entrega de un pedido (o conjunto de ellos) en el Modo Repartidor:

1.  **Validar Sesión de Caja**: Se debe buscar una sesión abierta para el `negocio_id` en `caja_sesiones` donde `fecha_cierre` sea NULL.
2.  **Actualizar Pedido**: Cambiar `estado` a 'entregado'.
3.  **Generar Venta**: 
    - Crear registro en `ventas`.
    - Capturar el `id` generado (`RETURNING id`).
    - **IMPORTANTE**: No intentar insertar `pedido_id` en `ventas`, no existe la columna.
4.  **Vincular**: Ejecutar `UPDATE pedidos SET venta_id = <venta_id> WHERE id = <p_id>`.
5.  **Cta. Cte.**: Si el método es 'Cuenta Corriente' o 'Mixto' (con remanente), insertar en `clientes_cuenta_corriente` usando la columna `debe`.

## 🛠️ DESARROLLO FRONTEND (`logistica.js`)
- La función `abrirModalEntregaMulti` maneja la consolidación de varios pedidos del mismo cliente en una sola parada.
- Debe calcular el total sumando los pedidos que aún no están entregados.
- El envío al backend se hace secuencialmente por cada `pedido_id` en el bucle de confirmación.

---
**NOTA PARA LA IA**: Este flujo fue estabilizado tras errores de esquema. NO CAMBIAR nombres de columnas ni lógicas de inserción sin verificar este documento primero.
