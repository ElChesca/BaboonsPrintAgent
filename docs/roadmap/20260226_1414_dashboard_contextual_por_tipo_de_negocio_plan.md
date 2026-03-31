# Dashboard Contextual por Tipo de Negocio

## Contexto

El sistema ya tiene `appState.negocioActivoTipo` (valores: `'retail'`, `'distribuidora'`, `'consorcio'`, `'rentals'`).
El body ya recibe la clase CSS `app-distribuidora` automáticamente.

La estrategia: **un solo `dashboard.html`** con dos secciones (`#dash-generic` y `#dash-distribuidora`), controladas por `dashboard.js`.

---

## Propuestas de Cambio

### Backend

#### [MODIFY] [dashboard_routes.py](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/routes/dashboard_routes.py)

Nuevo endpoint (no reemplaza los existentes):

```
GET /api/negocios/<id>/dashboard/distribucion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
```

Retorna en **una sola llamada**:
- `kpis.facturacion`: suma de pedidos entregados en período
- `kpis.pedidos_total`: total de pedidos creados
- `kpis.pedidos_entregados`: pedidos con estado `'entregado'`
- `kpis.pedidos_pendientes`: pedidos con estado `'pendiente'` o `'preparado'`
- `kpis.rutas_completadas`: hojas de ruta con estado `'completada'`
- `kpis.clientes_visitados`: clientes únicos con al menos un pedido entregado
- `ventas_por_dia`: `[{fecha, total}]` para el gráfico de línea
- `ranking_vendedores`: `[{nombre, pedidos, total}]` top 5
- `ultimas_rutas`: `[{id, fecha, estado, vendedor}]` últimas 5

---

### Frontend — HTML

#### [MODIFY] [dashboard.html](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/dashboard.html)

Estructura:

```html
<!-- Sección Generic (retail, consorcio) -->
<div id="dash-generic"> ... contenido actual ... </div>

<!-- Sección Distribuidora -->
<div id="dash-distribuidora" style="display:none;">
  <!-- Filtros rápidos: Hoy | 7d | 30d | Este mes | Este año -->
  <!-- 6 KPI Cards en grid -->
  <!-- Gráfico de línea + Ranking Vendedores lado a lado -->
  <!-- Tabla últimas Hojas de Ruta -->
</div>
```

---

### Frontend — JS

#### [MODIFY] [dashboard.js](file:///c:/Users/usuario/Documents/MultinegocioBaboons/app/static/js/modules/dashboard.js)

- Al inicio de `inicializarLogicaDashboard()`: detectar `appState.negocioActivoTipo`
- Si es `'distribuidora'`: mostrar `#dash-distribuidora`, ocultar `#dash-generic`, cargar datos del nuevo endpoint
- Si es otro tipo: comportamiento actual (`#dash-generic`)
- Lógica de filtros rápidos (pills): Hoy / 7d / 30d / Mes / Año

## Verificación

1. Entrar con negocio **FS Distribuidora** → ver el dashboard Distribuidora
2. Entrar con otro negocio (retail) → ver el dashboard genérico (sin cambios)
3. Probar cada filtro rápido
4. Deploy: `fly deploy -c fly.toml --ha=false`
