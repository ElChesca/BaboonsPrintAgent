# Acciones Masivas en Productos (Bulk Actions)

Permitir a los administradores seleccionar múltiples productos mediante checkboxes para realizar acciones en lote: enviarlos a una nueva categoría o eliminarlos permanentemente.

## Cambios Propuestos

### Backend (`app/routes/product_routes.py`)

- **[NUEVO]** `DELETE /api/productos/bulk`: Recibe una lista de `product_ids` y los elimina.
- **[NUEVO]** `PUT /api/productos/bulk/categoria`: Recibe una lista de `product_ids` y un `categoria_id` para actualizar todos los productos seleccionados.

### Frontend UI (`app/static/inventario.html`)

- **[MODIFICAR]** `<thead>`: Agregar una columna inicial con un checkbox maestro "Seleccionar Todo".
- **[NUEVO]** Barra de Acciones Masivas: Un contenedor (inicialmente oculto) que aparece cuando hay productos seleccionados, mostrando:
    - Contador de seleccionados.
    - Botones: "Cambiar Categoría", "Eliminar".
    - Botón "Cancelar".

### Frontend Logic (`app/static/js/modules/inventory.js`)

- **[MODIFICAR]** `renderProductos`: 
    - Insertar checkbox en cada fila.
    - Mantener el estado de selección (`selectedProductIds`).
- **[NUEVO]** Funciones de manejo de UI:
    - `toggleAllProducts(checked)`: Marca/desmarca todos los visibles.
    - `updateBulkActionBar()`: Muestra/oculta la barra según la selección.
- **[NUEVO]** Funciones de API:
    - `ejecutarBorradoMasivo()`: Llama al nuevo endpoint con confirmación de seguridad.
    - `abrirModalCambioCategoriaMasivo()`: Muestra un selector para elegir la nueva categoría y ejecuta el cambio.

## Plan de Verificación

1. **Prueba de Selección**: Verificar que al marcar el checkbox de cabecera se marquen todos y aparezca la barra de acciones.
2. **Borrado Masivo**: Seleccionar 3 productos y borrarlos. Verificar que desaparezcan de la lista y de la base de datos.
3. **Cambio de Categoría**: Seleccionar productos de categorías distintas y moverlos a una nueva. Verificar el cambio en la tabla.
