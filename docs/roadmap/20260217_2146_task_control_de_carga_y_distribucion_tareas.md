# Task: Control de Carga y Distribución

## Completed ✅

- [x] Diseño de UX para Control de Carga
- [x] Tab "Control de Carga" en módulo Hoja de Ruta
- [x] Selector de vehículo con capacidades
- [x] Lista de HRs disponibles con checkboxes
- [x] Cálculo dinámico de capacidad acumulada (peso/volumen)
- [x] Asignación batch de múltiples HRs a vehículo
- [x] Indicador visual de HRs ya asignadas (badge verde + disabled checkbox)
- [x] Vehículo mostrado en Picking List PDF
- [x] Picking List mejorado con sección de productos totales
- [x] Picking List con entregas por cliente (nombre, dirección, productos)
- [x] Estado 'en_camino' para pedidos en ruta
- [x] Transición automática preparado → en_camino al confirmar salida
- [x] Botón manual para cambiar estado a en_camino desde Pedidos

## Pending for Tomorrow 🚀

- [ ] Backend: Endpoint `/api/pedidos/<id>/entregar`
  - [ ] Validar estado actual (debe ser 'en_camino')
  - [ ] Lógica para pago en Efectivo
  - [ ] Lógica para pago Mercado Pago
  - [ ] Integración con Cuenta Corriente existente
  - [ ] Crear venta automáticamente
  - [ ] Registrar movimiento de caja según método

- [ ] Frontend: Modo Repartidor en HR
  - [ ] Botón "Modo Repartidor" en HR activa
  - [ ] Vista/Modal con lista ordenada de paradas
  - [ ] Card por cliente con dirección y productos
  - [ ] Modal de entrega con selector de método de pago
  - [ ] Función `confirmarEntregaPedido(pedidoId, metodoPago)`

- [ ] Testing
  - [ ] Caso: Entrega + cobro efectivo
  - [ ] Caso: Entrega + cobro Mercado Pago
  - [ ] Caso: Entrega + cuenta corriente
  - [ ] Verificar creación de venta
  - [ ] Verificar registro en caja

- [ ] Documentation
  - [ ] Actualizar walkthrough con flujo completo end-to-end
