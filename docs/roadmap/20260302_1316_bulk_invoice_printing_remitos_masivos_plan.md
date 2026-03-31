# Bulk Invoice Printing (Remitos Masivos)

Add functionality to print multiple invoices ("remitos") at once for selected orders in the Preventa/Pedidos module. 

## Proposed Changes

### `app/static/pedidos.html`
- **[MODIFY] `pedidos.html`**
  - Add a new button "Imprimir Remitos" to the bulk actions bar (`#bulk-actions-bar`), alongside the status change buttons.

### `app/static/js/modules/pedidos.js`
- **[MODIFY] `pedidos.js`**
  - **Refactor `imprimirRemitoPDF(id)`**: Extract the `jsPDF` drawing logic (headers, tables, totals, footers) into a reusable helper function `dibujarRemitoEnPDF(doc, pedido)`.
  - **Add `imprimirRemitosMasivos()`**: A new function that reads the selected `pedido-check` checkboxes. It will loop through the selected order IDs, fetch the order data for each from the API, and use `dibujarRemitoEnPDF()` to draw them all into a single multi-page `jsPDF` document (using `doc.addPage()` between orders).
  - Export the new function to `window` so it can be triggered from the HTML button.

## Verification Plan
1. Select multiple orders from the list.
2. Click the new "Imprimir Remitos" button.
3. Validate that a single PDF is downloaded.
4. Open the PDF and verify it contains one page per selected order, with accurate order details.
