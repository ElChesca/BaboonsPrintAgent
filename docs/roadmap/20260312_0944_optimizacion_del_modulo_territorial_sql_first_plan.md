# Optimización del Módulo Territorial (SQL-First)

El objetivo es eliminar los errores 502 y problemas de memoria causados por cargar 67k filas en memoria en cada petición de la API. Se seguirá la sugerencia del usuario de no cargar todo el padrón simultáneamente.

## Proposed Changes

### [Módulo Territorial]

#### [MODIFY] [routes.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/territorial/routes.py)

1.  **Eliminar Carga Global**: Eliminar el uso de `_get_padron_df()` y `load_df('padron_territorial')` en endpoints que solo requieren estadísticas.
2.  **`api_stats`**: Reescribir para usar consultas SQL `COUNT` y `SUM`.
3.  **`api_matriz`**: Reescribir para usar `GROUP BY` en SQL, trayendo solo el resumen por barrio.
4.  **`api_auditoria_anomalias`**: Filtrar en SQL directamente los casos de "Falso Baldío" (es_baldio=1 AND tiene_medidor=1) y "Posible Clandestino".
5.  **`api_detalle_barrio`**: Modificar para que la consulta SQL incluya el `WHERE barrio = ?` en lugar de filtrar el DataFrame completo.
6.  **`api_ficha_padron`**: Asegurar que solo busque una fila por partida en SQL.

### [Base de Datos]

#### [MODIFY] [db.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/routes/db.py)

- Agregar una función helper `query_db(sql, params)` para ejecutar consultas SQL personalizadas y devolver DataFrames o listas de diccionarios de forma eficiente.

## Verification Plan

### Automated Tests
1.  **Pruebas de Conectividad**: Ejecutar `Invoke-WebRequest` contra los endpoints optimizados para verificar que devuelven el mismo JSON pero mucho más rápido.
2.  **Logs de Memoria**: Verificar vía `fly status` que el uso de RAM no se dispara al abrir el tablero.

### Manual Verification
1.  Entrar al Tablero Territorial y verificar que los KPIs cargan instantáneamente.
2.  Verificar que el ranking de barrios y la matriz de servicios muestran los mismos datos que antes.
3.  Probar el buscador de anomalías.
