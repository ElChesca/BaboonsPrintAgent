# Arquitectura de Entornos: MultinegocioBaboons

Este documento describe la lógica de ejecución y persistencia para los entornos de producción y desarrollo, permitiendo que cualquier IA entienda cómo operar en cada uno.


## TODOS LOS DOCUMENTOS SE ESCRIBEN EN ESPAÑOL !!!!!

## 1. Entorno de Producción
- **App Fly.io**: `multinegociobaboons-fly`
- **URL**: [https://multinegociobaboons-fly.fly.dev/](https://multinegociobaboons-fly.fly.dev/)
- **Base de Datos**: PostgreSQL (Alojada en **Neon**)
- **Persistencia de Archivos**: Volumen `club_storage` montado en `/app/app/static/img/premios`.
- **Configuración (`APP_ENV`)**: `production`
- **Lógica de Conexión**: Utiliza la variable `DATABASE_URL` para conectarse a Neon.

## 2. Entorno de Desarrollo / Testing
- **App Fly.io**: `multinegociobaboons-dev`
- **URL**: [https://multinegociobaboons-dev.fly.dev/](https://multinegociobaboons-dev.fly.dev/)
- **Base de Datos**: **SQLite** (Archivo local)
- **Persistencia**: Volumen `club_storage` montado en `/data`.
- **Ruta DB**: `/data/inventario.db` (definida vía `SQLITE_DB_PATH`).
- **Configuración (`APP_ENV`)**: `development`
- **Lógica de Conexión**: Forzada a SQLite mediante `APP_ENV` para evitar tocar datos de producción aunque existan secretos de base de datos configurados.

## 3. Lógica de Código (`app/database.py`)
El sistema decide dinámicamente qué motor de base de datos utilizar:
- Si `APP_ENV == "production"` y existe `DATABASE_URL`: Usa **PostgreSQL**.
- De lo contrario: Usa **SQLite**.

> [!IMPORTANT]
> **REGLA ESTRICTA DE EJECUCIÓN:** Como IA, **NO DEBO EJECUTAR** scripts directamente en la base de datos de Producción (Neon) ni en Desarrollo (SQLite / Fly.io). 
> Si se requiere una inserción, modificación de tablas o alteración de datos, debo **PROVEER EL SCRIPT SQL O ARCHIVO PYTHON AL USUARIO** como un requerimiento para que él mismo lo ejecute manualmente.

## 4. Archivos de Configuración
- `fly.toml`: Configuración base para Producción.
- `fly.dev.toml`: Configuración específica para Desarrollo (montajes y variables).

> [!WARNING]
> En el entorno de desarrollo, el archivo `inventario.db` **DEBE** residir en `/data/` para ser persistente. Si se guarda fuera de esa carpeta, se perderá al reiniciar o redestruir la máquina (datos efímeros).

## 5. Otros Entornos Detectados
- `multinegociodev`: Entorno heredado con instancia de Postgres propia (Flex). Actualmente no es el estándar para pruebas de SQLite.
