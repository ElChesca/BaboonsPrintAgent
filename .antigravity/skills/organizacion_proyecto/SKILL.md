---
name: Project Structure and Organization
description: Guide to the standardized project structure for diagnostic tools, migrations, and patterns in MultinegocioBaboons.
---

# Skill: Organización y Estructura del Proyecto Pro

**Descripción:** Esta skill define la estructura obligatoria de carpetas para mantener el proyecto limpio y profesional. Debe ser consultada por el Agente cada vez que necesite crear un nuevo archivo de diagnóstico, validación, conocimiento o patrón.

## 📁 Árbol de Directorios Decidido (Antigravity Standard)

Toda nueva lógica "no-aplicativa" (scripts de soporte, documentación, patrones) DEBE seguir esta estructura:

### 1. Diagnóstico, Investigación y Validación
Si el archivo es un script Python para chequear datos, validar una hipótesis o investigar un bug:
- **Ubicación:** `docs/pruebas/scripts/`
- **Nomenclatura:** `check_*.py`, `investigate_*.py`, `diagnostico_*.py`.
- **Relación:** Los resultados (`.md`) de estas pruebas deben ir en `docs/pruebas/`.

### 2. Patrones y Conocimiento Descubierto
Si el archivo es una guía técnica sobre un patrón de diseño (ej: paginación, modales) o una pieza de conocimiento crítico:
- **Ubicación:** `.antigravity/knowledge/`
- **Estructura:** Seguir el formato `smart_pagination_pattern/` con `metadata.json` y `artifacts/`.

### 3. Habilidades del Agente (Skills)
Si el archivo es una instrucción operativa para la IA (con frontmatter):
- **Ubicación:** `.antigravity/skills/`

### 4. Migraciones de Base de Datos
Si el archivo es un script de cambio estructural (`UP/DOWN`):
- **Ubicación:** `/migrations/` (Estructura SQL estándar).
- **Scripts de Aplicación Python:** `scripts/migraciones/`.

### 5. Utilidades y Administración
Scripts para tareas administrativas recurrentes o utilidades generales:
- **Ubicación:** `scripts/util/`.

## 🧠 Instrucción Operativa para el Agente:

1. **Antes de crear un archivo en la raíz:** Detente y analiza si encaja en una de las categorías anteriores. **EVITA** ensuciar la raíz del proyecto.
2. **MkDocs Sincronización:** Recuerda que los `.md` en `docs/` son visibles para el usuario en el sitio web de documentación. Los `.py` en `docs/pruebas/scripts/` NO deben ser indexados por MkDocs, pero sí deben estar allí como referencia técnica del "cómo se probó".
3. **Mantenimiento:** Si una herramienta vieja en la raíz ya no es necesaria, muévela a la categoría correspondiente siguiendo este estándar.
