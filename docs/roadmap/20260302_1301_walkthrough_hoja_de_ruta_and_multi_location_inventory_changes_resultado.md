# Walkthrough: Hoja de Ruta and Multi-Location Inventory Changes

This document summarizes the changes deployed to the production environment (`multinegociobaboons-fly`).

## Hoja de Ruta: Assigned Seller in Picking List
**Goal:** Display the name of the assigned seller on the picking list PDF generated for drivers/warehouse staff.

### What Changed
1.  **Backend (`app/routes/distribucion_routes.py`)**: 
    -   Modified the `/hoja_ruta/<int:id>/picking_list` endpoint.
    -   Added a `LEFT JOIN` on the `vendedores` table.
    -   Included `vend.nombre as vendedor_nombre` in the returned SQL response.
2.  **Frontend (`app/static/js/modules/hoja_ruta.js`)**: 
    -   Updated the `exportarPickingHR_PDF` function.
    -   Added `jsPDF` logic to print the 'Vendedor Asignado' precisely below the vehicle and driver details.

---

## Inventory: Segregating Resale Products (Ubicación)
**Goal:** Allow the user to track stock for a separate list of resale products without the overhead of a full multi-warehouse system.

### What Changed
1.  **Database Migration**:
    -   Added a new column `ubicacion` to the `productos` table in Neon PostgreSQL.
    -   Assigned a default value of `'Depósito 1'` so all existing stock defaults there.
2.  **Backend (`app/routes/product_routes.py`)**:
    -   Updated the `GET` functions to return the `ubicacion` field.
    -   Updated the `POST` (create) and `PUT` (edit) endpoints to accept and save the `ubicacion` field.
3.  **Frontend HTML (`app/static/inventario.html`)**:
    -   Added a dropdown filter `filtro-ubicacion` next to the main search bar to quickly toggle between 'Todas las Ubicaciones', 'Depósito 1', and 'Depósito 2'.
    -   Added the `producto-ubicacion` dropdown field to the product creation/edit modal.
4.  **Frontend JS (`app/static/js/modules/inventory.js`)**:
    -   Updated the `renderProductos` function to inject the new `ubicacion` column in the data table.
    -   Wired up the `filtro-ubicacion` select box to run the client-side search/filter logic whenever it's changed.
    -   Ensured the product modal correctly pre-selects the location when editing an existing product.

### Validation Results
- The seller name successfully renders in the Hoja de Ruta PDF headers.
- The `ubicacion` workflow was tested in production, correctly defaulting to "Depósito 1" and successfully filtering in the UI.
