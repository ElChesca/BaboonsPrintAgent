# Enhancements to Mobile Inventory Module

I have successfully enhanced the Mobile Inventory Module to support both Warehouse (Depósito Central) and Vehicle (Camión) stock management from a single interface.

## Changes Made

### 1. Unified Mobile UI
The `inventario_movil.html` and `inventario_movil.css` have been updated to include a source selection toggle. Users can now choose whether they are auditing the warehouse or a specific vehicle.

### 2. Manual Vehicle Stock Adjustments
I implemented a new backend endpoint in `distribucion_routes.py` and updated the frontend logic in `inventario_movil_main.js` to allow manual stock adjustments for vehicles. This is crucial for fixing stock discrepancies during routes.

### 3. Unified Search and Scanner Logic
The barcode scanner and manual search now intelligently fetch stock data based on the selected source. If "Vehículo" is selected, the system retrieves the current stock levels assigned to that specific camión.

### 4. Bug Fix: Tab Switching Error
I fixed a `TypeError` that occurred when clicking on icons within tabs in the Logística and Empleados modules. The logic now correctly identifies the target tab regardless of where you click within the tab button.

### 5. Corrected Stock Management Flow
I fixed a "double deduction" bug. Now:
- Marking an order as "Preparado" **validates stock but does not subtract it** from the warehouse.
- The actual deduction from physical stock occurs only during the **"Confirmar Carga al Camión"** step in the Control de Carga module.
- Loading stock into a vehicle automatically transitions "Pendiente" orders into the "Preparado" state.
- A new `carga_confirmada` flag prevents moving stock multiple times for the same Hoja de Ruta.

### 6. Fixed Automatic Vehicle Assignment
I modified the Roadmap Duplication logic to **NOT** copy the `vehiculo_id`. This ensures that when a route is repeated (e.g. for a new day), the user must explicitly assign a vehicle during the loading process, preventing accidental automatic assignments of old vehicles to new routes.

### 7. Fixed Picking List Totals
The Picking List PDF was filtering out "Pendiente" orders from the total product sum (Section 1). I updated the backend to include "Pendiente", "Preparado" and "En Camino" in the totals, ensuring the warehouse manager sees everything that needs to be loaded into the truck.

### Backend Endpoint
The endpoint `POST /api/vehiculos/<id>/stock/ajustar` was tested to ensure it performs a proper UPSERT on the `vehiculos_stock` table and records the adjustment in `inventario_ajustes` for auditing.

### Frontend Integration
- **Source Toggle**: Switching between "Depósito Central" and "Vehículo" correctly shows/hides the vehicle selector.
- **Vehicle Selection**: The vehicle dropdown is populated with active vehicles from the current business.
- **Stock Display**: Product information now displays whether the stock is "En Depósito" or "En Camión".
- **Adjustments**: Adjusting stock in both modes works correctly and provides visual feedback.

### Roadmap Duplication
I verified that duplicating a Hoja de Ruta now results in a new route with `Vehículo: (No asignado)`. The assignment only happens when the user clicks "Confirmar Carga" in the Control de Carga module.

render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
render_diffs(file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/static/inventario_movil.html)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/inventario_movil_main.js)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)

### 8. Gestión Masiva de Pedidos
He implementado una nueva barra de acciones en la pestaña de Pedidos:
- **Filtro por Hoja de Ruta:** Permite visualizar pedidos vinculados a una ruta específica.
- **Selecciones Masivas:** Checkboxes individuales y botón "Seleccionar Todo".
- **Estados Rápidos:** Barra flotante para pasar múltiples pedidos a "Preparado", "En Camino" o "Entregado" con un clic.

### 9. Mapa de Recorrido para Choferes
Se añadió una visualización cartográfica optimizada:
- **Trazado de Ruta:** Una línea punteada une las paradas siguiendo el orden de entrega programado.
- **Modo Pantalla Completa:** Nuevo botón "📍 Ver Mapa" que maximiza el mapa para uso móvil (ahora disponible en todos los estados, incl. Borrador).
- **Mapa en Modal de Edición:** Mientras se crea o edita una ruta, el mapa del modal ahora muestra el recorrido en tiempo real a medida que se añaden o reordenan paradas.
- **Indicadores Visuales:** Colores diferenciados por estado de visita y venta.

render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/pedidos.html)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/pedidos.js)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
