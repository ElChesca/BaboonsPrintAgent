# 📦 Walkthrough: Filtro por Estado y Días en Estado (Pedidos)

He completado los cambios solicitados para mejorar el filtrado y el seguimiento de actividad de los pedidos de los vendedores. A continuación se detallan las implementaciones:

## ¿Qué cambió?

### 1. Ajustes en la Base de Datos
- Se incluyó la columna temporal `fecha_estado` directamente en la base de datos de producción apuntada desde el entorno (mediante ejecución de un script en Python conectado a PostgreSQL).
- Esta nueva columna registra exactamente en qué momento el pedido cambió a su estado actual.

### 2. Lógica del Servidor (`app/routes/pedidos_routes.py`)
- Ahora, al consultar `GET /api/negocios/<id>/pedidos`, el servidor:
  - Soporta el parámetro `estado=X` para filtrar en la BD por estado.
  - Compara la `fecha_estado` (o la `fecha` original si el estado nunca cambió) contra la hora y fecha actual del servidor (`datetime.now()`).
  - Agrega dinámicamente el campo `dias_en_estado` al JSON retornado por cada pedido.
- Cada vez que la acción es de tipo **creación** (POST) o **actualización de estado** (PUT `/pedidos/.../estado`), la `fecha_estado` se sobre-escribe con la fecha actual.

### 3. Ajustes en el Panel de Pedidos (`app/static/pedidos.html` y `pedidos.js`)
- [pedidos.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/pedidos.html): Se agregó un `<select>` para filtrar por "Pendientes", "Preparados", "En Reparto", "Entregados" y "Anulados" ubicado al lado del filtro de Hola de Ruta y fecha.
- [pedidos.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pedidos.js):
  - El `<select>` de estado dispara una auto-recarga del contenido.
  - La visualización en la tabla se actualizó. Ejemplo, si el pedido está *Pendiente*, ahora dirá visualmente: **PENDIENTE (3 d.)** o **PENDIENTE (Hoy)**, si sucedió el mismo día.

## Verificación Recomendada
Accede al sistema y navega a la sección **Pedidos**:
1. El selector de **Estado** debería mostrarte opciones por defecto. Al seleccionarlo, la grilla se filtrará de inmediato.
2. En la columna de la grilla de cada pedido que muestra su estado, deberías notar información en formato "(X d.)" o "(Hoy)" al finalizar el estado ("PENDIENTE (Hoy)").
3. Intenta cambiar un **Pedido de Prueba** hacia otro estado. Observa si, al hacer el refresh, la cuenta de días vuelve a cero y muestra apropiadamente "(Hoy)".
