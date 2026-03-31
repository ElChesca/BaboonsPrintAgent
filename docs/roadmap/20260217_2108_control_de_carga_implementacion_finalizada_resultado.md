# Control de Carga - Implementación Finalizada

## Cambios Realizados

### 1. Nueva Interfaz en Módulo Hoja de Ruta

#### Tab Navigation
Agregamos dos pestañas al módulo Hoja de Ruta:
- **"Hojas de Ruta"** - Lista original de hojas de ruta
- **"Control de Carga"** - Nueva interfaz de asignación de vehículos

#### Layout Control de Carga  
La interfaz se divide en dos columnas:

**Columna Izquierda: Selector de Vehículo**
- Dropdown con todos los vehículos activos
- Muestra patente, modelo y capacidades
- Barras de progreso dinámicas para Peso (Kg) y Volumen (m³)
- Los colores cambian según utilización: Verde (<80%), Amarillo (80-100%), Rojo (>100%)
- Botón "Confirmar Carga" para asignar las HRs seleccionadas

**Columna Derecha: Hojas de Ruta Disponibles**
- Muestra TODAS las HRs en estado 'borrador' o 'activa'
- Cada HR muestra:
  - ID, Vendedor, Fecha, Estado
  - Peso total y Volumen total
- Checkbox para seleccionar/deseleccionar cada HR
- Selección múltiple permitida

### 2. Funcionalidad Implementada

**Flujo de Uso:**
1. Usuario abre módulo "Hoja de Ruta"
2. Click en pestaña **"Control de Carga"**
3. Selecciona un vehículo del dropdown
4. Sistema carga automáticamente las HRs disponibles
5. Usuario marca las HRs que desea cargar (checkboxes)
6. Las barras de capacidad se actualizan **en tiempo real** sumando el peso/volumen de todas las HRs seleccionadas
7. Click en "Confirmar Carga"
8. Sistema valida que no exceda capacidad
9. Asigna el vehículo a todas las HRs seleccionadas de una vez

**Validaciones:**
- No permite confirmar sin vehículo seleccionado
- No permite confirmar sin al menos una HR seleccionada
- Backend valida que capacidad no sea excedida (con mensaje detallado si falla)

### 3. Backend Changes

#### Modified: `distribucion_routes.py`

**Endpoint existente mejorado:** `GET /api/vehiculos/carga/hojas_ruta_disponibles`
- Ya existía y funciona correctamente
- Retorna HRs con peso y volumen calculados

**Endpoint existente utilizado:** `POST /api/vehiculos/carga/asignar`
- Acepta `vehiculo_id` y `hoja_ruta_ids` (array)
- Valida capacidad sumando todas las HRs
- Asigna el vehículo a todas las HRs en una transacción

**Mejorado:** `GET /api/hoja_ruta/<id>/picking_list`
- Ahora incluye información del vehículo asignado
- Retorna: `{'productos': [...], 'vehic': {patente, modelo, capacidad_kg, capacidad_volumen_m3}}`

### 4. Frontend Changes

#### `hoja_ruta.html`
- Agregada navegación por tabs
- Agregado tab "Control de Carga" con layout de 2 columnas
- Removido modal obsoleto de asignación individual

#### `hoja_ruta.js`

**Tab Switching Logic:**
- Event listeners en pestañas para mostrar/ocultar tabs
- Inicializa Control de Carga al abrir la pestaña

**Control de Carga Functions:**
- `inicializarControlCargaHR()` - Carga vehículos y configura eventos
- `cargarHojasRutaDisponiblesHR()` - Obtiene HRs disponibles del backend
- `renderHojasRutaCargaHR()` - Renderiza HRs con checkboxes
- `toggleHojaRutaHR(id)` - Maneja selección/deselección de HR
- `actualizarCapacidadHR()` - Calcula capacidad acumulada y actualiza barras
- `confirmarCargaVehiculoMultiple()` - Envía asignación al backend

**Picking List PDF:**
- Modificado `exportarPickingHR_PDF()` para mostrar vehículo asignado
- Formato: "Vehículo Asignado: ABC-123 - Ford F-150"

### 5. Removed Code

- Modal `#modal-asignar-vehiculo` (ya no se usa)
- Funciones `abrirModalAsignarVehiculo()`, `cerrarModalAsignarVehiculo()`, `confirmarAsignacionVehiculo()` (obsoletas)
- Botón "Asignar Vehículo" individual del detalle de HR
- Archivo temporal `hoja_ruta_vehiculo_addon.js` (fusionado al principal)

## Verificación

### Para Probar:

render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/hoja_ruta.html)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/hoja_ruta.js)
render_diffs(file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/distribucion_routes.py)

### Pasos de Prueba:

1. Ir a **Hoja de Ruta** módulo
2. Click en pestaña **"Control de Carga"**
3. Seleccionar un vehículo (ej: ARC-123)
4. Verificar que aparezcan las HRs disponibles
5. Marcar 2-3 HRs con checkbox
6. Verificar que las barras de capacidad se actualicen mostrando suma total
7. Click en **"Confirmar Carga"**
8. Verificar mensaje de éxito
9. Verificar que las HRs desaparezcan de la lista (ya no disponibles)
10. Ir a detalle de alguna HR asignada
11. Verificar que muestre el vehículo en "Vehículo: ABC-123 (Modelo)"
12. Click en **"Imprimir Picking"** desde HR activa
13. Verificar que el PDF muestre "Vehículo Asignado: ABC-123 - Modelo"

## Notas

- El lint errors de Pyre2 en `distribucion_routes.py` son falsos positivos del LSP - no afectan funcionalidad
- La funcionalidad de Control de Carga anterior en módulo "Logística" fue removida como se solicitó
