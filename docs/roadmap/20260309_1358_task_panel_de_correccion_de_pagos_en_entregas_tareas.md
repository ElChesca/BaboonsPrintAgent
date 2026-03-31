# Task: Panel de Corrección de Pagos en Entregas

## Planificación
- [x] Crear Implementation Plan detallado
- [x] Aprobación del usuario

## Backend (`distribucion_routes.py` / `pedidos_routes.py`)
- [x] Crear endpoint `POST /api/pedidos/<id>/corregir_pago`
- [x] Implementar reversión del pago original (Caja o Cta Cte)
- [x] Implementar registro del nuevo pago (Caja o Cta Cte)
- [x] Actualizar `metodo_pago` en la tabla `ventas`
- [x] Agregar validación estricta de Caja Abierta para cualquier método distinto a Cta. Cte.
- [x] Requerir campo `motivo` y registrarlo en auditoría/observaciones.

## Frontend HTML (`pedidos.html`)
- [x] Agregar estructura del modal `modal-corregir-pago` usando clases `.baboons-modal`
- [x] Agregar `textarea` para el motivo obligatorio.

## Frontend JS (`pedidos.js`)
- [x] Renderizar botón "Corregir Pago" para pedidos "entregados"
- [x] Lógica para abrir modal y cargar datos del pedido
- [x] Fetch request al nuevo endpoint y actualización de UI
- [x] Enviar el `motivo` en el payload y validar que no esté vacío.
- [x] Recargar tabla tras éxito
