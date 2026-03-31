# Plan de Implementación - Refactorización del Módulo de Clientes

El usuario reportó que la interfaz actual es "fea" y poco intuitiva ("no aparece la opción de nuevo cliente"). Refactorizaremos el módulo para seguir un patrón moderno de **Lista + Modal**.

## Revisión del Usuario Requerida

> [!NOTE]
> Se eliminará el diseño de "Formulario a la izquierda, Tabla a la derecha". La página ahora mostrará una lista de clientes de ancho completo. Crear o Editar un cliente abrirá una ventana Modal centrada.

## Cambios Propuestos

### Estructura Frontend (`app/static/clientes.html`)

#### [MODIFICAR] [clientes.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/clientes.html)
-   **Eliminar** el diseño dividido `.main-grid`.
-   **Crear** una sección de "Encabezado" con el Título, Barra de Búsqueda y un botón destacado de **"Nuevo Cliente"**.
-   **Mover** el `<form id="form-cliente">` dentro de un `<div id="modal-cliente" class="modal">` oculto.
-   **Estilizar** la tabla para que sea de ancho completo y responsive.

### Lógica Frontend (`app/static/js/modules/clientes.js`)

#### [MODIFICAR] [clientes.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/clientes.js)
-   **Agregar** lógica para abrir/cerrar `#modal-cliente`.
-   **Actualizar** `poblarFormulario`: Abrir el modal después de poblar los datos.
-   **Actualizar** `resetFormulario`: Limpiar formulario y Abrir el modal (para la acción "Nuevo Cliente").
-   **Corregir**: Llamar a `map.invalidateSize()` cuando se abra el modal para asegurar que el Mapa se renderice correctamente.

### Despliegue y Estilo (`app/static/css/clientes.css` o `global.css`)
-   Asegurar que los estilos del Modal sean premium (desenfoque de fondo, bordes redondeados, sombra).
-   Mejorar el estilo de la Tabla (si no está ya cubierto por los estilos globales).

## Plan de Verificación

### Verificación Manual
1.  **Flujo de Nuevo Cliente**:
    -   Hacer clic en "Nuevo Cliente".
    -   Verificar que se abre el Modal.
    -   Verificar que el Mapa carga correctamente (sin áreas grises).
    -   Verificar que el interruptor "Potencial" sigue funcionando.
    -   Guardar y verificar que el Modal se cierra y la Lista se actualiza.
2.  **Flujo de Editar Cliente**:
    -   Hacer clic en "Editar" en un cliente.
    -   Verificar que se abre el Modal con los datos pre-cargados.
    -   Guardar y verificar las actualizaciones.
3.  **Chequeo Responsive**:
    -   Verificar que el Modal funciona en pantallas más pequeñas (si es posible).

# Importación Masiva de Clientes (CSV)
## Base de Datos
```sql
ALTER TABLE clientes 
ADD COLUMN visita_lunes BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_martes BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_miercoles BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_jueves BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_viernes BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_sabado BOOLEAN DEFAULT FALSE,
ADD COLUMN visita_domingo BOOLEAN DEFAULT FALSE,
ADD COLUMN vendedor_externo_id VARCHAR(50); -- Para guardar el ID del CSV
```

## Backend
### [NEW] [import_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/import_routes.py)
- Nuevo endpoint `POST /negocios/{id}/importar/clientes`.
- Lógica de parseo de CSV (usando `csv` module o `pandas` si estuviera, preferible stdlib `csv`).
- Mapeo:
    - `canal` -> `actividad`
    - `domicilio` -> `direccion`
    - `vendedor` -> `vendedor_externo_id`
    - Columnas de días (si valor > 0 o "TRUE") -> `visita_X = TRUE` (domingo a sabado)

## Frontend
### [MODIFY] [clientes.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/clientes.html)
- Agregar botón "Importar CSV" en la cabecera.
- Modal simple para subir archivo.

---

## Client Pagination & Grid Optimization

### Goal Description
Optimize the client management interface to handle larger datasets (2000+ records) by implementing server-side pagination and a more compact grid layout.

### Proposed Changes

#### Backend
1.  **Modify `conf_negocio_routes.py` (or wherever `get_clientes` lives)**:
    *   Update `GET /api/negocios/<id>/clientes` to accept query params: `page` (default 1), `limit` (default 20, max 100), `search` (optional).
    *   Implement SQL `LIMIT` and `OFFSET` based on these parameters.
    *   Return metadata: `total_items`, `total_pages`, `current_page`.

