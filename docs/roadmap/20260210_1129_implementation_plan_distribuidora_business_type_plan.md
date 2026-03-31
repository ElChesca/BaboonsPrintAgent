# Implementation Plan - Distribuidora Business Type

## Goal Description
Add a new business type "Distribuidora" to the MultinegocioBaboons application. This type will have exclusive features: Seller Management (ABM Vendedor), Roadmap (Hoja de Ruta), Client Map (Leaflet), Seller-associated Delivery Notes (Remitos), and Delivery (Reparto).

## User Review Required
> [!IMPORTANT]
> - Confirm the specific fields required for a "Vendedor" (Seller).
> - Confirm if "Reparto" is a separate module or part of the "Hoja de ruta".

## Proposed Changes

### Database
#### [NEW] migrations/distribuidora.sql
- **Tables:**
    - `vendedores`: `id`, `negocio_id` (FK), `nombre`, `telefono`, `email`, `activo`.
    - `hoja_ruta`: `id`, `negocio_id` (FK), `vendedor_id` (FK), `fecha`, `estado` ('borrador', 'activa', 'finalizada'), `observaciones`.
    - `hoja_ruta_items`: `id`, `hoja_ruta_id` (FK), `cliente_id` (FK), `orden`, `visitado` (bool), `observaciones`.
- **Alterations:**
    - `clientes`: Add `vendedor_id` (FK, nullable), `latitud` (real), `longitud` (real).
    - `ventas`: Add `vendedor_id` (FK, nullable).
- **Data Insertion:**
    - Insert new modules: `vendedores`, `hoja_ruta`, `mapa_clientes`.
    - Insert `type_permissions` for `distribuidora` to access these modules + common ones.

### Backend (Python/Flask)
#### [NEW] app/routes/distribucion_routes.py
- **Blueprint:** `distribucion`
- **Endpoints:**
    - `GET/POST /negocios/<id>/vendedores` (CRUD Vendedores)
    - `GET/POST /negocios/<id>/hoja_ruta` (Create/List Roadmaps)
    - `GET/PUT /hoja_ruta/<id>` (Manage specific roadmap)
    - `GET /negocios/<id>/clientes_mapa` (Get clients with lat/long for map)

#### [MODIFY] app/routes/clientes_routes.py
- Update `create_cliente` and `update_cliente` to handle `latitud`, `longitud`, and `vendedor_id`.

#### [MODIFY] app/__init__.py
- Register `distribucion_routes` blueprint.

### Frontend (HTML/JS)
#### [MODIFY] app/static/admin_apps.html & js/admin_apps.js
- Add "Distribuidora" tab and logic to manage its apps.

#### [MODIFY] app/static/negocios.html
- Add "Distribuidora" to the business type dropdown.

#### [NEW] app/static/vendedores.html & js/vendedores.js
- ABM (CRUD) for Vendedores.

#### [NEW] app/static/hoja_ruta.html & js/hoja_ruta.js
- UI to create Roadmaps: Select seller, date, then pick clients from a list (or map?).
- "Reparto" view: simple list to check off items/visits.

#### [NEW] app/static/mapa_clientes.html & js/mapa_clientes.js
- Leaflet map showing client markers.
- Filter by Seller.


## Verification Plan
### Manual Verification
- Create a new business of type "Distribuidora".
- Check that the new icons appear in the dashboard.
- Create a seller.
- Assign a client to a seller.
- View the client on the map.
- Create a delivery note associated with the seller.
