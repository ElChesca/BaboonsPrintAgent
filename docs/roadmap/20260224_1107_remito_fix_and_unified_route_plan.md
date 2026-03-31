# Remito Fix and Unified Route

## 1. Unified Route View (COMPLETE)
Improve delivery efficiency by merging all active Hojas de Ruta (HR) assigned to a driver into a single unified view.

### Backend API
#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
- Create `GET /api/chofer/recorrido_unificado`:
  - Returns all `hoja_ruta_items` from all HRs assigned to the current driver that are in 'activa' or 'borrador' status.
  - Aggregates associated product details and order descriptions for each stop.

### Frontend: Chofer App
#### [MODIFY] [home_chofer.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/home_chofer.js)
- Add "Recorrido Unificado" section:
  - Button on the home screen to access the unified view.
  - Interactive map showing ALL stops from ALL active HRs.
  - Unified list of stops, possibly sorted by proximity (nearest neighbor) to suggest an efficient path.
  - Allow confirming visits/bajadas directly from the unified view.

## 2. Remito Printing in Ventas Module
Fix the regression where "Cobrar e Imprimir" button doesn't work.

### Frontend: Sales Module
#### [NEW] [utils.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/sales/utils.js)
- Implement `imprimirVentaPDF(ventaId)`:
  - Fetches full sale data from `/api/ventas/${ventaId}`.
  - Generates a PDF Remito using `jsPDF` and `autoTable`.
  - Reuses the layout from `pedidos.js` but adapted for "Ventas".

#### [MODIFY] [events.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/sales/events.js)
- Add event listener for `btn-finalize-and-print`: Calls `procesarVenta(true)`.
- Update `procesarVenta(imprimir)`:
  - If `imprimir` is true, call `imprimirVentaPDF(responseData.venta_id)` after successful registration.

### Frontend: Sales History Module
#### [MODIFY] [historial_ventas.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/historial_ventas.js)
- Import `imprimirVentaPDF` from `./sales/utils.js`.
- Update `cargarHistorialVentas`: Add a print button (PDF icon) to the actions column.
- Update event listener in `inicializarLogicaHistorialVentas`: Handle the print button click by calling `imprimirVentaPDF(ventaId)`.

### Frontend: Navigation & Permissions
#### [MODIFY] [index.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/templates/index.html)
- Add "Historial de Ventas" link to the `nav-distribuidora` section (under Historiales dropdown).

#### [MODIFY] [admin_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/admin_routes.py)
- Add `'historial_ventas'` to the `default_distri` list in `get_permissions` to ensure it's seeded and enabled by default for Distribuidoras.

- Redesign the "Total" section to use a structured block with background color and better alignment.
- Fix overlapping of label and value.

### Feature: Hoja de Ruta Seller Modification (All Statuses)
#### [MODIFY] [hoja_ruta.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
- Allow editing routes in both `borrador` and `activa` status.
- Enable seller modification for admin/superadmin roles.
- Ensure map markers refresh when the seller changes during edit.

#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
- Update `update_hoja_ruta`: Allow updates when state is `borrador` or `activa`.

## Verification Plan

### Automated Tests
- Script `test_unified_route.py` to:
  - Create two separate HRs assigned to the same driver.
  - Fetch the unified route and verify it contains items from both HRs.

### Manual Verification
- Assign two different HRs (from different sellers) to a driver.
- Log in as the driver and verify the stops appear merged in the "Recorrido Unificado" map and list.
- Confirm a visit in the unified view and verify it updates the correct HR item in the database.
- Go to "Ventas" module.
- Add products and choose a client.
- Click "Cobrar e Imprimir".
- Verify that the sale is registered AND a PDF Remito is generated/downloaded.
- Verify that "Cobrar" (without printing) still works correctly.
