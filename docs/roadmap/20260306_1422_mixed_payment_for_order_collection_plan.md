# Mixed Payment for Order Collection

The user wants to allow a "Mixed" payment method where they can pay a portion in Cash/Mercado Pago and the remainder is added to the client's debt (Cuenta Corriente).

## Proposed Changes

### Seller App (Frontend) - [Restrict to Delivery Only]

The seller app should only allow confirming the "Bajada" (delivery) and adjusting quantities/bonifications, without handling the actual payment collection.

#### [MODIFY] [seller.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/seller.html)
- [DELETE] Payment method radio buttons and Mixed Payment container.
- Update button text from "CONFIRMAR RENDICIÓN PAGO" to "CONFIRMAR ENTREGA (BAJADA)".

#### [MODIFY] [seller.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/seller.js)
- Remove logic that shows/hides payment containers.
- Modify `confirmarEntregaBackend` to NOT send a payment method (or send a special 'entrega_sin_cobro' flag).

---

### Driver Mode / Admin (Frontend) - [Payment Collection]

The "Modo Repartidor" in the Admin interface will retain the full "Mixed Payment" functionality for final collection.

#### [MODIFY] [hoja_ruta.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
- Retain the updated Mixed Payment UI for Admins/Drivers.

#### [MODIFY] [logistica.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/logistica.js)
- Retain the split-payment calculation logic.

---

### Backend (API)

#### [MODIFY] [distribucion_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)
- Modify `entregar_pedido` to handle cases where NO payment is provided (seller delivery).
- If no payment is provided, mark the order as delivered but do NOT create a sale or current account movement yet (or mark as pending collection).
- **Enhance `entregar_pedido`**:
    - Update the `Mixto` logic to calculate the remainder: `monto_cta_cte = total_final - (monto_ef + monto_mp)`.
    - If `monto_cta_cte > 0`, insert a record into `clientes_cuenta_corriente`.
    - Also, ensure that if `metodo_pago == 'Cuenta Corriente'` (single method), it also records the movement in `clientes_cuenta_corriente` (currently missing).
    - Link the `venta_id` of the main transaction (Efectivo or Cta Cte) to the account movement.

## Verification Plan

### Automated Tests
- Test various payment ratios (e.g., all Cash, all MP, half/half, half Cash + half Cta Cte).
- Verify that `total_final` matches the sum of all recorded parts (Cash + MP + Debt).

### Manual Verification
- Perform a delivery using "Pago Mixto + Cta Cte".
- Check the "Caja" to see the Cash/MP portions recorded.
- Check the "Cuenta Corriente" of the client to see the debt recorded.
- Verify the receipt sent via WhatsApp reflects the split.
