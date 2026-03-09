# MultinegocioBaboons

Plataforma de gestión multi-negocio para Retail, Consorcios, Distribución y Eventos.

---

> [!CAUTION]
> ### 🚩 IMPORTANTE: LÉAME PRIMERO
> Antes de realizar cualquier despliegue, modificación en el flujo de base de datos o cambios en Fly.io, es **OBLIGATORIO** leer el archivo:
> ## 📄 [ARQUITECTURA_ENTORNOS.md](./ARQUITECTURA_ENTORNOS.md)
> Este archivo contiene las reglas críticas para no romper la persistencia de datos en el entorno de Desarrollo (SQLite) y Producción (Postgres).

---

## Módulos Principales
- **Retail**: Punto de venta, inventario y gestión de facturación.
- **Distribución**: Gestión de vendedores y Hojas de Ruta (reparto).
- **Consorcio**: Gestión de unidades, expensas y noticias.
- **Eventos**: Sistema de inscripciones y gestión de ferias.

## Stack Técnico
- **Backend**: Python (Flask)
- **Frontend**: HTML5, Vanilla JS, CSS3
- **Infraestructura**: Fly.io
- **Base de Datos**: PostgreSQL (Producción) / SQLite (Desarrollo)

---

## 🤖 Guía Obligatoria para Agentes IA
Para mantener la calidad y claridad en cada nueva funcionalidad o modificación importante, **todo Asistente o Agente IA** que trabaje en este repositorio debe cumplir estrictamente con los siguientes pasos:

1. **Implementation Plan (`implementation_plan.md`)**:
   - Antes de codificar, siempre generar y presentar un plan de implementación detallado.
   - Detallar claramente los archivos a modificar usando tags como `[MODIFY]`, `[NEW]`, o `[DELETE]`.
   - **Obligatorio**: Incluir un bloque de código `mermaid` con un **Flujo Completo (Diagrama)** visualizando la arquitectura o el flujo de la funcionalidad propuesta.

2. **Walkthrough y Pruebas (`walkthrough.md`)**:
   - Al finalizar, entregar un documento de recorrido (*Walkthrough*).
   - Detallar los cambios exactos implementados.
   - **Obligatorio**: Proporcionar pasos precisos para **Comprobaciones y Verificaciones** (pruebas manuales que el usuario humano debe seguir en la interfaz para confirmar que la funcionalidad es correcta).

3. **Frontend y Estilos (`global.css`)**:
   - **NO crear CSS inline ni reinventar clases de estilos**. El proyecto tiene un `global.css` centralizado.
   - **Modales**: USAR SIEMPRE la estructura `baboons-modal`, `baboons-modal-content`, `baboons-modal-header` y `modal-body`. **No usar** clases genéricas tipo `.modal` o `.modal-content` de Bootstrap o viejas plantillas.
   - **Tablas**: Usar SIEMPRE las clases `.tabla-bonita` o `.table` estandarizadas en el CSS.
   - **Botones**: Usar SIEMPRE las clases estructuradas `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`.
