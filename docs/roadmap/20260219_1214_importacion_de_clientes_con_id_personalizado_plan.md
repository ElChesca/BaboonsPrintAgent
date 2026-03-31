# Importación de Clientes con ID Personalizado

El objetivo es permitir que el usuario importe clientes conservando sus IDs originales (históricos), en lugar de que el sistema genere nuevos IDs secuenciales.

## Schema Definitivo (Hardcoded)
Para archivos sin encabezados, el sistema asumirá OBLIGATORIAMENTE este orden de columnas:
1.  **ID**
2.  **Nombre / Razón Social**
3.  **Domicilio**
4.  **Localidad**
5.  **Zona**
6.  **Canal / Actividad**
7.  **Latitud**
8.  **Longitud**
9.  **Vendedor**
10. **Visita Domingo**
11. **Visita Lunes**
12. **Visita Martes**
13. **Visita Miércoles**
14. **Visita Jueves**
15. **Visita Viernes**
16. **Visita Sábado**

## Validación y Limpieza
- **IDs**: Se limpian caracteres no numéricos.
- **Coordenadas**: Se aceptan comas o puntos decimales.
- **Vendedores**: Se busca por ID o Nombre.
- **Días**: Se acepta "1", "Si", "True", "S".

## Revisión del Usuario Requerida
> [!WARNING]
> **Riesgo de Conflictos**: Al importar IDs manualmente, existe el riesgo de colisión con IDs existentes.
>
> **Solución**:
> 1. Si el ID importado ya existe: Se actualizará el registro existente (Merge/Upsert).
> 2. Si el ID importado NO existe: Se insertará con ese ID específico.
> 3. **Secuencias**: Tras la importación, se ajustará automáticamente la secuencia de la base de datos (`clientes_id_seq`) para evitar errores en futuras creaciones automáticas.

## Cambios Propuestos

### Backend

#### [MODIFICAR] [import_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/import_routes.py)
- Detectar columna "ID" o "Código" en el Excel.
- En la sentencia `INSERT`, incluir el campo `id` explícitamente si está presente en la fila.
- Manejar conflictos: Usar `ON CONFLICT (id) DO UPDATE` (Upsert) o lógica manual de verificación.
- Al finalizar la importación, ejecutar:
  ```sql
  SELECT setval('clientes_id_seq', (SELECT MAX(id) FROM clientes));
  ```
  Esto sincroniza el contador de autoincremento.

## Plan de Verificación

### Verificación Manual
1.  **Excel de Prueba**: Crear un Excel con una columna "ID" y un valor alto (ej. 9000).
2.  **Importar**: Subir el archivo.
3.  **Verificar**: Buscar el cliente por ID 9000.
4.  **Crear Nuevo**: Crear un cliente nuevo manualmente y verificar que obtenga el ID 9001 (o siguiente disponible) sin error de clave duplicada.
