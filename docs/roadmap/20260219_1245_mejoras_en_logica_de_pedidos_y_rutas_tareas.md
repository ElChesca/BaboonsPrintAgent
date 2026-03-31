# Mejoras en Lógica de Pedidos y Rutas

- [x] Localizar la consulta SQL problemática en el código <!-- id: 5 -->
- [x] Identificar el nombre correcto de la columna de precio <!-- id: 6 -->
- [x] Corregir la consulta SQL en el backend <!-- id: 7 -->
- [x] Verificar la corrección <!-- id: 8 -->
- [x] Localizar la línea que causa el error de tipo en `distribucion_routes.py` <!-- id: 9 -->
- [x] Corregir la multiplicación asegurando tipos compatibles (float/Decimal) <!-- id: 10 -->
- [x] Verificar la corrección de tipos <!-- id: 11 -->
- [x] Localizar el error de resta en `distribucion_routes.py` (deducción de stock) <!-- id: 12 -->
- [x] Corregir la resta asegurando tipos compatibles <!-- id: 13 -->
- [x] Verificar la corrección final <!-- id: 14 -->

## Nuevos Requerimientos (Español)

- [x] Agregar columnas "Pagado" y "Medio de Pago" a la vista de Pedidos <!-- id: 15 -->
- [x] Agregar columna "Caja" a la vista de Pedidos <!-- id: 16 -->
- [x] Restringir agregar pedidos a Hoja de Ruta si el estado no es "borrador" <!-- id: 17 -->
- [x] Verificar cambios <!-- id: 18 -->

# Búsqueda por ID en Hoja de Ruta

- [x] Habilitar búsqueda por ID en `hoja_ruta.js` <!-- id: 19 -->
- [x] Mostrar ID en las sugerencias de búsqueda <!-- id: 20 -->
- [x] Verificar cambios <!-- id: 21 -->

# Búsqueda Global de Clientes

- [x] Incluir ID en la consulta SQL de `get_clientes` <!-- id: 22 -->
- [x] Verificar cambios <!-- id: 23 -->

# Manejo de ID de Cliente Personalizado

- [ ] Analizar esquema de base de datos (`clientes.id` vs `ref_interna`) <!-- id: 24 -->
- [ ] Modificar lógica de importación para aceptar columna ID <!-- id: 25 -->
- [x] Ajustar secuencia de ID en base de datos si se importan IDs manuales <!-- id: 26 -->
- [x] Verificar cambios <!-- id: 27 -->

# Emergencia: Importación Permisiva

- [x] Eliminar validaciones estrictas en `import_routes.py` <!-- id: 28 -->
- [x] Forzar importación de filas con datos faltantes <!-- id: 29 -->
- [x] Verificar cambios <!-- id: 30 -->

# Refactorización Profesional
- [x] Refactorizar la importación de CLIENTES para que sea profesional (usar Pandas)
    - [x] Soportar archivos SIN headers (detectar y aplicar esquema posicional)
    - [x] Detectar automáticamente si es un CSV pegado en una columna de Excel
    - [x] Normalizar nombres de columnas (buscar "nombre", "cliente", etc) y soportar typos ("latidud")
    - [x] Implementar Fallback Híbrido: Si fallan los headers, usar columnas 1 y 2 por defecto (Anti-Cliente Importado X)
    - [x] Manejar IDs manuales y fallback a IDs generados si hay conflicto/error
    - [x] Guardar progresivo (commit cada 50 filas) y transacciones seguras (SAVEPOINT) <!-- id: 33 -->
