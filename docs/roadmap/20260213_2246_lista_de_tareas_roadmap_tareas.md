# Lista de Tareas (Roadmap)

- [x] Analizar código base para conceptos existentes de 'prospecto' o patrones similares <!-- id: 0 -->
- [/] Determinar estrategia de modelo de datos: Nueva tabla vs. Atributo en `clientes` <!-- id: 1 -->
- [x] Crear Plan de Implementación <!-- id: 2 -->
- [x] Implementar cambios en backend (Esquema, API) <!-- id: 3 -->
- [x] Implementar cambios en frontend (UI para creación, Integración de Mapa) <!-- id: 4 -->
- [x] Verificar funcionalidad <!-- id: 5 -->

# Tareas de Refactorización de UI
- [ ] Crear Plan de Implementación de Refactorización <!-- id: 6 -->
- [x] Refactorizar estructura HTML (Lista + Modal) <!-- id: 7 -->
- [x] Actualizar lógica JS (Manejo de Modal, Redimensionamiento de Mapa) <!-- id: 8 -->
- [x] Mejorar estilo CSS <!-- id: 9 -->
- [x] Verificar Refactorización <!-- id: 10 -->

# Tareas Adicionales
- [x] Agregar Categoría Gastos a Home Distribuidora <!-- id: 11 -->

# Debugging
- [x] Investigar error de validación de Caja en Gastos <!-- id: 12 -->

# UI Improvements
- [x] Compactar estilo de Categorías <!-- id: 13 -->

# Database & Fields
- [x] Agregar campo 'Actividad' a Clientes (Backend + UI) <!-- id: 14 -->

- [x] Debuggear error 500 en Reporte de Caja <!-- id: 15 -->

- [x] Importación Masiva de Clientes (Excel) <!-- id: 16 -->
    - [x] DB: Agregar columnas `visita_lunes`...`visita_domingo` y `vendedor_externo_id`
    - [x] Backend: Instalar openpyxl y actualizar endpoint para .xlsx
    - [x] Backend: Endpoint para descargar plantilla Excel
    - [x] Frontend: Actualizar modal para aceptar .xlsx y descargar plantilla

- [x] Generar script de limpieza de Clientes <!-- id: 17 -->

- [x] Implementar Paginación y Optimización de Grilla de Clientes <!-- id: 18 -->
    - [x] Backend: Modificar endpoint GET clientes para aceptar `page` y `limit`
    - [x] Frontend: Implementar paginación en `clientes.js` y controles UI
    - [x] Frontend: CSS para grilla más compacta

- [x] Optimizar Visualización del Mapa de Clientes <!-- id: 19 -->
    - [x] Frontend: Cambiar marcadores por `L.circleMarker` (puntos) para reducir ruido visual
    - [x] Frontend: Implementar colores según estado (opcional)

# Tareas de Auditoría y Normalización de Clientes
- [x] Implementar Campos de Auditoría (Revisado) <!-- id: 20 -->
    - [x] DB: Agregar columnas `revisado`, `fecha_revision`, `usuario_revision_id`
    - [x] Backend: Actualizar `GET /clientes` para incluir datos de auditoría
    - [x] Backend: Filtros de "Revisado" en `GET /clientes`
    - [x] Backend: Endpoint/Lógica para marcar como revisado (con fecha y usuario auto)
    - [x] Frontend: Agregar columna "Revisado" en tabla
    - [x] Frontend: Agregar filtro "Estado Revisión" en barra de búsqueda
    - [x] Frontend: Mostrar detalles (Quién/Cuando) en tooltip
    - [x] Frontend: Mostrar detalles (Quién/Cuando) en tooltip

# Asignación de Vendedor y Días de Visita
- [x] Implementar Tabs y Campos Nuevos en Cliente <!-- id: 21 -->
    - [x] Backend: Actualizar `POST` y `PUT` en `clientes_routes.py` para columnas `visita_*`
    - [x] Frontend: Reestructurar Modal con Tabs (General / Ventas)
    - [x] Frontend: Agregar Select de Vendedor y Checkboxes de Días
    - [x] Frontend: Lógica de Tabs en JS
    - [x] Frontend: Cargar lista de Vendedores
    - [x] Frontend: Guardar y Cargar datos de visita

# Corrección de Errores
- [x] Corregir Duplicados en Importación de Clientes <!-- id: 22 -->
    - [x] Backend: Verificar existencia por Nombre antes de insertar (Update vs Insert)
    - [x] Backend: Normalizar campo 'Actividad' para coincidir con lista desplegable
    - [x] Backend: Resolver `vendedor_id` a partir de `vendedor_externo_id` (Nombre o ID)

# Zonas de Vendedores
- [x] Implementar Dibujo de Zonas en Mapa <!-- id: 23 -->
    - [x] DB: Agregar columnas `zona_geografica` y `color` a `vendedores`
    - [x] Backend: Actualizar endpoints de vendedores para guardar zona y color
    - [x] Frontend: Integrar Leaflet.draw en `vendedores.html`
    - [x] Frontend: Lógica para dibujar y guardar polígonos
    - [x] Frontend: Visualizar zonas en mapa global de clientes
    - [x] Frontend: Colorear pines de clientes según color del vendedor
