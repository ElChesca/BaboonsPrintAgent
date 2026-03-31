# Acciones Masivas en Productos

Se ha implementado la funcionalidad de selección múltiple en el maestro de productos para permitir cambios de categoría y eliminaciones en lote.

## Cambios Realizados

### Backend
- **Nuevos Endpoints**:
    - `DELETE /api/productos/bulk`: Elimina múltiples productos de una sola vez.
    - `PUT /api/productos/bulk/categoria`: Cambia la categoría de una lista de productos.

### Frontend
- **Selección Múltiple**: Se agregó una columna de checkboxes en la tabla de inventario.
- **Barra de Acciones Masivas**: Aparece dinámicamente al seleccionar productos, mostrando el conteo y las opciones disponibles.
- **Modal de Categoría**: Un diálogo simplificado para elegir la nueva categoría destino.
- **Confirmación de Borrado**: Integración con SweetAlert2 para evitar eliminaciones accidentales.

## Cómo Utilizar
1. Vaya a la sección de **Inventario**.
2. Seleccione uno o varios productos usando los checkboxes de la izquierda (o use el de la cabecera para seleccionar toda la página).
3. Utilice la barra flotante azul que aparece arriba:
    - **📁 Cambiar Categoría**: Seleccione la nueva categoría y confirme.
    - **🗑️ Eliminar**: Elimine permanentemente los productos seleccionados.
4. Presione **Cancelar** para limpiar la selección.

## Verificación de Calidad
- [x] Selección master (Check All) funciona correctamente.
- [x] La barra de acciones aparece/desaparece según la selección.
- [x] El borrado masivo requiere confirmación y funciona.
- [x] El cambio de categoría masivo actualiza los datos en la tabla.
