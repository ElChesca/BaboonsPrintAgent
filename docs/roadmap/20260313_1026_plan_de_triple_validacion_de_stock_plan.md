# Plan de Triple Validación de Stock

Este plan añade un tercer nivel de control de stock, permitiendo decidir si se bloquean los pedidos desde el momento de su creación.

## Reglas Configurables
- **Ventas Directas**: Controla el mostrador. (`vender_stock_negativo`)
- **Pedidos (Flujo)**: Controla el paso a "Preparado" y la "Carga de Camión". (`pedidos_stock_negativo`)
- **Pedidos (Creación)**: NUEVA REGLA. Controla el bloqueo al tomar el pedido. (`bloquear_pedido_sin_stock`)

## Proposed Changes

### 1. Base de Datos
- Crear migración para añadir `bloquear_pedido_sin_stock` (Default 'No') a todos los negocios.

### 2. Frontend
#### [MODIFY] [configuracion.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/configuracion.html)
- Añadir el tercer selector: "¿Bloquear creación de pedidos si no hay stock?".

### 3. Backend
#### [MODIFY] [pedidos_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/pedidos_routes.py)
- **Creación**: En `create_pedido`, si la nueva regla es "Si", validar stock de cada item.
- **Edición**: En `update_pedido_content`, aplicar la misma lógica al guardar cambios en pedidos pendientes.

## Verification Plan
1. **Flujo de Preventa (Recomendado)**:
   - Creación Stock=No, Flujo Stock=No. 
   - Debe permitir crear el pedido sin stock, pero bloquear al intentar cargarlo al camión.
2. **Flujo Restrictivo**:
   - Creación Stock=Si.
   - Debe bloquear el pedido inmediatamente si algún producto no tiene stock suficiente en el depósito.
