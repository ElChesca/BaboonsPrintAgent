# Refactorizacion de Historial de Inventario
### Backend: Historial Inventario Routes

#### [MODIFY] [historial_inventario_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/historial_inventario_routes.py)

- **Use `LEFT JOIN`** for `productos` and `usuarios` in the subqueries to ensure history records aren't hidden if a product or user was deleted.
- **Implement Pagination** (`limit` and `offset`) to prevent performance issues as the history grows.
- **Support Date Filters correctly** (it seems it does, but I'll double-check logic with timezone/formatting).
- **Add `tipo` filter support**: Support filtering the unified results by `tipo_movimiento`.

### Frontend: Historial Inventario Module

#### [MODIFY] [historial_inventario.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/historial_inventario.js)

- **Implement Pagination UI**: Add "Load More" functionality similar to `historial_ajustes.js`.
- **Add Debug Logs**: (Already partially done) to trace data flow.
- **Support Movement Type Filter**: Update logic to send the new `tipo` parameter.

### Frontend: HTML

#### [MODIFY] [historial_inventario.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/historial_inventario.html)

- **Add Movement Type Select**: Add a dropdown for "Tipo de Movimiento" in the filters section.

## Verification Plan

### Manual Verification
1. Navigate to "Historial de Inventario".
2. Verify if records appear.
2. Verify if records appear.
3. Test filters (Product, Dates, **Movement Type**).
4. Verify "Load More" if implemented.
