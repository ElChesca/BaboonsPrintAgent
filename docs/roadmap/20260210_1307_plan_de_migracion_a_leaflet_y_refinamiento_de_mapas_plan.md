# Plan de Migración a Leaflet y Refinamiento de Mapas

Este plan detalla la integración de un mapa interactivo en el módulo de Hojas de Ruta y el ajuste del centro por defecto de todos los mapas a San Luis, Argentina.

## Cambios Propuestos

### 1. ABM Clientes
- [x] Centrar el mapa de selección en San Luis (-33.3017, -66.3378).

### 2. Hoja de Ruta (Módulo Logística)
#### [MODIFY] [hoja_ruta.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
- Agregar un contenedor para el mapa (`#map-hoja-ruta`) en la sección de detalle de la hoja de ruta.
- Definir dimensiones para el mapa para que sea visible y útil.

#### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- Implementar la función `cargarLeafletJS` (similar a clientes.js) para asegurar la disponibilidad de la librería.
- Inicializar el mapa al ver el detalle de una hoja de ruta.
- Dibujar marcadores para cada cliente de la ruta que tenga coordenadas guardadas.
- Centrar el mapa automáticamente para abarcar todos los puntos de la ruta.
- Reemplazar el enlace de Google Maps por una acción que centre el mapa de Leaflet en ese cliente específico.

## Verificación Plan

### Manual Verification
1. Abrir ABM Clientes y verificar que el mapa inicie en San Luis.
2. Abrir Hoja de Ruta y ver el detalle de una hoja existente.
3. Confirmar que el mapa de Leaflet aparece y muestra los marcadores de los clientes.
4. Interactuar con los marcadores para ver la información del cliente.
