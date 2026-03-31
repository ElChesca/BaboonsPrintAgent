# Resumen de Reducción de Costos en Fly.io

He completado todas las acciones para optimizar tus recursos y reducir la factura mensual.

## Acciones Realizadas

### 1. Eliminación de "Máquinas Fantasma" (`multinegociobaboons-dev`)
- **Limpieza de Consolas**: Se destruyeron **3 máquinas fantasma** de 1GB cada una que no estaban en uso pero consumían recursos.
- **Entorno de Desarrollo**: Se eliminó la máquina principal y el volumen de desarrollo.

### 2. Optimización de Memoria (RAM)
- **Producción (`multinegociobaboons-fly`)**: Se mantiene en **1024MB (1GB)** por requerimiento del cliente.
- **MuniDigital (`munidigitalsanluis`)**: Bajamos de 1GB a **512MB**.

### 3. Configuración de Escalamiento
- Para evitar que Fly cree máquinas automáticamente (escalamiento horizontal), se configuró para que solo exista **una máquina por aplicación**.

## Estado Final de Recursos

| Aplicación | Máquinas Activas | RAM por Máquina | Volúmenes Activos |
| :--- | :--- | :--- | :--- |
| `multinegociobaboons-fly` | 1 | 1 GB | 1 GB |
| `munidigitalsanluis` | 1 | 512 MB | 2 GB (2 volúmenes de 1GB) |
| `multinegociobaboons-dev` | 0 | - | 0 |

## Verificación
He verificado con `fly machines list` que todos los cambios se aplicaron correctamente y no quedan procesos redundantes.
