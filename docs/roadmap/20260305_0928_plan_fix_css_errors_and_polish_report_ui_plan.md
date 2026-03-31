# Plan: Fix CSS Errors and Polish Report UI

The user reported a 404 error for `reporte_caja.css` and requested a fix for "broken styles" in the "Historial de Ajustes" view.

## Proposed Changes

### [Frontend Components]

#### [NEW] [reporte_caja.css](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/css/reporte_caja.css)
- Create this missing file to satisfy the 404 error and provide clean layout styles for the "Historial de Cierres de Caja" view.
- Define `.filtros-container`, `.form-group`, and `.form-actions` as flex layouts for a premium feel. [DONE]

#### [MODIFY] [historial_ajustes.css](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/css/historial_ajustes.css)
- Improve current styles to ensure consistency with the new `reporte_caja.css`. [DONE]
- Add styles for movement type pills/buttons.

#### [MODIFY] [caja_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/caja_routes.py)
- Support `tipo` (Ingreso/Egreso) filter.
- Support `limit` and `offset` for pagination.

#### [MODIFY] [historial_ajustes.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/historial_ajustes.html)
- Add "Tipo de Movimiento" selector (Pills/Buttons).
- Add "Cargar más" button at the bottom of the table.

#### [MODIFY] [historial_ajustes.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/historial_ajustes.js)
- Implement pagination logic using `limit` and `offset`.
- Add event listeners for the new movement type filter.

## Verification Plan

### Automated Tests
- None applicable for these UI-only CSS changes.

### Manual Verification
1. Open the application.
2. Navigate to "Reportes" -> "Cierres de Caja" (Reporte de Caja).
3. Verify that the 404 error for `reporte_caja.css` is gone in the console.
4. Verify that the filters and table look well-aligned and premium.
5. Navigate to "Historial de Ajustes".
6. Verify that the layout is consistent and functional.
