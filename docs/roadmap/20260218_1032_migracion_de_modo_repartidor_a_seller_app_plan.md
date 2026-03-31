# Migración de Modo Repartidor a Seller App

La funcionalidad de "Entrega y Cobro" se implementó originalmente en `hoja_ruta.html`. Sin embargo, el usuario indicó que los repartidores usan la aplicación `seller.html`. Este plan detalla la migración de la lógica y la UI.

## 1. Frontend: `seller.html`
- **Agregar Modal de Confirmación de Entrega**: Copiar la estructura HTML del modal `modal-confirmar-entrega` existente en `hoja_ruta.html` e insertarlo en `seller.html`.
- Este modal permite seleccionar el método de pago (Efectivo, Mercado Pago, Cuenta Corriente) y confirmar.

## 2. Lógica: `seller.js`
- **Obtención de datos**:
    - Modificar `loadRouteDetails` para que, además de los items de la hoja de ruta, traiga los **pedidos** asociados (`fetchData(/api/negocios/.../pedidos?hoja_ruta_id=...)`).
    - Esto es necesario para saber qué cliente tiene un pedido "En Camino" listo para entregar.
- **Renderizado de Clientes (`renderClients`)**:
    - Actualizar la función para que cruce los items de la ruta con los pedidos obtenidos.
    - **Estados Visuales**:
        - Si tiene pedido `en_camino`: Mostrar botón "ENTREGAR ($Monto)".
        - Si tiene pedido `entregado`: Mostrar badge "ENTREGADO".
        - Si no tiene pedido (o es solo visita): Mantener botones actuales ("Pedido", "Visita").
- **Implementar Funciones de Entrega**:
    - `abrirModalEntrega(pedido)`: Abre el modal y setea los datos.
    - `confirmarEntrega()`: Llama al endpoint `POST /api/pedidos/{id}/entregar` y actualiza la UI.

## 3. Backend (No requiere cambios)
- El endpoint `POST /api/pedidos/<id>/entregar` ya es funcional y agnóstico del frontend.

## 4. Verificación
- Acceder a `/static/seller.html`.
- Cargar una ruta con pedidos "En Camino".
- Verificar botón "Entregar".
- Realizar flujo de entrega y verificar actualización de estado.
