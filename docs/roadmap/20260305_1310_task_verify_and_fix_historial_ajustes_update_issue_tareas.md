# Task: Verify and fix Historial Ajustes update issue

- [x] Research current implementation of `historial_ajustes` <!-- id: 0 -->
    - [x] Inspect `app/static/historial_ajustes.html` <!-- id: 1 -->
    - [x] Inspect `app/static/js/modules/historial_ajustes.js` <!-- id: 2 -->
    - [x] Identify backend routes involved <!-- id: 3 -->
- [x] Investigate potential caching issues <!-- id: 7 -->
    - [x] Check `app/static/js/api.js` <!-- id: 8 -->
    - [x] Check `service-worker.js` <!-- id: 9 -->
- [x] Check page loading logic in `main.js` <!-- id: 10 -->
- [x] Search for all references to `historial_ajustes` <!-- id: 11 -->
- [x] Create Implementation Plan <!-- id: 12 -->
- [x] Resolve route conflict and implement backend fixes for Cash Adjustments <!-- id: 13 -->
- [x] Fix Inventory Adjustment ("Ajuste de Inventario") history <!-- id: 18 -->
    - [x] Research current implementation of `historial_inventario` <!-- id: 19 -->
    - [x] Identify if it's not updating or if filters are broken <!-- id: 20 -->
    - [x] Apply fixes to backend/frontend similar to cash adjustments <!-- id: 21 -->
- [x] Implement Movement Type filter in Inventory History <!-- id: 22 -->
    - [x] Update backend route to support `tipo` parameter <!-- id: 23 -->
    - [x] Update HTML to include Movement Type dropdown <!-- id: 24 -->
    - [x] Update JavaScript to read and send the new filter <!-- id: 25 -->
- [x] Verify both histories are working <!-- id: 6 -->

# Driver App Improvements
- [x] Implement HR filtering (Solo con Pedidos) <!-- id: 26 -->
    - [x] Add filter UI to `home_chofer.html` <!-- id: 27 -->
    - [x] Add filter logic to `home_chofer.js` <!-- id: 28 -->
- [x] Implement Partial Delivery and Rebounds <!-- id: 29 -->
    - [x] Add delivery modal to `home_chofer.html` <!-- id: 30 -->
    - [x] Implement `abrirModalEntrega` logic in `home_chofer.js` <!-- id: 31 -->
    - [x] Integrate with `/api/pedidos/entregar` backend <!-- id: 32 -->
    - [x] Handle rebound reasons from API (Fixed empty dropdown) <!-- id: 33 -->
    - [x] Remove payment confirmation UI for drivers <!-- id: 34 -->
    - [x] Fix 500 Error in delivery confirmation (payload format) <!-- id: 35 -->
- [x] Fix Missing Inventory History for Rebounces <!-- id: 37 -->

# Separar Cobranza (Opción 2)
- [x] Update backend `/api/pedidos/<id>/entregar` to support `solo_bajada` and `solo_cobro` flags <!-- id: 38 -->
- [x] Add `venta_id` to `/chofer/recorrido_unificado` and `/api/negocios/<id>/pedidos?hoja_ruta_id=<id>` response for Modo Repartidor <!-- id: 39 -->
- [x] Update Driver App frontend (`home_chofer.js`) to send `solo_bajada: true` and rename buttons <!-- id: 40 -->
- [x] Update Admin App frontend (`logistica.js` / Modo Repartidor) to handle the "Registrar Cobro" workflow <!-- id: 41 -->
