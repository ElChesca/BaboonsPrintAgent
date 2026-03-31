# Reglas Globales y Contexto para Agentes IA (MultinegocioBaboons)

> [!CAUTION]
> ESTAS REGLAS SON DE CUMPLIMIENTO OBLIGATORIO Y ESTRICTO. Su violación romperá la arquitectura del proyecto. Deben aplicarse a cada plan, modificación o refactorización.

## 1. Protocolo de Trabajo Obligatorio
Antes y después de codificar, el Agente debe cumplir este ciclo:
1. **`implementation_plan.md`**: Antes de modificar código, generar un plan de implementación detallado. Debe incluir los archivos a modificar (`[MODIFY]`, `[NEW]`, `[DELETE]`) y un bloque `mermaid` con el diagrama del flujo propuesto. Esperar aprobación del usuario.
2. **`walkthrough.md`**: Al finalizar, entregar un documento con los cambios exactos implementados y los pasos de **Verificación Manual** que el usuario debe seguir en la interfaz.

## 2. Arquitectura de Entornos y Persistencia
- **Producción (`APP_ENV=production`)**: Fly.io (`multinegociobaboons-fly`), Postgres en Neon, volumen en `/app/app/static/img/premios`.
- **ID de Negocio**: En backend, obtener de `g.negocio_id`. En frontend, de `appState.negocioActivoId`.
- **Registro de Módulos**: Todo nuevo módulo DEBE registrarse en `app/routes/admin_routes.py` (dentro de las listas `default_distri`/`default_retail`) y en el switch de `inicializarModulo` en `main.js`.
- **Desarrollo (`APP_ENV=development`)**: Fly.io (`multinegociobaboons-dev`), SQLite local, volumen `/data`. Ruta DB: `/data/inventario.db`.
- **REGLA DE EJECUCIÓN DB**: El Agente **NUNCA** debe ejecutar scripts SQL directamente en Producción o Desarrollo. Todo cambio en la DB debe proveerse como un script SQL para que el usuario lo ejecute manualmente, acompañado siempre de su respectivo script de `rollback`.

## 3. Reglas de Base de Datos y Migraciones SQL
> **⚠️ EJECUCIÓN OBLIGATORIA:** Siempre que el usuario solicite crear, alterar o eliminar tablas/columnas en la base de datos, el Agente **DEBE** invocar y seguir las instrucciones de la skill definida en `.antigravity/skills/crear_migracion.md`.

Todas las modificaciones a la estructura de la base de datos deben crearse en la carpeta `/migrations` siguiendo estrictamente estos lineamientos (detallados a fondo en la skill):
- **Idempotencia**: Usar SIEMPRE `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, y `CREATE INDEX IF NOT EXISTS`.
- **Tipos Estándar**: Usar `SERIAL PRIMARY KEY` para IDs, y `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` para auditorías de fecha.
- **Documentación**: Utilizar sentencias `COMMENT ON COLUMN table.column IS '...';`.
- **Sintaxis Exclusiva**: 
  - **NUNCA** utilizar la palabra reservada `AS` para definir alias de tablas en las sentencias `FROM` o `JOIN`.
  - **SIEMPRE** utilizar la función nativa `NULLIF(TRIM(campo), '')` para manejar cadenas vacías o evaluar condiciones de nulidad, garantizando la compatibilidad entre SQLite y PostgreSQL.
- **Rollback**: Todo script SQL generado debe incluir inmediatamente su contraparte de reversión (Rollback).

## 4. Frontend y Estilos (UI/UX)
- **CSS Global**: NO crear CSS inline ni reinventar clases. Todo está centralizado en `global.css`. El agente DEBE leer este archivo antes de maquetar.
- **Modales**: Usar EXCLUSIVAMENTE la estructura `baboons-modal`, `baboons-modal-content`, `baboons-modal-header` y `modal-body`. Prohibido usar clases genéricas de Bootstrap (`.modal`).
- **Tablas y Botones**: Utilizar estrictamente las clases `.tabla-bonita` o `.table`. Para botones, usar `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`.

## 5. Gestión de Documentación y Artefactos (MkDocs)
> [!IMPORTANT]
> Para mantener la transparencia y organización, el Agente debe sincronizar sus artefactos internos con la documentación pública del proyecto.

- **Ubicación Interna**: Los archivos originales (`task.md`, `implementation_plan.md`, `walkthrough.md`) residen en el sistema interno del Agente (`~/.gemini/antigravity/brain/<id_conversacion>/`).
- **Sincronización Obligatoria**: Al finalizar cada tarea exitosa, el Agente **DEBE** copiar sus artefactos a la carpeta `docs/` del proyecto siguiendo este mapeo:
  - `implementation_plan.md` -> `docs/informes/plan_<nombre_corto_tarea>.md`
  - `walkthrough.md` -> `docs/pruebas/resultado_<nombre_corto_tarea>.md`
  - Otros reportes o logs -> `docs/pruebas/` o `docs/otros/`.
- **Convención de Nombres**: Usar nombres descriptivos en minúsculas sustituyendo espacios por guiones bajos. Ejemplo: `plan_fix_login_error.md`.
- **Actualización de nav**: Si se crea una categoría nueva, el Agente debe sugerir o realizar la actualización en `mkdocs.yml`.