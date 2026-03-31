# Mapa de Recorrido para Hojas de Ruta

Añadir un mapa interactivo de pantalla completa para que los choferes puedan seguir el recorrido optimizado de su Hoja de Ruta.

## Proposed Changes

### [Frontend - Hoja de Ruta]

#### [MODIFY] [hoja_ruta.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
- Añadir un botón "📍 Ver Mapa" en la cabecera del detalle de la Hoja de Ruta (solo si está ACTIVA).
- Crear un modal de pantalla completa (`#modal-mapa-recorrido`) que contenga un contenedor de mapa Leaflet.

#### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- **`verDetalleHR`**: Actualizar para dibujar una línea (`Polyline`) uniendo los puntos en orden de parada (según el campo `orden`).
- **`abrirMapaRecorrido(id)`**: Nueva función para mostrar el mapa en pantalla completa, ideal para dispositivos móviles.
- Mejorar la visualización del mapa actual en el detalle para que incluya las flechas de dirección o simplemente la línea de unión.

## Verification Plan

### Manual Verification
- Entrar al detalle de una Hoja de Ruta ACTIVA.
- Verificar que aparece la línea azul uniendo los clientes en el orden correcto (1 -> 2 -> 3...).
- Hacer clic en el nuevo botón "📍 Ver Mapa" y verificar que se abre en pantalla completa.
- Probar en un navegador simulando un dispositivo móvil.
