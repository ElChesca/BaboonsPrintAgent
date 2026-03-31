# Task Checklist - Fixing Logistics & Identification Issues

- [x] Corrección de Errores Logísticos [x]
    - [x] Implementar `marcarVisitaChofer` en `logistica.js`
    - [x] Corregir lógica de visualización del botón de cobro en `logistica.js`
    - [x] Asegurar que `abrirModalEntregaChofer` esté disponible (con fallback)
    - [x] Exportar funciones necesarias al objeto `window`
    - [x] Verificar funcionamiento básico de bajada y cobro

- [x] Mejora de Identificación de Pedidos [x]
    - [x] Agregar columna con Número de Pedido en la tabla de Gestión de Pedidos (`pedidos.html` / `pedidos.js`)
    - [x] Mostrar Número de Pedido en el modal de "Confirmar Entrega y Registrar Cobro" (`hoja_ruta.html` / `logistica.js`)

- [x] Refinamiento de Fluencia Pedido-Venta [x]
    - [x] Mejorar `anular_venta` para desvincular el pedido y volverlo a estado 'en_camino'
    - [x] Verificar que el desvincular limpie el `venta_id` en el pedido
    - [x] Agregar columna "Pedido / HR" al Historial de Ventas (`historial_ventas.html` / `historial_ventas.js`)

- [x] Verificación Final [x]
    - [x] Verificar que tras anular una venta vinculada a un pedido, este último permita ser re-cobrado.
    - [x] Validar que la nueva columna sea legible.
