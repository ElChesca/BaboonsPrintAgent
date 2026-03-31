# Plan de Organización de Documentación

Este plan establece las reglas para que los agentes de IA (como Antigravity) organicen automáticamente los planes de implementación, walkthroughs y otros documentos generados en la estructura de MkDocs del proyecto.

## Cambios Propuestos

### Reglas del Proyecto

#### [MODIFY] [rules.md](file:///c:/Users/usuario/Documents/MultinegocioBaboons/.antigravity/rules.md)
- Añadir la **Regla 5: Gestión de Documentación y Artefactos**.
- Especificar que los agentes deben depositar copias de sus planes y resultados en la carpeta `docs/`.
- Definir la convención de nombres y carpetas de destino basadas en la configuración de `mkdocs.yml`.

### Acción Inmediata
- Localizar los artefactos de sesiones anteriores y de esta sesión.
- Copiar el `implementation_plan.md` y `walkthrough.md` de esta sesión a `docs/informes/` y `docs/pruebas/` respectivamente como demostración.

## Plan de Verificación

### Verificación Manual
1. Abrir `.antigravity/rules.md` y confirmar que la nueva regla es legible.
2. Ejecutar `mkdocs serve` (ya está corriendo según la metadata) y verificar en el navegador que los nuevos documentos aparecen en la navegación lateral.
3. Confirmar con el usuario si la ubicación de los archivos anteriores es clara (se le indicará la ruta del "brain").
