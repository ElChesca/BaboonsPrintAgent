# Task: Entrega de Pedido y Cobro

## Status
- [x] Backend: Endpoint `/api/pedidos/<id>/entregar`
    - [x] Validar estado actual (debe ser 'en_camino')
    - [x] Lógica para pago en Efectivo (Caja)
    - [x] Lógica para pago Mercado Pago
    - [x] Integración con Cuenta Corriente existente
    - [x] Crear venta automáticamente (reutilizar lógica de ventas)
    - [x] Vincular Venta con Pedido
- [x] Frontend: Modo Repartidor en HR
    - [x] Botón "Modo Repartidor" en HR activa
    - [x] Vista/Modal con lista ordenada de paradas
    - [x] Card por cliente con dirección y productos
    - [x] Modal de entrega con selector de método de pago
    - [x] Lógica de confirmación (Llamada al backend)
- [x] Migración a Seller App (Mobile)
    - [x] Agregar modal de entrega en seller.html
    - [x] Implementar lógica de cobro en seller.js
- [x] Testing & Verification
    - [x] Verificar flujo completo: Pedido -> Entregar -> Venta creada -> Stock descontado -> Caja impactada
