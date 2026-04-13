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
*   `hoja_ruta_id`: integer (Link a la ruta; OBLIGATORIO para que figure en la Liquidación de la HR)
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

1.  **Validación de Integridad**: ES OBLIGATORIO abortar u omitir cualquier pedido cuyo `estado` sea 'anulado' o 'rechazado' para no generar deudas fantasmas si el frontend los llegase a enviar por error.
2.  **Validar Sesión de Caja**: Se debe buscar una sesión abierta para el `negocio_id` en `caja_sesiones` donde `fecha_cierre` sea NULL.
3.  **Actualizar Pedido**: Cambiar `estado` a 'entregado'.
4.  **Generar Venta**: 
    - Crear registro en `ventas`.
    - Capturar el `id` generado (`RETURNING id`).
    - **IMPORTANTE**: No intentar insertar `pedido_id` en `ventas`, no existe la columna.
    - **IMPORTANTE 2**: Asegurarse de insertar el `hoja_ruta_id` de forma explícita para no romper los paneles de resumen en las liquidaciones.
5.  **Vincular**: Ejecutar `UPDATE pedidos SET venta_id = <venta_id> WHERE id = <p_id>`.
6.  **Cta. Cte.**: Si el método es 'Cuenta Corriente' o 'Mixto' (con remanente), insertar en `clientes_cuenta_corriente` usando la columna `debe`.

## 🛠️ DESARROLLO FRONTEND (`logistica.js` y `hoja_ruta.js`)
- **Persistencia de HR_ID**: IMPORTANTE: Un pedido `anulado` conserva su `hoja_ruta_id` para historial. Por lo tanto, filtrar la API por `hoja_ruta_id` NO es suficiente; se debe filtrar por `estado` siempre.
- **Filtros de Paradas (`logistica.js`)**: En la función `abrirModoRepartidor`, es OBLIGATORIO filtrar el array de pedidos ANTES de agrupar por paradas.
    - ✅ **Correcto**: `const validos = pedidos.filter(p => p.estado !== 'anulado' && p.estado !== 'rechazado')`.
    - ❌ **Incorrecto**: Usar el array crudo de la API.
- **Sumatoria Dinámica**: El monto mostrado en la tarjeta de parada (`totalMonto`) debe ser el resultado exclusivo de los pedidos válidos. Si un cliente tiene 1 pedido de $1000 (Pendiente) y 1 de $1000 (Anulado), la tarjeta DEBE mostrar $1000, no $2000.
- **Cobros Consolidados**: La función `abrirModalEntregaMulti` maneja la consolidación de varios pedidos del mismo cliente en una sola parada sumando los pendientes de entregar válidos.
- **Liquidaciones (`hoja_ruta.js`)**: Los apartados de Resumen de Cobros extraen información haciendo JOIN a la tabla `ventas` desde `hoja_ruta_id`. Cualquier desvinculación previa provoca un apagón visual del componente dinámico.

---

## 🚚 PROCESO DE CARGA Y DESPACHO (Backend: `asignar_carga_vehiculo`)

1.  **Requisito de Estado**: Antes de asignar un vehículo y marcar `carga_confirmada = TRUE`, el sistema valida que **el 100% de los pedidos** de la Hoja de Ruta estén en estado `preparado`. Si hay pedidos en `pendiente`, la operación se aborta (Error 400).
2.  **Movimiento de Inventario**:
    *   Se calcula el total por SKU de todos los pedidos de la HR.
    *   Se descuenta del stock global (`productos.stock`).
    *   Se incrementa el stock del vehículo (`vehiculos_stock`).
3.  **Transición de Ventas**: Todos los pedidos en `preparado` cambian automáticamente su estado a `en_camino`.
4.  **Vehículo Asignado**: La Hoja de Ruta queda vinculada al `vehiculo_id`, lo cual es indispensable para que los pedidos aparezcan en el "Modo Repartidor" del chofer asignado.

---
## 📦 GESTIÓN DE STOCK RESERVADO (COMPROMETIDO)

Para evitar la sobreventa de productos (unidades que figuran en sistema pero están reservadas para otros pedidos aún no despachados), se aplica la lógica de **Stock disponible real**.

1.  **Definiciones de Stock**:
    *   **Stock Físico (`productos.stock`)**: Cantidad total real en el depósito central.
    *   **Stock Comprometido**: Suma de las cantidades de todos los pedidos en estado `pendiente` o `preparado` cuya Hoja de Ruta tiene `carga_confirmada = FALSE` (o no tienen HR aún).
    *   **Stock Disponible**: `Stock Físico - Stock Comprometido`.

2.  **Visualización en Ventas/Preventa**:
    *   Tanto en la **App de Vendedores** como en el **POS**, el sistema debe mostrar el **Stock Disponible**.
    *   La API de búsqueda (`/api/negocios/<id>/productos/buscar`) devuelve `stock_disponible` y el campo `stock` (pisado con el disponible para compatibilidad).
    *   **Exclusión de Edición**: Al editar un pedido existente, la consulta debe incluir el parámetro `exclude_pedido_id` para NO restar del "Disponible" las unidades que ese mismo pedido ya tiene reservadas.

3.  **Impacto en Carga de Camión**:
    *   Al ejecutar `asignar_carga_vehiculo` (Confirmar Carga), el stock pasa de ser **Comprometido** a ser **Stock de Vehículo**. 
    *   En este punto, se resta físicamente de `productos.stock`, por lo que el "Stock Disponible" para nuevas preventas no cambia (antes se restaba como comprometido, ahora se resta como físico).

---
**NOTA PARA LA IA**: Este flujo fue estabilizado tras errores de esquema e inconsistencias de estado (HR #143). NO CAMBIAR nombres de columnas ni lógicas de inserción sin verificar este documento primero.
