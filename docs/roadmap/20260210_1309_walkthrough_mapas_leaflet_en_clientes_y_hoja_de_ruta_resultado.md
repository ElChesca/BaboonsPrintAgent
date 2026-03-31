# Walkthrough: Mapas Leaflet en Clientes y Hoja de Ruta

He unificado el sistema de mapas utilizando **Leaflet** en lugar de Google Maps, asegurando que todos los mapas estén correctamente centrados en San Luis, Argentina.

## Mejoras Implementadas

### 1. ABM Clientes (Selector de Ubicación)
- El mapa ahora inicia automáticamente en **San Luis Capital** (-33.30, -66.33).
- Se corrigió la precisión del marcador al guardarlo.

### 2. Hoja de Ruta (Mapa de Reparto)
- Se eliminó el enlace externo a Google Maps.
- **Mapa Integrado**: Ahora, al ver el detalle de una Hoja de Ruta, verás un mapa interactivo con la ubicación de todos los clientes de ese reparto.
- **Auto-Zoom**: El mapa se ajusta automáticamente para que todos los puntos de la ruta sean visibles.
- **Enfoque Rápido**: Al hacer clic en el icono 📍 de la tabla, el mapa se centrará en ese cliente específico y abrirá un globo con su nombre.

## Verificación Final
- [x] Mapa de Clientes centrado en San Luis.
- [x] Mapa de Hoja de Ruta muestra los marcadores correctamente.
- [x] Eliminada la dependencia de servicios externos para visualización rápida.

> [!IMPORTANT]
> **Debes ejecutar `fly deploy` nuevamente** para que estos cambios se apliquen en producción. Una vez desplegado, podrás ver el recorrido completo de tus repartidores en el mapa.
