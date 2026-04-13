# Walkthrough - Corrección de Estadísticas Restó y Actualización de Versión

Se ha corregido el error de sintaxis que impedía la carga del Dashboard de Estadísticas de Restó y se ha incrementado la versión de la aplicación para asegurar la correcta limpieza de caché en los navegadores.

## Cambios Implementados

### Backend
- **app/routes/resto_routes.py**:
  - Se corrigió la consulta SQL en la función `get_resto_stats`. Se añadió el operador de resta `-` que faltaba entre `fecha_estado_cambiado` y `fecha_pedido` dentro de la función `EXTRACT(EPOCH FROM ...)`.

### Frontend y Cache
- **app/static/js/main.js**:
  - Se incrementó la constante `APP_VERSION` de `1.9.14` a `1.9.15`.
  - Se añadió una nota en el historial de versiones.
- **service-worker.js**:
  - Se incrementó la constante `APP_VERSION` de `1.9.14` a `1.9.15`.
  - Se añadió una nota explicativa en el historial de cambios del Service Worker para forzar la actualización en los dispositivos de los usuarios.

## Verificación Manual (Pasos para el Usuario)

1. **Refrescar la Página**: Al cargar nuevamente el sistema, el Service Worker detectará la nueva versión (`1.9.15`) y debería mostrar el mensaje de "Nueva versión disponible" o actualizarse silenciosamente.
2. **Dashboard de Estadísticas**:
   - Navegar al Dashboard de Estadísticas de Restó.
   - Verificar que los datos carguen correctamente y no se visualicen errores 500 en la consola.
   - Confirmar que el gráfico de "Tiempo Promedio de Preparación" muestre valores coherentes.
3. **Versión en Consola**:
   - Abrir las herramientas de desarrollador (F12).
   - Verificar que el log inicial muestre: `DOM Cargado... Configurando listeners iniciales...` y que los recursos tengan el sufijo `?v=1.9.15` en las llamadas de red.
