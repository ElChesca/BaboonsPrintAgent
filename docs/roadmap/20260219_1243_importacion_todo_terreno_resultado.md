# Importación "Todo Terreno"

Se han eliminado todas las restricciones estrictas del importador de clientes para asegurar que **todos** los datos del Excel sean procesados, independientemente de errores de formato menores.

## Cambios Realizados

1.  **Refactorización Professional (Pandas)**: Se reemplazó el motor de lectura manual por **Pandas**, una librería de análisis de datos estándar en la industria.
2.  **Auto-detect CSV en Excel**: El sistema examina el archivo; si ve que es un CSV pegado en una columna de Excel, lo reestructura automáticamente.
3.  **Mapeo Inteligente**: No importa el orden de las columnas. El sistema busca palabras clave (`Nombre`, `Cliente`, `Dirección`, `Domicilio`, etc.) para entender qué es cada columna.
4.  **Guardado Progresivo y Seguro**:
    - **Aislamiento**: Cada fila es una transacción independiente. Si una falla, las demás siguen.
    - **Batching**: Se guardan cambios en la base de datos cada 50 filas para prevenir pérdidas por cortes de internet.
5.  **Detección de Encabezados**: Si el archivo no tiene títulos (ej: empieza directo con datos), el sistema lo detecta y asume el orden estándar de columnas automáticamente, evitando nombres como "Cliente Importado X".
6.  **IDs Gigantes (Fallback)**: Si un ID manual es demasiado grande, se genera uno nuevo y se guarda el original en `Referencia Interna`.
7.  ** Validación de Estructura**: Si el archivo tiene menos de 2 columnas (ej: una lista de compras o texto plano), el sistema **rechaza el archivo** en lugar de intentar importarlo como clientes "fantasma".
8.  **Estrategia Híbrida de Rescate (Antibalas)**: Si el sistema detecta encabezados pero por alguna razón (espacios, caracteres invisibles, sinónimos raros) no encuentra la columna "Nombre" o "ID":
    - **Fuerza Bruta Inteligente**: Automáticamente toma la **Columna 1 como ID** y la **Columna 2 como Nombre**.
    - **Resultado**: Nunca más "Cliente Importado X" si los datos están ahí. Si hay texto en la segunda columna, ese será el nombre. garantizado.

## Resultado Esperado
El sistema debería procesar todo el archivo Excel y cargar o actualizar la mayor cantidad de clientes posible, sin detenerse por detalles técnicos ni errores de base de datos en filas individuales. Los clientes con IDs problemáticos se importarán con un ID nuevo y una nota de referencia.
