# Mobile Inventory & Overselling Prevention Plan

This plan outlines the implementation of a "Mobile Inventory" (Inventario Móvil) module. The goal is to track stock levels within each vehicle and prevent overselling by "reserving" or "moving" stock from the warehouse to the truck when a route is loaded.

## User Review Required

> [!IMPORTANT]
> **Inventario por Vehículo**: El stock móvil será **individual por camión**. Cada vehículo funcionará como un "depósito móvil" independiente. Esto permite que el vendedor sepa exactamente qué lleva en su unidad y facilita el control al regreso.

> [!WARNING]
> This requires all active trucks to be properly loaded in the system to ensure warehouse availability is accurate.

## Proposed Changes

### Database Schema

#### [NEW] `vehiculos_stock`
Track the current quantity of each product inside a specific vehicle.

```sql
CREATE TABLE vehiculos_stock (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id),
    producto_id INTEGER REFERENCES productos(id),
    negocio_id INTEGER,
    cantidad DECIMAL(15,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehiculo_id, producto_id)
);
```

---

### Backend Components

#### [MODIFY] `distribucion_routes.py` (file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
Update the `asignar_carga_vehiculo` and `entregar_pedido` logic.

- **`asignar_carga_vehiculo`**: 
    - When assigning a vehicle to routes, calculate the total products in those routes.
    - **Movement**: Subtract total quantities from `productos.stock` and add to `vehiculos_stock` for that vehicle.
- **`entregar_pedido`**:
    - Instead of subtracting from `productos.stock`, subtract from `vehiculos_stock`.
    - Handle cases where a product might be sold without being "preloaded" (optional, for flexibility).
- **`finalizar_liquidacion`**:
    - Return any remaining `vehiculos_stock` to `productos.stock` (Warehouse).

#### [NEW] `mobile_inventory_routes.py` (file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/routes/mobile_inventory_routes.py)
New API endpoints for managing mobile stock.
- `GET /api/vehiculos/<id>/stock`: Returns the current inventory of a truck.
- `POST /api/vehiculos/<id>/ajustar`: Manual stock adjustment for a truck (reconciliation).

#### [MODIFY] `product_routes.py` (file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/routes/product_routes.py)
- **Calculate "Available" Stock**: Adjust the product list API to distinguish between `Total Stock` (in DB) and `Available for Sale` (Warehouse minus Loaded Trucks).

---

### Frontend Components

#### [NEW] `inventario_movil.html` & `inventario_movil.js`
A new view to visualize truck stock.

#### [MODIFY] `hoja_ruta.js` (file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
Update the `Control de Carga` UI to trigger the stock movement API.

#### [MODIFY] `seller.js` (Seller App)
Update the seller app to show "Stock on Truck" so the driver knows what they actually have physically.

## Verification Plan

### Automated Tests
- Script `test_mobile_sync.py`:
    1. Check warehouse stock.
    2. Load a truck with 10 units.
    3. Verify warehouse stock decreased by 10 and truck stock increased by 10.
    4. Sell 2 units from truck.
    5. Verify truck stock is 8, warehouse still -10.
    6. Close route.
    7. Verify warehouse stock recovered 8 units.

### Manual Verification
- Create a route, load it, and check the "Inventario Móvil" tab.
- Perform a sale from the Seller App and check that the truck stock decreases.
