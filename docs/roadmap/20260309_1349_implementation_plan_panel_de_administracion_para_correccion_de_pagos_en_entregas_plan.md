# Implementation Plan: Panel de Administración para Corrección de Pagos en Entregas

El usuario solicita una herramienta administrativa para corregir situaciones comunes: un chofer/vendedor confirmó una entrega como "Cuenta Corriente" pero recibió el pago en "Efectivo" (o viceversa). 
Esta función debe modificar el método de pago registrado y nivelar financieramente la caja y la cuenta corriente.

## Flujo Completo (Diagrama)

```mermaid
graph TD
    A[Admin en 'Pedidos' clickea 'Corregir Pago'] --> B[Se abre Modal para elegir nuevo Medio de Pago]
    B --> C[POST /api/pedidos/{id}/corregir_pago]
    C --> D{¿Método Anterior?}
    D -->|Cuenta Corriente| E[Borrar pago (Haber) de Cta. Cte.]
    D -->|Efectivo/MP| F[Generar 'Egreso' en Caja Actual para contrarrestarlo]
    E --> G{¿Método Nuevo?}
    F --> G
    G -->|Cuenta Corriente| H[Generar pago (Haber) en Cta. Cte.]
    G -->|Efectivo| I[Generar 'Ingreso' en Caja Actual]
    H --> J[UPDATE ventas SET metodo_pago = nuevo_metodo]
    I --> J
    J --> K[Recargar UI - Listo]
```

## Proposed Changes

### Backend

#### [NEW] `pedidos_routes.py`
- Agregar endpoint `POST /api/pedidos/<int:pedido_id>/corregir_pago`.
- **Lógica Financiera**:
  - Obtener la venta original a través del `venta_id` del pedido.
  - **Revertir efecto anterior**: Si era "Cuenta Corriente", eliminar/anular el registro de `clientes_cuenta_corriente`. Si era otro método financiero ("Efectivo", etc.), generar una salida compensatoria (`Egreso`) en la caja activa del Admin.
  - **Aplicar nuevo efecto**: Si el nuevo es "Cuenta Corriente", registrar el pago en `clientes_cuenta_corriente`. Si es "Efectivo", registrar un `Ingreso` en la caja activa del Admin.
  - Actualizar el campo `metodo_pago` directamente en la tabla `ventas`.

### Frontend

#### [MODIFY] [pedidos.html](file:///C:/Users/usuario/Documents/MultinegocioBaboons/app/static/pedidos.html)
- Agregar un código HTML estructurado (usando la clase `.baboons-modal` requerida por las guías) para el modal `modal-corregir-pago`.
- El modal debe tener un `<select>` con los medios básicos (Efectivo, Mercado Pago, Cuenta Corriente, Tarjeta, Transferencia).

#### [MODIFY] `pedidos.js` (u hoja_ruta.js) dependiente
- En la función que pinta las acciones por renglón (`cargarPedidos` o donde se dibujen las filas), agregar un botón "Corrección" o ícono de engranaje para los pedidos que estén en estado `entregado`.
- Lógica JS para capturar el clic, abrir el modal `modal-corregir-pago`, y al confirmar, enviar la petición fetch al nuevo endpoint.

## Revisión Requerida (User Review)
> [!WARNING]
> Dado que esta función revertirá e ingresará dinero en "Caja", **el Administrador que ejecute la corrección a Efectivo debe tener una Caja Abierta** en su sesión actual para poder registrar el ingreso de nivelación, para preservar el control de arqueo.

## Verification Plan
### Pruebas Manuales:
1. Ir a **Gestión de Pedidos**.
2. Buscar un pedido ya entregado como "Cuenta Corriente".
3. Apretar el nuevo botón de corregir pago y pasarlo a "Efectivo".
4. Verificar que la cuenta corriente del cliente haya vuelto a su estado original (se eliminó el descuento del pedido).
5. Verificar en Caja que se registró un ingreso extra etiquetado como "Corrección Manual".
