# Refining Order-Sale Lifecycle Flow

To improve the user experience when handled errors in confirmed orders, we will refine the connection between `Pedidos` and `Ventas`.

## User Review Required

> [!CAUTION]
> **Reflow of Order State**: When a sale linked to an order is voided (Anulada via NC), the order itself will now return to `en_camino` status and its `venta_id` will be cleared. This allows the order to be re-confirmed and re-billed.

## Proposed Changes

### [Backend]

#### [MODIFY] [sales_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/sales_routes.py)
- In the `anular_venta` function:
    - Search for any order (`pedido`) where `venta_id` matches the current `venta_id`.
    - If found, update the order:
        - Set `venta_id = NULL`.
        - Set `estado = 'en_camino'`.
        - Add an audit note to `observaciones`.

---

### [Documentation & UX]

#### [NEW] [walkthrough.md](file:///C:/Users/usuario/.gemini/antigravity/brain/f57ee7c9-41bf-4979-bc53-6b2d931dba38/walkthrough.md)
- Update with a clear explanation of the two ways to handle errors:
    1.  **Corregir Pago** (Preferred): Directly Change the payment method in Order Management. No stock/void/rebill needed.
    2.  **Anular Venta** (Full reversal): Use when the items or quantities were wrong. Now the order is automatically released for re-billing.

## Verification Plan

### Automated Tests
1.  **Test Anulación**: Confirm an order, verify the `Venta` is created and the `Pedido` is `entregado`. Void the sale and verify the `Pedido` returns to `en_camino` and `venta_id` is null.

### Manual Verification
1.  Verify the "Corregir Pago" button in Order Management still works as expected.
2.  Verify that after voiding a sale, the "Registrar Cobro" button appears again for that order in the logistics view.
