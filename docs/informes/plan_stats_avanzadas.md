# Plan de Implementación - Estadísticas Avanzadas Restó

Se amplía el módulo de estadísticas de Restó con capacidades de filtrado por rango de fechas, visualización gráfica de demanda (PAX) y análisis de categorías más vendidas.

## Archivos a Modificar
1. [MODIFY] `app/routes/resto_routes.py`: Refactorizar `/stats` para aceptar parámetros `desde`/`hasta` e incluir nuevos datasets.
2. [MODIFY] `app/static/resto_stats.html`: Agregar inputs de fecha, contenedor de gráfica y sección de categorías.
3. [MODIFY] `app/static/js/modules/resto_stats.js`: Lógica de filtros, integración con Chart.js y renderizado dinámico.

## Nuevas Funcionalidades
- **Filtro Temporal**: Selectores "Desde/Hasta" con actualización instantánea.
- **Gráfico de Barras**: Visualización de comensales por día para identificar picos de demanda.
- **Análisis de Rubros**: Ranking de categorías (ej: Cocina, Bar, Cafetería) para entender el mix de ventas.

## Verificación
- Seleccionar un rango de fechas (ej: última semana).
- Verificar que el gráfico muestre una barra por cada día con actividad.
- Comprobar que el ranking de productos y categorías se actualice según el rango.
