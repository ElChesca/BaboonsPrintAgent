# Plan de Implementación: Dashboard en Historial de Ventas

El objetivo es agregar un minidashboard visual en la parte superior del módulo de "Historial de Ventas", que muestre un resumen rápido antes de ver la tabla.

## Enfoque Técnico
La buena noticia es que **no necesitamos modificar el backend (la base de datos ni los servidores de Python)** para esto. El módulo de Historial de Ventas ya trae todos los datos necesarios. Podemos calcular las métricas directamente en el navegador (JavaScript).

### 1. Interfaz (HTML)
Voy a insertar una nueva sección de *Dashboard* justo debajo del título "Historial de Ventas" y arriba de los filtros de fecha. Esta sección contendrá:
- **Tarjetas de Métricas (KPIs):**
  - **Ingresos Totales:** La suma de todas las ventas válidas en el rango de fechas.
  - **Cantidad de Ventas:** Cuántas operaciones se hicieron.
  - **Ticket Promedio:** El ingreso total dividido por la cantidad de ventas.
- **Gráfico Visual:** Un cuadro usando `Chart.js` (la librería que ya usas en otros módulos) que mostrará una curva de las ventas a lo largo de los días seleccionados.

### 2. Lógica (JavaScript)
En `historial_ventas.js`, ajustaré la función que carga la tabla para que:
- Sume los valores para llenar las Tarjetas de Métricas.
- Agrupe las ventas por fecha.
- Dibuje o actualice el gráfico automáticamente cada vez que presiones "Filtrar".

> [!NOTE]
> Todos estos datos se basarán en los filtros de fecha que elijas. Por ejemplo, si filtras "Este mes", el dashboard mostrará los números y el gráfico de este mes.

¿Estás de acuerdo con este plan? ¿Te gustarían otras métricas (por ejemplo: el método de pago más usado) o con estas 3 tarjetas estamos bien para empezar?
