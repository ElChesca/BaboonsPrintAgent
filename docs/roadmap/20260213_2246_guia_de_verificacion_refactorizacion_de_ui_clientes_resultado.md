# Guía de Verificación - Refactorización de UI Clientes

Esta guía describe cómo probar la nueva interfaz de "Clientes" con diseño de Lista + Modal.

## Cambios Realizados

- **Diseño**: Se eliminó el formulario fijo a la izquierda. Ahora la lista de clientes ocupa todo el ancho.
- **Modal**: Se implementó una ventana emergente (Modal) para "Añadir Nuevo Cliente" y "Editar Cliente".
- **Botón**: Nuevo botón "➕ Nuevo Cliente" en la parte superior.

## Pasos de Verificación

### 1. Verificar Diseño General
1.  Vaya al módulo de **Clientes**.
2.  **Verifique**:
    -   No debe verse el formulario a la izquierda.
    -   La tabla de clientes debe ocupar el ancho completo.
    -   Debe aparecer el botón "➕ Nuevo Cliente" arriba a la derecha.

### 2. Crear un Cliente (Modal)
1.  Haga clic en **"➕ Nuevo Cliente"**.
2.  **Verifique**:
    -   Se abre una ventana modal centrada.
    -   El título dice "Añadir Nuevo Cliente".
    -   El formulario está limpio.
    -   El **Mapa** se carga correctamente dentro del modal (no se ve gris).
3.  Complete los datos (pruebe "Potencial" para ver si oculta campos).
4.  Haga clic en **Guardar**.
5.  **Verifique**: El modal se cierra y el cliente aparece en la lista.

### 3. Editar Cliente (Modal)
1.  Busque un cliente en la lista y haga clic en **Editar**.
2.  **Verifique**:
    -   Se abre el modal con los datos cargados.
    -   El título dice "Editar Cliente".
    -   El mapa muestra la ubicación guardada (si tiene).
3.  Modifique algún dato y guarde.
4.  **Verifique**: El modal se cierra y la tabla muestra el cambio.

### 4. Importación Masiva (Excel)
1.  Haga clic en el botón de **Importar**.
2.  Descargue la **Plantilla Excel**.
3.  Llene la plantilla con datos de prueba (use formatos correctos para fechas y números).
4.  Suba el archivo y verifique que los clientes se creen.

### 5. Paginación y Grilla Compacta
1.  Observe la tabla de clientes.
    -   Debe verse más compacta (filas más bajas, texto ajustado).
    -   Si tiene más de 50 clientes, deben aparecer controles de paginación al final ("Anterior", "1 / X", "Siguiente").
2.  Pruebe navegar entre páginas.
3.  Pruebe el **Buscador**:
    -   Escriba un nombre.
    -   Verifique que la búsqueda filtre los resultados y resetee la paginación a la página 1.

### 6. Mapa de Clientes (Puntos)
1.  Vaya a la pestaña de **Mapa** (si existe una vista separada) o observe el mapa en el modal.
    -   NOTA: La optimización de puntos se aplicó al mapa general de clientes (`mapa_clientes.js`).
    -   Vaya a la sección de **Mapa Georeferenciado** (icono de mapa en el menú lateral o botón correspondiente).
2.  **Verifique**:
    -   Los clientes deben aparecer como **Puntos Circulares** (pequeños) en lugar de marcadores grandes.
    -   Al hacer clic en un punto, debe abrirse un popup con la info del cliente.

### 7. Verificación de Correcciones (Regression Fixes)
1.  **Mapa de Clientes (General)**:
    -   Vaya al módulo "Mapa de Clientes".
    -   Verifique que **ahora sí aparecen los puntos** (antes podía estar vacío).
2.  **Ficha Cliente - Lat/Long**:
    -   Edite un cliente.
    -   Verifique que los campos **Latitud** y **Longitud** ahora son **editables** (ya no están en gris/readonly).
    -   Puede escribir manualmente coordenadas si lo desea, o usar el mapa.
3.  **Selectores en otros módulos**:
    -   Vaya a **Ventas** o **Presupuestos**.
    -   Intente buscar un cliente en el selector. Debe funcionar correctamente (antes podría haber fallado silenciosamente).

### 8. Auditoría y Normalización de Clientes
1.  **Filtro de Estado**:
    -   En la lista de clientes, use el selector junto al buscador.
    -   Pruebe "Todos", "Pendientes" y "Revisados".
2.  **Marcar como Revisado**:
    -   En la columna "Rev.", haga clic en el icono gris (círculo vacío).
    -   Debe cambiar a verde (check) y mostrar una notificación de éxito.
3.  **Verificar Información**:
    -   Pase el mouse sobre un check verde.
    -   Debe aparecer un tooltip: "Revisado por [Tu Usuario] el [Fecha]".
4.  **Desmarcar**:
    -   Haga clic en un check verde para volver a estado "Pendiente".

### 9. Asignación de Vendedor y Días de Visita
1.  **Nuevo Modal con Pestañas**:
    -   Al Crear o Editar un cliente, ahora verá dos pestañas: **Datos Generales** y **Logística y Ventas**.
2.  **Logística y Ventas**:
    -   Haga clic en la pestaña "Logística y Ventas".
    -   **Vendedor**: Seleccione un vendedor de la lista desplegable.
    -   **Días de Visita**: Marque los días de la semana (Lun-Dom) que se realizan visitas.
    -   **Mapa**: El mapa ahora se encuentra en esta pestaña para mejor organización.
3.  **Guardado**:
    -   Al guardar el cliente, estos datos se persistirán.
    -   Al volver a editar, verifique que los datos se han guardado correctamente.

### 10. Gestión de Vendedores (NUEVO)
1.  **Zonas Geográficas**:
    -   Vaya a la sección **Vendedores** (en Distribuidora).
    -   Verá un botón amarillo **"Zona"** en cada fila.
    -   Al hacer clic, se abre un mapa.
    -   Use los controles de dibujo (hexágono/cuadrado) para marcar el área de cobertura.
    -   Seleccione un **Color** identificativo.
    -   Guarde.
2.  **Visualización en Mapa Global**:
    -   Vaya al **Mapa de Clientes**.
    -   Las zonas guardadas se mostrarán como polígonos coloreados de fondo.
    -   Esto permite ver visualmente qué clientes caen dentro de qué zona de vendedor.
    -   **Pines Coloreados:** Los pines de los clientes tomarán automáticamente el color de su vendedor asignado, facilitando la identificación rápida.

