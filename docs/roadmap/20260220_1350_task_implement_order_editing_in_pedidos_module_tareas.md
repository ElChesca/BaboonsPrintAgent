# Task: Implement Order Editing in Pedidos Module

## Research & Planning
- [x] Explore backend routes for pedidos `pedidos_routes.py`
- [x] Explore frontend orders module `pedidos.js` and `pedidos.html`
- [x] Create implementation plan

## Backend Implementation
- [x] Verify/Refine `PUT /pedidos/<id>` in `pedidos_routes.py`
    - [x] Support `bonificacion` column
- [x] Update `hoja_ruta.js` to send `bonificacion` correctly

## Frontend Implementation
- [x] Update `pedidos.html`
    - [x] Add the order editing modal
- [x] Update `pedidos.js`
    - [x] Implement `abrirModalEditarPedido(id)`
    - [x] Implement product search and selection logic
    - [x] Implement item editing logic
    - [x] Implement save logic calling `PUT /api/pedidos/<id>`
    - [x] Update `renderPedidos` to show "Editar" button conditionally

## Verification
## Bug Fixing
- [x] Corregir Cálculo de Totales con Bonificación (Documentado en Walkthrough)
- [x] Corregir Errores de JS en Módulo de Pedidos (ReferenceError: appState, mostrarNotificacion)

## Remito de Entrega
- [x] Agregar botón "Imprimir Remito" en `pedidos.html`
- [x] Implementar `imprimirRemitoPDF(id)` en `pedidos.js` (Mejorado: Join Vendedor, Parsing Bonif, Posición Obs)
- [x] Sincronizar Modal de Detalle con el PDF (Columna Bonif. y Totales)
- [x] Agregar Tip/Aclaración de Bonificaciones (10+1) en el UI
- [x] Verificar generación correcta de PDF con bonificaciones y firma## Bonificación por Pago Contado
- [x] Backend: Soportar campo `descuento` en registro de entrega
- [x] Frontend (Seller): Añadir campo de descuento en modal de cobro
- [x] Frontend (Seller): Lógica de cálculo en tiempo real
- [x] PDF: Mostrar descuento en Remito/Recibo

## Recibo de Pago y WhatsApp
- [x] Implementar generación de Recibo de Pago (PDF o Texto)
- [x] Frontend (Seller): Añadir botón "Enviar Recibo por WhatsApp" post-cobro
- [x] Backend/UI: Implementar aviso WhatsApp para estado "Preparado"

