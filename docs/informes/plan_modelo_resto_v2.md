# Implementation Plan: Restó Dashboard & Tables ABM

The user wants a more standard dashboard for the Restó business type (similar to Distribuidora) and a full management interface for tables (ABM) including sector/zone configuration.

## Proposed Changes

### [Component] Backend: Restó Routes
#### [MODIFY] [resto_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/resto_routes.py)
- Add `DELETE /mesas/<id>` route.
- Ensure `get_mesas` and `add_mesa` handle the `zona` field correctly (already exists but verify).

#### [MODIFY] [admin_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/admin_routes.py)
- Add `mesas` to `default_resto` permission list.

---

### [Component] Frontend: Dashboard Redesign
#### [MODIFY] [home_resto.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/home_resto.html)
- Redesign using the `app-dashboard` and `app-grid` classes from `global.css`.
- Show specific Restó cards (Mozo, Cocina, Mesas) and then all other enabled modules.

#### [MODIFY] [main.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/main.js)
- Register the `mesas` module in `inicializarModulo`.
- Ensure the routing for `mesas.html` works.

---

### [Component] Frontend: Tables ABM
#### [NEW] [mesas.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/mesas.html)
- Standard table/form layout for managing restaurant tables.
- Fields: Number, Name/Alias, Capacity, Zone/Sector.

#### [NEW] [mesas.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/mesas.js)
- CRUD logic for tables using `fetchData` and `sendData`.
- Real-time updates.

---

## Verification Plan
### Automated Tests
- Test DELETE endpoint for tables via a small script.

### Manual Verification
1. **Dashboard**: Navigate to a Restó business and verify the grid layout.
2. **Tables ABM**: 
   - Create a new table with a specific zone (e.g., "Terraza").
   - Edit the table capacity.
   - Delete a table.
   - Verify changes are reflected in the Mozo table map.