#### Frontend (`clientes.js` & `clientes.html`)
1.  **State Management**: Add `currentPage`, `itemsPerPage`, `totalItems` to `appState` or module scope.
2.  **API Call**: Update `cargarClientes()` to send pagination params.
3.  **UI Controls**: Add "Previous", "Next", and "Page X of Y" controls below the grid.
4.  **CSS Optimization**:
    *   Reduce cell padding.
    *   Truncate long text (address/name) with ellipsis.
    *   Verify responsive behavior.

### Verification Plan
1.  **Manual Test**: Check if only 20 items load initially.
2.  **Navigation**: Test "Next" and "Previous" buttons functionality.
3.  **Search**: Verify search works in conjunction with pagination (resets to page 1).
4.  **Performance**: Confirm page load is instant with 2000 records.

---

## Client Map Optimization

### Goal Description
Improve the visualization of the Client Map for large datasets (2000+ points), as default markers are too large and clutter the view.

### Proposed Changes
#### Frontend (`mapa_clientes.js` or `clientes.js`)
1.  **Replace Markers**: Switch from `L.marker` to `L.circleMarker`.
2.  **Style**:
    *   Radius: 6px
    *   FillColor: Blue (default) / Red (inactive?)
    *   Stroke: White, width 1px
    *   Opacity: 0.8
3.  **Interaction**: Maintain popup functionality on click.

---

## Client Audit Fields (Revisado)

### Goal Description
Add an audit mechanism to the client list to help the user "normalize" their database.
Fields: `Revisado` (Boolean), `Fecha Revisión` (Auto), `Usuario Revisión` (Auto).

### Proposed Changes

#### Database
```sql
ALTER TABLE clientes 
ADD COLUMN revisado BOOLEAN DEFAULT FALSE,
ADD COLUMN fecha_revision TIMESTAMP,
ADD COLUMN usuario_revision_id INT REFERENCES usuarios(id);
```

#### Backend (`clientes_routes.py`)
1.  **GET /clientes**:
    *   Join `usuarios` to get `usuario_revision_nombre`.
    *   Support `revisado` filter query param (`true`, `false`, `all`).
2.  **PUT /clientes/<id>/toggle_revision**:
    *   New endpoint for the toggle action.
    *   If setting `revisado=true`: set `fecha_revision = NOW()` and `usuario_revision_id = current_user.id`.
    *   If setting `revisado=false`: Clear fields.

#### Frontend (`clientes.js`)
1.  **UI Filter**: Add a select dropdown next to the search bar: `[Todos / Revisados / Pendientes]`.
2.  **Table Column**: Add "Estado" column.
    *   Show a Checkbox or Button.
    *   If checked: Show Green confirm icon. Hovering shows "Revisado por [User] el [Fecha]".
    *   If unchecked: Show gray/outline icon.
3.  **Action**: Clicking the icon toggles the state immediately (optimistic UI) and calls the API.

### Verification Plan
1.  **Migration**: Verify columns exist.
2.  **Toggle**: Click "Revisado" on a client. Reload page. Verify it stays checked.
3.  **Audit Info**: Hover over the check. Verify it shows YOUR username and TODAY's date.
4.  **Filter**: Select "Pendientes". Verify the checked client disappears.

---

## Seller Assignment & Visit Days (Tabbed Interface)

### Goal Description
Allow users to assign a specific "Vendedor" (Seller) and "Días de Visita" to a client. These fields should be organized in a new tab within the Client Modal.

### Proposed Changes

#### Backend (`clientes_routes.py`)
1.  **POST /clientes**: Update `INSERT` to include `visita_lunes`, `visita_martes` ... `visita_domingo`.
2.  **PUT /clientes/<id>**: Update `allowed_fields` to include `visita_lunes` ... `visita_domingo`.

#### Frontend (`clientes.html`)
1.  **Modal Structure**: Refactor `#modal-cliente` to use Tabs:
    *   **Tab 1: General**: Existing fields (Name, DNI, Address, Map, etc.).
    *   **Tab 2: Ventas/Logística**: New fields.
2.  **New Fields (Tab 2)**:
    *   **Vendedor**: `<select>` dropdown (populated from `/api/vendedores`).
    *   **Días de Visita**: Checkboxes for Mon-Sun.

#### Frontend (`clientes.js`)
1.  **Tab Logic**: Add event listeners to switch tabs.
2.  **Data Loading**:
    *   Fetch sellers (`/api/negocios/{id}/vendedores`) and populate the select.
    *   In `poblarFormulario`, set the `vendedor_id` and check/uncheck visit days.
3.  **Data Saving**: Include new fields in the JSON payload.

### Verification Plan
1.  **UI**: Open "New Client". Verify tabs work.
2.  **Assignment**: Select a Seller and "Monday". Save.
3.  **Persistence**: Edit the client again. Verify Seller and "Monday" are still selected.
4.  **Map Filter**: The Map already filters by `vendedor_id`, confirming end-to-end integration.
