# Implementación FiscalIA v2.0 (Next Gen)

Este plan detalla la implementación de las funcionalidades seleccionadas por el usuario para transformar el Observatorio Fiscal en un sistema inteligente proactivo.

## Objetivos
1.  **Memoria Persistente:** Recordar conversaciones y contexto entre sesiones usando SQLite.
2.  **Alertas Proactivas:** Detectar anomalías (ej: baja recaudación) y notificar automáticamente.
3.  **Dashboards Visuales:** Generar gráficos en el chat para respuestas analíticas.

## 1. Memoria Persistente (Core)
**Objetivo:** Que FiscalIA recuerde el nombre del usuario, el CUIT que se está analizando y el contexto de la charla anterior, incluso si se reinicia el servidor.

### Cambios Propuestos
#### [MODIFY] [llm_utils.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/ia_agente/llm_utils.py)
- Reemplazar el diccionario `ACTIVE_CHATS` (RAM) por una clase `ConversationManager` basada en SQLite.
- Crear tabla `chat_history` (session_id, role, content, timestamp).
- Cargar últimos N mensajes al iniciar una nueva consulta.

#### [NEW] [ia_agente/memory.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/ia_agente/memory.py)
- Módulo dedicado para manejar la conexión a `chat.db`.
- Funciones: `save_message()`, `get_history()`, `clear_history()`.

## 2. Dashboards Visuales (Charts)
**Objetivo:** Responder preguntas como "¿Cómo viene la recaudación?" con un gráfico de barras/líneas en lugar de solo texto.

### Cambios Propuestos
#### [NEW] [ia_agente/charts.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/ia_agente/charts.py)
- Utilizar `matplotlib` (modo no interactivo) para generar imágenes PNG estáticas.
- Función `generate_chart(data, type, title)` que devuelve la ruta de la imagen generada.

#### [MODIFY] [ia_agente/tools.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/ia_agente/tools.py)
- Nueva herramienta `tool_generar_grafico(tipo, datos)` expuesta a Gemini.
- Gemini decidirá cuándo llamar a esta herramienta basándose en la pregunta del usuario.

## 3. Alertas Proactivas (Cron Jobs)
**Objetivo:** Ejecutar análisis automáticos diarios y enviar reportes si se detectan anomalías.

### Cambios Propuestos
#### [NEW] [ia_agente/scheduler.py](file:///c:/Users/usuario/Documents/MuniSL/muniDigitalSanLuis/ia_agente/scheduler.py)
- Script que corre en background (o endpoint disparado por Cron de Fly.io).
- `check_recaudacion_diaria()`: Compara recaudación de ayer vs promedio histórico.
- Si diferencia > X%, enviar mensaje a un webhook de alerta (simulado o log por ahora).

## Plan de Ejecución
1.  Implementar **Memoria Persistente** (Base estable).
2.  Implementar **Dashboards** (Impacto visual alto).
3.  Implementar **Alertas** (Valor estratégico).

## Verificación
- **Memoria:** Reiniciar servidor (`fly restart`) y preguntar "¿De qué hablábamos antes?".
- **Gráficos:** Pedir "Grafícame la recaudación de la semana pasada".
- **Alertas:** Forzar ejecución del script y verificar salida en logs.
