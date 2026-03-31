# Arreglo de Errores Críticos: Leaflet y Pedidos

Se detectaron dos problemas críticos:
1.  **Leaflet 404/CORS**: Error al cargar `leaflet.css` debido a una respuesta opaca en el Service Worker.
2.  **Pedidos 404**: Error al buscar productos en edición de pedidos por endpoint inexistente.

## User Review Required
> [!IMPORTANT]
> Se actualizará la versión de la aplicación a `1.4.3` para forzar una limpieza completa de caché en todos los clientes y asegurar que los nuevos Service Workers tomen el control correctamente.

## Proposed Changes

### [Infraestructura / PWA]
#### [MODIFY] [service-worker.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/service-worker.js)
- Actualizar `APP_VERSION` a `1.4.3`.
- Excluir URLs externas de la caché automática del evento `fetch` si no están en `urlsToCache`, para evitar conflictos de CORS con respuestas opacas.
- Asegurar que `urlsToCache` incluya los recursos esenciales.

#### [MODIFY] [main.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/main.js)
- Actualizar `APP_VERSION` a `1.4.3`.

### [Backend]
#### [MODIFY] [product_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/product_routes.py)
- Añadir ruta `@bp.route('/productos')` para compatibilidad con el buscador de pedidos antiguo.
- Asegurar que retorne `precio_venta` para mantener compatibilidad con el frontend.

### [Frontend]
#### [MODIFY] [pedidos.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pedidos.js)
- Actualizar `buscarProductosPedidoEdit` para usar el endpoint estándar `/api/negocios/${appState.negocioActivoId}/productos/buscar?query=${termino}`.
- Mapear `precio_final` a `precio_venta` para que el carrito funcione correctamente.

## Verification Plan
### Manual Verification
- Cargar la aplicación y verificar en consola que no haya errores de Leaflet.
- Abrir un mapa para confirmar que el estilo carga correctamente.
- Probar el buscador en el modal de edición de pedidos.
