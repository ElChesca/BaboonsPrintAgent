# Skill: Crear Migración SQL

**Descripción:** Genera un script de migración SQL seguro y su respectivo script de rollback para MultinegocioBaboons, respetando estrictamente la sintaxis requerida.

**Gatillo / Trigger:** `@crear_migracion`

## Instrucciones de Ejecución para el Agente:

Cuando el usuario invoque esta skill, DEBES seguir estos pasos secuenciales sin desviarte:

1. **Recolección de Datos:**
   - Pregunta al usuario qué tabla o entidad desea crear o modificar, y qué campos necesita.
   - Espera la respuesta del usuario antes de generar el código.

2. **Generación de la Migración (UP):**
   - Escribe el código SQL para la migración.
   - **Regla de Idempotencia:** Usa SIEMPRE `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, o `CREATE INDEX IF NOT EXISTS`.
   - **Reglas de Sintaxis ESTRICTAS (CRÍTICO):**
     - **NUNCA** utilices la palabra reservada `AS` para definir alias de tablas en las sentencias `FROM` o `JOIN`. (Ejemplo correcto: `SELECT * FROM tabla t`).
     - **SIEMPRE** utiliza la función `to_null()` para evaluar o manejar campos vacíos.
   - **Tipos de Datos y Estándares:** - IDs deben ser `SERIAL PRIMARY KEY`.
     - Fechas de auditoría deben ser `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
   - **Documentación de Base de Datos:** Agrega sentencias `COMMENT ON COLUMN` para cada campo que represente un estado, rol o tenga una lógica de negocio específica.

3. **Generación del Rollback (DOWN):**
   - Inmediatamente después del script UP, genera el script SQL inverso (Rollback) para deshacer exactamente los cambios propuestos (ej. `DROP TABLE IF EXISTS`, `ALTER TABLE ... DROP COLUMN`).

4. **Entrega Final:**
   - Presenta ambos scripts (UP y DOWN) claramente separados.
   - Recuerda al usuario que NO debes ejecutar esto directamente en Producción o Desarrollo, sino que él debe correr los scripts de forma manual.