# Driver App Implementation

- [x] 1. Backend: Update `auth_routes.py` to include `empleado_id` in the JWT token for `chofer` role.
- [x] 2. Backend: Add `/api/chofer/rutas_hoy` to fetch active routes for the logged-in driver's vehicle.
- [x] 3. Frontend: Update `app/static/js/main.js` to whitelist `home_chofer` for the `chofer` role, set it as default, and hide main nav.
- [x] 4. Frontend: Create `app/static/home_chofer.html` with mobile-first UI for routes.
- [x] 5. Frontend: Create `app/static/js/modules/home_chofer.js` to fetch routes, show picking lists per client, and handle "Entregado".
- [x] 6. Bugfix: Update `home_chofer.js` imports (use `apiFetch` instead of `fetchData`).
- [x] 7. Bugfix: Create empty `home_chofer.css` to fix 404 error.
- [x] 8. Bugfix: Resolve incorrect fetch function name import in `home_chofer.js`.
- [x] 9. Bugfix: Resolve missing export imports (loaders and notification) in `home_chofer.js`.
- [x] 10. Bugfix: Fix empty string parsing to NULL for dates in `empleados_routes.py`.
- [x] 11. Bugfix: Enforce strict role isolation for `home_chofer` in `main.js`.
- [x] 12. Bugfix: Add `chofer` role to the user creation form in `/usuarios`.
- [x] 12. Bugfix: Add `chofer` role to the user creation form in `/usuarios`.
- [x] 13. Bugfix: Enable late-linking of users to employees during Edit Empleado flow.
- [x] 14. Bugfix: Export `logout()` globally so the `home_chofer` view can use it.
- [x] 15. Backend: Add `chofer_id` to `hoja_ruta` table to allow route-specific driver assignment.
- [x] 16. Frontend (`hoja_ruta.html`): Add "Chofer" dropdown when creating/editing a route.
- [x] 17. Backend: Modify `/api/chofer/mis_rutas` to search by `hr.chofer_id` first, then fallback to vehicle default.
- [x] 18. Frontend (`home_chofer.html`): Integrate Leaflet map to visualize stops for the driver.
- [x] 19. Bugfix: Allow assigning `chofer_id` to `hoja_ruta` even when its state is 'activa'.

# Driver Delivery Report
- [x] 20. Backend: Update `/api/hoja_ruta/<id>/picking_list` to fetch the assigned driver (`chofer_id` or vehicle default).
- [x] 21. Frontend: Update `exportarPickingHR_PDF` to include driver's name and rebrand to "Hoja de Ruta / Reparto".

# Bulk Product Actions
- [x] 22. Backend: Add bulk delete endpoint `DELETE /api/productos/bulk`.
- [x] 23. Backend: Add bulk category update endpoint `PUT /api/productos/bulk/categoria`.
- [x] 24. Frontend: Update `inventario.html` with checkboxes and bulk action bar.
- [x] 25. Frontend: Update `inventory.js` to handle selection logic and bulk API calls.
