# Implementation Plan: Filtro de Estado y Días en Estado en Pedidos

El objetivo es permitir filtrar los pedidos por su estado actual y visualizar cuántos días llevan en dicho estado para detectar inactividad.

## Proposed Changes

### 1. Base de Datos
- **Tabla `pedidos`**: Agregar una nueva columna `fecha_estado` de tipo `TIMESTAMP`.
- Para los pedidos existentes, inicialmente `fecha_estado` puede ser igual a `fecha`. Esto se realizará mediante un pequeño script temporal de base de datos.

### 2. Backend (`app/routes/pedidos_routes.py`)
- **GET `/api/negocios/<id>/pedidos`**:
  - Leer el nuevo parámetro opcional `estado` desde el request. Si se envía, agregarlo a la consulta SQL (`WHERE p.estado = %s`).
  - En la consulta SQL principal, calcular la cantidad de días que el pedido lleva en ese estado. Se puede hacer sumando el campo: `DATE_PART('day', CURRENT_TIMESTAMP - COALESCE(p.fecha_estado, p.fecha)) AS dias_en_estado`.
- **PUT `/api/pedidos/<id>/estado`**:
  - Cuando se cambie exitosamente el estado de un pedido, actualizar la columna `fecha_estado` con `CURRENT_TIMESTAMP`.
- **POST `/api/negocios/<id>/pedidos`**:
  - Al crear un nuevo pedido, inicializar la `fecha_estado` con `CURRENT_TIMESTAMP` o `NOW()`.

### 3. Frontend HTML (`app/static/pedidos.html`)
- En la barra de filtros superior (junto a filtro de fechas y Hoja de Ruta), añadir un nuevo `select`:
  ```html
  <select id="filtro-estado-pedidos" class="form-select" style="width: auto;">
      <option value="">Todos los Estados</option>
      <option value="pendiente">Pendiente</option>
      <option value="preparado">Preparado</option>
      <option value="en_camino">En Camino</option>
      <option value="entregado">Entregado</option>
      <option value="anulado">Anulado</option>
  </select>
  ```

### 4. Frontend JS (`app/static/js/modules/pedidos.js`)
- **Filtro API**:
  - En `inicializarPedidos()`, agregar el evento `onchange = cargarPedidos` al nuevo selector de estados.
  - En `cargarPedidos()`, leer el valor de `filtro-estado-pedidos` y agregarlo a la URL del endpoint si no está vacío (`&estado=X`).
- **Renderizado Visual**:
  - En `renderPedidos(pedidos)`, leer la propiedad `dias_en_estado`.
  - Modificar el renderizado de la columna "Estado" para que muestre el tiempo transcurrido (Ej: `<span class="badge bg-warning">PENDIENTE (2 días)</span>` o `... (Hoy)` si es 0).

## Verification Plan

### Manual Verification
1. **Filtro de Estado**: Seleccionar un estado en el select y verificar que la tabla solo muestre pedidos en ese estado.
2. **Visualización de Días**: Observar la columna "Estado" en la tabla y verificar que indique el paso del tiempo. (Ej. "(3 días)").
3. **Cambio de Estado**: Cambiar el estado a un pedido. Refrescar la tabla y validar que el contador de días se haya reiniciado a "(Hoy)".
