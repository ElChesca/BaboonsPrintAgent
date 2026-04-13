# Baboons Stats Reports: Guía de Estilo y Funcionalidad 🚀

Esta documentación define el estándar visual y funcional para la nueva generación de reportes analíticos de Baboons ERP. El objetivo es mantener una experiencia de usuario **Premium, Clara y Altamente Analítica** en todos los módulos.

## 1. Filosofía de Diseño: "Premium Clear"
Buscamos que el usuario se sienta en control de sus datos mediante una interfaz que no solo presenta números, sino que cuenta una historia visual.

- **Minimalismo con Propósito**: Eliminar el ruido visual. Si un dato no ayuda a tomar una decisión, es ruido.
- **Jerarquía Visual**: Los KPIs más importantes siempre van arriba y en tarjetas destacadas.
- **Feedback Inmediato**: Cada acción de filtrado debe tener una respuesta visual (spinners, animaciones sutiles).

---

## 2. Paleta de Colores y Tipografía
### Colores Core
- **Primario**: Indigo/Violeta (`#4f46e5`, `#7c3aed`) - Usado para acentos, botones principales y "Gasto/Venta".
- **Éxito**: Emerald (`#10b981`) - Usado para ganancias, rentabilidad positiva y estados "Pagado".
- **Peligro**: Coral/Red (`#ef4444`) - Usado para deudas, mermas o indicadores críticos.
- **Fondos**: Slate/Gray (`#f8fafc`, `#f1f5f9`) - Fondos limpios para resaltar las tarjetas blancas.

### Tipografía
- Se utiliza **Inter** o **Roboto** como fuente principal.
- Títulos en **Bold (700)**.
- Etiquetas de KPI en **Semi-bold (600)** y en **Uppercase** con `tracking-wider`.

---

## 3. Componentes Estándar UI

### 📇 KPI Premium Card
Diseñada para dar una visión rápida del pulso del negocio.
- **Estructura**: Icono en cabecera, Etiqueta descriptiva, Valor principal (grande) y Tendencia (opcional).
- **Styling**: Bordes redondeados (`20px`), sombras sutiles (`0 10px 15px -3px rgba(0,0,0,0.1)`).
- **Variantes**: 
  - *Sólidas*: Para métricas de alto impacto (Ej. Ventas Totales).
  - *Minimalistas*: Fondo blanco con bordes ligeros para métricas secundarias.

### 📈 Gráficos (Chart.js)
Los gráficos no son solo decorativos; deben ser interactivos.
- **Líneas**: Para evolución temporal (Evolución de costos, ventas diarias).
- **Barras**: Para comparativas (Top productos, ranking de mozos).
- **Interaction Mode**: Debe estar seteado en `index` e `intersect: false` para mostrar tooltips combinados.

### 🔍 Filtros "On-Demand"
Para optimizar la performance, los reportes pesados cargan bajo demanda.
- **Barra de Filtros**: Diseño flotante con selectores limpios y sin bordes.
- **Botón de Acción**: Usar la clase `btn-icon-premium` con iconos de FontAwesome.

---

## 4. Patrones de Funcionalidad
Cualquier nuevo reporte debe seguir estos 3 pilares:

1.  **Carga Paralela**: Las estadísticas rápidas (stats) se cargan primero e independientemente del listado detallado (historial).
2.  **Traceabilidad Dinámica**: Al seleccionar un filtro (ej. Proveedor o Categoría), el dashboard debe mutar para mostrar análisis específicos de esa selección (ej. el gráfico de evolución de costos).
3.  **Exportación PDF de Alta Fidelidad**: Usar `jsPDF` con estilos personalizados que repliquen la estética de la marca (logo, fuentes helvéticas, tablas limpias).

---

## 5. Implementación Técnica Requerida
- **CSS**: Utilizar variables globales y clases reutilizables definidas en `global.css`.
- **JS**: Modularizar la lógica en archivos dentro de `static/js/modules/`.
- **Backend**: Los endpoints de estadísticas deben estar centralizados en rutas dedicadas (ej. `/stats`) para evitar sobrecargar los endpoints de consulta de datos crudos.

---

> [!TIP]
> **Regla de Oro**: Si el usuario abre el reporte y no puede entender el estado de su negocio en menos de 5 segundos, el reporte necesita ser rediseñado.
