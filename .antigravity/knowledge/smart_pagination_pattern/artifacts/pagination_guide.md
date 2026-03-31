# Patrón de Paginación Inteligente "Baboons"

Este patrón se utiliza para manejar grandes volúmenes de datos en tablas (Pedidos, Hoja de Ruta), integrando controles de navegación en el frontend con parámetros de `LIMIT` y `OFFSET` en el backend.

## 🟢 Backend (Flask/Python)

El endpoint del API debe aceptar los parámetros `limit` y `offset`, y retornar tanto el subconjunto de datos como el **conteo total** de registros (considerando los mismos filtros).

### Ejemplo de Implementación:
```python
def get_items(current_user, negocio_id):
    limit = request.args.get('limit')
    offset = request.args.get('offset')
    
    # 1. Base query para contar TOTAL (con filtros, sin limit/offset)
    count_query = "SELECT COUNT(*) as total FROM items WHERE negocio_id = %s"
    
    # 2. Base query para DATOS
    query = "SELECT * FROM items WHERE negocio_id = %s"
    
    # ... aplicar filtros personalizados al query y filter_params ...

    # Ejecutar conteo total
    db.execute(count_query + filter_sql, tuple(params + filter_params))
    total_count = db.fetchone()['total']
    
    # Aplicar orden y paginación
    query += filter_sql + " ORDER BY id DESC"
    if limit and offset:
        query += " LIMIT %s OFFSET %s"
        filter_params.extend([int(limit), int(offset)])
    
    db.execute(query, tuple(params + filter_params))
    rows = db.fetchall()
    
    return jsonify({
        'items': [dict(r) for r in rows],
        'total': total_count
    })
```

## 🔵 Frontend UI (HTML/Bootstrap)

Se utiliza un contenedor después de la tabla con el ID `paginacion-[modulo]`, que incluye botones "Anterior", "Siguiente" y un label del estado actual.

```html
<div id="paginacion-items" class="d-flex justify-content-between align-items-center mt-3">
    <button class="btn btn-sm btn-outline-secondary px-3" onclick="cambiarPagina( -1)" id="btn-prev-items">
        <i class="fas fa-chevron-left me-1"></i> Anterior
    </button>
    <span id="label-pagina-items" class="small fw-bold text-muted text-uppercase">Página 1</span>
    <button class="btn btn-sm btn-outline-secondary px-3" onclick="cambiarPagina( 1)" id="btn-next-items">
        Siguiente <i class="fas fa-chevron-right ms-1"></i>
    </button>
</div>
```

## 🟡 Frontend Logic (JavaScript)

Se definen variables de estado para la página actual y el tamaño por página.

### Ejemplo de Control en JS:
```javascript
let paginaActual = 0;
const POR_PAGINA = 50;

async function cargarItems(resetPaging = false) {
    if (resetPaging) paginaActual = 0;

    const url = `/api/items?limit=${POR_PAGINA}&offset=${paginaActual * POR_PAGINA}`;
    const res = await fetchData(url);
    
    renderTable(res.items);
    actualizarPaginacion(res.total);
}

function actualizarPaginacion(totalItems) {
    document.getElementById('label-pagina-items').textContent = `Página ${paginaActual + 1}`;
    document.getElementById('btn-prev-items').disabled = (paginaActual === 0);
    document.getElementById('btn-next-items').disabled = (paginaActual >= Math.ceil(totalItems / POR_PAGINA) - 1);
}

function cambiarPagina(delta) {
    paginaActual += delta;
    cargarItems(false);
}
```

## 🔴 Consideraciones de Negocio
- Los filtros (fecha, estado, buscador) deben **RESETEAR** la página a 0 (`resetPaging = true`).
- En módulos de estadísticas o reportes (como Consolidado de Pedidos), se recomienda **NO paginar** para asegurar el cálculo total, o utilizar un valor de `limit` muy alto (ej: 10,000).
