# Análisis Técnico: Sincronización de Pedidos y Asociación de Hojas de Ruta

## Fecha: 2026-03-24

### 1. El Problema Original
Los pedidos creados desde la aplicación Android llegaban correctamente al backend (servidor Flask) pero no aparecían asociados a ninguna **Hoja de Ruta** (HR) en el panel administrativo. Esto causaba que los pedidos no fueran visibles en la liquidación de la ruta ni en el seguimiento del chofer.

### 2. Análisis del Causa Raíz
Se identificaron dos causas principales:

#### A. Selección de "Todas las Rutas" en la App
Cuando el vendedor seleccionaba la opción "Todas las Rutas" en el `HomeScreen`, el estado `selectedHojaRutaId` se establecía en `null`. Al navegar a la creación de pedido (`NuevoPedidoScreen`), se pasaba `-1` (mapeado luego a `null`) como ID de ruta.
*   **Consecuencia**: El objeto `PedidoPendienteEntity` se guardaba con `hoja_ruta_id = null`.
*   **Sync**: El backend recibía este valor y lo insertaba en la base de datos de producción como `NULL`, rompiendo la asociación con el módulo de Distribución.

#### B. Falta de Inferencia en el Frontend
La App no intentaba deducir la ruta si el usuario no la había seleccionado explícitamente, a pesar de tener la información disponible en las tablas de mapeo (`hoja_ruta_clientes`).

### 3. Soluciones Implementadas

#### Inferencia de Ruta en Navegación (`MainActivity.kt`)
Se modificaron los puntos de entrada a la creación de pedidos para que, en caso de que la ruta seleccionada sea nula, se busque en la tabla de mapeo local cuál es la ruta (o la primera de ellas) asociada a ese cliente para el vendedor actual.

```kotlin
// Lógica de recuperación
val hrId = selectedHrId ?: hrClientes.find { it.cliente_id == id }?.hoja_ruta_id
navController.navigate(Routes.nuevoPedido(id, hrId))
```

#### Optimización de Rendimiento (`ApiClient.kt`)
Se detectó un posible motivo de "cuelgue" durante la sincronización de grandes volúmenes de datos (Snapshots). El interceptor de logs de OkHttp estaba configurado en nivel `BODY`.
*   **Mejora**: Se cambió a nivel `HEADERS` para evitar el procesamiento pesado de cadenas JSON gigantes en el logcat, lo cual mejora la fluidez de la App en dispositivos de gama media/baja.

### 4. Estructura de Datos Relevante
*   **Backend**: Tabla `pedidos` (columna `hoja_ruta_id`).
*   **App Local**: `PedidoPendienteEntity` -> `hoja_ruta_id`.
*   **Mapeo**: `HojaRutaClienteEntity` (vincula `hoja_ruta_id` con `cliente_id`).

### 5. Recomendaciones Futuras
*   **Validación en Backend**: Se recomienda añadir una validación en `sync_routes.py` para que, si el `hoja_ruta_id` llega nulo, el servidor intente buscar una ruta activa para ese cliente y vendedor antes de insertar el pedido.
*   **UI Feedback**: Añadir un indicador en el carrito de compras que muestre a qué número de Hoja de Ruta se asignará el pedido.
