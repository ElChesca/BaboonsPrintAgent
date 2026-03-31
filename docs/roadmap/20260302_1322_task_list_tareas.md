# Task List

- [x] Deploy current branch to `multinegociobaboons-dev` environment.
- [x] Verify deployment success.
- [x] Add Assigned Seller to Hoja de Ruta PDF
  - [x] Update `/picking_list` endpoint to return seller name
  - [x] Update frontend `exportarPickingHR_PDF` to print it
  - [x] Deploy to Production `multinegociobaboons-fly`
- [ ] User verifies PDF generation in Production
- [x] Add Ubicacion (Location) to Products
  - [x] User executes SQL migration script
  - [x] Update backend `product_routes.py`
  - [x] Update frontend `inventario.html` and `inventory.js`
  - [x] Deploy to Production
- [ ] Implement Bulk Invoice Printing (Remitos Masivos)
  - [x] Add button to `pedidos.html`
  - [x] Extract JS PDF logic in `pedidos.js`
  - [x] Add `imprimirRemitosMasivos` function in `pedidos.js`
  - [x] Deploy to Production
- [ ] User verifies Bulk Invoice Printing in Production
